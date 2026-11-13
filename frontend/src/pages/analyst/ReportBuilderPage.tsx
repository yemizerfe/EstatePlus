import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createReport, getReport, updateReport } from '../../api/reports';
import { 
  FileText, 
  Calendar,
  MapPin,
  CheckSquare,
  ArrowLeft,
  Save,
  Download,
  Eye
} from 'lucide-react';
import { PageHero } from '../../components/ui/kit-core';

interface ReportConfig {
  title: string;
  market: string;
  periodFrom: string;
  periodTo: string;
  sections: {
    marketOverview: boolean;
    priceTrends: boolean;
    rentalTrends: boolean;
    neighborhoodAnalysis: boolean;
    economicIndicators: boolean;
    aiSummary: boolean;
    supplyAnalysis: boolean;
    demandAnalysis: boolean;
  };
}

const sectionLabels: Record<keyof ReportConfig['sections'], string> = {
  marketOverview: 'Market Overview',
  priceTrends: 'Price Trends',
  rentalTrends: 'Rental Trends',
  neighborhoodAnalysis: 'Neighborhood Analysis',
  economicIndicators: 'Economic Indicators',
  aiSummary: 'AI Summary',
  supplyAnalysis: 'Supply Analysis',
  demandAnalysis: 'Demand Analysis',
};

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoMonthsAgo = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
};

export default function ReportBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [config, setConfig] = useState<ReportConfig>({
    title: '',
    market: 'addis-ababa',
    periodFrom: isoMonthsAgo(5),
    periodTo: isoToday(),
    sections: {
      marketOverview: true,
      priceTrends: true,
      rentalTrends: true,
      neighborhoodAnalysis: true,
      economicIndicators: true,
      aiSummary: false,
      supplyAnalysis: false,
      demandAnalysis: false
    }
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => getReport(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing) return;
    const period = existing.period ?? '';
    setConfig((prev) => ({
      ...prev,
      title: existing.title,
      periodFrom: period ? `${period}-01` : prev.periodFrom,
      periodTo: period ? `${period}-28` : prev.periodTo,
    }));
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (generate: boolean) => {
      // A report summarises the market up to the end of the selected range, so
      // the snapshot month is the range end — the start date only bounds the
      // analysis window shown in the description.
      const period = config.periodTo.slice(0, 7);
      const analysis = Object.entries(config.sections)
        .filter(([, enabled]) => enabled)
        .map(([key]) => sectionLabels[key as keyof ReportConfig['sections']])
        .join(', ');
      const payload = {
        title: config.title,
        description: `Sections: ${analysis}`,
        period,
        analysis,
        conclusions: generate ? `Generated from the report builder on ${new Date().toLocaleDateString()}` : undefined,
      };
      return isEdit ? updateReport(id!, payload) : createReport(payload);
    },
    onSuccess: (report, generated) =>
      navigate(generated ? `/app/analyst-reports/${report.id}` : '/app/analyst-reports'),
    onError: (mutationError) => {
      alert(mutationError instanceof Error ? mutationError.message : 'Could not save the report.');
    },
  });

  const handleSectionToggle = (section: keyof typeof config.sections) => {
    setConfig({
      ...config,
      sections: {
        ...config.sections,
        [section]: !config.sections[section]
      }
    });
  };

  const handleSaveDraft = () => {
    if (!config.title.trim()) {
      alert('Please enter a report title');
      return;
    }
    saveMutation.mutate(false);
  };

  const handleGenerateReport = () => {
    if (!config.title.trim()) {
      alert('Please enter a report title');
      return;
    }
    saveMutation.mutate(true);
  };

  const handlePreview = () => {
    if (!isEdit) {
      alert('Save the report first to preview it.');
      return;
    }
    navigate(`/app/analyst-reports/${id}`);
  };

  const selectedSectionsCount = Object.values(config.sections).filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-gray-400">Loading report…</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={FileText}
        title={isEdit ? 'Edit Market Report' : 'Create Market Report'}
        description="Configure and generate a professional market analysis report"
        accent="amber"
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/app/analyst-reports')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-4xl mx-auto">
        {/* Report Configuration */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Report Configuration</h3>
          </div>

          <div className="space-y-6">
            {/* Report Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Report Title *
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="e.g., Q3 2026 Market Overview"
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Market Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Market
                </div>
              </label>
              <select
                value={config.market}
                onChange={(e) => setConfig({ ...config, market: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="addis-ababa">Addis Ababa</option>
              </select>
            </div>

            {/* Period Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Analysis Period
                </div>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From</label>
                  <input
                    type="date"
                    value={config.periodFrom}
                    onChange={(e) => setConfig({ ...config, periodFrom: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To</label>
                  <input
                    type="date"
                    value={config.periodTo}
                    onChange={(e) => setConfig({ ...config, periodTo: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Sections */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">Report Sections</h3>
            </div>
            <span className="text-sm text-gray-400">
              {selectedSectionsCount} section{selectedSectionsCount !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'marketOverview', label: 'Market Overview', description: 'High-level summary of market conditions' },
              { key: 'priceTrends', label: 'Price Trends', description: 'Historical price analysis and trends' },
              { key: 'rentalTrends', label: 'Rental Trends', description: 'Rental market analysis and rates' },
              { key: 'neighborhoodAnalysis', label: 'Neighborhood Analysis', description: 'Breakdown by neighborhood' },
              { key: 'economicIndicators', label: 'Economic Indicators', description: 'Key economic metrics and context' },
              { key: 'aiSummary', label: 'AI Summary', description: 'AI-generated market insights' },
              { key: 'supplyAnalysis', label: 'Supply Analysis', description: 'Inventory and listing trends' },
              { key: 'demandAnalysis', label: 'Demand Analysis', description: 'Buyer activity and market demand' }
            ].map(({ key, label, description }) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                  config.sections[key as keyof typeof config.sections]
                    ? 'bg-amber-500/20 border-2 border-amber-500/50'
                    : 'bg-slate-800/50 border-2 border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={config.sections[key as keyof typeof config.sections]}
                  onChange={() => handleSectionToggle(key as keyof typeof config.sections)}
                  className="mt-1 w-5 h-5 rounded border-white/20 bg-slate-700 checked:bg-amber-500 checked:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <div className="font-medium text-white mb-1">{label}</div>
                  <div className="text-xs text-gray-400">{description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSaveDraft}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>

          <div className="flex gap-4">
            <button
              onClick={handlePreview}
              disabled={saveMutation.isPending || !config.title}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>

            <button
              onClick={handleGenerateReport}
              disabled={saveMutation.isPending || !config.title || selectedSectionsCount === 0}
              className="flex items-center gap-2 px-6 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-amber-400 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 mt-1">ℹ️</div>
            <div>
              <div className="text-blue-300 font-medium mb-1">Report Generation</div>
              <div className="text-blue-200/80 text-sm">
                Generating a report stores a snapshot of the market statistics and the latest economic
                indicators for the selected month, so the report keeps showing the figures that were true
                when it was created. The report opens straight away and can be printed to PDF or exported
                as CSV from its page.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}