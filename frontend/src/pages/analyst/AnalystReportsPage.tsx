import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileBarChart, 
  Plus,
  Search,
  Eye,
  Trash2,
  Calendar,
  Clock,
  User
} from 'lucide-react';
import { PageHero } from '../../components/ui/kit-core';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import { useNavigate } from 'react-router-dom';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getReports, deleteReport, type MarketReport } from '../../api/reports';

interface Report {
  id: string;
  title: string;
  description: string;
  period: string;
  market: string;
  createdDate: string;
  createdBy: string;
  status: 'generated';
  lastModified: string;
}

const mapReport = (report: MarketReport): Report => ({
  id: report.id,
  title: report.title,
  description: report.description ?? 'No description recorded for this report.',
  period: report.period ?? 'No period set',
  market: report.neighborhoodIds?.length
    ? `${report.neighborhoodIds.length} neighborhood${report.neighborhoodIds.length === 1 ? '' : 's'}`
    : 'City-wide',
  createdDate: report.generatedAt,
  createdBy: report.author.name?.trim() || report.author.email,
  status: 'generated',
  lastModified: report.updatedAt,
});

export default function AnalystReportsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  // Data queries
  const { data: reportsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analyst-reports'],
    queryFn: () => getReports({ limit: 100, sortBy: 'generatedAt', sortOrder: 'desc' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analyst-reports'] }),
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      published: 'bg-green-500/20 text-green-400 border-green-500/30',
      draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      generating: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      generated: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleCreateReport = () => {
    navigate('/app/analyst-reports/new');
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/app/analyst-reports/${reportId}`);
  };

  const handleEditReport = (reportId: string) => {
    navigate(`/app/analyst-reports/edit/${reportId}`);
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      deleteMutation.mutate(reportId);
    }
  };

  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filteredReports = (reportsData?.reports ?? []).map(mapReport).filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' || new Date(report.createdDate).getTime() >= recentCutoff;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <TableSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={FileBarChart}
        title="Market Reports"
        description="Create, manage, and export market analysis reports"
        accent="amber"
        actions={
          <button
            onClick={handleCreateReport}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Report
          </button>
        }
      />

      <div className="p-6">
        {/* Filters and Search */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">All dates</option>
              <option value="recent">Last 30 days</option>
            </select>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredReports.map((report) => (
            <div key={report.id} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileBarChart className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-bold text-white">{report.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{report.description}</p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(report.status)}
                    <span className="px-2 py-1 bg-slate-700/50 text-gray-300 rounded-full text-xs">
                      {report.market}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {report.period}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <User className="w-4 h-4" />
                    {report.createdBy}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="text-gray-400">
                    Generated <span className="font-medium text-white">{new Date(report.createdDate).toLocaleDateString()}</span>
                  </div>
                  <div className="text-gray-400">
                    Updated <span className="font-medium text-white">{new Date(report.lastModified).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Last modified: {new Date(report.lastModified).toLocaleDateString()}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewReport(report.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-lg text-amber-400 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Open
                </button>
                <button
                  onClick={() => handleEditReport(report.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700/40 hover:bg-slate-700/60 border border-white/10 rounded-lg text-gray-200 text-sm transition-colors"
                  title="Edit report settings"
                >
                  <Calendar className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  disabled={deleteMutation.isPending}
                  className="flex items-center justify-center px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                  title="Delete report"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredReports.length === 0 && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <FileBarChart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Reports Found</h3>
            <p className="text-gray-400 mb-6">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Create your first market report to get started'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={handleCreateReport}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-amber-400 transition-colors mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}