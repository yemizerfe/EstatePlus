# Forecasting Engine

The Forecasting Engine provides advanced property price and rental forecasting capabilities using multiple statistical models and market indicators.

## Overview

The forecasting system generates predictions for property prices and rental yields using:
- Historical market data analysis
- Multiple forecasting models (linear, exponential, moving average, ensemble)
- Trend detection and seasonality analysis
- Investment recommendations based on market conditions
- Confidence intervals for predictions

## Features

### Multi-Model Forecasting

The engine supports four forecasting models:

1. **Linear Regression**: Simple trend extrapolation assuming constant growth rate
2. **Exponential Smoothing**: Weighted average of past values with recent data weighted more heavily
3. **Moving Average**: Smooths out short-term fluctuations to show longer-term trends
4. **Ensemble**: Combines all models with weighted averaging based on R² scores

### Investment Recommendations

The system analyzes market data to provide investment recommendations:

- **Buy**: Strong upward trend with >5% expected price increase
- **Sell**: Downward trend with >5% expected decline
- **Hold**: Stable market or mixed signals

Each recommendation includes:
- Confidence score (0-1)
- Rationale explanation
- Target price
- Expected return percentage
- Risk level (low/medium/high)

### Forecast Comparison

Compare forecasts across:
- Different property types (apartments, villas, offices, etc.)
- Different neighborhoods
- Price vs rental forecasts

### Market Summary

Get a comprehensive market outlook including:
- Forecasts for all neighborhoods
- Market outlook (Strong Buy/Bullish/Neutral/Negative)
- Property type recommendations

## API Endpoints

### Get Forecast
```
GET /api/forecasts?neighborhoodId=<uuid>&propertyType=APARTMENT&forecastType=price&months=6&model=ensemble
```

Parameters:
- `neighborhoodId` (optional): UUID of neighborhood to forecast
- `propertyType` (optional): APARTMENT, VILLA, CONDOMINIUM, OFFICE, RETAIL, WAREHOUSE, LAND
- `forecastType` (required): "price" or "rental"
- `months` (optional): 1-24, default 6
- `model` (optional): linear, exponential, moving_average, ensemble

Response includes:
- Base value and forecast values for each month
- Confidence intervals (upper/lower bounds)
- Trend statistics (direction, strength)
- Investment recommendation
- Historical data used for prediction

### Get Market Summary
```
GET /api/forecasts/summary
```

Returns forecast summary for all neighborhoods including:
- Current and forecasted prices
- Trend direction
- Investment recommendations

### Compare Property Types
```
GET /api/forecasts/compare?neighborhoodId=<uuid>&propertyTypes=APARTMENT,VILLA&forecastType=price
```

Compares forecasts across multiple property types in a neighborhood.

### Get Specific Forecast
```
GET /api/forecasts/{id}
```

Retrieves a previously generated forecast by ID.

## Response Format

```json
{
  "success": true,
  "data": {
    "id": "forecast-uuid",
    "neighborhoodId": "neighborhood-uuid",
    "propertyType": "APARTMENT",
    "forecastType": "price",
    "baseValue": 1500000,
    "forecastMonths": 6,
    "trendSlope": 15000,
    "rSquared": 0.85,
    "model": "ensemble",
    "forecastData": [
      {
        "month": "2024-07",
        "value": 1550000,
        "confidence": 0.85,
        "upperBound": 1600000,
        "lowerBound": 1500000
      }
    ],
    "historicalData": [
      { "month": "2023-07", "value": 1200000 }
    ],
    "statistics": {
      "avgHistorical": 1350000,
      "volatility": 150000,
      "trendDirection": "bullish",
      "trendStrength": 0.75,
      "seasonalPattern": true
    },
    "investmentRecommendation": {
      "action": "buy",
      "confidence": 0.72,
      "rationale": "Strong upward trend with expected price increase",
      "targetPrice": 1800000,
      "expectedReturn": 12.5,
      "riskLevel": "medium"
    },
    "comparableForecasts": [
      { "neighborhood": "Bole", "forecastValue": 1650000, "comparison": "10% higher" }
    ],
    "generatedAt": "2024-01-15T10:30:00Z",
    "disclaimer": "This forecast is based on historical trends..."
  }
}
```

## Technical Details

### Data Requirements

- Minimum 3 months of historical market data required for forecasting
- More data points improve accuracy (recommended 12+ months)
- Data is automatically cached for performance

### Model Selection

- **linear**: Best for markets with steady, consistent growth
- **exponential**: Good for markets with accelerating growth/decline
- **moving_average**: Smooths out volatility, good for uncertain markets
- **ensemble** (recommended): Combines all models for most robust predictions

### Confidence Calculation

Confidence is calculated based on:
- R² score of the regression model
- Trend consistency (how long the trend has been maintained)
- Volatility (lower volatility = higher confidence)
- Number of data points used

### Limitations

1. **Data Quality**: Forecasts depend on quality of historical market data
2. **Market Events**: Cannot predict major market disruptions or external shocks
3. **External Factors**: Doesn't account for policy changes, economic crises, or natural disasters
4. **Geographic Scope**: Most accurate for areas with sufficient transaction volume

## Cache Strategy

Forecasts are cached to improve performance:
- Individual forecasts: 1 hour TTL
- Market summary: 5 minutes TTL
- Cache is invalidated when new market data is imported

## Event Publishing

When a forecast is generated, events are published to Kafka:
- Topic: `forecast-events`
- Event: `FORECAST_COMPLETED`
- Payload includes forecast ID, type, and parameters

## Usage Example

```javascript
// Get price forecast for Bole neighborhood
const response = await fetch('/api/forecasts?neighborhoodId=<uuid>&forecastType=price&months=12&model=ensemble');
const forecast = await response.json();

if (forecast.data.investmentRecommendation.action === 'buy') {
  console.log(`Recommended to buy! Expected return: ${forecast.data.investmentRecommendation.expectedReturn}%`);
}

// Get comparison across property types
const comparison = await fetch('/api/forecasts/compare?neighborhoodId=<uuid>&propertyTypes=APARTMENT,VILLA,OFFICE');
const result = await comparison.json();

console.log(`Best investment: ${result.data.bestInvestment.propertyType}`);
```

## Error Handling

- **Insufficient Data**: Returns message indicating minimum data requirements not met
- **Invalid Parameters**: Validates all input parameters with descriptive errors
- **Service Unavailable**: Returns 503 if Redis or database is unavailable

## Disclaimer

This forecasting system is provided for informational purposes only. It does not constitute financial advice. Users should:
- Verify forecasts with local market expertise
- Consider their individual financial situation
- Account for factors the model cannot predict
- Not rely solely on forecasts for investment decisions