import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Bath,
  Bed,
  Eye,
  Heart,
  Home,
  MapPin,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
} from 'lucide-react';

import { PageHero, StatCard } from '../../components/ui/kit-core';
import { EmptyState, TableSkeleton } from '../../components/ui/kit-blocks';
import { deleteProperty, getMyProperties } from '../../api/properties';
import {
  createSavedProperty,
  deleteSavedProperty,
  fetchSavedProperties,
} from '../../api/savedProperties';
import type { Property } from '../../types';
import { propertyPhoto } from '../../lib/propertyImages';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SOLD: 'Sold',
  RENTED: 'Rented',
  UNDER_CONTRACT: 'Under contract',
  ARCHIVED: 'Archived',
};

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-400/30',
  DRAFT: 'bg-slate-700/80 text-slate-200 border-white/10',
  SOLD: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  RENTED: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  ARCHIVED: 'bg-gray-500/15 text-gray-200 border-gray-400/30',
};

const formatPrice = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function MyPropertiesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();

  const propertiesQuery = useQuery({
    queryKey: ['my-properties', search, status],
    queryFn: () =>
      getMyProperties({
        ...(search ? { search } : {}),
        ...(status ? { status: status as Property['status'] } : {}),
        limit: 100,
      }),
  });

  const savedQuery = useQuery({ queryKey: ['saved-properties'], queryFn: fetchSavedProperties });
  const savedIds = useMemo(
    () => new Set((savedQuery.data ?? []).map((record) => record.propertyId)),
    [savedQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: (property: Property) =>
      createSavedProperty({
        propertyId: property.id,
        title: property.title,
        neighborhood: property.neighborhood?.name ?? 'Addis Ababa',
        image: propertyPhoto({
          id: property.id,
          title: property.title,
          propertyType: property.propertyType,
          bedrooms: property.bedrooms,
        }),
        price: property.askingPrice,
        size: property.sizeSqm,
        beds: property.bedrooms,
        baths: property.bathrooms,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (propertyId: string) => deleteSavedProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (propertyId: string) => deleteProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-properties'] }),
  });

  const properties = propertiesQuery.data?.properties ?? [];
  const totals = useMemo(
    () => ({
      total: properties.length,
      approved: properties.filter((p) => p.status === 'APPROVED' || p.status === 'ACTIVE').length,
      pending: properties.filter((p) => p.status === 'PENDING').length,
      drafts: properties.filter((p) => p.status === 'DRAFT').length,
    }),
    [properties],
  );

  const toggleSave = (property: Property) => {
    if (savedIds.has(property.id)) unsaveMutation.mutate(property.id);
    else saveMutation.mutate(property);
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={Home}
        title="My Properties"
        description="The properties you own, exactly as they stand in the EstatePlus database."
        accent="sky"
        actions={
          <Link
            to="/app/my-properties/add"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="w-4 h-4" /> Add property
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
        <StatCard icon={Home} label="Total" value={totals.total} hint="owned properties" accent="sky" />
        <StatCard icon={Eye} label="Live" value={totals.approved} hint="approved and visible" accent="emerald" />
        <StatCard icon={AlertCircle} label="In review" value={totals.pending} hint="awaiting approval" accent="amber" />
        <StatCard icon={Pencil} label="Drafts" value={totals.drafts} hint="not submitted yet" accent="rose" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your properties by title or address…"
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {propertiesQuery.isLoading ? (
        <TableSkeleton rows={4} />
      ) : propertiesQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Your properties could not be loaded"
          message="The API did not respond. Nothing is displayed rather than example records."
          accent="rose"
        />
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          message="Add your first property and it will appear here with its live approval status."
          accent="sky"
          action={
            <Link
              to="/app/my-properties/add"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="w-4 h-4" /> Add property
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {properties.map((property) => (
            <article
              key={property.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60"
            >
              <div className="relative h-48 bg-slate-800">
                <img
                  src={propertyPhoto({
                    id: property.id,
                    title: property.title,
                    propertyType: property.propertyType,
                    bedrooms: property.bedrooms,
                  })}
                  alt={property.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span
                  className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    STATUS_STYLES[property.status] ?? STATUS_STYLES['DRAFT']
                  }`}
                >
                  {STATUS_LABELS[property.status] ?? property.status}
                </span>
                <button
                  onClick={() => toggleSave(property)}
                  title={savedIds.has(property.id) ? 'Remove from saved' : 'Save property'}
                  className="absolute right-3 top-3 rounded-full bg-slate-950/70 p-2 text-white hover:bg-slate-950"
                >
                  <Heart
                    className={`h-4 w-4 ${savedIds.has(property.id) ? 'fill-current text-rose-500' : ''}`}
                  />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <h3 className="text-lg font-bold text-white">{property.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                    <MapPin className="h-4 w-4" />
                    {property.neighborhood?.name ?? property.address ?? 'Addis Ababa'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-5 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Square className="h-4 w-4" /> {Math.round(property.sizeSqm)} m²
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bed className="h-4 w-4" /> {property.bedrooms} beds
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bath className="h-4 w-4" /> {property.bathrooms} baths
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Asking price</p>
                    <p className="text-xl font-bold text-white">{formatPrice(property.askingPrice)}</p>
                  </div>
                  {property.rentalPrice ? (
                    <p className="text-sm text-slate-400">
                      Rent {formatPrice(property.rentalPrice)}
                      <span className="text-slate-500"> / month</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/app/properties/${property.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                  >
                    <Eye className="h-4 w-4" /> View
                  </Link>
                  <Link
                    to={`/app/my-properties/edit/${property.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete “${property.title}”?`)) deleteMutation.mutate(property.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
