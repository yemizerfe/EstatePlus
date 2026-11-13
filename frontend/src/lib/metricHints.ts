/**
 * Plain-language explanations for the figures the analyst pages display.
 *
 * Each hint answers the three questions a non-specialist usually has: what the
 * number is, how it was calculated from our records, and what it does and does
 * not tell them. They intentionally avoid statistical jargon.
 */

export const METRIC_HINTS = {
  medianAskingPrice:
    'The middle asking price when every eligible sale listing is sorted from cheapest to dearest. Half of the listings ask more and half ask less. It is not an average, so one very expensive villa cannot pull it up.',

  averageAskingPrice:
    'The total of all asking prices divided by the number of listings. A few very expensive properties can pull an average up, which is why the median is shown next to it.',

  pricePerSqm:
    'Asking price divided by the property size in square metres. This lets you compare a small apartment with a large villa on the same footing.',

  medianMonthlyRent:
    'The middle monthly rent when every eligible rental listing is sorted from cheapest to dearest. Half of the rentals ask more and half ask less.',

  averageMonthlyRent:
    'The total of all recorded monthly rents divided by the number of rental listings. A few luxury rentals can pull an average up, which is why the median rent is a better guide to a typical home.',

  saleGrowth:
    'The percentage change in the median sale price between the latest month with recorded sale listings and the month before it. It compares the same area and property type, not a fixed basket of homes.',

  rentGrowth:
    'The percentage change in the median monthly rent between the latest month with recorded rentals and the month before it.',

  activeListings:
    'Properties currently advertised for sale or rent in our records. It measures how much choice buyers and tenants have, not how many sales have happened.',

  sampleSize:
    'The number of listings the figure is calculated from. A small sample (for example n=3) is still a real median, but one unusual listing can move it a lot, so treat it as indicative.',

  localSample:
    'How many listings recorded inside this specific area back the figure. When this is zero, the number shown comes from the wider city sample and is marked as citywide.',

  citywideSample:
    'The area had too few listings of its own, so the figure uses the Addis Ababa-wide sample. It describes the city, not this neighbourhood.',

  rentalYield:
    'A rough yearly return if you bought at the median asking price and rented at the median monthly rent: (monthly rent × 12) ÷ asking price. It ignores purchase costs, vacancy and maintenance.',

  daysOnMarket:
    'Days between the date a listing was recorded and today. Because we only store first-seen listings, this measures listing age, not how long a property actually took to sell.',

  listingCount:
    'How many approved listings from our records fall in this view. Listings are only counted when their price was stated in Ethiopian birr.',

  propertyTypeMix:
    'The share of recorded listings in each property type. It shows what is being advertised, not what the whole city contains.',

  priceDistribution:
    'How many recorded listings sit in each price band. The bands are built from the listings themselves, so this shows where the market is concentrated.',

  inflationRate:
    'The annual percentage change in consumer prices. When it is higher than rental growth, rents are losing buying power in real terms.',

  gdpGrowth:
    'The annual percentage change in the size of the economy. Faster growth usually supports demand for housing, but it does not set prices on its own.',

  interestRate:
    'The policy or lending rate quoted as an annual percentage. Higher rates make mortgages more expensive and usually cool buyer demand.',

  exchangeRate:
    'How many Ethiopian birr one US dollar buys. A rising number means the birr is weakening, which raises the birr cost of imported building materials.',

  consumerPriceIndex:
    'An index of the cost of a typical basket of goods, expressed relative to a base period. The level matters less than its change over time.',

  cpiChange:
    'The percentage change in the consumer price index over the period. It is another way of reading inflation.',

  constructionCost:
    'The cost of building per square metre, in the unit recorded by the source. It feeds into the replacement cost that sellers consider when setting a price.',

  mortgageRate:
    'The annual interest rate a buyer would pay on a home loan. It changes what a household can afford each month without changing the asking price.',

  marketRows:
    'Each row is one market snapshot: a period, an area (or city-wide) and a property type. Reading rows together shows which segment moved.',

  economicIndicatorValue:
    'The latest observation recorded by the named source, shown with its own unit. Values are never interpolated or invented; a missing month stays missing.',

  trendChange:
    'The difference between the first and last recorded month in the selected window. Short windows exaggerate changes, so the sample size matters.',

  confidence: {
    high: 'Based on 5 or more listings, so the figure is reasonably stable.',
    medium: 'Based on 3–4 listings. Useful as a guide, but one unusual listing can move it.',
    low: 'Based on 1–2 listings. Treat it as a data point, not a market-wide truth.',
  },

  correlation:
    'A score from -1 to +1 showing how often two things move together. +0.7 or higher means they usually rise together; around 0 means no clear link; negative values mean one tends to fall as the other rises. A high score is still not proof that one causes the other.',

  priceBandShare:
    'The share of sampled listings that fall inside this price band. Add the bands together and you get 100% of the sample.',

  priceRange:
    'The cheapest and the most expensive listing in this property type. A wide range means that type covers very different homes.',

  minPrice: 'The lowest asking price among the listings counted here.',

  maxPrice: 'The highest asking price among the listings counted here.',
} as const;

/** Plain-language explanations for each economic indicator we publish. */
export const ECONOMIC_INDICATOR_HINTS: Record<string, string> = {
  INFLATION:
    'How fast consumer prices are rising per year. 10% means a basket of goods that cost 100 birr a year ago costs about 110 birr now. It erodes the value of rent and savings.',
  INTEREST_RATES:
    'The rate banks charge on loans, as an annual percentage. Higher rates make mortgages costlier and usually soften buyer demand.',
  GDP_GROWTH:
    'How much the economy grew against the previous year, after removing price effects. Faster growth normally supports housing demand.',
  UNEMPLOYMENT:
    'The share of the labour force without work. It shapes how many households can commit to a mortgage or a long lease.',
  CONSTRUCTION_COSTS:
    'What it costs to build, in the currency the source reports. When this climbs, new supply gets more expensive and asking prices follow.',
  MORTGAGE_RATES:
    'The annual interest rate on a home loan. It changes the monthly payment a buyer can carry, even when the asking price is unchanged.',
  EXCHANGE_RATES:
    'How many Ethiopian birr one US dollar buys. A higher number means the birr is weaker, which makes imported building materials costlier.',
  CONSUMER_CONFIDENCE:
    'A survey index of how optimistic households feel. Above its usual level suggests willingness to buy; below it suggests caution.',
  HOUSING_STARTS:
    'The number of new homes whose construction began. It is an early sign of how much supply will reach the market in a few years.',
  BUILDING_PERMITS:
    'Approvals granted to build. Permits come before construction, so this is the earliest signal of future supply.',
  RETAIL_SALES:
    'Total value of retail spending. Rising sales usually mean stronger household finances and more commercial rent demand.',
  INDUSTRIAL_PRODUCTION:
    'An index of factory output. It is read as a change over time, not as a money amount.',
  PPI:
    'The producer price index: the cost of goods at the factory gate, relative to a base period. It often foreshadows consumer inflation.',
  CPI:
    'The consumer price index: the cost of a typical household basket relative to a base period. The level matters less than how fast it moves.',
  WAGE_GROWTH:
    'The yearly change in average pay. When pay grows slower than rent, tenants feel affordability pressure.',
  POPULATION_GROWTH:
    'The yearly change in the number of residents. More people usually means more demand for homes.',
  MIGRATION:
    'Net people moving into or out of the area. Positive numbers add housing demand; negative numbers reduce it.',
  INFRASTRUCTURE_SPENDING:
    'Public money committed to roads, utilities and similar works. New infrastructure can lift nearby property values.',
  TAX_RATES:
    'The percentage levied on property transactions or income, depending on the source. Higher taxes reduce net returns for owners.',
  REGULATION_INDEX:
    'A score of how restrictive property rules are, read as a change over time rather than as a birr amount.',
};

export function indicatorHint(type: string): string | undefined {
  return ECONOMIC_INDICATOR_HINTS[type];
}
