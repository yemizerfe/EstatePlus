import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Bath,
  Bed,
  Building2,
  Calendar,
  Eye,
  Heart,
  Loader2,
  MapPin,
  Ruler,
  Share2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Footer from '../../components/Footer';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPublicProperty,
  formatAmount,
  formatDate,
  metricNote,
  propertyTypeLabel,
  type Metric,
} from '../../api/publicData';
import {
  createSavedProperty,
  deleteSavedProperty,
  fetchSavedProperties,
} from '../../api/savedProperties';

/**
 * Public property detail.
 *
 * Reads a single approved property plus its active listing from
 * `GET /api/v1/public/properties/:id`. Fields the record does not contain are
 * shown as "not provided" instead of being filled from sample data.
 */

function MetricRow({ label, metric }: { label: string; metric: Metric }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-white">
        {formatAmount(metric.value)}
        <span className="text-xs text-gray-300 font-normal ml-2">{metricNote(metric)}</span>
      </span>
    </div>
  );
}

const PublicPropertyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shareLabel, setShareLabel] = useState('Share');

  const propertyQuery = useQuery({
    queryKey: ['public-property', id],
    queryFn: () => fetchPublicProperty(id!),
    enabled: Boolean(id),
    retry: 1,
  });

  // Saved state is read from the API so the heart reflects the real list.
  const savedQuery = useQuery({
    queryKey: ['saved-properties'],
    queryFn: fetchSavedProperties,
    enabled: isAuthenticated,
    retry: false,
  });
  const isSaved = Boolean(id) && (savedQuery.data ?? []).some((saved) => saved.propertyId === id);

  const saveMutation = useMutation({
    mutationFn: createSavedProperty,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });
  const unsaveMutation = useMutation({
    mutationFn: (propertyId: string) => deleteSavedProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const property = propertyQuery.data;

  const handleToggleSave = () => {
    if (!property) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/properties/${property.propertyId}`)}`);
      return;
    }
    if (isSaved) {
      unsaveMutation.mutate(property.propertyId);
      return;
    }
    const rent = property.listing?.monthlyRent ?? null;
    const price = property.listing?.price ?? rent;
    saveMutation.mutate({
      propertyId: property.propertyId,
      title: property.title,
      neighborhood: property.neighborhood?.name ?? 'Addis Ababa',
      image: property.images[0]?.imageUrl ?? '',
      price: price ?? 0,
      size: property.sizeSqm,
      beds: property.bedrooms,
      baths: property.bathrooms,
    });
  };

  const handleShare = async () => {
    // Sharing is an account feature: send signed-out visitors to sign in first.
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: property?.title ?? 'Property', url });
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
  const heroImage = property?.images[0]?.imageUrl ?? null;

  const facts = property
    ? [
        {
          icon: <Ruler className="w-4 h-4" />,
          label: 'Size',
          value: property.sizeSqm !== null ? `${property.sizeSqm} m²` : 'Not provided',
        },
        { icon: <Bed className="w-4 h-4" />, label: 'Bedrooms', value: String(property.bedrooms) },
        {
          icon: <Bath className="w-4 h-4" />,
          label: 'Bathrooms',
          value: String(property.bathrooms),
        },
        {
          icon: <Building2 className="w-4 h-4" />,
          label: 'Type',
          value: propertyTypeLabel(property.propertyType),
        },
        ...(property.address
          ? [{ icon: <MapPin className="w-4 h-4" />, label: 'Address', value: property.address }]
          : []),
        ...(property.listing
          ? [
              {
                icon: <Calendar className="w-4 h-4" />,
                label: 'Listed',
                value: formatDate(property.listing.listedAt),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(0,0,0,1))] pointer-events-none" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {propertyQuery.isLoading && (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading property…
          </div>
        )}

        {propertyQuery.isError && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-2">This listing is not published</h3>
            <p className="text-gray-400 mb-6">
              The listing may have been taken down by its owner, or the link may be out of date.
              Browse the live listings instead.
            </p>
            <Link to="/properties" className="text-blue-400 hover:text-blue-300">
              Back to all properties
            </Link>
          </div>
        )}

        {property && (
          <>
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6"
            >
              ← All properties
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-3xl overflow-hidden border border-white/10 bg-slate-800/40 h-80 flex items-center justify-center">
                  {heroImage ? (
                    <img
                      src={heroImage}
                      alt={property.images[0]?.altText ?? property.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-slate-600">
                      <Building2 className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">No image provided for this property</p>
                    </div>
                  )}
                </div>

                {property.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-3">
                    {property.images.slice(1, 5).map((image) => (
                      <img
                        key={image.imageUrl}
                        src={image.imageUrl}
                        alt={image.altText ?? property.title}
                        className="rounded-xl h-20 w-full object-cover border border-white/10"
                      />
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
                      {propertyTypeLabel(property.propertyType)}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-gray-300 text-xs font-semibold">
                      Condition: {property.condition.toLowerCase()}
                    </span>
                    {property.listing && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        {property.listing.listingType === 'rent'
                          ? 'For rent'
                          : property.listing.listingType === 'both'
                            ? 'Sale and rent'
                            : 'For sale'}
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-black mb-2">{property.title}</h1>
                  <p className="text-gray-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {[property.neighborhood?.name, property.address, property.neighborhood?.city]
                      .filter(Boolean)
                      .join(' · ') || 'Location not provided'}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        {fact.icon}
                        {fact.label}
                      </div>
                      <p className="text-white font-semibold text-sm break-words">{fact.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-bold mb-3">Description</h2>
                  <p className="text-gray-300 whitespace-pre-line">
                    {property.description?.trim() ||
                      'The owner did not provide a description for this property.'}
                  </p>
                </div>

              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSave}
                      disabled={saveMutation.isPending || unsaveMutation.isPending}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/60 hover:bg-white/10 disabled:opacity-60"
                      title={isSaved ? 'Remove from saved properties' : 'Save property'}
                    >
                      <Heart
                        className={`h-4 w-4 ${isSaved ? 'fill-rose-400 text-rose-400' : 'text-gray-300'}`}
                      />
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/60 hover:bg-white/10"
                      title="Share this property"
                    >
                      <Share2 className="h-4 w-4 text-gray-300" />
                      {shareLabel}
                    </button>
                  </div>
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                    {property.listing?.listingType === 'rent' ? 'Monthly rent' : 'Asking price'}
                  </p>
                  <p className="text-4xl font-black text-white">
                    {property.listing
                      ? property.listing.listingType === 'rent'
                        ? property.listing.monthlyRent !== null
                          ? formatAmount(property.listing.monthlyRent)
                          : 'Not stated'
                        : property.listing.price !== null
                          ? formatAmount(property.listing.price)
                          : 'Not stated'
                      : 'No active listing'}
                  </p>
                  {property.listing && (
                    <div className="mt-4 pt-4 border-t border-white/10 text-sm text-gray-400 space-y-1">
                      {property.listing.monthlyRent !== null &&
                        property.listing.listingType !== 'rent' && (
                          <p>Rental price on record: {formatAmount(property.listing.monthlyRent)}</p>
                        )}
                      <p className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        {property.listing.viewCount} views
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-bold mb-1">Area market</h2>
                  <p className="text-xs text-gray-300 mb-3">
                    {property.neighborhood
                      ? `Medians from active listings in ${property.neighborhood.name}.`
                      : 'No neighborhood recorded for this property.'}
                  </p>
                  {property.neighborhoodMarket ? (
                    <>
                      <MetricRow
                        label="Median asking"
                        metric={property.neighborhoodMarket.sale.medianAskingPrice}
                      />
                      <MetricRow
                        label="Median per m²"
                        metric={property.neighborhoodMarket.sale.medianPricePerSqm}
                      />
                      <MetricRow
                        label="Median rent"
                        metric={property.neighborhoodMarket.rent.medianMonthlyRent}
                      />
                      <p className="text-xs text-gray-300 mt-3">
                        {property.neighborhoodMarket.activeListings.sale} for sale ·{' '}
                        {property.neighborhoodMarket.activeListings.rent} for rent in this area.
                      </p>
                      {property.neighborhood && (
                        <Link
                          to={`/neighborhoods/${property.neighborhood.slug}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-3"
                        >
                          Explore {property.neighborhood.name}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-300">
                      This property has no recorded neighborhood, so area statistics cannot be
                      attached.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
                  {isAuthenticated ? (
                    <Link
                      to="/app/saved-properties"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                    >
                      Go to saved properties
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                    >
                      Create an account to save it
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default PublicPropertyDetailsPage;
