# Data Import System

The Data Import System provides automated data ingestion capabilities for the EstatePlus application using RabbitMQ for job queuing and processing.

## Overview

The system supports multiple types of data import operations:
- Property data import (CSV, JSON, Excel, API)
- Market statistics import
- Economic indicators import  
- Neighborhood data import (demographics, amenities, statistics)
- Image processing for property photos
- Data validation jobs
- Bulk operations (update, delete, export)

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  API Requests   │────│  Job Queue   │────│  Job Processors │
│  (REST API)     │    │  (RabbitMQ)  │    │  (Services)     │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                                            ┌─────────────────┐
                                            │    Database     │
                                            │  (PostgreSQL)   │
                                            └─────────────────┘
```

## Job Types

### 1. Property Import
- **Queue**: `property_import`
- **Formats**: CSV, JSON, Excel, API endpoints
- **Features**: 
  - Validation and deduplication
  - Batch processing
  - Error reporting
  - Automatic neighborhood creation

### 2. Market Data Import
- **Queue**: `market_data_import`
- **Types**: Price trends, sales volume, market metrics
- **Features**:
  - Calculates market statistics from property data
  - Supports multiple property types per neighborhood
  - Growth rate calculations

### 3. Economic Data Import
- **Queue**: `economic_data_import`
- **Sources**: NBE, CSA, World Bank APIs (simulated)
- **Indicators**: 20+ economic indicators including inflation, interest rates, GDP growth
- **Features**:
  - Multiple data source support
  - Correlation analysis triggers
  - Real estate market impact analysis

### 4. Neighborhood Data Import
- **Queue**: `neighborhood_data_import`
- **Types**: Demographics, amenities, statistics, geographic data
- **Features**:
  - Amenity management (24 types)
  - Statistical tracking (15+ metrics)
  - Geographic data updates

### 5. Image Processing
- **Queue**: `image_processing`
- **Operations**: Resize, watermark, optimization, metadata extraction
- **Features**:
  - Multiple image format support
  - Batch processing
  - Property image management

### 6. Data Validation
- **Queue**: `data_validation`
- **Rules**: Configurable validation rules
- **Features**:
  - Custom validation logic
  - Batch validation
  - Detailed error reporting

### 7. Bulk Operations
- **Queue**: `bulk_operations`
- **Operations**: Status updates, deletion, export
- **Features**:
  - Safe bulk operations
  - Export functionality
  - Audit logging

## API Endpoints

### Schedule Import Job
```
POST /api/data-import/jobs
```

Request body:
```json
{
  "type": "property_import",
  "payload": {
    "sourceId": "uuid",
    "fileName": "properties.csv",
    "options": {
      "skipDuplicates": true,
      "validateOnly": false,
      "batchSize": 100
    }
  }
}
```

### Get Job History
```
GET /api/data-import/jobs?status=completed&page=1&limit=20
```

### Get Job Details
```
GET /api/data-import/jobs/{jobId}
```

### Queue Health Check
```
GET /api/data-import/queue-health
```

### Import Statistics
```
GET /api/data-import/statistics
```

### Data Validation
```
POST /api/data-import/validate
```

## Configuration

### Environment Variables
```env
RABBITMQ_URL=amqp://localhost:5672
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

### Queue Configuration
The system automatically creates and manages the following queues:
- `property_import`
- `market_data_import` 
- `economic_data_import`
- `neighborhood_data_import`
- `image_processing`
- `email_notifications`
- `data_validation`
- `bulk_operations`

## Job Processing Flow

1. **Job Submission**: Client submits job via REST API
2. **Queue Scheduling**: Job is added to appropriate RabbitMQ queue
3. **Job Processing**: Worker consumes job and processes data
4. **Progress Tracking**: Job status is updated in database
5. **Result Storage**: Results and errors are stored
6. **Notifications**: Optional email notifications sent

## Error Handling

- **Validation Errors**: Data validation failures are captured with detailed error messages
- **Processing Errors**: System errors during processing are logged and reported
- **Retry Logic**: Failed jobs can be retried with exponential backoff
- **Dead Letter Queue**: Persistently failing jobs are moved to dead letter queue

## Data Sources

The system supports multiple data source types:

### CSV Files
- Standard CSV format with headers
- Automatic field mapping
- Data type inference

### JSON Files
- Structured JSON data
- Nested object support
- Array processing

### Excel Files
- XLSX and XLS formats
- Multi-sheet support
- Formula evaluation

### API Endpoints
- REST API integration
- Authentication support
- Rate limiting handling

### Database Sources
- External database connections
- SQL query execution
- Incremental data loading

## Performance

- **Batch Processing**: Large datasets are processed in configurable batches
- **Parallel Processing**: Multiple workers can process jobs concurrently
- **Memory Management**: Streaming processing for large files
- **Caching**: Redis caching for frequently accessed data

## Monitoring

### Metrics Tracked
- Job completion rates
- Processing times
- Error rates
- Queue depths
- Resource utilization

### Health Checks
- Database connectivity
- RabbitMQ connectivity
- Redis connectivity
- Queue status

### Logging
- Structured logging with correlation IDs
- Error tracking and alerting
- Performance monitoring
- Audit trail

## Usage Examples

### Import Properties from CSV
```javascript
const response = await fetch('/api/data-import/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'property_import',
    payload: {
      fileName: 'properties.csv',
      options: {
        skipDuplicates: true,
        batchSize: 100
      }
    }
  })
});
```

### Schedule Market Data Update
```javascript
const response = await fetch('/api/data-import/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'market_data_import',
    payload: {
      dataType: 'price_trends',
      period: '2024-03',
      neighborhoods: ['uuid1', 'uuid2']
    }
  })
});
```

### Bulk Update Property Status
```javascript
const response = await fetch('/api/data-import/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'bulk_operation',
    payload: {
      operation: 'bulk_update_status',
      resourceType: 'properties',
      resourceIds: ['uuid1', 'uuid2', 'uuid3'],
      parameters: {
        status: 'ACTIVE'
      }
    }
  })
});
```

## Security

- **Authentication**: All endpoints require valid JWT tokens
- **Authorization**: Role-based permissions (IMPORT_DATA, VIEW_IMPORT_JOBS, etc.)
- **Input Validation**: All input data is validated and sanitized
- **Audit Logging**: All import operations are logged for compliance
- **Rate Limiting**: API endpoints have rate limiting to prevent abuse

## Troubleshooting

### Common Issues

1. **RabbitMQ Connection Failed**
   - Check RABBITMQ_URL configuration
   - Verify RabbitMQ server is running
   - Check network connectivity

2. **Job Processing Stuck**
   - Check queue health endpoint
   - Review worker logs
   - Verify database connectivity

3. **High Error Rates**
   - Review data validation rules
   - Check source data quality
   - Verify field mappings

4. **Memory Issues**
   - Reduce batch sizes
   - Enable streaming processing
   - Monitor resource usage

### Support

For technical support or feature requests, please:
1. Check the logs for detailed error messages
2. Review the API documentation
3. Contact the development team with relevant details