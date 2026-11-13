import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHero } from '../../components/ui/kit-core';
import {
  FileText,
  Search,
  Upload,
  Download,
  Trash2,
  File,
  FileImage,
  Eye,
  Folder,
  Clock,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  fetchDocuments,
  uploadDocument,
  fetchDocumentBlob,
  deleteDocument,
  type PropertyDocument,
} from '../../api/documents';
import { useMyProperties } from '../../hooks/useProperties';

const CATEGORIES = ['Legal Documents', 'Certificates', 'Contracts', 'Media', 'Other'] as const;
type Category = (typeof CATEGORIES)[number];

/** Category drives the badge + icon without trusting the file extension. */
const categoryType = (category: string): 'deed' | 'contract' | 'certificate' | 'image' | 'other' => {
  switch (category) {
    case 'Legal Documents': return 'deed';
    case 'Contracts': return 'contract';
    case 'Certificates': return 'certificate';
    case 'Media': return 'image';
    default: return 'other';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (category: string) => {
  switch (categoryType(category)) {
    case 'deed':
    case 'certificate':
    case 'contract':
      return <FileText className="w-8 h-8 text-blue-400" />;
    case 'image':
      return <FileImage className="w-8 h-8 text-purple-400" />;
    default:
      return <File className="w-8 h-8 text-gray-400" />;
  }
};

const getTypeBadgeColor = (category: string) => {
  switch (categoryType(category)) {
    case 'deed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'contract': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'certificate': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'image': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<{ name: string; category: Category; propertyId: string }>({
    name: '',
    category: 'Legal Documents',
    propertyId: '',
  });
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const queryClient = useQueryClient();

  const { data: documents, isLoading, error: loadError } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  });

  const { data: myProperties } = useMyProperties({ limit: 100 });
  const properties = myProperties?.properties ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file to upload.');
      return uploadDocument(file, {
        category: form.category,
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
        ...(form.propertyId ? { propertyId: form.propertyId } : {}),
      });
    },
    onSuccess: () => {
      setUploadOpen(false);
      setFile(null);
      setForm({ name: '', category: 'Legal Documents', propertyId: '' });
      setFormError('');
      invalidate();
    },
    onError: (mutationError) => {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Upload failed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      setActionError('');
      invalidate();
    },
    onError: (mutationError) => {
      setActionError(mutationError instanceof Error ? mutationError.message : 'Could not delete the document.');
    },
  });

  const filteredDocuments = (documents ?? []).filter((doc) => {
    const needle = searchTerm.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(needle) ||
      (doc.propertyTitle?.toLowerCase().includes(needle) ?? false);
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: documents?.length ?? 0,
    totalSize: documents?.reduce((acc, doc) => acc + doc.sizeBytes, 0) ?? 0,
    legal: documents?.filter((doc) => doc.category === 'Legal Documents' || doc.category === 'Contracts').length ?? 0,
    certificates: documents?.filter((doc) => doc.category === 'Certificates').length ?? 0,
    media: documents?.filter((doc) => doc.category === 'Media').length ?? 0,
  };

  const openDocument = async (doc: PropertyDocument, mode: 'view' | 'download') => {
    setBusyId(doc.id);
    setActionError('');
    try {
      const blob = await fetchDocumentBlob(doc.id, mode === 'view');
      const url = URL.createObjectURL(
        mode === 'view' ? new Blob([blob], { type: doc.mimeType }) : blob,
      );

      if (mode === 'view' && (doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf')) {
        window.open(url, '_blank', 'noopener');
        // The new tab keeps its own reference to the blob; revoke later so the
        // object URL does not leak for the lifetime of the page.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not open the document.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (doc: PropertyDocument) => {
    if (window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
      setBusyId(doc.id);
      deleteMutation.mutate(doc.id, { onSettled: () => setBusyId(null) });
    }
  };

  const openUpload = () => {
    setFile(null);
    setForm({ name: '', category: 'Legal Documents', propertyId: '' });
    setFormError('');
    setUploadOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={Folder}
        title="Documents"
        description="Manage property documents, contracts, and certificates."
        accent="indigo"
        actions={
          <button
            onClick={openUpload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Documents</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Folder className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{formatFileSize(stats.totalSize)}</div>
              <div className="text-sm text-gray-400">Storage Used</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.legal}</div>
              <div className="text-sm text-gray-400">Legal Documents</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <FileImage className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.certificates + stats.media}</div>
              <div className="text-sm text-gray-400">Certificates &amp; Media</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | Category)}
            className="px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all" className="bg-slate-800">All Categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category} className="bg-slate-800">
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(actionError || loadError) && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>
            {actionError || (loadError instanceof Error ? loadError.message : 'Could not load documents.')}
          </span>
        </div>
      )}

      {/* Documents List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : filteredDocuments.length > 0 ? (
          filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-800/50 rounded-xl border border-white/10">
                  {getFileIcon(doc.category)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">{doc.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeBadgeColor(doc.category)}`}>
                      {doc.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-3">
                    {doc.propertyTitle && (
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        <span>{doc.propertyTitle}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <File className="w-4 h-4" />
                      <span>{formatFileSize(doc.sizeBytes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => openDocument(doc, 'view')}
                      disabled={busyId === doc.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => openDocument(doc, 'download')}
                      disabled={busyId === doc.id}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => confirmDelete(doc)}
                      disabled={busyId === doc.id || deleteMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-red-400 border border-white/20 rounded-lg hover:bg-red-500/10 transition-colors text-sm disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Documents Found</h3>
            <p className="text-gray-400 mb-6">
              {searchTerm || categoryFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Upload your first document to get started'}
            </p>
            {!searchTerm && categoryFilter === 'all' && (
              <button
                onClick={openUpload}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Upload Document</h3>
              <button onClick={() => setUploadOpen(false)} className="p-1 text-gray-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">File (max 10MB)</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    setFile(selected);
                    if (selected && !form.name) setForm((prev) => ({ ...prev, name: selected.name }));
                  }}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:text-white hover:file:bg-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Display name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Title deed — Bole apartment"
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as Category }))}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category} className="bg-slate-800">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Property (optional)</label>
                  <select
                    value={form.propertyId}
                    onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" className="bg-slate-800">Not linked</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id} className="bg-slate-800">
                        {property.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || !file}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
