import argon2 from 'argon2';
import { Prisma, UserRole as PrismaUserRole } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../shared/utils/errors';
import { buildPaginationMeta } from '../../shared/utils/response';

export type UserRole = 'ADMIN' | 'ANALYST' | 'PROPERTY_OWNER' | 'USER';

export interface UserServiceUpdateInput {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface MyProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  profilePicture?: string | null;
}

/** Snapshot captured when a user saves a property (mirrors the /users payload). */
export interface SavePropertyDto {
  propertyId: string;
  title: string;
  neighborhood: string;
  image?: string;
  price: number;
  size?: number | null;
  beds?: number;
  baths?: number;
}

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  authProvider: true,
  profilePicture: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const adminUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  authProvider: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Routes accept lowercase roles; Prisma enums are uppercase. */
function toPrismaRole(role: string): PrismaUserRole {
  const upper = role.toUpperCase();
  if (upper === 'PROPERTY_OWNER' || upper === 'ANALYST' || upper === 'ADMIN' || upper === 'USER') {
    return upper as PrismaUserRole;
  }
  throw new BadRequestError(`Unknown role: ${role}`);
}

const savedPropertyInclude = {
  property: {
    select: {
      id: true,
      title: true,
      askingPrice: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
      neighborhood: { select: { name: true } },
      images: { take: 1, orderBy: { isPrimary: 'desc' as const }, select: { imageUrl: true } },
    },
  },
} satisfies Prisma.SavedPropertyInclude;

// ─── Own account ───────────────────────────────────────────────────────────

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function updateMe(userId: string, input: MyProfileUpdateInput) {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw new NotFoundError('User');

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.profilePicture !== undefined ? { profilePicture: input.profilePicture } : {}),
    },
    select: profileSelect,
  });
}

/** Avatars are stored inline as a data URL; no external object storage needed. */
export async function setAvatar(userId: string, file: Express.Multer.File) {
  if (!file?.buffer || file.size === 0) throw new BadRequestError('No image uploaded');
  if (!file.mimetype.startsWith('image/')) throw new BadRequestError('Only image files are allowed');

  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  await prisma.user.update({ where: { id: userId }, data: { profilePicture: dataUrl } });
  return { profilePicture: dataUrl };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new NotFoundError('User');
  if (!user.passwordHash) {
    throw new BadRequestError('This account signs in with Google/Microsoft and has no local password');
  }

  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(newPassword), lastPasswordChange: new Date() },
  });
}

// ─── Saved properties (snapshot-backed) ────────────────────────────────────

function mapSavedRow(row: Prisma.SavedPropertyGetPayload<{ include: typeof savedPropertyInclude }>) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    title: row.title ?? row.property.title,
    neighborhood: row.neighborhood ?? row.property.neighborhood?.name ?? '',
    image: row.image ?? row.property.images[0]?.imageUrl ?? '',
    price: Number(row.price ?? row.property.askingPrice),
    size: row.size != null ? Number(row.size) : Number(row.property.sizeSqm),
    beds: row.beds ?? row.property.bedrooms,
    baths: row.baths ?? row.property.bathrooms,
    notes: row.notes,
    tags: row.tags,
    createdAt: row.savedAt,
  };
}

export async function listSavedProperties(userId: string) {
  const rows = await prisma.savedProperty.findMany({
    where: { userId },
    orderBy: { savedAt: 'desc' },
    include: savedPropertyInclude,
  });
  return rows.map(mapSavedRow);
}

export async function saveProperty(userId: string, dto: SavePropertyDto) {
  const property = await prisma.property.findUnique({ where: { id: dto.propertyId } });
  if (!property) throw new NotFoundError('Property');

  // Upsert on the (user, property) unique pair so re-saving updates the snapshot.
  const row = await prisma.savedProperty.upsert({
    where: { userId_propertyId: { userId, propertyId: dto.propertyId } },
    update: {
      title: dto.title,
      neighborhood: dto.neighborhood,
      image: dto.image,
      price: dto.price,
      size: dto.size ?? null,
      beds: dto.beds ?? null,
      baths: dto.baths ?? null,
    },
    create: {
      userId,
      propertyId: dto.propertyId,
      title: dto.title,
      neighborhood: dto.neighborhood,
      image: dto.image,
      price: dto.price,
      size: dto.size ?? null,
      beds: dto.beds ?? null,
      baths: dto.baths ?? null,
    },
    include: savedPropertyInclude,
  });

  return mapSavedRow(row);
}

export async function removeSavedProperty(userId: string, propertyId: string) {
  const existing = await prisma.savedProperty.findFirst({
    where: { userId, propertyId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Saved property');

  await prisma.savedProperty.delete({ where: { id: existing.id } });
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function listUsers(input: {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
}) {
  const result = await searchUsers({
    query: input.search,
    role: input.role ? toPrismaRole(input.role) : undefined,
    page: input.page,
    limit: input.limit,
  });

  return {
    users: result.users,
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: adminUserSelect });
  if (!user) throw new NotFoundError('User');
  return user;
}

/** Soft delete: deactivating keeps audit history and owned properties intact. */
export async function deleteUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new NotFoundError('User');
  await prisma.user.update({ where: { id }, data: { isActive: false } });
}

// ─── Shared lookups ────────────────────────────────────────────────────────

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function searchUsers(input: {
  query?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, Number(input.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (input.query) {
    where.OR = [
      { email: { contains: input.query, mode: 'insensitive' } },
      { firstName: { contains: input.query, mode: 'insensitive' } },
      { lastName: { contains: input.query, mode: 'insensitive' } },
    ];
  }

  if (input.role) {
    where.role = toPrismaRole(input.role);
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: adminUserSelect }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function updateUser(id: string, input: UserServiceUpdateInput) {
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('User');

  const data: Prisma.UserUpdateInput = {
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
    ...(input.role ? { role: toPrismaRole(input.role) } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };

  return prisma.user.update({ where: { id }, data, select: adminUserSelect });
}

export async function toggleUserActive(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!user) throw new NotFoundError('User');

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: adminUserSelect,
  });
}

export async function countUsersByRole(role: UserRole) {
  return prisma.user.count({ where: { role: toPrismaRole(role) } });
}

export async function getSavedProperties(
  userId: string,
  input: { page?: number; limit?: number; sort?: 'newest' | 'oldest' },
) {
  const page = Math.max(1, Number(input.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));
  const skip = (page - 1) * limit;

  const where: Prisma.SavedPropertyWhereInput = { userId };
  const orderBy: Prisma.SavedPropertyOrderByWithRelationInput =
    input.sort === 'oldest' ? { savedAt: 'asc' } : { savedAt: 'desc' };

  const [rows, total] = await Promise.all([
    prisma.savedProperty.findMany({ where, skip, take: limit, orderBy, include: savedPropertyInclude }),
    prisma.savedProperty.count({ where }),
  ]);

  return {
    items: rows.map(mapSavedRow),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
