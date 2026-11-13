import { InquiryStatus, Prisma } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/utils/errors';
import { notificationService } from '../notifications/notifications.service';

const inquiryInclude = {
  property: {
    select: {
      id: true,
      title: true,
      address: true,
      neighborhood: { select: { name: true } },
    },
  },
  sender: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.InquiryInclude;

type InquiryRow = Prisma.InquiryGetPayload<{ include: typeof inquiryInclude }>;

/** API shape consumed by the owner workspace. */
export interface InquiryView {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  message: string;
  status: 'new' | 'responded' | 'closed';
  response?: string;
  createdAt: string;
  respondedAt?: string;
}

const STATUS_TO_VIEW: Record<InquiryStatus, InquiryView['status']> = {
  NEW: 'new',
  RESPONDED: 'responded',
  CLOSED: 'closed',
};

const toView = (row: InquiryRow): InquiryView => ({
  id: row.id,
  propertyId: row.propertyId,
  propertyTitle: row.property.title,
  propertyAddress:
    row.property.address?.trim() ||
    `${row.property.neighborhood?.name ?? 'Addis Ababa'}`,
  userName: row.name,
  userEmail: row.email,
  ...(row.phone ? { userPhone: row.phone } : {}),
  message: row.message,
  status: STATUS_TO_VIEW[row.status],
  ...(row.response ? { response: row.response } : {}),
  createdAt: row.createdAt.toISOString(),
  ...(row.respondedAt ? { respondedAt: row.respondedAt.toISOString() } : {}),
});

export interface ListInquiriesOptions {
  status?: InquiryStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateInquiryInput {
  propertyId: string;
  message: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface UpdateInquiryInput {
  status?: InquiryStatus;
  response?: string;
}

export class InquiryService {
  /**
   * Inquiries addressed to the signed-in user's listings. Admins see every
   * inquiry so they can step in on a disputed conversation.
   */
  async listForUser(
    userId: string,
    role: string,
    opts: ListInquiriesOptions,
  ): Promise<{ data: InquiryView[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const where: Prisma.InquiryWhereInput = {
      ...(role === 'admin' ? {} : { ownerId: userId }),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.search
        ? {
            OR: [
              { property: { title: { contains: opts.search, mode: 'insensitive' } } },
              { name: { contains: opts.search, mode: 'insensitive' } },
              { email: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: inquiryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.inquiry.count({ where }),
    ]);

    return {
      data: rows.map(toView),
      meta: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / opts.limit)),
      },
    };
  }

  /** Counts behind the owner workspace cards. */
  async stats(userId: string, role: string): Promise<Record<'total' | 'new' | 'responded' | 'closed', number>> {
    const scope = role === 'admin' ? {} : { ownerId: userId };
    const [total, unread, responded, closed] = await Promise.all([
      prisma.inquiry.count({ where: scope }),
      prisma.inquiry.count({ where: { ...scope, status: 'NEW' } }),
      prisma.inquiry.count({ where: { ...scope, status: 'RESPONDED' } }),
      prisma.inquiry.count({ where: { ...scope, status: 'CLOSED' } }),
    ]);
    return { total, new: unread, responded, closed };
  }

  /**
   * A prospective buyer messages the listing owner. The sender's profile
   * supplies the contact details unless they were typed explicitly.
   */
  async create(userId: string, input: CreateInquiryInput): Promise<InquiryView> {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, title: true, ownerId: true },
    });
    if (!property) throw new NotFoundError('Property');
    if (property.ownerId === userId) {
      throw new ValidationError('You cannot send an inquiry about your own listing');
    }

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const name = input.name?.trim() || `${sender?.firstName ?? ''} ${sender?.lastName ?? ''}`.trim();
    const email = input.email?.trim() || sender?.email || '';
    if (!name) throw new ValidationError('Your name is required');
    if (!email) throw new ValidationError('Your email is required');

    const row = await prisma.inquiry.create({
      data: {
        propertyId: property.id,
        ownerId: property.ownerId,
        senderId: userId,
        name: name.slice(0, 150),
        email: email.slice(0, 255),
        phone: input.phone?.trim() || null,
        message: input.message.trim().slice(0, 2000),
      },
      include: inquiryInclude,
    });

    await notificationService.createNotification({
      userId: property.ownerId,
      type: 'PROPERTY',
      title: 'New inquiry about your listing',
      body: `${name} asked about "${property.title}"`,
      link: '/app/inquiries',
    });

    return toView(row);
  }

  /** Owner replies, or moves the thread to responded/closed. */
  async update(userId: string, role: string, id: string, input: UpdateInquiryInput): Promise<InquiryView> {
    const existing = await prisma.inquiry.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) throw new NotFoundError('Inquiry');
    if (role !== 'admin' && existing.ownerId !== userId) {
      throw new ForbiddenError('You can only manage inquiries on your own listings');
    }

    const response = input.response?.trim();
    const status: InquiryStatus | undefined =
      input.status ?? (response ? 'RESPONDED' : undefined);

    const row = await prisma.inquiry.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(response ? { response: response.slice(0, 2000), respondedAt: new Date() } : {}),
        ...(status && status !== 'NEW' && !response ? { respondedAt: new Date() } : {}),
      },
      include: inquiryInclude,
    });

    if (row.senderId && response) {
      await notificationService.createNotification({
        userId: row.senderId,
        type: 'PROPERTY',
        title: 'Owner replied to your inquiry',
        body: `Reply about "${row.property.title}" is available in your inquiries.`,
        link: `/app/properties/${row.propertyId}`,
      });
    }

    return toView(row);
  }
}

export const inquiryService = new InquiryService();
