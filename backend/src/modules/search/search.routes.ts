import { Router, Request, Response, NextFunction } from 'express';
import { searchQuerySchema, SearchQueryDto } from './dto/search.dto';
import { searchProperties, validateSearchFilters } from './search.service';
import { ValidationError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Zod schema (not an express-validator chain) — parse and reject inline.
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'query',
          message: issue.message,
        })),
      );
    }
    const query = parsed.data as SearchQueryDto;
    validateSearchFilters(query);

    const result = await searchProperties({
      q: query.q,
      propertyType: query.propertyType,
      listingType: query.listingType,
      bedrooms: query.bedrooms ?? undefined,
      bathrooms: query.bathrooms ?? undefined,
      minPrice: query.minPrice ?? undefined,
      maxPrice: query.maxPrice ?? undefined,
      neighborhood: query.subcity ?? query.neighborhood ?? undefined,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ msg: 'Search failed', error });
    next(error);
  }
});

export default router;
