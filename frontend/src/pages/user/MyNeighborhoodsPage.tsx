import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Heart, MapPin, TrendingUp } from 'lucide-react';

import { PageHero, StatCard } from '../../components/ui/kit-core';
import { EmptyState } from '../../components/ui/kit-blocks';
import { fetchSavedProperties } from '../../api/savedProperties';
import { fetchPublicNeighborhoods, formatAmount, type PublicNeighborhood } from '../../api/publicData';

/**
 * Areas the signed-in user actually holds a shortlist in.
 *
 * Every figure comes from the public neighborhood endpoint, which computes its
 * medians from recorded listings; nothing here is invented. An area the user
 * has not saved anything in is not shown as "followed".
 */
const MyNeighborhoodsPage: React.FC = () => {
  const savedQuery = useQuery({
    queryKey: ['saved-properties'],
    queryFn: fetchSavedProperties,
    retry: 1,
  });

  const neighborhoodsQuery = useQuery({
    queryKey: ['public-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
    retry: 1,
  });

  const saved = savedQuery.data ?? [];
  const allNeighborhoods = neighborhoodsQuery.data ?? [];

  const watched = useMemo(() => {
    const savedNames = new Set(
      saved.map((property) => (property.neighborhood ?? '').trim().toLowerCase()).filter(Boolean),
    );
    return allNeighborhoods
      .filter((neighborhood) => savedNames.has(neighborhood.name.trim().toLowerCase()))
      .map((neighborhood) => ({
        ...neighborhood,
        savedCount: saved.filter(
          (property) => (property.neighborhood ?? '').trim().toLowerCase() === neighborhood.name.trim().toLowerCase(),
        ).length,
      }))
      .sort((a, b) => b.savedCount - a.savedCount);
  }, [allNeighborhoods, saved]);

  const withPrices = watched.filter((entry) => entry.sale.medianAskingPrice.value !== null);
  const averageAsking =
    withPrices.length > 0
      ? withPrices.reduce((sum, entry) => sum + (entry.sale.medianAskingPrice.value ?? 0), 0) / withPrices.length
      : null;

  const growthValues = watched
    .map((entry) => entry.growth?.pricePct)
    .filter((value): value is number => value !== null && value !== undefined);
  const averageGrowth =
    growthValues.length > 0 ? growthValues.reduce((sum, value) => sum + value, 0) / growthValues.length : null;

  const isLoading = savedQuery.isLoading || neighborhoodsQuery.isLoading;
  const isError = savedQuery.isError || neighborhoodsQuery.isError;

  const metric = (neighborhood: PublicNeighborhood) => {
    const rows = [
      { label: 'Median asking', value: neighborhood.sale.medianAskingPrice.value, unit: 'ETB' },
      { label: 'Median per m²', value: neighborhood.sale.medianPricePerSqm.value, unit: 'ETB/m²' },
      { label: 'Median rent', value: neighborhood.rent.medianMonthlyRent.value, unit: 'ETB/mo' },
    ].filter((row) => row.value !== null);
    return rows;
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={MapPin}
        title="My Neighborhoods"
        description="The areas where you have shortlisted a property, with the market figures the database can support for each."
        accent="sky"
        actions={
          <Link
            to="/neighborhoods"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110"
          >
            <MapPin className="h-4 w-4" />
            Browse Neighborhoods
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={MapPin} label="Areas" value={watched.length} hint="with a saved property" accent="sky" />
        <StatCard
          icon={TrendingUp}
          label="Average median asking"
          value={averageAsking === null ? '—' : `ETB ${formatAmount(Math.round(averageAsking))}`}
          hint="mean of the areas below"
          accent="emerald"
        />
        <StatCard
          icon={Heart}
          label="Shortlisted"
          value={saved.length}
          hint="properties saved"
          accent="rose"
        />
      </div>

      {isError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
          Your saved areas could not be loaded from the API.
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-gray-400">
          Loading your areas…
        </div>
      )}

      {!isLoading && !isError && watched.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No areas yet"
          message="Save a property and its neighborhood appears here with live market figures."
          accent="sky"
          action={
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse Properties
            </Link>
          }
        />
      )}

      {!isLoading && watched.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {watched.map((neighborhood) => (
            <div key={neighborhood.id} className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl">
              <div className="relative h-36 overflow-hidden">
                <img
                  src={neighborhood.imageUrl ?? ''}
                  alt={neighborhood.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <h3 className="text-xl font-bold text-white">{neighborhood.name}</h3>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {neighborhood.activeListings.sale + neighborhood.activeListings.rent} active
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <p className="text-xs text-gray-400">
                  {neighborhood.savedCount} saved {neighborhood.savedCount === 1 ? 'property' : 'properties'} in this area
                  {averageGrowth !== null && growthValues.length > 0 ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-300">
                      <TrendingUp className="h-3 w-3" />
                      {averageGrowth >= 0 ? '+' : ''}
                      {averageGrowth.toFixed(1)}% average month change
                    </span>
                  ) : null}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {metric(neighborhood).map((row) => (
                    <div key={row.label}>
                      <p className="text-[11px] text-gray-500">{row.label}</p>
                      <p className="text-sm font-bold text-white">
                        {formatAmount(row.value)} <span className="text-[10px] font-normal text-gray-500">{row.unit}</span>
                      </p>
                    </div>
                  ))}

                </div>

                <div className="flex gap-2 pt-1">
                  <Link
                    to={`/neighborhoods/${neighborhood.slug}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Area report <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to={`/properties?neighborhood=${neighborhood.slug}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-blue-400/50 hover:text-white"
                  >
                    Listings
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyNeighborhoodsPage;
