import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  propertyType: z.string().optional(),
  listingType: z.enum(['sale', 'rent', 'both']).optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  subcity: z.string().optional(),
  neighborhood: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'size_desc']).optional(),
});

export type SearchQueryDto = z.infer<typeof searchQuerySchema>;
