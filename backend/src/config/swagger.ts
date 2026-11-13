import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Real Estate Market Intelligence API',
      version: '1.0.0',
      description: 'REST API for Addis Ababa real estate market intelligence system',
      contact: {
        name: 'API Support',
        email: 'support@realestateiq.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}${config.API_PREFIX}`,
        description: 'Development server',
      },
      {
        url: `https://api.realestateiq.com${config.API_PREFIX}`,
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT access token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'analyst', 'user'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Property: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            propertyType: { type: 'string', enum: ['apartment', 'house', 'villa', 'commercial', 'land', 'office'] },
            condition: { type: 'string', enum: ['new', 'excellent', 'good', 'fair', 'needs_renovation'] },
            neighborhoodId: { type: 'string', format: 'uuid' },
            sizeSqm: { type: 'number' },
            bedrooms: { type: 'integer' },
            bathrooms: { type: 'integer' },
            askingPrice: { type: 'number' },
            rentalPrice: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive', 'sold', 'rented', 'pending'] },
            listingDate: { type: 'string', format: 'date' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        MarketStats: {
          type: 'object',
          properties: {
            period: { type: 'string', example: '2024-03' },
            avgPrice: { type: 'number' },
            medianPrice: { type: 'number' },
            pricePerSqm: { type: 'number' },
            avgRentalPrice: { type: 'number' },
            rentalYield: { type: 'number' },
            priceGrowth: { type: 'number' },
            rentGrowth: { type: 'number' },
            activeListings: { type: 'integer' },
            calculatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Neighborhood: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            city: { type: 'string' },
            description: { type: 'string', nullable: true },
            areaSqkm: { type: 'number', nullable: true },
          },
        },
        Forecast: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            forecastType: { type: 'string', enum: ['price', 'rental'] },
            baseValue: { type: 'number' },
            forecastMonths: { type: 'integer' },
            rSquared: { type: 'number', nullable: true },
            forecastData: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string' },
                  value: { type: 'number' },
                  confidence: { type: 'number' },
                },
              },
            },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Properties', description: 'Property management and search' },
      { name: 'Market', description: 'Market statistics and trends' },
      { name: 'Neighborhoods', description: 'Neighborhood analysis' },
      { name: 'Valuation', description: 'Property valuation' },
      { name: 'Forecasting', description: 'Market forecasts' },
      { name: 'Economics', description: 'Economic indicators' },
      { name: 'Scenarios', description: 'Scenario analysis' },
      { name: 'AI', description: 'AI market assistant' },
      { name: 'Ingestion', description: 'Data import' },
    ],
  },
  apis: ['./src/modules/*//*.routes.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
