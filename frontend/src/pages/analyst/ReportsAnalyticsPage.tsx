import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createReport, deleteReport, getReports, type MarketReport } from '../../api/reports';
import { PageHero, StatCard } from '../../components/ui/kit-core';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import {
  Plus,
  FileText,
  Play,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Trash2
} from 'lucide-react';

interface AnalyticsJob {
  id: string;
  name: string;
  type: 'market_report' | 'neighborhood_analysis' | 'price_forecast' | 'rental_analysis' | 'custom_report';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  parameters: Record<string, any>;
  outputSize?: number;
  errorMessage?: string;
  createdBy: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'market_report' | 'neighborhood_analysis' | 'price_forecast' | 'rental_analysis' | 'custom_report';
  parameters: Array<{
    name: string;
    label: string;
    type: 'text' | 'select' | 'date' | 'number';
    options?: string[];
    required: boolean;
  }>;
}

const getAnalyticsJobs = async (): Promise<AnalyticsJob[]> => {
  const { reports } = await getReports({ limit: 100, sortBy: 'generatedAt', sortOrder: 'desc' });
  return reports.map((report: MarketReport) => ({
    id: report.id,
    name: report.title,
    type: 'market_report' as const,
    status: 'completed' as const,
    progress: 100,
    startedAt: report.generatedAt,
    completedAt: report.generatedAt,
    parameters: {
      period: report.period ?? 'not set',
      neighborhoods: report.neighborhoodIds ?? [],
      author: report.author.name || report.author.email,
    },
    createdBy: report.author.name || report.author.email,
  }));
};

const getReportTemplates = async (): Promise<ReportTemplate[]> => ([
  {
    id: '1',
    name: 'Market Overview Report',
    description: 'Comprehensive market analysis with trends, pricing, and forecasts',
    type: 'market_report',
    parameters: [
      { name: 'period', label: 'Time Period', type: 'select', options: ['3_months', '6_months', '12_months'], required: true },
      { name: 'neighborhoods', label: 'Neighborhoods', type: 'select', options: ['Bole', 'Kazanchis', 'CMC', 'Megenagna'], required: false },
      { name: 'includeForecasts', label: 'Include Forecasts', type: 'select', options: ['Yes', 'No'], required: true }
    ]
  },
  {
    id: '2',
    name: 'Neighborhood Analysis',
    description: 'Detailed analysis of a specific neighborhood with comparisons',
    type: 'neighborhood_analysis',
    parameters: [
      { name: 'neighborhood', label: 'Target Neighborhood', type: 'select', options: ['Bole', 'Kazanchis', 'CMC', 'Megenagna'], required: true },
      { name: 'compareWith', label: 'Compare With', type: 'select', options: ['Bole', 'Kazanchis', 'CMC', 'Megenagna'], required: false },
      { name: 'period', label: 'Analysis Period', type: 'select', options: ['6_months', '12_months', '24_months'], required: true }
    ]
  },
  {
    id: '3',
    name: 'Price Forecast',
    description: 'Predictive analysis for future property price trends',
    type: 'price_forecast',
    parameters: [
      { name: 'horizon', label: 'Forecast Horizon', type: 'select', options: ['3_months', '6_months', '12_months'], required: true },
      { name: 'model', label: 'Model Type', type: 'select', options: ['basic', 'advanced_regression', 'machine_learning'], required: true },
      { name: 'confidence', label: 'Confidence Level', type: 'select', options: ['80%', '90%', '95%'], required: true }
    ]
  },
  {
    id: '4',
    name: 'Rental Market Analysis',
    description: 'Analysis of rental market trends and yield opportunities',
    type: 'rental_analysis',
    parameters: [
      { name: 'propertyTypes', label: 'Property Types', type: 'select', options: ['apartment', 'villa', 'commercial'], required: true },
      { name: 'priceRange', label: 'Price Range', type: 'select', options: ['budget', 'mid_range', 'luxury', 'all'], required: true },
      { name: 'period', label: 'Analysis Period', type: 'select', options: ['3_months', '6_months', '12_months'], required: true }
    ]
  }
]);

const generateReport = async (template: ReportTemplate, parameters: Record<string, any>) => {
  const parameterSummary = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('; ');

  const periodMatch = String(parameters.period ?? '').match(/^(\d{4})-(\d{2})$/);

  return createReport({
    title: `${template.name} — ${new Date().toLocaleDateString()}`,
    description: parameterSummary || template.description,
    period: periodMatch ? `${periodMatch[1]}-${periodMatch[2]}` : undefined,
    analysis: parameterSummary || undefined,
  });
};

export default function ReportsAnalyticsPage() {
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [formParameters, setFormParameters] = useState<Record<string, any>>({});
  const [statusFilter, setStatusFilter] = useState<string>('');

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: jobs, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics-jobs'],
    queryFn: getAnalyticsJobs,
  });

  const { data: templates } = useQuery({
    queryKey: ['report-templates'],
    queryFn: getReportTemplates,
  });

  const generateMutation = useMutation({
    mutationFn: ({ template, parameters }: { template: ReportTemplate; parameters: Record<string, any> }) =>
      generateReport(template, parameters),
    onSuccess: () => {
      setShowGenerateForm(false);
      setSelectedTemplate(null);
      setFormParameters({});
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-jobs'] });
      refetch();
    },
  });

  const getStatusIcon = (status: AnalyticsJob['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running': return <Play className="w-5 h-5 text-blue-600" />;
      case 'queued': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-gray-400" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: AnalyticsJob['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'queued': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': return 'text-gray-400 bg-white/5 border-white/10';
      default: return 'text-gray-400 bg-white/5 border-white/10';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'market_report': return 'Market Report';
      case 'neighborhood_analysis': return 'Neighborhood Analysis';
      case 'price_forecast': return 'Price Forecast';
      case 'rental_analysis': return 'Rental Analysis';
      case 'custom_report': return 'Custom Report';
      default: return type;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleGenerateReport = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setFormParameters({});
    setShowGenerateForm(true);
  };

  const handleSubmitGeneration = () => {
    if (selectedTemplate) {
      generateMutation.mutate({ template: selectedTemplate, parameters: formParameters });
    }
  };

  const filteredJobs = jobs?.filter(job => 
    !statusFilter || job.status === statusFilter
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-semibold">Could not load reports</p>
          <p className="mt-1 text-sm text-rose-300/80">
            {error instanceof Error ? error.message : 'The reports service did not respond.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Hero */}
      <PageHero
        icon={FileText}
        title="Reports & Analytics"
        description="Generate comprehensive market reports and manage analytics jobs."
        accent="purple"
        actions={
          <button
            onClick={() => setShowGenerateForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard
          icon={FileText}
          label="Reports"
          value={jobs?.length ?? 0}
          accent="emerald"
        />
        <StatCard
          icon={CheckCircle}
          label="Authors"
          value={new Set((jobs ?? []).map((job) => job.createdBy)).size}
          accent="sky"
        />
        <StatCard
          icon={Clock}
          label="Latest Report"
          value={jobs?.[0] ? new Date(jobs[0].startedAt).toLocaleDateString() : '—'}
          accent="amber"
        />
        <StatCard
          icon={BarChart3}
          label="Neighborhoods Covered"
          value={new Set((jobs ?? []).flatMap((job) => job.parameters.neighborhoods ?? [])).size || 'City-wide'}
          accent="rose"
        />
      </div>

      {/* Jobs List */}
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Analytics Jobs</h2>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Reports</option>
                <option value="completed">Generated</option>
              </select>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredJobs.map((job) => (
            <div key={job.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h3 className="font-medium text-white">{job.name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span>{getTypeLabel(job.type)}</span>
                    <span>•</span>
                    <span>By {job.createdBy}</span>
                    <span>•</span>
                    <span>Started {new Date(job.startedAt).toLocaleString()}</span>
                    {job.duration && (
                      <>
                        <span>•</span>
                        <span>Duration: {job.duration}min</span>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(job.status === 'running' || job.status === 'queued') && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            job.status === 'running' ? 'bg-blue-600' : 'bg-yellow-600'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {job.status === 'failed' && job.errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">Job Failed</span>
                      </div>
                      <p className="text-sm text-red-800 mt-1">{job.errorMessage}</p>
                    </div>
                  )}

                  {/* Output Info */}
                  {job.status === 'completed' && job.outputSize && (
                    <div className="text-sm text-gray-400">
                      Output file size: {formatFileSize(job.outputSize)}
                    </div>
                  )}

                  {/* Parameters */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white">
                      View Parameters
                    </summary>
                    <div className="mt-2 p-3 bg-white/5 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(job.parameters).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium text-gray-300">{key}:</span>
                            <span className="text-gray-400 ml-1">
                              {Array.isArray(value) ? value.join(', ') : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => navigate(`/app/analyst-reports/edit/${job.id}`)}
                    className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    Open
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete report "${job.name}"?`)) deleteMutation.mutate(job.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1 text-gray-400 hover:bg-white/10 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Report Modal */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Generate Report</h2>
            </div>
            
            <div className="p-6">
              {!selectedTemplate ? (
                <div className="space-y-4">
                  <h3 className="font-medium text-white mb-4">Select Report Template</h3>
                  {templates?.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleGenerateReport(template)}
                      className="w-full text-left p-4 border border-white/10 rounded-lg hover:border-white/20 hover:bg-white/5 transition-colors"
                    >
                      <div className="font-medium text-white mb-1">{template.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{template.description}</div>
                      <div className="text-xs text-gray-500">
                        Type: {getTypeLabel(template.type)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-white mb-2">{selectedTemplate.name}</h3>
                    <p className="text-sm text-gray-400 mb-4">{selectedTemplate.description}</p>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedTemplate.parameters.map((param) => (
                      <div key={param.name}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {param.label} {param.required && <span className="text-red-500">*</span>}
                        </label>
                        {param.type === 'select' && param.options ? (
                          <select
                            value={formParameters[param.name] || ''}
                            onChange={(e) => setFormParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                            className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select {param.label}</option>
                            {param.options.map((option) => (
                              <option key={option} value={option}>
                                {option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </option>
                            ))}
                          </select>
                        ) : param.type === 'date' ? (
                          <input
                            type="date"
                            value={formParameters[param.name] || ''}
                            onChange={(e) => setFormParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                            className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <input
                            type={param.type}
                            value={formParameters[param.name] || ''}
                            onChange={(e) => setFormParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                            className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowGenerateForm(false);
                  setSelectedTemplate(null);
                  setFormParameters({});
                }}
                className="px-6 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              {selectedTemplate && (
                <>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-6 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitGeneration}
                    disabled={generateMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {generateMutation.isPending ? 'Generating...' : 'Generate Report'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

