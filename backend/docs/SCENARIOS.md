# Scenario Analysis System

The Scenario Analysis System enables users to model and analyze the potential impact of various economic, policy, and market scenarios on the real estate market.

## Overview

The system supports comprehensive scenario modeling with:
- Multiple scenario types (economic shock, market shift, policy change, infrastructure, etc.)
- Advanced elasticity-based impact calculations
- Sensitivity analysis for parameter uncertainty
- Risk assessment and confidence scoring
- AI-powered market analysis and recommendations
- Scenario comparison capabilities

## Scenario Types

### 1. Economic Shock Scenarios
**Purpose**: Model impacts of macroeconomic changes

**Indicators**:
- Inflation rate changes
- Interest rate adjustments
- GDP growth fluctuations
- Unemployment rate changes
- Exchange rate volatility

**Use Cases**:
- Preparing for economic downturns
- Assessing inflation impacts on property values
- Planning for interest rate changes

### 2. Market Shift Scenarios
**Purpose**: Analyze supply-demand imbalances and sentiment changes

**Indicators**:
- Construction cost changes
- Foreign investment inflows/outflows
- Credit availability shifts
- Market sentiment indicators

**Use Cases**:
- Assessing market overheating risks
- Evaluating investment opportunities
- Understanding supply-demand dynamics

### 3. Policy Change Scenarios
**Purpose**: Model regulatory and government policy impacts

**Indicators**:
- Tax policy changes
- Rental regulation adjustments
- Foreign ownership rules
- Zoning and land use policies

**Use Cases**:
- Assessing policy compliance costs
- Evaluating regulatory risks
- Planning for policy-driven market changes

### 4. Local Development Scenarios
**Purpose**: Analyze neighborhood-specific developments

**Indicators**:
- Infrastructure investments
- Amenity development
- Local economic growth
- Community projects

**Use Cases**:
- Evaluating neighborhood investment potential
- Assessing development impact on property values
- Planning for local amenities

### 5. Infrastructure Scenarios
**Purpose**: Model major infrastructure project impacts

**Indicators**:
- Transportation improvements
- Utility upgrades
- Connectivity enhancements
- Public works projects

**Use Cases**:
- Assessing transit-oriented development value
- Evaluating infrastructure investment returns
- Understanding connectivity impacts

### 6. Demographic Change Scenarios
**Purpose**: Analyze population and migration effects

**Indicators**:
- Migration patterns
- Employment shifts
- Income growth trends
- Household formation rates

**Use Cases**:
- Assessing population-driven demand
- Evaluating employment impacts on housing
- Planning for demographic changes

## Elasticity Coefficients

The system uses empirically derived elasticity coefficients:

| Indicator | Price Elasticity | Rental Elasticity |
|-----------|-----------------|-------------------|
| Inflation | 0.6 | 0.5 |
| Interest Rate | -0.8 | 0.2 |
| Exchange Rate | 0.3 | 0.15 |
| Construction Cost | 0.4 | 0.1 |
| GDP Growth | 0.5 | 0.3 |
| Unemployment | -0.4 | -0.2 |
| Mortgage Rate | -0.7 | 0.1 |
| Foreign Investment | 0.4 | 0.2 |

## API Endpoints

### Create Scenario
```
POST /api/scenarios
```

Request:
```json
{
  "name": "Inflation Surge Scenario",
  "description": "Analyzes impact of 30% inflation increase",
  "type": "economic_shock",
  "parameters": [
    {
      "indicator": "inflation",
      "changePct": 30,
      "changeType": "increase",
      "weight": 1.2
    },
    {
      "indicator": "interest_rate",
      "changePct": 10,
      "changeType": "increase",
      "weight": 1.0
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Inflation Surge Scenario",
    "description": "Analyzes impact of 30% inflation increase",
    "type": "economic_shock",
    "parameters": [...],
    "createdBy": "uuid",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Run Scenario
```
POST /api/scenarios/{id}/run?neighborhoodId={uuid}
```

Response includes:
- Price and rental impact percentages
- Parameter breakdown with individual contributions
- Sensitivity analysis (high/medium/low sensitivity parameters)
- Risk assessment with confidence score
- Investment implications (buy/sell/hold recommendations)
- Market conditions assessment
- AI-powered explanation and analysis

### List Scenarios
```
GET /api/scenarios?type=economic_shock&page=1&limit=20
```

### Get Scenario Details
```
GET /api/scenarios/{id}
```

### Compare Scenarios
```
GET /api/scenarios/compare?ids=uuid1,uuid2,uuid3
```

### Delete Scenario
```
DELETE /api/scenarios/{id}
```

### Get Neighborhood Impact
```
GET /api/scenarios/neighborhood/{neighborhoodId}/impact
```

Returns all scenarios run for a neighborhood with summary statistics.

### Get Scenarios by Type
```
GET /api/scenarios/type/economic_shock
```

## Response Format

```json
{
  "success": true,
  "data": {
    "id": "result-uuid",
    "scenarioId": "scenario-uuid",
    "neighborhoodId": "neighborhood-uuid",
    "priceImpactPct": 12.5,
    "rentalImpactPct": 8.3,
    "demandImpact": "decrease",
    "supplyImpact": "increase",
    "calculatedResults": {
      "priceImpactPct": 12.5,
      "rentalImpactPct": 8.3,
      "breakdown": [
        {
          "indicator": "inflation",
          "changePct": 30,
          "priceImpact": 18.0,
          "rentalImpact": 15.0,
          "weight": 1.2
        }
      ],
      "totalWeight": 2.2,
      "avgPriceImpact": 5.68,
      "avgRentalImpact": 3.77
    },
    "sensitivityAnalysis": {
      "high": [
        { "indicator": "inflation", "changePct": 30, "priceImpact": 18.0, "rentalImpact": 15.0, "weight": 1.2 }
      ],
      "medium": [],
      "low": [
        { "indicator": "interest_rate", "changePct": 10, "priceImpact": -8.0, "rentalImpact": 2.0, "weight": 1.0 }
      ]
    },
    "riskAssessment": {
      "overall": "medium",
      "factors": ["Multiple parameters increase uncertainty", "Large parameter changes reduce accuracy"],
      "confidence": 0.65
    },
    "investmentImplications": [
      {
        "action": "hold",
        "rationale": "Moderate price increase suggests stable market conditions",
        "holdingPeriod": "medium_term"
      }
    ],
    "marketConditions": {
      "current": "moderate_growth",
      "projected": "steady_growth",
      "timeline": "medium_term"
    },
    "assumptions": {
      "model": "elasticity_coefficients",
      "scenarioType": "economic_shock",
      "disclaimer": "...",
      "coefficientsSource": "..."
    },
    "aiExplanation": "This scenario models a significant inflation surge...",
    "calculatedAt": "2024-01-15T10:35:00Z"
  }
}
```

## Risk Assessment

The system calculates risk based on:
- **Parameter count**: More parameters = higher uncertainty
- **Parameter magnitude**: Larger changes = lower accuracy
- **Sensitivity**: High sensitivity to multiple parameters increases risk
- **Scenario type**: Macroeconomic scenarios have higher uncertainty

Risk levels:
- **Low** (confidence > 0.7): Simple scenarios with small parameter changes
- **Medium** (confidence 0.5-0.7): Typical scenarios with reasonable assumptions
- **High** (confidence < 0.5): Complex scenarios with large parameter changes

## Investment Implications

The system generates specific investment recommendations based on:
- Price impact magnitude and direction
- Rental income impact
- Market conditions
- Risk assessment

Recommendations include:
- Action: buy/sell/hold/delay
- Rationale: Explanation of recommendation
- Expected return: Projected return percentage
- Holding period: short_term/medium_term/long_term

## AI Analysis

The system uses AI to provide market context:
- Plain-language explanation of scenario impacts
- Practical implications for investors
- Risk and opportunity assessment
- Actionable recommendations

## Use Cases

### 1. Investment Planning
```javascript
// Create a scenario for evaluating investment
const scenario = await createScenario({
  name: 'Addis Ababa Price Surge',
  type: 'economic_shock',
  parameters: [
    { indicator: 'inflation', changePct: 25, changeType: 'increase' },
    { indicator: 'interest_rate', changePct: 5, changeType: 'increase' }
  ]
});

// Run the scenario
const result = await runScenario(scenario.id);
console.log(`Expected price change: ${result.priceImpactPct}%`);
console.log(`Recommendation: ${result.investmentImplications[0].action}`);
```

### 2. Portfolio Risk Analysis
```javascript
// Compare multiple scenarios
const comparisons = await compareScenarios([scenario1.id, scenario2.id, scenario3.id]);
// Analyze which scenario has highest risk/return profile
```

### 3. Market Trend Analysis
```javascript
// Get neighborhood impact summary
const impact = await getNeighborhoodImpact(neighborhoodId);
console.log(`Average price impact: ${impact.summary.avgPriceImpact}%`);
console.log(`Volatility: ${impact.summary.volatility}%`);
```

## Limitations

1. **Historical Data**: Based on historical elasticity relationships; actual outcomes may differ
2. **External Factors**: Cannot predict unexpected market disruptions
3. **Data Quality**: Results depend on input parameter accuracy
4. **Market Specificity**: Elasticity coefficients are generalized; local adjustments may be needed

## Best Practices

1. **Multiple Scenarios**: Run multiple scenarios to understand range of possibilities
2. **Sensitivity Analysis**: Review high-sensitivity parameters for key drivers
3. **Risk Awareness**: Consider risk assessment when making decisions
4. **Time Horizon**: Align scenario timeframes with investment horizons
5. **Contextual Understanding**: Use AI explanations to understand practical implications

## Security

- Authentication required for all operations
- Authorization based on scenario ownership or admin role
- Audit logging for all scenario operations
- Rate limiting to prevent abuse