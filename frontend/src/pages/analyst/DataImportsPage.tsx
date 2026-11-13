import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, FileSpreadsheet, RefreshCw, Upload, XCircle } from 'lucide-react';
import {
  getDataImportJobHistory,
  uploadPropertyCsv,
  type DataImportJobHistoryItem,
} from '../../api/dataImport';
import { PageHero } from '../../components/ui/kit-core';
import { TableSkeleton } from '../../components/ui/kit-blocks';

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'processing':
      return <Clock className="h-4 w-4 animate-pulse text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function formatError(errorLog: unknown): string | null {
  if (errorLog == null) return null;
  const message = typeof errorLog === 'string' ? errorLog : JSON.stringify(errorLog);
  return message ? message.slice(0, 500) : null;
}

function ImportJobCard({ job }: { job: DataImportJobHistoryItem }) {
  const status = job.status.toLowerCase();
  const error = status === 'failed' ? formatError(job.errorLog) : null;

  return (
    <article className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-gray-400" />
            <h3 className="break-all font-medium text-white">
              {job.fileName || job.source?.name || `${job.jobType} import`}
            </h3>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs capitalize text-gray-200">
              {getStatusIcon(status)}
              {status}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {job.jobType.replace(/[_-]/g, ' ')}
            {job.source ? ` · ${job.source.name}` : ''}
            {' · '}
            {new Date(job.startedAt || job.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <div>
          <dt className="text-gray-500">Records received</dt>
          <dd className="font-medium text-white">{job.recordsReceived.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Valid</dt>
          <dd className="font-medium text-green-500">{job.recordsValid.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Rejected</dt>
          <dd className="font-medium text-red-400">{job.recordsRejected.toLocaleString()}</dd>
        </div>
      </dl>

      {error && (
        <div className="mt-4 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="break-all">{error}</p>
        </div>
      )}
    </article>
  );
}

/** Analyst CSV upload: every valid row becomes a live property listing. */
function CsvUploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (selected: File) => uploadPropertyCsv(selected, 'properties'),
    onSuccess: (result) => {
      setNotice(
        `Queued ${result.recordsReceived} rows from this file. The import runs in the background — the job list below updates when it finishes.`,
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['import-job-history'] });
    },
    onError: (mutationError) => {
      setNotice(
        mutationError instanceof Error
          ? `Upload failed: ${mutationError.message}`
          : 'Upload failed. Check the file headers and try again.',
      );
    },
  });

  return (
    <section className="rounded-2xl bg-slate-900/50 p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <Upload className="h-5 w-5 text-sky-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">Upload listings CSV</h2>
          <p className="text-sm text-gray-400">
            Headers: title, property_type, neighborhood, size_sqm, bedrooms, bathrooms, asking_price,
            rental_price, listing_date, condition, address, latitude, longitude.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-200 hover:file:bg-sky-500/30"
        />
        <button
          type="button"
          disabled={!file || upload.isPending}
          onClick={() => file && upload.mutate(file)}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading…' : 'Import file'}
        </button>
      </div>
      {notice && <p className="mt-3 text-sm text-gray-300">{notice}</p>}
    </section>
  );
}

export default function DataImportsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['import-job-history'],
    queryFn: getDataImportJobHistory,
    refetchInterval: (query) =>
      query.state.data?.jobs.some((job) => ['pending', 'processing'].includes(job.status.toLowerCase()))
        ? 3000
        : false,
  });

  if (isLoading) {
    return <div className="space-y-6"><TableSkeleton rows={6} /></div>;
  }

  return (
    <div className="space-y-8">
      <PageHero
        icon={FileSpreadsheet}
        title="Data Imports"
        description="Review import jobs recorded by the backend and their actual validation results."
        accent="sky"
      />

      <CsvUploadCard />

      <section className="overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Import history</h2>
            {data && <p className="mt-1 text-sm text-gray-400">{data.pagination.total} recorded jobs</p>}
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isError ? (
          <div role="alert" className="p-6 text-sm text-red-300">
            Could not load import history: {error instanceof Error ? error.message : 'Unexpected API error'}
          </div>
        ) : data?.jobs.length ? (
          <div className="divide-y divide-white/10">
            {data.jobs.map((job) => <ImportJobCard key={job.id} job={job} />)}
          </div>
        ) : (
          <p className="p-8 text-center text-gray-400">No import jobs have been recorded.</p>
        )}
      </section>
    </div>
  );
}
