import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarRange,
  ClipboardList,
  Clock,
  Home,
  Plus,
  TrendingUp,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { PageHero, StatCard } from '../../components/ui/kit-core';
import { EmptyState, SectionCard, StatusBadge, statusToTone, TableSkeleton } from '../../components/ui/kit-blocks';
import { getMyProperties, getPropertyStatistics } from '../../api/properties';
import { formatAmount, formatDate } from '../../api/publicData';

const money = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? '—'
    : `ETB ${formatAmount(Number(value))}`;

const OwnerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const displayName = user?.firstName || user?.name || 'there';

  const statsQuery = useQuery({
    queryKey: ['owner-property-statistics'],
    queryFn: getPropertyStatistics,
    retry: 1,
  });

  const propertiesQuery = useQuery({
    queryKey: ['owner-properties-dashboard'],
    queryFn: () => getMyProperties({ limit: 6, page: 1 }),
    retry: 1,
  });

  const stats = statsQuery.data;
  const properties = propertiesQuery.data?.properties ?? [];

  const liveCount = useMemo(
    () =>
      (stats?.byStatus ?? [])
        .filter((entry) => entry.status === 'ACTIVE' || entry.status === 'APPROVED')
        .reduce((sum, entry) => sum + entry.count, 0),
    [stats],
  );

  const reviewCount = useMemo(
    () =>
      (stats?.byStatus ?? [])
        .filter((entry) => entry.status === 'PENDING')
        .reduce((sum, entry) => sum + entry.count, 0),
    [stats],
  );

  const draftCount = useMemo(
    () =>
      (stats?.byStatus ?? [])
        .filter((entry) => entry.status === 'DRAFT' || entry.status === 'REJECTED')
        .reduce((sum, entry) => sum + entry.count, 0),
    [stats],
  );

  const averageAsking = useMemo(() => {
    const priced = properties.filter((property) => Number(property.askingPrice) > 0);
    if (priced.length === 0) return null;
    return priced.reduce((sum, property) => sum + Number(property.askingPrice), 0) / priced.length;
  }, [properties]);

  const statusRows = (stats?.byStatus ?? []).filter((entry) => entry.count > 0);
  const typeRows = (stats?.byType ?? []).filter((entry) => entry.count > 0);
  const typeTotal = typeRows.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="space-y-6">
      <PageHero
        icon={Building2}
        title={`Welcome back, ${displayName}.`}
        description="Your portfolio, straight from the listings recorded in EstatePlus. Every count and price below is read from the database."
        accent="sky"
        actions={
          <>
            <Link
              to="/app/analytics"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-500/10"
            >
              <BarChart3 className="h-4 w-4 text-blue-300" />
              Analytics
            </Link>
            <Link
              to="/app/my-properties/add"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Add Property
            </Link>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Home}
          label="My Properties"
          value={stats ? stats.totalProperties : '—'}
          hint="Records you own"
          accent="sky"
        />
        <StatCard
          icon={TrendingUp}
          label="Live"
          value={stats ? liveCount : '—'}
          hint="Approved and active"
          accent="emerald"
        />
        <StatCard
          icon={Clock}
          label="Awaiting review"
          value={stats ? reviewCount : '—'}
          hint="Submitted to admin"
          accent="amber"
        />
        <StatCard
          icon={ClipboardList}
          label="Drafts & rejected"
          value={stats ? draftCount : '—'}
          hint="Not published yet"
          accent="purple"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard
          title="My listings"
          description="Most recent records you own, with the status the approval workflow has them in."
          action={
            <Link to="/app/my-properties" className="text-sm font-medium text-blue-300 hover:text-blue-200">
              View all
            </Link>
          }
          bodyClassName="p-0"
        >
          {propertiesQuery.isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={4} />
            </div>
          ) : propertiesQuery.isError ? (
            <div className="p-6 text-sm text-rose-300">
              Your listings could not be loaded from the API.
            </div>
          ) : properties.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Home}
                title="No listings yet"
                message="Create your first listing to start appearing in search and market statistics."
                accent="sky"
                action={
                  <Link
                    to="/app/my-properties/add"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" /> Add Property
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  to={`/app/properties/${property.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5"
                >
                  <img
                    src={property.images?.[0]?.imageUrl}
                    alt={property.title}
                    loading="lazy"
                    className="h-14 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{property.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {property.neighborhood?.name ?? property.address} · {property.bedrooms} bed ·{' '}
                      {property.bathrooms} bath · {Number(property.sizeSqm).toLocaleString()} m²
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-white">{money(Number(property.askingPrice))}</p>
                    <div className="mt-1 flex justify-end">
                      <StatusBadge tone={statusToTone(property.status)}>{property.status}</StatusBadge>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Portfolio mix" description="Share of your records by property type.">
            {typeRows.length === 0 ? (
              <p className="text-sm text-slate-400">No records to break down yet.</p>
            ) : (
              <div className="space-y-3">
                {typeRows.map((entry) => {
                  const share = typeTotal > 0 ? Math.round((entry.count / typeTotal) * 100) : 0;
                  return (
                    <div key={entry.type}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">
                          {entry.type.charAt(0) + entry.type.slice(1).toLowerCase()}
                        </span>
                        <span className="text-slate-400">
                          {entry.count} · {share}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Status breakdown" description="Where the approval workflow has each record.">
            {statusRows.length === 0 ? (
              <p className="text-sm text-slate-400">No statuses recorded yet.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {statusRows.map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between">
                    <StatusBadge tone={statusToTone(entry.status)}>{entry.status}</StatusBadge>
                    <span className="font-semibold text-white">{entry.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Average asking price" description="Mean of your latest six records.">
            <p className="text-2xl font-black text-white">{money(averageAsking)}</p>
            <p className="mt-1 text-xs text-slate-400">
              {properties.length > 0
                ? `Across ${properties.length} recent ${properties.length === 1 ? 'record' : 'records'}.`
                : 'Add a record to see this figure.'}
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <CalendarRange className="h-3.5 w-3.5 text-blue-300" />
              Portfolio read at {formatDate(new Date().toISOString())}
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
