import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';
import { UploadCloud, FileImage, FileVideo, FileText, Trash2, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';

type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string | number;
  cdnUrl: string;
  s3Key: string;
  isProcessed: boolean;
  status: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  width?: number | null;
  height?: number | null;
  durationSecs?: number | null;
  processedCdnUrl?: string | null;
  thumbnailCdnUrl?: string | null;
  processingError?: string | null;
  processedAt?: string | null;
  processingAttempts?: number;
  createdAt: string;
};

function formatBytes(value: string | number) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '–';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function kindFromMime(mime: string) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'file';
}

function formatDuration(value?: number | null) {
  if (!value || value <= 0) return '–';
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function statusClasses(status: Asset['status']) {
  if (status === 'PROCESSED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'FAILED') return 'bg-red-50 text-red-700';
  if (status === 'PROCESSING') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function statusLabel(status: Asset['status']) {
  return status.toLowerCase().replace('_', ' ');
}

export default function MediaLibrary() {
  const token = useAuthStore((s) => s.accessToken);
  const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') as string;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'image' | 'video' | 'pdf'>('ALL');
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<'image' | 'video' | 'document'>('image');
  const [folder, setFolder] = useState<'thumbnails' | 'banners' | 'profiles'>('thumbnails');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function loadAssets() {
    setLoading(true);
    try {
      const res = await api.get<{ assets: Asset[] }>('/api/media/assets');
      setAssets(res.assets);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load media assets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  useEffect(() => {
    const hasPendingAssets = assets.some((asset) => asset.status === 'UPLOADED' || asset.status === 'PROCESSING');
    if (!hasPendingAssets) return;

    const interval = window.setInterval(() => {
      void loadAssets();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [assets]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return assets;
    return assets.filter((a) => kindFromMime(a.mimeType) === filter);
  }, [assets, filter]);

  async function upload() {
    if (!file) return;
    if (!token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (type === 'image') form.append('folder', folder);

      const endpoint = type === 'image' ? '/api/media/image' : type === 'video' ? '/api/media/video' : '/api/media/document';
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === 'string' ? body.error : `Upload failed (${res.status})`);
      }
      await res.json().catch(() => ({}));
      toast.success('Uploaded.');
      setFile(null);
      await loadAssets();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function removeAsset(id: string) {
    try {
      await api.delete(`/api/media/assets/${id}`);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.success('Deleted.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not delete asset.');
    }
  }

  async function retryAsset(id: string) {
    setRetryingId(id);
    try {
      await api.post(`/api/media/assets/${id}/retry`);
      toast.success('Retry queued.');
      await loadAssets();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not retry media processing.');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload and manage assets for course sections. Videos remain in processing until the worker finishes and a ready asset is generated.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAssets()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <UploadCloud size={18} />
          Upload
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'image' | 'video' | 'document')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
            >
              <option value="image">Image (JPG/PNG/WebP)</option>
              <option value="video">Video (MP4)</option>
              <option value="document">Document (PDF) / Audio</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Image folder</label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value as 'thumbnails' | 'banners' | 'profiles')}
              disabled={type !== 'image'}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
            >
              <option value="thumbnails">Thumbnails</option>
              <option value="banners">Banners</option>
              <option value="profiles">Profiles</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!file || uploading}
            onClick={upload}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <UploadCloud size={16} />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'image', 'video', 'pdf'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
              filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {k === 'ALL' ? 'All' : k.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">Assets</div>
          <div className="text-xs text-slate-500">{filtered.length} shown</div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<UploadCloud size={28} />}
              title="No assets yet"
              description="Upload images, videos, PDFs, or audio to start building course content."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((a) => {
              const kind = kindFromMime(a.mimeType);
              const Icon = kind === 'image' ? FileImage : kind === 'video' ? FileVideo : FileText;
              return (
                <div key={a.id} className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-start">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 text-slate-500">
                      <Icon size={18} />
                    </div>
                    {a.thumbnailCdnUrl ? (
                      <img
                        src={a.thumbnailCdnUrl}
                        alt=""
                        className="h-16 w-28 rounded-xl border border-slate-200 object-cover bg-slate-100"
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="font-medium text-slate-900 truncate max-w-[32rem]">{a.fileName}</div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses(a.status)}`}>
                          {statusLabel(a.status)}
                        </span>
                        <span className="text-[11px] text-slate-500">{formatBytes(a.sizeBytes)}</span>
                        {a.width && a.height ? (
                          <span className="text-[11px] text-slate-500">
                            {a.width}×{a.height}
                          </span>
                        ) : null}
                        {a.durationSecs ? <span className="text-[11px] text-slate-500">{formatDuration(a.durationSecs)}</span> : null}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        <a className="hover:underline" href={a.processedCdnUrl ?? a.cdnUrl} target="_blank" rel="noreferrer">
                          {a.processedCdnUrl ?? a.cdnUrl}
                        </a>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>Uploaded {new Date(a.createdAt).toLocaleString()}</span>
                        {a.processedAt ? <span>Ready {new Date(a.processedAt).toLocaleString()}</span> : null}
                        {typeof a.processingAttempts === 'number' && a.processingAttempts > 0 ? (
                          <span>{a.processingAttempts} attempt{a.processingAttempts === 1 ? '' : 's'}</span>
                        ) : null}
                      </div>
                      {a.status === 'FAILED' && a.processingError ? (
                        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <div>{a.processingError}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:ml-4">
                    {a.status === 'FAILED' && kind === 'video' ? (
                      <button
                        type="button"
                        onClick={() => retryAsset(a.id)}
                        disabled={retryingId === a.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RotateCcw size={14} />
                        {retryingId === a.id ? 'Retrying…' : 'Retry'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeAsset(a.id)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      aria-label="Delete asset"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
