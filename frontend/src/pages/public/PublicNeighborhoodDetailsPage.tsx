import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bath,
  Bed,
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  TrendingUp,
} from 'lucide-react';

import Footer from '../../components/Footer';
import { InfoHint } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import {
  fetchPublicNeighborhood,
  formatAmount,
  formatPct,
  metricNote,
  propertyTypeLabel,
  type Metric,
  type PublicListingCard,
} from '../../api/publicData';

/**
 * Public area page (`/neighborhoods/:slug`).
 *
 * Everything on it comes from `GET /api/v1/public/neighborhoods/:slug`: the
 * area's stored photograph, its real listing counts and medians, and the
 * listings themselves. A figure without a recorded sample is left out rather
 * than filled with a placeholder.
 */

function MetricTile({ label, metric, hint }: { label: string; metric: Metric; hint?: string }) {
  if (metric.value === null) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
        {hint && <InfoHint text={hint} label={label} />}
      </p>
      <p className="mt-1 text-2xl font-bold text-white">{formatAmount(metric.value)}</p>
      <p className="mt-0.5 text-xs text-gray-300">{metricNote(metric)}</p>
    </div>
  );
}

function ListingCard({ listing }: { listing: PublicListingCard }) {
  const price = listing.listingType === 'rent' ? listing.monthlyRent : listing.price;
  return (
    <Link
      to={`/properties/${listing.propertyId}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-sky-400/40"
    >
      <div className="relative h-40 overflow-hidden bg-slate-800">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            <Building2 className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-white">
          {listing.listingType === 'rent' ? 'For rent' : listing.listingType === 'both' ? 'Sale & rent' : 'For sale'}
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-white">{listing.title}</h3>
        <p className="mt-1 text-xs text-gray-400">
          {propertyTypeLabel(listing.propertyType)}
          {listing.sizeSqm ? ` · ${listing.sizeSqm} m²` : ''}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-300">
          <span className="inline-flex items-center gap-1">
            <Bed className="h-3.5 w-3.5" /> {listing.bedrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" /> {listing.bathrooms}
          </span>
        </div>
        <p className="mt-3 text-lg font-bold text-white">
          {price !== null ? `ETB ${formatAmount(price)}` : 'Price not stated'}
          {listing.listingType === 'rent' && price !== null && (
            <span className="text-xs font-normal text-gray-400">/month</span>
          )}
        </p>
      </div>
    </Link>
  );
}

export default function PublicNeighborhoodDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const areaQuery = useQuery({
    queryKey: ['public-neighborhood', id],
    queryFn: () => fetchPublicNeighborhood(id!),
    enabled: Boolean(id),
    retry: 1,
  });

  const area = areaQuery.data;
  const listings = area?.recentListings ?? [];
  const totalActive = area ? area.activeListings.sale + area.activeListings.rent : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <Link
          to="/neighborhoods"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> All neighborhoods
        </Link>

        {areaQuery.isLoading && (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Loading area…
          </div>
        )}

        {areaQuery.isError && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
            <h1 className="text-xl font-bold">This area is not available</h1>
            <p className="mt-1 text-gray-400">
              The area may have been renamed, or the link may be out of date.
            </p>
            <Link
              to="/neighborhoods"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Browse neighborhoods <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {area && (
          <>
            <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10">
              {area.imageUrl ? (
                <img
                  src={area.imageUrl}
                  alt={`${area.name}, ${area.city}`}
                  className="h-72 w-full object-cover sm:h-80"
                />
              ) : (
                <div className="flex h-72 w-full items-center justify-center bg-slate-800 text-slate-600 sm:h-80">
                  <Building2 className="h-12 w-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-200">
                  <MapPin className="h-4 w-4" />
                  {area.subcity ? `${area.subcity} sub-city` : area.city}
                </div>
                <h1 className="mt-1 text-3xl font-black text-white sm:text-5xl">{area.name}</h1>
                <p className="mt-2 text-sm text-gray-300">
                  {totalActive} active listing{totalActive === 1 ? '' : 's'} recorded in this area
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-bold text-white">Market indicators</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Medians of the listings EstatePlus holds for this area, with the sample size behind
                    each figure.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <MetricTile
                      label="Median asking price"
                      metric={area.sale.medianAskingPrice}
                      hint={METRIC_HINTS.medianAskingPrice}
                    />
                    <MetricTile
                      label="Median price per m²"
                      metric={area.sale.medianPricePerSqm}
                      hint={METRIC_HINTS.pricePerSqm}
                    />
                    <MetricTile
                      label="Median monthly rent"
                      metric={area.rent.medianMonthlyRent}
                      hint={METRIC_HINTS.medianMonthlyRent}
                    />
                  </div>
                  {(area.growth?.pricePct != null || area.growth?.rentPct != null) && (
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {area.growth?.pricePct != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300">
                          <TrendingUp className="h-4 w-4" />
                          Sale prices {formatPct(area.growth.pricePct)} vs previous month
                        </span>
                      )}
                      {area.growth?.rentPct != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 font-semibold text-sky-300">
                          <TrendingUp className="h-4 w-4" />
                          Rents {formatPct(area.growth.rentPct)} vs previous month
                        </span>
                      )}
                    </div>
                  )}
                  {area.sale.medianAskingPrice.value === null &&
                    area.rent.medianMonthlyRent.value === null && (
                      <p className="mt-4 text-sm text-gray-300">
                        No price samples are recorded for this area yet, so no median is shown.
                      </p>
                    )}
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Listings in {area.name}</h2>
                    <Link
                      to={`/properties?neighborhood=${encodeURIComponent(area.slug)}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-sky-300 hover:text-sky-200"
                    >
                      See all <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  {listings.length > 0 ? (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {listings.map((listing) => (
                        <ListingCard key={listing.listingId} listing={listing} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-gray-300">
                      No approved listings are recorded in this area yet. New listings appear here as
                      soon as an owner publishes one.
                    </p>
                  )}
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-bold text-white">Area profile</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-400">Sub-city</dt>
                      <dd className="font-semibold text-white">{area.subcity ?? '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-400">City</dt>
                      <dd className="font-semibold text-white">{area.city}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-400">For sale</dt>
                      <dd className="font-semibold text-white">{area.activeListings.sale}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-400">For rent</dt>
                      <dd className="font-semibold text-white">{area.activeListings.rent}</dd>
                    </div>
                  </dl>
                  {area.centerLat !== null && area.centerLng !== null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${area.centerLat}&mlon=${area.centerLng}#map=15/${area.centerLat}/${area.centerLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-300 hover:text-sky-200"
                    >
                      Open on the map <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </section>

                {area.description && (
                  <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                    <h2 className="text-lg font-bold text-white">About {area.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-300">{area.description}</p>
                  </section>
                )}

                {area.imageCredit && (
                  <p className="px-2 text-xs text-gray-400">
                    Photograph:{' '}
                    {area.imageCreditUrl ? (
                      <a
                        href={area.imageCreditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-gray-200"
                      >
                        {area.imageCredit}
                      </a>
                    ) : (
                      area.imageCredit
                    )}
                    {area.imageLicense ? ` · ${area.imageLicense}` : ''} (Wikimedia Commons)
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
