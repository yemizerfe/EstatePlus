import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Brain,
  Calendar,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Sparkles,
} from 'lucide-react';

import { askQuestion, fetchAiStatus, type AiAnswer } from '../../api/ai';
import {
  fetchEconomicContext,
  fetchMarketSummary,
  fetchMarketTrends,
  fetchPublicNeighborhoods,
  formatAmount,
  metricNote,
} from '../../api/publicData';
import { InfoHint, PageHero } from '../../components/ui/kit-core';

const DATA_CATEGORIES = [
  { key: 'prices', label: 'Sale prices' },
  { key: 'rents', label: 'Rents' },
  { key: 'listings', label: 'Listing coverage' },
  { key: 'economicIndicators', label: 'Economic indicators' },
] as const;

type DataCategory = (typeof DATA_CATEGORIES)[number]['key'];
type Period = 3 | 6 | 12 | 24;

export default function AIInsightsPage() {
  const [neighborhoodSlug, setNeighborhoodSlug] = useState('all');
  const [months, setMonths] = useState<Period>(12);
  const [propertyType, setPropertyType] = useState('all');
  const [listingType, setListingType] = useState<'all' | 'sale' | 'rent'>('all');
  const [categories, setCategories] = useState<DataCategory[]>(DATA_CATEGORIES.map(({ key }) => key));
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const neighborhoodsQuery = useQuery({
    queryKey: ['ai-insights-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
    retry: 1,
  });
  const statusQuery = useQuery({
    queryKey: ['ai-insights-status'],
    queryFn: fetchAiStatus,
    retry: false,
  });

  const neighborhoods = useMemo(() => neighborhoodsQuery.data ?? [], [neighborhoodsQuery.data]);

  /**
   * Deterministic briefing. The AI model is optional; every figure below is
   * computed from the same recorded data the model would be given, so the page
   * stays useful when no provider key is configured.
   */
  const briefingQuery = useQuery({
    queryKey: ['ai-briefing', months],
    queryFn: async () => {
      const [summary, trends, economic] = await Promise.all([
        fetchMarketSummary(months),
        fetchMarketTrends(months),
        fetchEconomicContext(months),
      ]);
      return { summary, trends, economic };
    },
    enabled: false,
    retry: 1,
  });

  const briefingText = useMemo(() => {
    const data = briefingQuery.data;
    if (!data) return '';
    const { summary, trends, economic } = data;
    const scopeName =
      neighborhoodSlug === 'all'
        ? 'Addis Ababa (citywide)'
        : neighborhoods.find((item) => item.slug === neighborhoodSlug)?.name ?? neighborhoodSlug;

    const lines: string[] = [];
    lines.push(`Computed briefing — ${scopeName}, last ${months} months`);
    lines.push(`Generated ${new Date().toLocaleString()} from recorded listings and sourced indicators.`);
    lines.push('');
    lines.push('Sale market');
    lines.push(`- Median asking price: ${formatAmount(summary.sale.medianAskingPrice.value)} (${metricNote(summary.sale.medianAskingPrice)})`);
    lines.push(`- Median price per m²: ${formatAmount(summary.sale.medianPricePerSqm.value)} (${metricNote(summary.sale.medianPricePerSqm)})`);
    lines.push('');
    lines.push('Rental market');
    lines.push(`- Median monthly rent: ${formatAmount(summary.rent.medianMonthlyRent.value)} (${metricNote(summary.rent.medianMonthlyRent)})`);
    lines.push('');
    lines.push('Coverage');
    lines.push(
      `- ${summary.activeListings.total} active listings (${summary.activeListings.sale} sale · ${summary.activeListings.rent} rent) across ${summary.neighborhoodsCovered} areas with listings.`,
    );
    lines.push(
      `- Change vs previous period: sale ${
        trends.comparison.priceChangePct == null ? 'not computable' : `${trends.comparison.priceChangePct}%`
      }, rent ${
        trends.comparison.rentChangePct == null ? 'not computable' : `${trends.comparison.rentChangePct}%`
      }.`,
    );
    lines.push(`- ${trends.comparison.note}`);
    lines.push('');

    const localAreas = neighborhoods
      .filter((area) => area.sale.medianAskingPrice.scope !== 'city' && area.sale.medianAskingPrice.value != null)
      .sort(
        (a, b) =>
          (b.sale.medianAskingPrice.localSampleSize ?? 0) - (a.sale.medianAskingPrice.localSampleSize ?? 0),
      )
      .slice(0, 5);

    lines.push('Areas with their own sale sample');
    if (localAreas.length === 0) {
      lines.push('- No area has a local sale sample yet, so no area comparison is published.');
    } else {
      localAreas.forEach((area) => {
        const rent =
          area.rent.medianMonthlyRent.scope === 'city'
            ? 'no local rental sample'
            : `${formatAmount(area.rent.medianMonthlyRent.value)}/month (n=${area.rent.medianMonthlyRent.sampleSize})`;
        lines.push(
          `- ${area.name}: median sale ${formatAmount(area.sale.medianAskingPrice.value)} (n=${area.sale.medianAskingPrice.sampleSize}); rent ${rent}.`,
        );
      });
    }
    lines.push('');

    lines.push('Economic context');
    if (economic.indicators.length === 0) {
      lines.push('- No economic indicators are recorded for this window.');
    } else {
      economic.indicators.slice(0, 6).forEach((indicator) => {
        lines.push(
          `- ${indicator.label}: ${indicator.latest?.value ?? '—'} ${indicator.unit ?? ''} (latest ${indicator.latest ? new Date(indicator.latest.date).toLocaleDateString() : 'n/a'}, ${indicator.quality.replace('_', ' ')}).`,
        );
      });
    }
    lines.push('');
    lines.push('Limitations');
    lines.push('- Figures are medians of asking prices held by EstatePlus, not completed sales.');
    lines.push('- Areas below the minimum sample report the citywide median instead of a local one.');
    lines.push('- No forecasts or projections are produced from this data.');

    return lines.join('\n');
  }, [briefingQuery.data, months, neighborhoodSlug, neighborhoods]);

  const copyBriefing = async () => {
    if (!briefingText) return;
    try {
      await navigator.clipboard.writeText(briefingText);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  };
  const mutation = useMutation({
    mutationFn: async () => {
      const selected = DATA_CATEGORIES
        .filter(({ key }) => categories.includes(key))
        .map(({ label }) => label.toLowerCase());
      const scope = neighborhoodSlug === 'all'
        ? 'across Addis Ababa'
        : `in ${neighborhoods.find((item) => item.slug === neighborhoodSlug)?.name ?? neighborhoodSlug}`;
      const direction = listingType === 'all' ? 'sale and rental' : listingType;
      const type = propertyType === 'all' ? 'all property types' : propertyType.toLowerCase();
      const question =
        `Analyze only recorded data for ${scope} over the last ${months} months. ` +
        `Focus on ${direction} listings and ${type}. Cover these requested categories: ${selected.join(', ')}. ` +
        'Use only retrieved facts and calculated metrics; report sample sizes and source dates, distinguish asking prices from completed sales, ' +
        'and explicitly state when a requested figure is unavailable. Do not invent values or forecasts.';
      return askQuestion(question, {
        months,
        neighborhoodSlug: neighborhoodSlug === 'all' ? undefined : neighborhoodSlug,
        listingType: listingType === 'all' ? undefined : listingType,
        propertyType: propertyType === 'all' ? undefined : propertyType,
      });
    },
    onSuccess: setAnswer,
  });

  const toggleCategory = (key: DataCategory) => {
    setCategories((current) =>
      current.includes(key) ? current.filter((category) => category !== key) : [...current, key],
    );
  };

  const copyAnswer = async () => {
    if (!answer) return;
    const text = [
      answer.answer,
      '',
      'Limitations:',
      ...answer.grounding.limitations.map((item) => `- ${item}`),
      '',
      'Sources:',
      ...answer.grounding.citations.map((citation) => `- ${citation.label}${citation.url ? `: ${citation.url}` : ''}`),
    ].join('\n');
    await navigator.clipboard.writeText(text);
  };

  const downloadAnswer = () => {
    if (!answer) return;
    const content = [
      'Addis Ababa Market Insights',
      new Date(answer.grounding.generatedAt).toLocaleString(),
      '',
      answer.answer,
      '',
      'Limitations:',
      ...answer.grounding.limitations.map((item) => `- ${item}`),
      '',
      'Sources:',
      ...answer.grounding.citations.map((citation) => `- ${citation.label}${citation.url ? `: ${citation.url}` : ''}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'addis-ababa-market-insights.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHero
        icon={Brain}
        title="Addis Ababa Market Insights"
        description="AI explanations grounded in this app's approved Addis Ababa listings and sourced economic observations."
        accent="indigo"
      />

      <main className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
        <section className="h-fit space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold">Analysis scope</h2>
          <div>
            <label htmlFor="ai-neighborhood" className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4" /> Neighborhood
            </label>
            <select
              id="ai-neighborhood"
              value={neighborhoodSlug}
              onChange={(event) => setNeighborhoodSlug(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2"
            >
              <option value="all">All Addis Ababa</option>
              {neighborhoods.map((neighborhood) => (
                <option key={neighborhood.id} value={neighborhood.slug}>{neighborhood.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-period" className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <Calendar className="h-4 w-4" /> Period
            </label>
            <select
              id="ai-period"
              value={months}
              onChange={(event) => setMonths(Number(event.target.value) as Period)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-property-type" className="mb-2 block text-sm text-slate-300">Property type</label>
            <select
              id="ai-property-type"
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2"
            >
              <option value="all">All types</option>
              <option value="APARTMENT">Apartment</option>
              <option value="VILLA">Villa</option>
              <option value="CONDOMINIUM">Condominium</option>
              <option value="OFFICE">Office</option>
              <option value="RETAIL">Retail</option>
              <option value="WAREHOUSE">Warehouse</option>
              <option value="LAND">Land</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-listing-type" className="mb-2 block text-sm text-slate-300">Listing direction</label>
            <select
              id="ai-listing-type"
              value={listingType}
              onChange={(event) => setListingType(event.target.value as typeof listingType)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2"
            >
              <option value="all">Sale and rent</option>
              <option value="sale">Sale</option>
              <option value="rent">Rent</option>
            </select>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm text-slate-300">Requested categories</legend>
            <div className="space-y-2">
              {DATA_CATEGORIES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={categories.includes(key)}
                    onChange={() => toggleCategory(key)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {statusQuery.data && (
            <p className={`text-xs ${statusQuery.data.configured ? 'text-emerald-300' : 'text-amber-300'}`}>
              {statusQuery.data.message}
            </p>
          )}
          {statusQuery.isError && (
            <p className="text-xs text-amber-300">AI availability could not be checked; analysis will report API errors directly.</p>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || categories.length === 0 || neighborhoodsQuery.isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-3 font-semibold text-indigo-200 hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5" />
            {mutation.isPending ? 'Retrieving and analyzing…' : 'Generate grounded analysis'}
          </button>

          <button
            onClick={() => void briefingQuery.refetch()}
            disabled={briefingQuery.isFetching || neighborhoodsQuery.isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800/60 px-4 py-3 font-semibold text-slate-200 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Brain className="h-5 w-5" />
            {briefingQuery.isFetching ? 'Computing…' : 'Compute data briefing (no AI)'}
          </button>
          <p className="text-xs text-slate-500">
            The briefing is calculated from the same records with fixed arithmetic, so it works without an
            AI provider.
          </p>
        </section>

        <section className="space-y-5">
          {briefingQuery.isError && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">The briefing could not be computed</p>
                <p className="mt-1 text-sm">The market or economics endpoints did not respond.</p>
              </div>
            </div>
          )}

          {briefingText && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center text-xl font-bold">
                    Computed data briefing
                    <InfoHint
                      text="Every figure below is plain arithmetic over the stored listings and economic observations, not a model estimate. The bracketed n is the number of listings behind that figure: a small n means one unusual listing can move the number a lot."
                      label="Computed data briefing"
                    />
                  </h2>
                  <p className="text-sm text-slate-400">
                    Arithmetic over the stored records — no model involved.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void copyBriefing()}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    <Copy className="h-4 w-4" />
                    {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
                  </button>
                  <button
                    onClick={() => {
                      if (!briefingText) return;
                      const blob = new Blob([briefingText], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `market-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    <Download className="h-4 w-4" /> Download
                  </button>
                </div>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-200">
                {briefingText}
              </pre>
            </div>
          )}

          {!answer && !mutation.isPending && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-10 text-center">
              <Brain className="mx-auto mb-4 h-12 w-12 text-indigo-300" />
              <h2 className="text-xl font-bold">Analysis based on available records</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                The assistant will use retrieved database records and cite their sources. If there is not enough data for a requested conclusion, it should say so instead of filling the gap with a guess.
              </p>
            </div>
          )}

          {mutation.isPending && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-10 text-center text-slate-300">
              Retrieving Addis Ababa data and generating the grounded response…
            </div>
          )}

          {mutation.isError && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Analysis could not be generated</p>
                <p className="mt-1 text-sm">
                  {mutation.error instanceof Error ? mutation.error.message : 'The AI service did not respond.'}
                </p>
              </div>
            </div>
          )}

          {answer && (
            <>
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Grounded analysis</h2>
                  <div className="flex gap-2">
                    <button onClick={() => void copyAnswer()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
                      <Copy className="h-4 w-4" /> Copy
                    </button>
                    <button onClick={downloadAnswer} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
                      <Download className="h-4 w-4" /> Download
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap leading-7 text-slate-200">{answer.answer}</p>
                <p className="mt-4 text-xs text-slate-500">
                  Generated {new Date(answer.grounding.generatedAt).toLocaleString()} ·{' '}
                  {answer.grounding.counts.listings} listings · {answer.grounding.counts.calculations} calculations
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-300" /> Sources
                  </h3>
                  {answer.grounding.citations.length ? (
                    <ul className="space-y-2 text-sm text-slate-300">
                      {answer.grounding.citations.map((citation) => (
                        <li key={citation.id}>
                          {citation.url ? (
                            <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline">
                              {citation.label}<ExternalLink className="h-3 w-3" />
                            </a>
                          ) : citation.label}
                          {citation.asOf ? <span className="text-slate-500"> · {new Date(citation.asOf).toLocaleDateString()}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No external source links were available for this retrieval.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                  <h3 className="mb-3 font-semibold">Data limitations</h3>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                    {[...answer.grounding.limitations, ...answer.grounding.unavailable].length ? (
                      [...answer.grounding.limitations, ...answer.grounding.unavailable].map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                      ))
                    ) : (
                      <li>No limitations were reported by retrieval.</li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
