import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getScenarios, createScenario, runScenario, addScenarioParameter, updateScenarioParameter } from '../../api/scenarios';
import { getNeighborhoods } from '../../api/market';
import type { ScenarioParameter, Scenario } from '../../types';
import { Zap, Plus, Play } from 'lucide-react';

export default function ScenariosPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    parameters: [{ indicator: 'inflation', changePct: 0, changeType: 'increase' as ScenarioParameter['changeType'] }],
  });
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');

  const scenariosQuery = useQuery({ queryKey: ['scenarios'], queryFn: () => getScenarios() });
  const neighborhoodsQuery = useQuery({ queryKey: ['neighborhoods'], queryFn: () => getNeighborhoods() });
  const scenarios: readonly Scenario[] = scenariosQuery.data ?? [];
  const neighborhoodsList: { id: string; name: string }[] = (neighborhoodsQuery.data ?? []);
  const createMutation = useMutation({
    mutationFn: createScenario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setShowCreate(false);
      setNewScenario({ name: '', description: '', parameters: [{ indicator: 'inflation', changePct: 0, changeType: 'increase' }] });
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ id, neighborhoodId }: { id: string; neighborhoodId?: string }) => runScenario(id, neighborhoodId),
  });

  const handleAddParameter = () => {
    setNewScenario({
      ...newScenario,
      parameters: addScenarioParameter(newScenario.parameters, { indicator: 'interest_rate' }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Zap className="w-8 h-8" />
            Scenario Analysis
          </h1>
          <p className="text-gray-600 mt-1">Model economic changes and their market impact</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Scenario
        </button>
      </div>

      {showCreate && (
        <div className="card border-brand-200 bg-brand-50">
          <h2 className="mb-4">Create New Scenario</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Scenario Name</label>
              <input
                type="text"
                value={newScenario.name}
                onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                className="input"
                placeholder="e.g., High Inflation + Interest Rate Hike"
              />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <textarea
                value={newScenario.description}
                onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
            <div>
              <label className="label">Parameters</label>
              {newScenario.parameters.map((param, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    value={param.indicator}
                    onChange={(e) => {
                      setNewScenario({ ...newScenario, parameters: updateScenarioParameter(newScenario.parameters, idx, { indicator: e.target.value }) });
                    }}
                    className="input flex-1"
                  >
                    <option value="inflation">Inflation</option>
                    <option value="interest_rate">Interest Rate</option>
                    <option value="exchange_rate">Exchange Rate</option>
                    <option value="construction_cost">Construction Cost</option>
                  </select>
                  <select
                    value={param.changeType}
                    onChange={(e) => {
                      setNewScenario({ ...newScenario, parameters: updateScenarioParameter(newScenario.parameters, idx, { changeType: e.target.value as ScenarioParameter['changeType'] }) });
                    }}
                    className="input w-32"
                  >
                    <option value="increase">+</option>
                    <option value="decrease">-</option>
                  </select>
                  <input
                    type="number"
                    value={param.changePct}
                    onChange={(e) => {
                      setNewScenario({ ...newScenario, parameters: updateScenarioParameter(newScenario.parameters, idx, { changePct: Number(e.target.value) }) });
                    }}
                    className="input w-24"
                    placeholder="%"
                  />
                </div>
              ))}
              <button onClick={handleAddParameter} className="btn-secondary text-sm">
                Add Parameter
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMutation.mutate(newScenario)} className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Scenario'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <label className="label">Filter by Neighborhood (for analysis)</label>
        <select value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(e.target.value)} className="input max-w-md">
          <option value="">All Neighborhoods</option>                {neighborhoodsList.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(scenarios ?? []).map((scenario: Scenario) => (
          <div key={scenario.id} className="card">
            <h3 className="font-semibold mb-2">{scenario.name}</h3>
            {scenario.description && <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>}
            <div className="space-y-1 mb-4">
              {(scenario.parameters as ScenarioParameter[]).map((param) => (
                <div key={param.indicator} className="text-sm flex items-center gap-2">
                  <span className="badge-blue capitalize">{param.indicator.replace('_', ' ')}</span>
                  <span className={param.changeType === 'increase' ? 'text-red-600' : 'text-green-600'}>
                    {param.changeType === 'increase' ? '+' : '-'}
                    {param.changePct}%
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => runMutation.mutate({ id: scenario.id, neighborhoodId: selectedNeighborhood || undefined })}
              className="btn-primary flex items-center gap-2 w-full"
              disabled={runMutation.isPending}
            >
              <Play className="w-4 h-4" />
              {runMutation.isPending ? 'Running...' : 'Run Analysis'}
            </button>
            {runMutation.isSuccess && runMutation.data && runMutation.variables?.id === scenario.id && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm" key={`result-${scenario.id}`}>
                <div className="font-medium mb-2">Impact Estimate:</div>
                <div className="space-y-1">
                  {runMutation.data?.priceImpactPct !== null && (
                    <div key="price">
                      Price Impact:{' '}
                      <span className={runMutation.data.priceImpactPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {runMutation.data.priceImpactPct > 0 ? '+' : ''}
                        {runMutation.data.priceImpactPct.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {runMutation.data?.rentalImpactPct !== null && (
                    <div key="rental">
                      Rental Impact:{' '}
                      <span className={runMutation.data.rentalImpactPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {runMutation.data.rentalImpactPct > 0 ? '+' : ''}
                        {runMutation.data.rentalImpactPct.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
                {runMutation.data?.aiExplanation && (
                  <p key="ai" className="mt-3 text-gray-700 text-sm italic">{runMutation.data.aiExplanation}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!scenariosQuery.data || scenarios.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">No scenarios created yet</div>
      ) : null}
    </div>
  );
}
