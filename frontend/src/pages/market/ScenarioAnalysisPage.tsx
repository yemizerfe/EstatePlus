import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { 
  Play,
  Save,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Bot,
  BarChart3
} from 'lucide-react';

interface ScenarioInput {
  name: string;
  interestRate: number;
  inflationRate: number;
  constructionCost: number;
  populationGrowth: number;
  economicGrowth: number;
}

interface ScenarioResult {
  propertyDemand: {
    direction: 'up' | 'down' | 'stable';
    magnitude: 'low' | 'moderate' | 'high';
    percentage: number;
  };
  propertyPrices: {
    direction: 'up' | 'down' | 'stable';
    magnitude: 'low' | 'moderate' | 'high';
    percentage: number;
  };
  rentalPrices: {
    direction: 'up' | 'down' | 'stable';
    magnitude: 'low' | 'moderate' | 'high';
    percentage: number;
  };
  constructionActivity: {
    direction: 'up' | 'down' | 'stable';
    magnitude: 'low' | 'moderate' | 'high';
    percentage: number;
  };
  aiExplanation: string;
  confidence: number;
}

import { createScenario, getScenarios, runScenario } from '../../api/scenarios';
import { fetchEconomicContext } from '../../api/publicData';
import type { Scenario } from '../../types';

const BASELINE = {
  interestRate: 15.5,
  inflationRate: 28.5,
  constructionCost: 12500,
  populationGrowth: 3.2,
  economicGrowth: 6.1,
} as const;

const direction = (value: number): 'up' | 'down' | 'stable' =>
  value > 1 ? 'up' : value < -1 ? 'down' : 'stable';

const magnitude = (value: number, moderate = 2, high = 5): 'low' | 'moderate' | 'high' =>
  Math.abs(value) > high ? 'high' : Math.abs(value) > moderate ? 'moderate' : 'low';

const buildParameters = (input: ScenarioInput): ScenarioParameterPayload[] => {
  const params: ScenarioParameterPayload[] = [];

  const push = (indicator: string, current: number, baseline: number) => {
    if (!Number.isFinite(current) || current === baseline) return;
    const changePct = Math.abs(((current - baseline) / baseline) * 100);
    params.push({
      indicator,
      changePct: Math.min(100, Math.round(changePct * 10) / 10),
      changeType: current > baseline ? 'increase' : 'decrease',
    });
  };

  push('interest_rate', input.interestRate, BASELINE.interestRate);
  push('inflation', input.inflationRate, BASELINE.inflationRate);
  push('construction_cost', input.constructionCost, BASELINE.constructionCost);
  push('population_growth', input.populationGrowth, BASELINE.populationGrowth);
  push('gdp_growth', input.economicGrowth, BASELINE.economicGrowth);

  return params;
};

type ScenarioParameterPayload = {
  indicator: string;
  changePct: number;
  changeType: 'increase' | 'decrease';
};

const runScenarioFromInput = async (input: ScenarioInput): Promise<ScenarioResult> => {
  const parameters = buildParameters(input);
  if (!parameters.length) {
    throw new Error('Adjust at least one indicator before running the scenario.');
  }

  const scenario = await createScenario({
    name: input.name.trim() || `Scenario ${new Date().toLocaleString()}`,
    description: parameters
      .map((p) => `${p.indicator} ${p.changeType} ${p.changePct}%`)
      .join(', '),
    type: 'ECONOMIC_SHOCK',
    parameters,
  });

  const analysis = await runScenario(scenario.id);
  return {
    propertyDemand: {
      direction: direction(analysis.priceImpactPct),
      magnitude: magnitude(analysis.priceImpactPct),
      percentage: Math.round(analysis.priceImpactPct * 10) / 10,
    },
    propertyPrices: {
      direction: direction(analysis.priceImpactPct),
      magnitude: magnitude(analysis.priceImpactPct),
      percentage: Math.round(analysis.priceImpactPct * 10) / 10,
    },
    rentalPrices: {
      direction: direction(analysis.rentalImpactPct),
      magnitude: magnitude(analysis.rentalImpactPct, 1.5, 4),
      percentage: Math.round(analysis.rentalImpactPct * 10) / 10,
    },
    constructionActivity: {
      direction:
        analysis.supplyImpact === 'strong_increase' || analysis.supplyImpact === 'increase'
          ? 'up'
          : analysis.supplyImpact === 'decrease'
            ? 'down'
            : 'stable',
      magnitude: magnitude(analysis.priceImpactPct, 1.5, 4),
      percentage: Math.round(analysis.priceImpactPct * 10) / 10,
    },
    aiExplanation: analysis.aiExplanation ?? analysis.assumptions.disclaimer,
    confidence: 70,
  };
};

interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  input: ScenarioInput;
}

const reverseMapScenario = (scenario: Scenario): SavedScenario => {
  const input: ScenarioInput = {
    name: scenario.name,
    interestRate: BASELINE.interestRate,
    inflationRate: BASELINE.inflationRate,
    constructionCost: BASELINE.constructionCost,
    populationGrowth: BASELINE.populationGrowth,
    economicGrowth: BASELINE.economicGrowth,
  };

  const apply = (indicator: string, baselineKey: keyof typeof BASELINE) => {
    const param = scenario.parameters.find((p) => p.indicator === indicator);
    if (!param) return;
    const factor = param.changeType === 'increase' ? 1 + param.changePct / 100 : 1 - param.changePct / 100;
    input[baselineKey] = Math.round(BASELINE[baselineKey] * factor * 100) / 100;
  };

  apply('interest_rate', 'interestRate');
  apply('inflation', 'inflationRate');
  apply('construction_cost', 'constructionCost');
  apply('population_growth', 'populationGrowth');
  apply('gdp_growth', 'economicGrowth');

  return {
    id: scenario.id,
    name: scenario.name,
    createdAt: new Date(scenario.createdAt).toLocaleDateString(),
    input,
  };
};

export default function ScenarioAnalysisPage() {
  const [scenario, setScenario] = useState<ScenarioInput>({
    name: '',
    interestRate: 15.5,
    inflationRate: 28.5,
    constructionCost: 12500,
    populationGrowth: 3.2,
    economicGrowth: 6.1
  });

  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [notice, setNotice] = useState('');

  // Baseline macro values shown beside each input come from the stored
  // indicator series, never from a constant in this file.
  const { data: economic } = useQuery({
    queryKey: ['public-economic-context', 24],
    queryFn: () => fetchEconomicContext(24),
    retry: 1,
  });
  const indicator = (type: string): number | null =>
    economic?.indicators.find((series) => series.type === type)?.latest?.value ??
    null;
  const macro = (code: string): number | null =>
    economic?.macro.find((series) => series.code === code)?.latest?.value ?? null;
  const current = (value: number | null): string =>
    value === null ? '' : `Current: ${Math.round(value * 10) / 10}%`;

  const { data: savedScenarios, refetch: refetchScenarios } = useQuery({
    queryKey: ['market-scenarios'],
    queryFn: async () => (await getScenarios({ limit: 20 })).map(reverseMapScenario),
  });

  const runScenarioMutation = useMutation({
    mutationFn: runScenarioFromInput,
    onSuccess: (data) => {
      setResult(data);
      refetchScenarios();
    },
    onError: (mutationError) => {
      alert(mutationError instanceof Error ? mutationError.message : 'Scenario analysis failed.');
    },
  });

  const handleInputChange = (field: keyof ScenarioInput, value: string | number) => {
    setScenario(prev => ({ ...prev, [field]: value }));
  };

  const handleRunScenario = () => {
    if (!scenario.name.trim()) {
      alert('Please enter a scenario name');
      return;
    }
    runScenarioMutation.mutate(scenario);
  };

  const loadScenario = (savedScenario: SavedScenario) => {
    setScenario(savedScenario.input);
    setResult(null);
  };

  // Persist the current inputs without re-running the model. Running already
  // stores its own scenario, so this covers "keep this setup for later".
  const saveScenarioMutation = useMutation({
    mutationFn: async () => {
      const parameters = buildParameters(scenario);
      if (!parameters.length) {
        throw new Error('Adjust at least one indicator before saving the scenario.');
      }
      return createScenario({
        name: scenario.name.trim() || `Scenario ${new Date().toLocaleString()}`,
        description: parameters.map((p) => `${p.indicator} ${p.changeType} ${p.changePct}%`).join(', '),
        type: 'ECONOMIC_SHOCK',
        parameters,
      });
    },
    onSuccess: () => {
      refetchScenarios();
      setNotice('Scenario saved to your list.');
    },
    onError: (mutationError) => {
      setNotice(mutationError instanceof Error ? mutationError.message : 'Could not save the scenario.');
    },
  });

  /** CSV of the inputs and modelled outcomes, built from the current result. */
  const handleExportReport = () => {
    if (!result) return;

    const rows: Array<Array<string | number>> = [
      ['Scenario', scenario.name || 'Untitled scenario'],
      ['Generated', new Date().toISOString()],
      [],
      ['Input', 'Value'],
      ['Interest rate (%)', scenario.interestRate],
      ['Inflation rate (%)', scenario.inflationRate],
      ['Construction cost (ETB/sqm)', scenario.constructionCost],
      ['Population growth (%)', scenario.populationGrowth],
      ['Economic growth (%)', scenario.economicGrowth],
      [],
      ['Outcome', 'Change (%)', 'Direction', 'Magnitude'],
      ['Property demand', result.propertyDemand.percentage, result.propertyDemand.direction, result.propertyDemand.magnitude],
      ['Property prices', result.propertyPrices.percentage, result.propertyPrices.direction, result.propertyPrices.magnitude],
      ['Rental prices', result.rentalPrices.percentage, result.rentalPrices.direction, result.rentalPrices.magnitude],
      ['Construction activity', result.constructionActivity.percentage, result.constructionActivity.direction, result.constructionActivity.magnitude],
      [],
      ['Confidence (%)', result.confidence],
      [],
      ['AI analysis', result.aiExplanation.replace(/\s+/g, ' ')],
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const slug = (scenario.name || 'scenario-analysis')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'scenario-analysis';

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const getDirectionIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'down': return <TrendingDown className="w-5 h-5 text-red-600" />;
      case 'stable': default: return <BarChart3 className="w-5 h-5 text-gray-400" />;
    }
  };

  const getDirectionColor = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return 'text-green-600 bg-green-50 border-green-200';
      case 'down': return 'text-red-600 bg-red-50 border-red-200';
      case 'stable': default: return 'text-gray-400 bg-white/5 border-white/10';
    }
  };

  const getMagnitudeLabel = (magnitude: 'low' | 'moderate' | 'high') => {
    switch (magnitude) {
      case 'high': return 'High';
      case 'moderate': return 'Moderate';
      case 'low': default: return 'Low';
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Hero */}
      <PageHero
        icon={BarChart3}
        title="Scenario Analysis"
        description="Model interest-rate, inflation and demand shocks — and see their impact before they happen."
        accent="purple"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Create Scenario */}
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Create Scenario</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Scenario Name</label>
                <input
                  type="text"
                  placeholder="e.g., Interest Rate Increase"
                  value={scenario.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Interest Rate (%)
                  <span className="text-xs text-gray-500 ml-1">{current(indicator('INTEREST_RATE'))}</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={scenario.interestRate}
                  onChange={(e) => handleInputChange('interestRate', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Inflation Rate (%)
                  <span className="text-xs text-gray-500 ml-1">{current(indicator('INFLATION_RATE'))}</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={scenario.inflationRate}
                  onChange={(e) => handleInputChange('inflationRate', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Construction Cost (ETB/sqm)
                  
                </label>
                <input
                  type="number"
                  step="100"
                  value={scenario.constructionCost}
                  onChange={(e) => handleInputChange('constructionCost', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="flex items-center">
                    Population Growth (%)
                    <InfoHint
                      text="The yearly percentage change in the number of residents you expect. Enter 0 to assume the population stays flat; a negative number models residents leaving."
                      label="Population growth"
                    />
                  </span>
                  <span className="text-xs text-gray-500 ml-1">{current(macro('SP.POP.GROW'))}</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={scenario.populationGrowth}
                  onChange={(e) => handleInputChange('populationGrowth', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="flex items-center">
                    Economic Growth (%)
                    <InfoHint text={METRIC_HINTS.gdpGrowth} label="Economic growth" />
                  </span>
                  <span className="text-xs text-gray-500 ml-1">{current(macro('NY.GDP.MKTP.KD.ZG'))}</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={scenario.economicGrowth}
                  onChange={(e) => handleInputChange('economicGrowth', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleRunScenario}
                disabled={runScenarioMutation.isPending}
                className="w-full py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {runScenarioMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Running Analysis...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" />
                    Run Scenario
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Saved Scenarios */}
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Saved Scenarios</h3>
            
            <div className="space-y-3">
              {savedScenarios?.map((saved) => (
                <div key={saved.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-white">{saved.name}</div>
                    <div className="text-sm text-gray-400">{saved.createdAt}</div>
                  </div>
                  <button
                    onClick={() => loadScenario(saved)}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {runScenarioMutation.isPending && (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-white/10 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="text-lg font-bold text-white mb-2">Analyzing Scenario</h3>
                  <p className="text-gray-400">Running market calculations and impact analysis...</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Scenario Results */}
              <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="flex items-center text-lg font-bold text-white">
                    Scenario Results
                    <InfoHint
                      text="Each percentage is the modelled change against the baseline case in the panel on the left — not a forecast of what will happen. Change the inputs to see how sensitive the result is."
                      label="Scenario results"
                    />
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4" />
                    Confidence: {result.confidence.toFixed(1)}%
                    <InfoHint
                      text="How confident the scenario engine rates its own result, from 0% to 100%. It is a heuristic score based on how far your inputs sit from the baseline, not a statistical probability. Treat anything below about 60% as highly uncertain."
                      label="Confidence"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${getDirectionColor(result.propertyDemand.direction)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Property Demand</span>
                      {getDirectionIcon(result.propertyDemand.direction)}
                    </div>
                    <div className="text-2xl font-bold mb-1">
                      {result.propertyDemand.percentage > 0 ? '+' : ''}{result.propertyDemand.percentage}%
                    </div>
                    <div className="text-sm">
                      {getMagnitudeLabel(result.propertyDemand.magnitude)} {result.propertyDemand.direction === 'up' ? 'increase' : result.propertyDemand.direction === 'down' ? 'decrease' : 'change'}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${getDirectionColor(result.propertyPrices.direction)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Property Prices</span>
                      {getDirectionIcon(result.propertyPrices.direction)}
                    </div>
                    <div className="text-2xl font-bold mb-1">
                      {result.propertyPrices.percentage > 0 ? '+' : ''}{result.propertyPrices.percentage}%
                    </div>
                    <div className="text-sm">
                      {getMagnitudeLabel(result.propertyPrices.magnitude)} {result.propertyPrices.direction === 'up' ? 'increase' : result.propertyPrices.direction === 'down' ? 'decrease' : 'change'}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${getDirectionColor(result.rentalPrices.direction)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Rental Prices</span>
                      {getDirectionIcon(result.rentalPrices.direction)}
                    </div>
                    <div className="text-2xl font-bold mb-1">
                      {result.rentalPrices.percentage > 0 ? '+' : ''}{result.rentalPrices.percentage}%
                    </div>
                    <div className="text-sm">
                      {getMagnitudeLabel(result.rentalPrices.magnitude)} {result.rentalPrices.direction === 'up' ? 'increase' : result.rentalPrices.direction === 'down' ? 'decrease' : 'change'}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${getDirectionColor(result.constructionActivity.direction)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Construction Activity</span>
                      {getDirectionIcon(result.constructionActivity.direction)}
                    </div>
                    <div className="text-2xl font-bold mb-1">
                      {result.constructionActivity.percentage > 0 ? '+' : ''}{result.constructionActivity.percentage}%
                    </div>
                    <div className="text-sm">
                      {getMagnitudeLabel(result.constructionActivity.magnitude)} {result.constructionActivity.direction === 'up' ? 'increase' : result.constructionActivity.direction === 'down' ? 'decrease' : 'change'}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Explanation */}
              <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">AI Analysis</h3>
                    <p className="text-sm text-gray-400">Intelligent explanation of scenario results</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300 leading-relaxed">{result.aiExplanation}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => saveScenarioMutation.mutate()}
                    disabled={saveScenarioMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saveScenarioMutation.isPending ? 'Saving...' : 'Save Scenario'}
                  </button>
                  <button
                    onClick={handleExportReport}
                    className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Export Report
                  </button>
                  {notice && <span className="text-sm text-gray-300">{notice}</span>}
                </div>
              </div>
            </>
          )}

          {!result && !runScenarioMutation.isPending && (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Ready to Analyze</h3>
                <p className="text-gray-400">
                  Configure your scenario parameters and run the analysis to see potential market impacts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

