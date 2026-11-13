import { Prisma, ViewingStatus } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/utils/errors';

const viewingInclude = {
  property: {
    select: {
      id: true,
      title: true,
      address: true,
      neighborhood: { select: { name: true } },
    },
  },
} satisfies Prisma.ViewingInclude;

type ViewingRow = Prisma.ViewingGetPayload<{ include: typeof viewingInclude }>;

export interface ViewingView {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  createdAt: string;
}

const STATUS_TO_VIEW: Record<ViewingStatus, ViewingView['status']> = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no-show',
};

const STATUS_FROM_VIEW: Record<ViewingView['status'], ViewingStatus> = {
  scheduled: 'SCHEDULED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  'no-show': 'NO_SHOW',
};

const toView = (row: ViewingRow): ViewingView => ({
  id: row.id,
  propertyId: row.propertyId,
  propertyTitle: row.property.title,
  propertyAddress:
    row.property.address?.trim() || `${row.property.neighborhood?.name ?? 'Addis Ababa'}`,
  clientName: row.clientName,
  clientEmail: row.clientEmail,
  clientPhone: row.clientPhone ?? '',
  scheduledAt: row.scheduledAt.toISOString(),
  status: STATUS_TO_VIEW[row.status],
  ...(row.notes ? { notes: row.notes } : {}),
  createdAt: row.createdAt.toISOString(),
});

export interface ListViewingsOptions {
  status?: ViewingStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateViewingInput {
  propertyId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  scheduledAt: string;
  notes?: string;
}

export interface UpdateViewingInput {
  status?: ViewingStatus;
  scheduledAt?: string;
  notes?: string;
}

export class ViewingService {
  async listForUser(
    userId: string,
    role: string,
    opts: ListViewingsOptions,
  ): Promise<{ data: ViewingView[]; total: number }> {
    const where: Prisma.ViewingWhereInput = {
      ...(role === 'admin' ? {} : { ownerId: userId }),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.search
        ? {
            OR: [
              { property: { title: { contains: opts.search, mode: 'insensitive' } } },
              { clientName: { contains: opts.search, mode: 'insensitive' } },
              { clientEmail: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.viewing.findMany({
        where,
        include: viewingInclude,
        orderBy: { scheduledAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.viewing.count({ where }),
    ]);

    return { data: rows.map(toView), total };
  }

  async stats(
    userId: string,
    role: string,
  ): Promise<Record<'total' | 'scheduled' | 'completed' | 'cancelled' | 'noShow', number>> {
    const scope = role === 'admin' ? {} : { ownerId: userId };
    const [total, scheduled, completed, cancelled, noShow] = await Promise.all([
      prisma.viewing.count({ where: scope }),
      prisma.viewing.count({ where: { ...scope, status: 'SCHEDULED' } }),
      prisma.viewing.count({ where: { ...scope, status: 'COMPLETED' } }),
      prisma.viewing.count({ where: { ...scope, status: 'CANCELLED' } }),
      prisma.viewing.count({ where: { ...scope, status: 'NO_SHOW' } }),
    ]);
    return { total, scheduled, completed, cancelled, noShow };
  }

  async create(userId: string, role: string, input: CreateViewingInput): Promise<ViewingView> {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, ownerId: true },
    });
    if (!property) throw new NotFoundError('Property');
    if (role !== 'admin' && property.ownerId !== userId) {
      throw new ForbiddenError('You can only schedule viewings for your own listings');
    }

    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new ValidationError('A valid viewing date and time is required');

    const row = await prisma.viewing.create({
      data: {
        propertyId: property.id,
        ownerId: property.ownerId,
        clientName: input.clientName.trim().slice(0, 150),
        clientEmail: input.clientEmail.trim().slice(0, 255),
        clientPhone: input.clientPhone?.trim() || null,
        scheduledAt,
        notes: input.notes?.trim() || null,
      },
      include: viewingInclude,
    });

    return toView(row);
  }

  async update(
    userId: string,
    role: string,
    id: string,
    input: UpdateViewingInput,
  ): Promise<ViewingView> {
    const existing = await prisma.viewing.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) throw new NotFoundError('Viewing');
    if (role !== 'admin' && existing.ownerId !== userId) {
      throw new ForbiddenError('You can only manage viewings on your own listings');
    }

    let scheduledAt: Date | undefined;
    if (input.scheduledAt) {
      scheduledAt = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) throw new ValidationError('A valid viewing date and time is required');
    }

    const row = await prisma.viewing.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      },
      include: viewingInclude,
    });

    return toView(row);
  }

}

/** UI status ("no-show") → stored enum (NO_SHOW). */
export function viewingStatusFromView(value: unknown): ViewingStatus | undefined {
  if (typeof value !== 'string') return undefined;
  return (STATUS_FROM_VIEW as Record<string, ViewingStatus>)[value];
}

export const viewingService = new ViewingService();
