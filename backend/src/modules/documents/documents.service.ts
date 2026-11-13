import { Prisma } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/utils/errors';

const documentInclude = {
  property: { select: { id: true, title: true } },
} satisfies Prisma.PropertyDocumentInclude;

type DocumentRow = Prisma.PropertyDocumentGetPayload<{ include: typeof documentInclude }>;

export interface DocumentView {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  propertyId?: string;
  propertyTitle?: string;
  createdAt: string;
}

/** Metadata only — the bytes are streamed by `readFile`. */
const toView = (row: DocumentRow): DocumentView => ({
  id: row.id,
  name: row.name,
  category: row.category,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  ...(row.propertyId ? { propertyId: row.propertyId } : {}),
  ...(row.property ? { propertyTitle: row.property.title } : {}),
  createdAt: row.createdAt.toISOString(),
});

export interface UploadDocumentInput {
  file: Express.Multer.File;
  category: string;
  name?: string;
  propertyId?: string;
}

export interface StoredFile {
  name: string;
  mimeType: string;
  data: Buffer;
}

export class DocumentService {
  async listForUser(userId: string, role: string): Promise<DocumentView[]> {
    const rows = await prisma.propertyDocument.findMany({
      where: role === 'admin' ? {} : { ownerId: userId },
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toView);
  }

  async upload(userId: string, role: string, input: UploadDocumentInput): Promise<DocumentView> {
    if (!input.file) throw new ValidationError('A file is required');
    if (input.file.size === 0) throw new ValidationError('The uploaded file is empty');

    if (input.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: input.propertyId },
        select: { ownerId: true },
      });
      if (!property) throw new NotFoundError('Property');
      if (role !== 'admin' && property.ownerId !== userId) {
        throw new ForbiddenError('You can only attach documents to your own listings');
      }
    }

    const originalName = input.file.originalname?.trim() || 'document';
    const row = await prisma.propertyDocument.create({
      data: {
        ownerId: userId,
        propertyId: input.propertyId ?? null,
        name: (input.name?.trim() || originalName).slice(0, 255),
        category: (input.category?.trim() || 'Other').slice(0, 60),
        mimeType: (input.file.mimetype || 'application/octet-stream').slice(0, 120),
        sizeBytes: input.file.size,
        data: input.file.buffer,
      },
      include: documentInclude,
    });

    return toView(row);
  }

  /** Signed-in access check plus the bytes for a download/preview response. */
  async readFile(userId: string, role: string, id: string): Promise<StoredFile> {
    const row = await prisma.propertyDocument.findUnique({
      where: { id },
      select: { ownerId: true, name: true, mimeType: true, data: true },
    });
    if (!row) throw new NotFoundError('Document');
    if (role !== 'admin' && row.ownerId !== userId) {
      throw new ForbiddenError('You can only open your own documents');
    }
    return { name: row.name, mimeType: row.mimeType, data: Buffer.from(row.data) };
  }

  async remove(userId: string, role: string, id: string): Promise<{ id: string }> {
    const row = await prisma.propertyDocument.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!row) throw new NotFoundError('Document');
    if (role !== 'admin' && row.ownerId !== userId) {
      throw new ForbiddenError('You can only delete your own documents');
    }
    await prisma.propertyDocument.delete({ where: { id } });
    return { id };
  }
}

export const documentService = new DocumentService();
