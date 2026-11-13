/**
 * Turns the raw figures we display into sentences a non-specialist can act on.
 *
 * `metricHints.ts` explains what a number *is*; this file explains what a
 * particular number *means right now* — for example whether a 6% gross yield is
 * worth the purchase price, or whether asking prices are outpacing rents in the
 * window the user selected. Every sentence is derived from the values on screen
 * and never invents a figure we do not have.
 */

export type ReadingTone = 'positive' | 'caution' | 'neutral' | 'info';

export interface Reading {
  title: string;
  body: string;
  tone: ReadingTone;
}

const MINUS = '−';

/** Birr amounts as a person would say them: 12.4M, 850K, 92,000. */
export function formatBirrShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ETB`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M ETB`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K ETB`;
  return `${Math.round(value).toLocaleString()} ETB`;
}

export function formatBirrFull(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString()} ETB`;
}

const pct = (value: number, digits = 1) =>
  `${value > 0 ? '+' : value < 0 ? MINUS : ''}${Math.abs(value).toFixed(digits)}%`;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** How many years of rent it takes to equal the asking price. */
export function yearsOfRentToPayOff(price: number, monthlyRent: number): number {
  return price / (monthlyRent * 12);
}

/** Gross yield: yearly rent as a share of the purchase price. */
export function grossYieldPct(price: number, monthlyRent: number): number {
  return ((monthlyRent * 12) / price) * 100;
}

export interface MarketReadingInput {
  medianAskingPrice: number | null;
  medianMonthlyRent: number | null;
  priceGrowthPct: number | null;
  rentGrowthPct: number | null;
  activeListings: number;
  neighborhoodsCovered: number;
}

/**
 * City-wide readings for the market dashboard: what the price and rent medians
 * mean for a buyer, a tenant and an investor.
 */
export function marketReadings(input: MarketReadingInput): Reading[] {
  const {
    medianAskingPrice,
    medianMonthlyRent,
    priceGrowthPct,
    rentGrowthPct,
    activeListings,
    neighborhoodsCovered,
  } = input;

  const readings: Reading[] = [];

  if (medianAskingPrice != null && medianMonthlyRent != null && medianAskingPrice > 0) {
    const yieldPct = grossYieldPct(medianAskingPrice, medianMonthlyRent);
    const years = yearsOfRentToPayOff(medianAskingPrice, medianMonthlyRent);
    // Above ~20% the two medians almost certainly describe different homes (for
    // example serviced rentals against older sale stock), so present it as an
    // artefact rather than as an investment return.
    const implausible = yieldPct > 20;
    const verdict = implausible
      ? 'A figure this high means the median rent and the median sale price come from different kinds of homes — often serviced or furnished rentals against older sale stock. Do not read it as a return you could actually earn; compare like-for-like units instead.'
      : yieldPct >= 8
        ? 'That is a high gross return by local standards, though verify the actual rent the unit achieves before relying on it.'
        : yieldPct >= 5
          ? 'That is a middling gross return: the rent alone does not repay the price quickly, so most of the return would have to come from the property value rising.'
          : 'That is a low gross return. At today’s rents, buying to let only makes sense if you expect the resale value to grow, or if you value having the asset itself.';
    readings.push({
      title: implausible
        ? 'Median rent and median price describe different homes'
        : `A median home costs about ${years.toFixed(1)} years of its own rent`,
      body: `At the median asking price of ${formatBirrShort(medianAskingPrice)} and the median rent of ${formatBirrFull(medianMonthlyRent)} a month, the yearly rent is ${yieldPct.toFixed(1)}% of the purchase price. ${verdict}`,
      tone: implausible ? 'caution' : yieldPct >= 8 ? 'positive' : yieldPct >= 5 ? 'neutral' : 'caution',
    });
  }

  if (priceGrowthPct != null || rentGrowthPct != null) {
    const price = priceGrowthPct;
    const rent = rentGrowthPct;
    const direction =
      price == null
        ? 'Rents moved'
        : price > 1
          ? 'Asking prices are rising'
          : price < -1
            ? 'Asking prices are easing'
            : 'Asking prices are broadly flat';

    let compare = '';
    if (price != null && rent != null) {
      if (price > rent + 1) {
        compare = `Prices are climbing faster than rents (${pct(price)} against ${pct(rent)}), so renting is becoming the cheaper option relative to buying and yields are being squeezed.`;
      } else if (rent > price + 1) {
        compare = `Rents are climbing faster than prices (${pct(rent)} against ${pct(price)}), which improves the return on a purchase made today.`;
      } else {
        compare = `Prices and rents moved roughly together (${pct(price)} against ${pct(rent)}), so affordability for tenants is close to where it was.`;
      }
    }

    readings.push({
      title: direction,
      body: `${direction} in the latest recorded month${price != null ? ` (${pct(price)})` : ''}${rent != null ? `, with rents at ${pct(rent)}` : ''}. ${compare} This compares the latest month with recorded listings against the month before it — it is not growth measured across the whole window you selected.`,
      tone:
        price != null && rent != null && price > rent + 1
          ? 'caution'
          : rent != null && price != null && rent > price
            ? 'positive'
            : 'info',
    });
  }

  if (activeListings > 0) {
    return readings.concat({
      title: `${plural(activeListings, 'home is', 'homes are')} advertised across ${plural(neighborhoodsCovered, 'neighborhood')}`,
      body:
        medianAskingPrice != null && medianMonthlyRent != null
          ? `That is about ${Math.max(1, Math.round(activeListings / Math.max(1, neighborhoodsCovered)))} listings per area on average. More listings in an area mean more choice and more room to negotiate; very few means you may wait for the right home or pay above the median to secure it.`
          : 'Every figure on this page comes from these live listings, so it describes what is currently advertised rather than completed sales.',
      tone: 'info',
    });
  }

  return readings;
}

export interface NeighborhoodReadingInput {
  name: string;
  medianAskingPrice: number | null;
  medianMonthlyRent: number | null;
  priceGrowthPct: number | null;
  rentGrowthPct: number | null;
  activeListings: number;
}

/** Readings for a single neighborhood, written in second person. */
export function neighborhoodReadings(input: NeighborhoodReadingInput): Reading[] {
  const { name, medianAskingPrice, medianMonthlyRent, priceGrowthPct, rentGrowthPct, activeListings } =
    input;
  const readings: Reading[] = [];

  if (activeListings === 0) {
    readings.push({
      title: `No listings are recorded in ${name} yet`,
      body: 'The price and rent figures below fall back to the Addis Ababa-wide medians, so they describe the city rather than this neighborhood. Treat every figure on this page as city context until homes here are recorded.',
      tone: 'caution',
    });
  }

  if (medianAskingPrice != null && medianMonthlyRent != null && medianAskingPrice > 0) {
    const yieldPct = grossYieldPct(medianAskingPrice, medianMonthlyRent);
    const implausible = yieldPct > 20;
    readings.push({
      title: implausible
        ? `Rent and sale medians in ${name} cover different homes`
        : yieldPct >= 8
          ? `${name} looks strong for rental income on these medians`
          : yieldPct >= 5
            ? `${name} offers a middling rental return`
            : `${name} is priced for living, not for yield`,
      body: `A typical home here asks ${formatBirrShort(medianAskingPrice)} while a typical rental asks ${formatBirrFull(medianMonthlyRent)} a month. That is a gross yield of ${yieldPct.toFixed(1)}% — roughly ${yearsOfRentToPayOff(medianAskingPrice, medianMonthlyRent).toFixed(1)} years of rent to cover the price, before purchase costs, tax, repairs and empty months. ${
        implausible
          ? 'A yield this high means the two medians come from different kinds of homes rather than one you could actually buy and rent. Compare specific units instead of relying on this pairing.'
          : yieldPct >= 8
            ? 'If the rent holds, the purchase pays back relatively quickly.'
            : yieldPct >= 5
              ? 'Do not expect the rent alone to justify the price quickly; capital growth has to do part of the work.'
              : 'Buying here is mainly a bet on the value rising or on living in the area yourself.'
      }`,
      tone: implausible ? 'caution' : yieldPct >= 8 ? 'positive' : yieldPct >= 5 ? 'neutral' : 'caution',
    });
  } else if (medianAskingPrice != null) {
    readings.push({
      title: `Homes in ${name} ask about ${formatBirrShort(medianAskingPrice)}`,
      body: 'No rental listings back a yield figure here yet, so this area can only be judged on purchase prices for now.',
      tone: 'neutral',
    });
  }

  if (priceGrowthPct != null) {
    readings.push({
      title:
        priceGrowthPct > 1
          ? `Prices in ${name} are up ${priceGrowthPct.toFixed(1)}%`
          : priceGrowthPct < -1
            ? `Prices in ${name} are down ${Math.abs(priceGrowthPct).toFixed(1)}%`
            : `Prices in ${name} are flat`,
      body: `This compares the latest month with recorded sale listings to the month before it. ${
        priceGrowthPct > 5
          ? 'A move this large usually reflects a handful of listings rather than the whole area, so check how many homes were recorded before treating it as a trend.'
          : 'Small month-to-month moves are normal and often reflect which homes happened to be advertised, not a change in the area’s value.'
      }${rentGrowthPct != null ? ` Rents moved ${pct(rentGrowthPct)} over the same comparison.` : ''}`,
      tone: priceGrowthPct > 0 ? 'info' : 'caution',
    });
  }

  if (activeListings > 0) {
    readings.push({
      title: `${plural(activeListings, 'home is', 'homes are')} on the market here`,
      body:
        activeListings <= 2
          ? 'With so few listings, the medians are fragile: one unusual home can move them a lot, and you may have little choice at any moment. Compare with a larger area before deciding.'
          : activeListings <= 8
            ? 'There is a small but usable choice. Enough to compare a few homes, not enough to assume the median is the going rate for exactly what you want.'
            : 'There is a healthy choice of homes, which usually gives buyers and tenants more negotiating room than in thinner areas.',
      tone: activeListings <= 2 ? 'caution' : activeListings <= 8 ? 'neutral' : 'positive',
    });
  }

  return readings;
}

export interface PropertyReadingInput {
  price: number;
  monthlyRentBenchmark: number | null;
  neighborhoodMedianPrice: number | null;
  pricePerSqm: number | null;
  neighborhoodMedianPerSqm: number | null;
  sizeSqm: number | null;
  isRent: boolean;
}

/** Readings beside a listing: is it above or below its area, and what does it cost to own? */
export function propertyReadings(input: PropertyReadingInput): Reading[] {
  const {
    price,
    monthlyRentBenchmark,
    neighborhoodMedianPrice,
    pricePerSqm,
    neighborhoodMedianPerSqm,
    sizeSqm,
    isRent,
  } = input;
  const readings: Reading[] = [];

  if (!isRent && neighborhoodMedianPrice && price > 0) {
    const diff = ((price - neighborhoodMedianPrice) / neighborhoodMedianPrice) * 100;
    readings.push({
      title:
        diff > 10
          ? `Asking ${diff.toFixed(0)}% above the area median`
          : diff < -10
            ? `Asking ${Math.abs(diff).toFixed(0)}% below the area median`
            : 'Priced close to the area median',
      body: `The typical home in this neighborhood asks ${formatBirrShort(neighborhoodMedianPrice)}; this one asks ${formatBirrShort(price)}. ${
        diff > 10
          ? 'A higher price can still be fair for a larger, better located or better finished home — compare the price per m² below before treating it as expensive.'
          : diff < -10
            ? 'Below-median prices often reflect size, condition or location. Check what you are giving up before assuming it is a bargain.'
            : 'Being near the median means the price is in line with what else is advertised, not that it is the right price for this particular home.'
      }`,
      tone: diff > 10 ? 'caution' : diff < -10 ? 'info' : 'neutral',
    });
  }

  if (pricePerSqm != null && neighborhoodMedianPerSqm) {
    const diff = ((pricePerSqm - neighborhoodMedianPerSqm) / neighborhoodMedianPerSqm) * 100;
    readings.push({
      title:
        Math.abs(diff) < 10
          ? 'Price per m² is in line with the area'
          : `Price per m² is ${diff > 0 ? 'above' : 'below'} the area by ${Math.abs(diff).toFixed(0)}%`,
      body: `You would pay ${formatBirrFull(pricePerSqm)} per m² against an area median of ${formatBirrFull(neighborhoodMedianPerSqm)} per m². Price per m² is the fairest way to compare homes of different sizes, but it still ignores condition, floor, view and finishing.`,
      tone: diff > 10 ? 'caution' : diff < -10 ? 'positive' : 'neutral',
    });
  }

  if (!isRent && monthlyRentBenchmark && price > 0) {
    const yieldPct = grossYieldPct(price, monthlyRentBenchmark);
    const implausible = yieldPct > 20;
    readings.push({
      title: `Would rent for about ${formatBirrFull(monthlyRentBenchmark)} a month`,
      body: implausible
        ? `The area median rent implies a ${yieldPct.toFixed(1)}% return, which is too high to take literally: the rental stock and this sale listing are probably different sizes or levels of service. Use it only as a hint, and check actual rents for comparable units.`
        : `Using the area’s median rent, this home would return roughly ${yieldPct.toFixed(1)}% a year before costs (${
            yearsOfRentToPayOff(price, monthlyRentBenchmark).toFixed(1)
          } years of rent to equal the price). A higher yield means the rent covers more of the purchase; a lower one means you are paying for location, size or future value.`,
      tone: implausible ? 'caution' : yieldPct >= 8 ? 'positive' : yieldPct >= 5 ? 'neutral' : 'caution',
    });
  }

  if (sizeSqm != null && price > 0) {
    readings.push({
      title: `${sizeSqm.toLocaleString()} m² at ${formatBirrFull(price / sizeSqm)} per m²`,
      body: isRent
        ? 'For a rental, compare this monthly cost per m² with similar homes nearby: a higher figure buys location or finishing, a lower one may mean shared facilities or a longer commute.'
        : 'Multiply this by the size of any other home you are considering to compare them on the same footing, even when the total prices look very different.',
      tone: 'info',
    });
  }

  return readings;
}

export interface IndicatorReadingInput {
  type: string;
  latestValue: number | null;
  previousValue: number | null;
  unit?: string | null;
}

/**
 * One sentence per economic indicator explaining what its latest move implies
 * for someone buying, renting or building. Direction, not just level, is what
 * people need.
 */
export function indicatorReading(input: IndicatorReadingInput): Reading | null {
  const { type, latestValue, previousValue } = input;
  if (latestValue == null || !Number.isFinite(latestValue)) return null;
  const delta =
    previousValue != null && Number.isFinite(previousValue) ? latestValue - previousValue : null;
  const rising = delta != null && delta > 0.01;
  const falling = delta != null && delta < -0.01;
  const moving = rising ? 'rising' : falling ? 'falling' : 'steady';

  switch (type) {
    case 'INFLATION':
    case 'CPI':
      return {
        title: `Prices are ${moving}${delta != null ? ` (${pct(delta)} since the previous reading)` : ''}`,
        body: rising
          ? 'Inflation eats into what rent and savings can buy. If your rent is fixed while prices rise, the landlord loses buying power; if you are the tenant, expect renewals to ask for more.'
          : falling
            ? 'Slower price growth protects tenants’ buying power and makes long leases easier to plan around, though it can also signal weaker demand.'
            : 'Stable inflation means today’s rent and price levels are not being eroded unusually quickly either way.',
        tone: rising ? 'caution' : falling ? 'positive' : 'neutral',
      };
    case 'INTEREST_RATES':
    case 'MORTGAGE_RATES':
      return {
        title: `Borrowing costs are ${moving}`,
        body: rising
          ? 'Each rate rise makes the same mortgage cost more per month, which usually shrinks the pool of buyers and can soften asking prices. Buyers relying on a loan should re-check their budget before making an offer.'
          : falling
            ? 'Cheaper borrowing lets buyers carry a larger loan for the same monthly payment, which tends to support demand and prices.'
            : 'Borrowing costs are stable, so affordability is not being squeezed by financing alone.',
        tone: rising ? 'caution' : falling ? 'positive' : 'neutral',
      };
    case 'GDP_GROWTH':
      return {
        title: `The economy is ${rising ? 'growing faster' : falling ? 'growing more slowly' : 'holding its pace'}`,
        body: rising
          ? 'Faster growth usually means more jobs and more households able to commit to a mortgage or a lease. Demand tends to follow, especially in serviced urban areas.'
          : falling
            ? 'Slower growth can delay household decisions to buy, even when prices look attractive. Expect longer negotiation and more time on market.'
            : 'Steady growth gives buyers and sellers a predictable backdrop, without adding much pressure in either direction.',
        tone: rising ? 'positive' : falling ? 'caution' : 'neutral',
      };
    case 'UNEMPLOYMENT':
      return {
        title: `Unemployment is ${moving}`,
        body: rising
          ? 'More people out of work reduces the number of households able to take on a long lease or a mortgage, which can dampen demand in the segments they rent.'
          : falling
            ? 'More people in work supports household formation and rental demand, particularly for smaller, well-connected units.'
            : 'A stable labour market keeps housing demand predictable.',
        tone: rising ? 'caution' : falling ? 'positive' : 'neutral',
      };
    case 'CONSTRUCTION_COSTS':
    case 'PPI':
      return {
        title: `Building costs are ${moving}`,
        body: rising
          ? 'Dearer labour, cement and imported materials raise the replacement cost of a home. Developers pass that on, which supports asking prices for new and existing units.'
          : falling
            ? 'Cheaper construction eases pressure on new-build prices and can make renovation or expansion more attractive.'
            : 'Stable building costs mean new supply is not becoming more expensive, so price increases are more likely driven by demand.',
        tone: rising ? 'caution' : falling ? 'positive' : 'neutral',
      };
    case 'EXCHANGE_RATES':
      return {
        title: `The birr is ${rising ? 'weaker' : falling ? 'stronger' : 'steady'} against the dollar`,
        body: rising
          ? 'A weaker birr raises the birr cost of imported cement, steel and finishes. Construction gets dearer and dollar-linked rents tend to rise first in expat-heavy areas.'
          : falling
            ? 'A stronger birr makes imported materials cheaper, which can ease pressure on new-build costs.'
            : 'A steady exchange rate keeps imported construction costs predictable.',
        tone: rising ? 'caution' : falling ? 'positive' : 'neutral',
      };
    case 'HOUSING_STARTS':
    case 'BUILDING_PERMITS':
      return {
        title: `New supply is ${rising ? 'picking up' : falling ? 'slowing' : 'steady'}`,
        body: rising
          ? 'More starts and permits today mean more completed homes in a few years. That future supply can limit how fast prices rise in the segments being built.'
          : falling
            ? 'Fewer starts now point to tighter supply later. In the near term it supports the rents and prices of existing homes.'
            : 'A steady pipeline suggests supply is keeping pace with construction capacity rather than the market changing direction.',
        tone: rising ? 'info' : falling ? 'caution' : 'neutral',
      };
    case 'RETAIL_SALES':
    case 'INDUSTRIAL_PRODUCTION':
      return {
        title: `Business activity is ${moving}`,
        body: rising
          ? 'Stronger activity supports commercial rents and the incomes that underpin residential demand.'
          : falling
            ? 'Weaker activity can hit commercial rents first, and later the households those businesses employ.'
            : 'Flat activity suggests commercial demand is not the driver of local property prices right now.',
        tone: rising ? 'positive' : falling ? 'caution' : 'neutral',
      };
    case 'WAGE_GROWTH':
      return {
        title: `Pay is ${moving}`,
        body: rising
          ? 'Rising pay makes current rents more affordable for tenants and supports household formation.'
          : falling
            ? 'Slower pay growth increases rent stress: tenants can afford less of a rise at renewal, which caps how fast landlords can lift rents.'
            : 'Stable pay means rent increases will feel like a real cost to tenants.',
        tone: rising ? 'positive' : falling ? 'caution' : 'neutral',
      };
    case 'POPULATION_GROWTH':
    case 'MIGRATION':
      return {
        title: `The population is ${rising ? 'growing' : falling ? 'shrinking' : 'stable'}`,
        body: rising
          ? 'More residents mean more households needing homes. Unless supply keeps up, this is the strongest long-run support for rents and prices.'
          : falling
            ? 'Fewer residents soften demand, especially in segments that depend on new arrivals.'
            : 'A stable population means demand is driven by income and household formation rather than growth.',
        tone: rising ? 'positive' : falling ? 'caution' : 'neutral',
      };
    case 'CONSUMER_CONFIDENCE':
      return {
        title: `Households are ${rising ? 'more confident' : falling ? 'more cautious' : 'neither more nor less confident'}`,
        body: rising
          ? 'Confidence usually shows up first in enquiries and viewings, then in offers. Expect buyers to move a little faster.'
          : falling
            ? 'Cautious households delay decisions. Homes can sit longer and offers tend to come in below asking price.'
            : 'Sentiment is not shifting demand much in either direction right now.',
        tone: rising ? 'positive' : falling ? 'caution' : 'neutral',
      };
    case 'TAX_RATES':
    case 'REGULATION_INDEX':
      return {
        title: `Rules and charges are ${rising ? 'tightening' : falling ? 'easing' : 'unchanged'}`,
        body: rising
          ? 'Higher taxes or tighter rules reduce the net return on a purchase after costs, even if the headline price looks unchanged.'
          : falling
            ? 'Lower charges or lighter rules improve the net return and can bring more buyers into the market.'
            : 'The cost of transacting is not changing, so compare offered prices directly.',
        tone: rising ? 'caution' : falling ? 'positive' : 'neutral',
      };
    case 'INFRASTRUCTURE_SPENDING':
      return {
        title: 'Public investment is shaping future access',
        body: rising
          ? 'More spending on roads and utilities usually improves how desirable nearby areas become; values near completed projects tend to rise first.'
          : falling
            ? 'Slower investment can delay the infrastructure that would have lifted surrounding values.'
            : 'A steady pipeline means access is improving gradually rather than in one step.',
        tone: rising ? 'positive' : falling ? 'caution' : 'neutral',
      };
    default:
      return {
        title: `Latest reading ${latestValue.toLocaleString()}`,
        body: delta != null
          ? `This indicator moved ${pct(delta)} since the previous recorded month. Read it alongside prices and rents rather than on its own — no single indicator sets the market.`
          : 'This is the latest value recorded by the source; no earlier month is available to compare it with.',
        tone: 'neutral',
      };
  }
}
