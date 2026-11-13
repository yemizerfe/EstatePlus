import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Heart, MapPin, Eye, Search, Bed, Square, TrendingUp, Bell, BarChart3, MessageSquare, Calculator, Scale,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, SectionCard } from '../../components/ui/kit-blocks';
import { fetchSavedProperties, deleteSavedProperty, SavedProperty } from '../../api/savedProperties';
import { fetchPublicListings, type PublicListingCard } from '../../api/publicData';
import { propertyPhoto } from '../../lib/propertyImages';
import { addToCompare } from '../../lib/compare';

const fmtPrice = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ETB` : `${(n / 1_000).toFixed(0)}k ETB`;

const timeAgo = (iso: string) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const UserDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const displayName = user?.firstName || user?.name || 'there';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: ['saved-properties'],
    queryFn: fetchSavedProperties,
  });

  const listingsQuery = useQuery({
    queryKey: ['dashboard-recommended-listings'],
    queryFn: () => fetchPublicListings({ limit: 12 }),
    retry: 1,
  });

  const removeSavedMutation = useMutation({
    mutationFn: (propertyId: string) => deleteSavedProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const savedList = savedQuery.data ?? [];

  /** Areas the user actually holds a shortlist in. */
  const neighborhoods = useMemo(() => {
    const counts = new Map<string, { name: string; saved: number; image: string }>();
    for (const property of savedList) {
      const name = (property.neighborhood ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.saved += 1;
      else counts.set(key, { name, saved: 1, image: property.image });
    }
    return [...counts.values()].sort((a, b) => b.saved - a.saved).slice(0, 4);
  }, [savedList]);

  /** Live listings the user has not shortlisted yet. */
  const recommended = useMemo(() => {
    const savedPropertyIds = new Set(savedList.map((property) => property.propertyId));
    return (listingsQuery.data?.listings ?? [])
      .filter((listing) => !savedPropertyIds.has(listing.propertyId))
      .slice(0, 3);
  }, [listingsQuery.data, savedList]);

  const activity = useMemo(
    () =>
      [...savedList]
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        .slice(0, 5)
        .map((property) => ({
          id: property.id,
          text: `Saved ${property.title}${property.neighborhood ? ` in ${property.neighborhood}` : ''}`,
          time: timeAgo(property.savedAt),
          propertyId: property.propertyId,
        })),
    [savedList],
  );

  const handleRemoveSaved = (propertyId: string) => {
    removeSavedMutation.mutate(propertyId);
  };

  const handleCompareSaved = (property: SavedProperty) => {
    addToCompare({
      id: property.propertyId,
      title: property.title,
      location: 'Addis Ababa',
      neighborhood: property.neighborhood,
      price: property.price,
      pricePerSqm: property.size ? Math.round(property.price / property.size) : 0,
      size: property.size ?? 0,
      bedrooms: property.beds ?? 0,
      bathrooms: property.baths ?? 0,
      rentalYield: 0,
      marketValue: property.price,
      image: property.image,
    });
    navigate('/app/compare');
  };

  const openListing = (listing: PublicListingCard) => {
    navigate(`/app/properties/${listing.propertyId}`);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/90 px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)] sm:px-8 sm:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.18),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-300/90">
              EstatePlus dashboard
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Your shortlist, the areas you are watching and live listings from the market — all read
              from the EstatePlus database.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110"
            >
              <Search className="h-4 w-4" />
              Find Properties
            </Link>
            <Link
              to="/neighborhoods"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 transition-all hover:border-blue-400/50 hover:bg-white/10"
            >
              <MapPin className="h-4 w-4" />
              Explore Neighborhoods
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Saved', value: savedList.length, icon: Heart, tone: 'bg-rose-500/10 text-rose-300' },
          { label: 'Areas', value: neighborhoods.length, icon: MapPin, tone: 'bg-sky-500/10 text-sky-300' },
          {
            label: 'Market listings',
            value: listingsQuery.data?.total ?? '—',
            icon: Eye,
            tone: 'bg-indigo-500/10 text-indigo-300',
          },
          {
            label: 'For you',
            value: recommended.length,
            icon: MessageSquare,
            tone: 'bg-emerald-500/10 text-emerald-300',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.tone}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                live
              </span>
            </div>
            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{stat.label}</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-white">{stat.value}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard
            title="Saved properties"
            description="Everything you shortlisted, synced with your account."
            action={
              <Link to="/app/saved-properties" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                View all
              </Link>
            }
          >
            {savedList.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No saved properties yet"
                message="Open any listing and tap the heart to keep it here."
                accent="rose"
                action={
                  <Link
                    to="/properties"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Browse Properties
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {savedList.slice(0, 3).map((p) => (
                  <div key={p.propertyId} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 transition-all hover:border-blue-400/20 hover:bg-slate-800/50">
                    <Link to={`/app/properties/${p.propertyId}`} className="shrink-0">
                      <img src={p.image} alt={p.title} className="h-20 w-24 rounded-xl object-cover" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link to={`/app/properties/${p.propertyId}`} className="block truncate text-base font-semibold text-white transition-colors group-hover:text-blue-300">
                        {p.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                        <span>{p.neighborhood}</span>
                        <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.beds || '—'}</span>
                        <span className="flex items-center gap-1"><Square className="h-3.5 w-3.5" /> {p.size ? `${p.size} m²` : '—'}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-lg font-bold text-white">{fmtPrice(p.price)}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleCompareSaved(p)} className="rounded-full border border-white/10 bg-white/5 p-2 text-blue-300 hover:bg-blue-500/10" title="Compare">
                          <Scale className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleRemoveSaved(p.propertyId)} className="rounded-full border border-white/10 bg-white/5 p-2 text-rose-300 hover:bg-rose-500/10" title="Remove">
                          <Heart className="h-3.5 w-3.5 fill-rose-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Live listings"
            description="Active properties from the database that you have not saved yet."
            action={
              <Link to="/properties" className="text-sm font-medium text-slate-300 hover:text-white">
                Browse all
              </Link>
            }
          >
            {listingsQuery.isLoading ? (
              <p className="text-sm text-slate-400">Loading listings…</p>
            ) : recommended.length === 0 ? (
              <p className="text-sm text-slate-400">
                No unsaved listings are recorded right now.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {recommended.map((listing) => (
                  <button
                    key={listing.listingId}
                    type="button"
                    onClick={() => openListing(listing)}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 text-left"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={listing.imageUrl ?? propertyPhoto(listing)}
                        alt={listing.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-white">{listing.title}</p>
                        <span className="shrink-0 text-sm font-bold text-white">
                          {listing.price !== null ? fmtPrice(listing.price) : 'Price on request'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {listing.neighborhood ?? 'Addis Ababa'} · {listing.bedrooms} bed
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="My neighborhoods"
            description="Areas where you have a shortlisted property."
            action={
              <Link to="/app/my-neighborhoods" className="text-sm font-medium text-slate-300 hover:text-white">View all</Link>
            }
          >
            {neighborhoods.length === 0 ? (
              <p className="text-sm text-slate-400">Save a property to start tracking its area.</p>
            ) : (
              <div className="space-y-3">
                {neighborhoods.map((n) => (
                  <Link key={n.name} to="/app/my-neighborhoods" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-2.5 transition-colors hover:border-blue-400/35 hover:bg-slate-800/50">
                    <img src={n.image} alt={n.name} className="h-12 w-12 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">{n.name}</div>
                      <div className="text-xs text-slate-400">{n.saved} saved {n.saved === 1 ? 'property' : 'properties'}</div>
                    </div>
                    <span className="text-xs font-medium text-blue-300">View →</span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="Your latest saves."
            action={<Link to="/app/saved-properties" className="text-sm font-medium text-slate-300 hover:text-white">All</Link>}
          >
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing saved yet.</p>
            ) : (
              <div className="space-y-4">
                {activity.map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-3 pl-2">
                    {index < activity.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-px bg-white/10" />}
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-950/70">
                      <Heart className="h-4 w-4 text-rose-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/app/properties/${entry.propertyId}`} className="text-sm leading-5 text-slate-200 hover:text-white">
                        {entry.text}
                      </Link>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{entry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick actions">
            <div className="flex flex-wrap gap-2.5">
              {[
                { to: '/properties', icon: Search, label: 'Find Properties' },
                { to: '/neighborhoods', icon: MapPin, label: 'Neighborhoods' },
                { to: '/app/saved-properties', icon: Heart, label: 'Saved' },
                { to: '/app/my-neighborhoods', icon: TrendingUp, label: 'Markets' },
                { to: '/app/ai-assistant', icon: MessageSquare, label: 'AI Assistant' },
                { to: '/app/scenarios', icon: Calculator, label: 'Scenarios' },
                { to: '/app/notifications', icon: Bell, label: 'Notifications' },
                { to: '/app/compare', icon: BarChart3, label: 'Compare' },
              ].map((q) => (
                <Link key={q.to} to={q.to} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-all hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white">
                  <q.icon className="h-4 w-4 text-blue-300" />
                  {q.label}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default UserDashboardPage;
