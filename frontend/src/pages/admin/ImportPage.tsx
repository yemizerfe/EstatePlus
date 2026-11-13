import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

import { apiClient } from '../../api/client';

interface ImportJob {
  id: string;
  jobType: string;
  status: string;
  fileName: string | null;
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  startedAt: string | null;
  completedAt: string | null;
  errorLog?: unknown;
}

const fetchRecentImports = async (): Promise<ImportJob[]> => {
  const { data } = await apiClient.get<{ data: ImportJob[] }>('/ingestion');
  return data.data;
};

const statusTone: Record<string, string> = {
  completed: 'text-green-400',
  processing: 'text-blue-400',
  pending: 'text-yellow-400',
  failed: 'text-red-400',
};

export default function AdminImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; jobId?: string } | null>(
    null,
  );

  const jobsQuery = useQuery({
    queryKey: ['ingestion-jobs'],
    queryFn: fetchRecentImports,
    refetchInterval: 10_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (upload: File) => {
      const formData = new FormData();
      formData.append('file', upload);
      formData.append('importType', 'properties');
      // Do not set Content-Type: the browser must add the multipart boundary.
      const { data } = await apiClient.post<{ data: { jobId: string; recordsReceived: number } }>(
        '/ingestion/import',
        formData,
      );
      return data.data;
    },
    onSuccess: (data) => {
      setResult({
        success: true,
        message: `Queued ${data.recordsReceived.toLocaleString()} row(s) for import.`,
        jobId: data.jobId,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['ingestion-jobs'] });
    },
    onError: (error: any) => {
      setResult({
        success: false,
        message:
          error?.response?.data?.message ||
          'Upload failed. Check the file is a CSV with a header row and try again.',
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (file) uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Data Import
        </h1>
        <p className="text-gray-400 mt-1">
          Upload a CSV of properties. Every upload becomes a data source with its own import job.
        </p>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Upload CSV</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30"
            />
          </div>
          {file && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <FileText className="w-4 h-4" />
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium disabled:opacity-50"
            disabled={!file || uploadMutation.isPending}
          >
            <Upload className="w-4 h-4" />
            {uploadMutation.isPending ? 'Uploading…' : 'Upload and process'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-xl p-4 border ${
              result.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                {result.success ? 'Import queued' : 'Import failed'}
              </p>
              <p className={`text-sm mt-1 ${result.success ? 'text-green-200/80' : 'text-red-200/80'}`}>
                {result.message}
              </p>
              {result.jobId && (
                <p className="text-xs mt-2 text-gray-400">Job ID: {result.jobId}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Recent import jobs</h2>
          <button
            onClick={() => jobsQuery.refetch()}
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${jobsQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {jobsQuery.isLoading ? (
          <p className="p-6 text-sm text-gray-400">Loading import jobs…</p>
        ) : jobsQuery.isError ? (
          <p className="p-6 text-sm text-red-300">Could not load import jobs.</p>
        ) : (jobsQuery.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No imports have been run yet.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {(jobsQuery.data ?? []).slice(0, 10).map((job) => (
              <div key={job.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="font-medium">{job.fileName || job.jobType}</span>
                  </div>
                  <span
                    className={`text-xs font-semibold capitalize ${
                      statusTone[job.status] ?? 'text-gray-400'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
                  <span>{job.recordsReceived.toLocaleString()} received</span>
                  <span>{job.recordsValid.toLocaleString()} valid</span>
                  <span>{job.recordsRejected.toLocaleString()} rejected</span>
                  <span>
                    {job.completedAt
                      ? `Finished ${new Date(job.completedAt).toLocaleString()}`
                      : `Started ${job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 max-w-2xl">
        <h3 className="text-sm font-semibold text-blue-300 mb-2">CSV format</h3>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Headers: title, property_type, neighborhood, size_sqm, bedrooms, bathrooms, asking_price, rental_price, listing_date</li>
          <li>First row must contain headers; dates use YYYY-MM-DD</li>
          <li>Maximum file size: 10 MB (CSV or JSON)</li>
          <li>Economic indicators are imported from the integrations screen, not here.</li>
        </ul>
      </div>
    </div>
  );
}
