import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import { 
  ArrowLeft,
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  TrendingUp,
  TrendingDown,
  Heart,
  Share2,
  Eye,
  Scale,
  Send,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  fetchSavedProperties,
  createSavedProperty,
  deleteSavedProperty,
  SavePropertyPayload,
} from '../../api/savedProperties';
import { addToCompare } from '../../lib/compare';
import { sendInquiry } from '../../api/inquiries';
import { propertyGallery } from '../../lib/propertyImages';
import { propertyReadings } from '../../lib/marketMeaning';
import { MeaningPanel } from '../../components/ui/MeaningPanel';

import {
  fetchPublicProperty,
  fetchPublicListings,
  fetchMarketTrends,
  propertyTypeLabel,
  type PublicPropertyDetail,
} from '../../api/publicData';

const getPropertyDetails = async (id: string): Promise<PropertyDetails> => {
  const property = await fetchPublicProperty(id);
  const listing = property.listing;
  const isRent = listing?.listingType === 'rent' && listing.monthlyRent != null;
  const price = isRent ? (listing?.monthlyRent ?? null) : (listing?.price ?? null);
  const area = property.sizeSqm != null ? Number(property.sizeSqm) : null;

  const metricValue = (metric?: { status: string; value: number | null }) =>
    metric && metric.status === 'available' ? metric.value : null;

  const neighborhoodAvgPerSqm = metricValue(property.neighborhoodMarket?.sale.medianPricePerSqm);
  const neighborhoodMedianPrice = metricValue(property.neighborhoodMarket?.sale.medianAskingPrice);
  const neighborhoodMedianRent = metricValue(property.neighborhoodMarket?.rent.medianMonthlyRent);

  const pricePerSqm = !isRent && price != null && area ? price / area : null;
  const marketValueDifference =
    !isRent && price != null && neighborhoodMedianPrice
      ? ((price - neighborhoodMedianPrice) / neighborhoodMedianPrice) * 100
      : null;
  const rentalYield =
    price != null && neighborhoodMedianRent
      ? ((neighborhoodMedianRent * 12) / price) * 100
      : null;

  return {
    id: property.propertyId,
    title: property.title,
    price: price ?? 0,
    neighborhood: property.neighborhood?.name ?? 'Unassigned',
    neighborhoodSlug: property.neighborhood?.slug ?? null,
    type: propertyTypeLabel(property.propertyType),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area,
    images: propertyGallery(
      {
        id: property.propertyId,
        title: property.title,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
      },
      property.images,
    ).map((image) => image.imageUrl),
    description: property.description ?? 'No description provided for this listing.',
    yearBuilt: null,
    status: isRent ? 'for_rent' : 'for_sale',
    pricePerSqm,
    estimatedValue: !isRent ? neighborhoodMedianPrice : null,
    marketValueDifference,
    rentalYield,
    condition: property.condition
      ? property.condition.charAt(0) + property.condition.slice(1).toLowerCase().replace(/_/g, ' ')
      : 'Not recorded',
    features: [],
    owner: null,
    views: listing?.viewCount ?? 0,
    rating: null,
    neighborhoodAvgPerSqm,
    propertyType: property.propertyType,
  };
};

const getComparableProperties = async (id: string): Promise<ComparableProperty[]> => {
  const property: PublicPropertyDetail = await fetchPublicProperty(id);
  if (!property.neighborhood) return [];
  const { listings } = await fetchPublicListings({
    neighborhood: property.neighborhood.slug,
    propertyType: property.propertyType,
    limit: 30,
  });

  return listings
    .filter(
      (listing) =>
        listing.propertyId !== property.propertyId &&
        listing.price != null &&
        listing.listingType !== 'rent',
    )
    .slice(0, 5)
    .map((listing) => ({
      id: listing.propertyId,
      title: listing.title,
      price: Number(listing.price),
      area: listing.sizeSqm != null ? Number(listing.sizeSqm) : 0,
      bedrooms: listing.bedrooms,
      distance: listing.neighborhood ?? '—',
      pricePerSqm:
        listing.sizeSqm && listing.price ? Number(listing.price) / Number(listing.sizeSqm) : 0,
    }));
};

const getNeighborhoodPriceGrowth = async () => {
  const trends = await fetchMarketTrends(12);
  return trends.comparison.priceChangePct;
};

interface ComparableProperty {
  id: string;
  title: string;
  price: number;
  area: number;
  bedrooms: number;
  distance: string;
  pricePerSqm: number;
}

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#1e293b"/><text x="400" y="305" font-family="sans-serif" font-size="24" fill="#64748b" text-anchor="middle">No photos for this listing</text></svg>',
  );

interface PropertyDetails {
  id: string;
  title: string;
  price: number;
  neighborhood: string;
  neighborhoodSlug: string | null;
  type: string;
  bedrooms: number;
  bathrooms: number;
  area: number | null;
  images: string[];
  description: string;
  yearBuilt: number | null;
  status: 'for_sale' | 'for_rent';
  pricePerSqm: number | null;
  estimatedValue: number | null;
  marketValueDifference: number | null;
  rentalYield?: number | null;
  condition: string;
  features: string[];
  owner: {
    name: string;
    phone: string;
    email: string;
  } | null;
  views: number;
  rating: number | null;
  neighborhoodAvgPerSqm: number | null;
  propertyType: string;
}

export default function PropertyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [shareLabel, setShareLabel] = useState('Share');
  const queryClient = useQueryClient();

  // Saved state comes from the API so the heart matches what's actually saved.
  const { data: savedProperties } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: fetchSavedProperties,
  });
  const isFavorite = id != null && (savedProperties ?? []).some((s) => s.propertyId === id);

  const savePropertyMutation = useMutation({
    mutationFn: (payload: SavePropertyPayload) => createSavedProperty(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const unsavePropertyMutation = useMutation({
    mutationFn: (propertyId: string) => deleteSavedProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const { data: property, isLoading } = useQuery({
    queryKey: ['property-details', id],
    queryFn: () => getPropertyDetails(id!),
  });

  // Messaging the listing owner: one short note per send, no thread model.
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiry, setInquiry] = useState('');
  const [inquiryError, setInquiryError] = useState('');
  const [inquirySent, setInquirySent] = useState(false);

  const sendInquiryMutation = useMutation({
    mutationFn: sendInquiry,
    onSuccess: () => {
      setInquiryOpen(false);
      setInquiry('');
      setInquiryError('');
      setInquirySent(true);
    },
    onError: (mutationError) => {
      setInquiryError(mutationError instanceof Error ? mutationError.message : 'Could not send your message.');
    },
  });

  const { data: comparables } = useQuery({
    queryKey: ['comparable-properties', id],
    queryFn: () => getComparableProperties(id!),
    enabled: !!id,
  });

  const { data: priceGrowth } = useQuery({
    queryKey: ['neighborhood-price-growth'],
    queryFn: getNeighborhoodPriceGrowth,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white font-semibold">Property not found</p>
          <p className="text-sm text-gray-400 mt-1">
            This listing may have been removed or is no longer public.
          </p>
          <Link to="/app/properties" className="mt-4 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm text-white">
            Back to properties
          </Link>
        </div>
      </div>
    );
  }

  const handleToggleSave = () => {
    if (isFavorite) {
      unsavePropertyMutation.mutate(property.id);
    } else {
      savePropertyMutation.mutate({
        propertyId: property.id,
        title: property.title,
        neighborhood: property.neighborhood,
        image: property.images?.[0] ?? '',
        price: property.price,
        size: property.area,
        beds: property.bedrooms,
        baths: property.bathrooms,
      });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: property.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareLabel('Link copied');
      window.setTimeout(() => setShareLabel('Share'), 2000);
    } catch {
      setShareLabel('Copy failed');
      window.setTimeout(() => setShareLabel('Share'), 2000);
    }
  };

  const handleSendInquiry = () => {
    if (inquiry.trim().length < 5) {
      setInquiryError('Write at least a short message before sending.');
      return;
    }
    sendInquiryMutation.mutate({ propertyId: property.id, message: inquiry.trim() });
  };

  const handleCompare = () => {
    addToCompare({
      id: property.id,
      title: property.title,
      location: 'Addis Ababa',
      neighborhood: property.neighborhood,
      price: property.price,
      pricePerSqm: property.pricePerSqm ?? 0,
      size: property.area ?? 0,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      rentalYield: property.rentalYield ?? 0,
      marketValue: property.estimatedValue ?? property.price,
      image: property.images?.[0] ?? '',
    });
    navigate('/app/compare');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link 
          to="/app/properties"
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Properties
        </Link>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSave}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5"
            title={isFavorite ? 'Remove from saved' : 'Save property'}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
            {isFavorite ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={handleCompare}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5"
            title="Add to compare"
          >
            <Scale className="w-4 h-4" />
            Compare
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5"
            title="Copy a link to this property"
          >
            <Share2 className="w-4 h-4" />
            {shareLabel}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Images and Description */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden">
              <img
                src={property.images[selectedImage] ?? PLACEHOLDER_IMAGE}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {property.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImage === index ? 'border-slate-900' : 'border-white/10'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${property.title} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Description</h3>
            <p className="text-gray-400 leading-relaxed">{property.description}</p>
          </div>

          {/* Features — only when the listing actually records some. */}
          {property.features.length > 0 && (
            <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Features & Amenities</h3>
              <div className="grid grid-cols-2 gap-3">
                {property.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparable Properties — hidden entirely when none are recorded. */}
          {comparables && comparables.length > 0 && (
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Comparable Properties</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 text-sm font-medium text-gray-400">Property</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-400">Price</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-400">Area</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-400">Price/sqm</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-400">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((comp) => (
                    <tr key={comp.id} className="border-b border-slate-100">
                      <td className="py-3">
                        <Link 
                          to={`/app/properties/${comp.id}`}
                          className="font-medium text-white hover:text-gray-400"
                        >
                          {comp.title}
                        </Link>
                      </td>
                      <td className="py-3 text-right text-white">
                        ETB {comp.price.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-gray-400">
                        {comp.area} sqm
                      </td>
                      <td className="py-3 text-right text-gray-400">
                        ETB {comp.pricePerSqm.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-gray-400">
                        {comp.distance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>

        {/* Right Column - Property Info and Contact */}
        <div className="space-y-6">
          {/* Property Overview */}
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">{property.title}</h1>
                <div className="flex items-center gap-2 text-gray-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span>{property.neighborhood}, Addis Ababa</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {property.views.toLocaleString()} views
                  </div>
                </div>
              </div>
              
              <span className={`px-3 py-1 text-sm font-medium rounded-md ${
                property.status === 'for_sale' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {property.status === 'for_sale' ? 'For Sale' : 'For Rent'}
              </span>
            </div>

            <div className="text-3xl font-bold text-white mb-4">
              ETB {property.price.toLocaleString()}
              {property.status === 'for_rent' && <span className="text-lg font-normal text-gray-400">/month</span>}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Bed className="w-4 h-4" />
                  <span className="text-sm">Bedrooms</span>
                </div>
                <div className="font-semibold text-white">{property.bedrooms}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Bath className="w-4 h-4" />
                  <span className="text-sm">Bathrooms</span>
                </div>
                <div className="font-semibold text-white">{property.bathrooms}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Square className="w-4 h-4" />
                  <span className="text-sm">Area</span>
                </div>
                <div className="font-semibold text-white">
                  {property.area != null ? `${property.area} sqm` : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Property Type:</span>
                <span className="text-white">{property.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Condition:</span>
                <span className="text-white">{property.condition}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price per sqm:</span>
                <span className="text-white">
                  {property.pricePerSqm != null ? `ETB ${Math.round(property.pricePerSqm).toLocaleString()}` : '—'}
                </span>
              </div>
              {property.rentalYield != null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Rental Yield:</span>
                  <span className="text-white">{property.rentalYield}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Price Analysis */}
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Price Analysis</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Asking Price:</span>
                <span className="text-white font-semibold">ETB {property.price.toLocaleString()}</span>
              </div>
              
              {property.estimatedValue != null && property.marketValueDifference != null ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Neighborhood Median Price:</span>
                    <span className="text-white font-semibold">
                      ETB {Math.round(property.estimatedValue).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Difference:</span>
                    <div className={`flex items-center gap-1 font-semibold ${
                      property.marketValueDifference > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {property.marketValueDifference > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {property.marketValueDifference > 0 ? '+' : ''}{property.marketValueDifference.toFixed(1)}%
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg text-sm ${
                    Math.abs(property.marketValueDifference) <= 5
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : property.marketValueDifference > 5
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                    {Math.abs(property.marketValueDifference) <= 5
                      ? '✓ Priced at market value'
                      : property.marketValueDifference > 5
                      ? '⚠ Above market value'
                      : '💰 Below market value'
                    }
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Contact Owner — the message is delivered to the listing owner. */}
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Contact Owner</h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Ask about availability, arrange a viewing, or request more photos. The owner sees
                your message and profile in their inquiries inbox.
              </p>

              {inquirySent && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  Your message was sent to the owner.
                </div>
              )}

              <button
                onClick={() => {
                  setInquiryOpen(true);
                  setInquiryError('');
                  setInquirySent(false);
                }}
                className="w-full py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Send Message
              </button>
            </div>
          </div>

          {/* Investment Indicators — only when a figure actually exists. */}
          {property.status === 'for_sale' &&
            (priceGrowth != null ||
              property.neighborhoodAvgPerSqm != null ||
              property.marketValueDifference != null ||
              property.rentalYield != null) && (
            <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Investment Indicators</h3>
              
              <div className="space-y-3 text-sm">
                {priceGrowth != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price Growth (1Y):</span>
                    <span className={priceGrowth >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {`${priceGrowth >= 0 ? '+' : ''}${priceGrowth.toFixed(1)}%`}
                    </span>
                  </div>
                )}
                {property.neighborhoodAvgPerSqm != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Neighborhood Median / sqm:</span>
                    <span className="text-white">
                      {`ETB ${Math.round(property.neighborhoodAvgPerSqm).toLocaleString()}`}
                    </span>
                  </div>
                )}
                {property.marketValueDifference != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Market Position:</span>
                    <span className="text-white">
                      {Math.abs(property.marketValueDifference) <= 5
                        ? 'At market value'
                        : property.marketValueDifference > 0
                        ? 'Above market value'
                        : 'Below market value'}
                    </span>
                  </div>
                )}
                {property.rentalYield != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Est. Rental Yield:</span>
                    <span className="text-white">{property.rentalYield.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      <MeaningPanel
        className="lg:col-span-3"
        title="What this price means"
        subtitle="How this listing compares with its neighborhood, and what owning it would return."
        caveat="The neighborhood median describes what other approved listings ask, not what homes actually sold for. Use it as a starting point for negotiation, not as a valuation."
        readings={propertyReadings({
          price: property.price,
          monthlyRentBenchmark:
            property.rentalYield != null && property.rentalYield > 0
              ? (property.price * property.rentalYield) / 100 / 12
              : null,
          neighborhoodMedianPrice: property.estimatedValue,
          pricePerSqm: property.pricePerSqm,
          neighborhoodMedianPerSqm: property.neighborhoodAvgPerSqm,
          sizeSqm: property.area,
          isRent: property.status === 'for_rent',
        })}
      />

      {/* Inquiry modal */}
      {inquiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Message the owner</h3>
                <p className="text-sm text-gray-400">{property.title}</p>
              </div>
              <button onClick={() => setInquiryOpen(false)} className="p-1 text-gray-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={inquiry}
              onChange={(e) => setInquiry(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Hi, I am interested in this property. Is it still available?"
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {inquiryError && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{inquiryError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setInquiryOpen(false)}
                className="px-4 py-2 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInquiry}
                disabled={sendInquiryMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendInquiryMutation.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

