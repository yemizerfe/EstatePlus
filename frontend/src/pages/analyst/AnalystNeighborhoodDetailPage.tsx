import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  MapPin,
  TrendingUp,
} from 'lucide-react';

import { PageHero } from '../../components/ui/kit-core';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import {
  fetchPublicListings,
  fetchPublicNeighborhood,
  formatAmount,
  formatCompact,
  formatDate,
  formatPct,
  metricNote,
  propertyTypeLabel,
  type Metric,
  type PublicListingCard,
} from '../../api/publicData';
import { downloadCsv } from '../../lib/csv';

/**
 * Analyst view of a single area (`/app/analyst-neighborhoods/:slug`).
 *
 * Reads the same recorded figures as the public page but keeps the analyst
 * chrome: sample sizes and whether a median is local or citywide are always
 * visible, and the list of listings can be exported.
 */

function MetricCard({ label, metric }: { label: string; metric: Metric }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <div className="text-xs uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{formatAmount(metric.value)}</div>
      <div className="mt-1 text-xs text-gray-400">{metricNote(metric)}</div>
    </div>
  );
}

function ListingRow({ listing }: { listing: PublicListingCard }) {
  const price =
    listing.listingType === 'rent'
      ? listing.monthlyRent ?? listing.price
      : listing.price ?? listing.monthlyRent;

  return (
    <tr className="border-b border-white/5 hover:bg-white/5">
      <td className="py-3 px-4">
        <Link
          to={`/properties/${listing.propertyId}`}
          className="font-medium text-white hover:text-sky-300"
        >
          {listing.title}
        </Link>
        <div className="text-xs text-gray-400">
          {propertyTypeLabel(listing.propertyType)}
          {listing.sizeSqm ? ` · ${listing.sizeSqm} m²` : ''}
          {` · ${listing.bedrooms} bd · ${listing.bathrooms} ba`}
        </div>
      </td>
      <td className="py-3 px-4 text-right text-white">
        {price != null ? formatAmount(price) : '—'}
      </td>
      <td className="py-3 px-4 text-right text-gray-300">
        {listing.listingType === 'rent' ? 'Rent' : 'Sale'}
      </td>
      <td className="py-3 px-4 text-right text-gray-300">{formatDate(listing.listedAt)}</td>
    </tr>
  );
}

export default function AnalystNeighborhoodDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const areaQuery = useQuery({
    queryKey: ['analyst-neighborhood', slug],
    queryFn: () => fetchPublicNeighborhood(slug!),
    enabled: Boolean(slug),
    retry: 1,
  });

  const listingsQuery = useQuery({
    queryKey: ['analyst-neighborhood-listings', slug],
    queryFn: () => fetchPublicListings({ neighborhood: slug, limit: 50 }),
    enabled: Boolean(slug),
    retry: 1,
  });

  const area = areaQuery.data;
  const listings = listingsQuery.data?.listings ?? [];

  const handleExport = () => {
    downloadCsv(
      `${slug}-listings.csv`,
      ['Title', 'Property type', 'Listing type', 'Price (ETB)', 'Size (m²)', 'Bedrooms', 'Bathrooms', 'Listed at', 'Property URL'],
      listings.map((listing) => [
        listing.title,
        propertyTypeLabel(listing.propertyType),
        listing.listingType,
        listing.price ?? listing.monthlyRent ?? '',
        listing.sizeSqm ?? '',
        listing.bedrooms,
        listing.bathrooms,
        listing.listedAt,
        `${window.location.origin}/properties/${listing.propertyId}`,
      ]),
    );
  };

  if (areaQuery.isLoading) return <TableSkeleton />;

  if (areaQuery.isError || !area) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-5 w-5" /> Could not load this neighborhood
          </p>
          <p className="mt-1 text-sm text-rose-300/80">
            The area may not exist, or the market service did not respond.
          </p>
          <button
            onClick={() => navigate('/app/analyst-neighborhoods')}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to neighborhoods
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHero
        icon={MapPin}
        title={area.name}
        description={`${area.subcity ? `${area.subcity} · ` : ''}${area.city} · neighborhood market detail`}
        accent="sky"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/app/analyst-neighborhoods')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Link
              to={`/neighborhoods/${area.slug}`}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-xl text-sky-300 transition-colors"
            >
              Public page <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Median asking price" metric={area.sale.medianAskingPrice} />
          <MetricCard label="Median price per m²" metric={area.sale.medianPricePerSqm} />
          <MetricCard label="Median monthly rent" metric={area.rent.medianMonthlyRent} />
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <div className="text-xs uppercase tracking-wider text-gray-400">Active listings</div>
            <div className="mt-1 text-2xl font-bold text-white">
              {area.activeListings.sale + area.activeListings.rent}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {area.activeListings.sale} sale · {area.activeListings.rent} rent
            </div>
          </div>
        </div>

        {(area.growth?.pricePct != null || area.growth?.rentPct != null) && (
          <div className="flex flex-wrap gap-3 text-sm">
            {area.growth?.pricePct != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300">
                <TrendingUp className="h-4 w-4" /> Sale prices {formatPct(area.growth.pricePct)} vs previous month
              </span>
            )}
            {area.growth?.rentPct != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 font-semibold text-sky-300">
                <TrendingUp className="h-4 w-4" /> Rents {formatPct(area.growth.rentPct)} vs previous month
              </span>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Recorded listings</h2>
              <p className="text-sm text-gray-400">
                {listings.length} of {listingsQuery.data?.total ?? listings.length} approved listings
                recorded in {area.name}.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                disabled={!listings.length}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50"
              >
                Export CSV
              </button>
              <Link
                to={`/properties?neighborhood=${encodeURIComponent(area.slug)}`}
                className="text-sm font-semibold text-sky-300 hover:text-sky-200"
              >
                Open in property explorer →
              </Link>
            </div>
          </div>

          {listingsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading listings…
            </div>
          ) : listings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-gray-300">
              No approved listings are recorded in this area yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-gray-300">
                    <th className="px-4 py-3 text-left">Listing</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Type</th>
                    <th className="px-4 py-3 text-right">Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
                    <ListingRow key={listing.listingId} listing={listing} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Area profile</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Sub-city</dt>
              <dd className="font-semibold text-white">{area.subcity ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">City</dt>
              <dd className="font-semibold text-white">{area.city}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Sale sample</dt>
              <dd className="font-semibold text-white">
                {area.sale.medianAskingPrice.localSampleSize ?? 0} local · {area.sale.medianAskingPrice.sampleSize} total
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Rent sample</dt>
              <dd className="font-semibold text-white">
                {area.rent.medianMonthlyRent.localSampleSize ?? 0} local · {area.rent.medianMonthlyRent.sampleSize} total
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Median sale price</dt>
              <dd className="font-semibold text-white">
                {formatCompact(area.sale.medianAskingPrice.value)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Coordinates</dt>
              <dd className="font-semibold text-white">
                {area.centerLat != null && area.centerLng != null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${area.centerLat}&mlon=${area.centerLng}#map=15/${area.centerLat}/${area.centerLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                  >
                    Open map <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
