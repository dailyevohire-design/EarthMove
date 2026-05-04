'use client';

import { useState } from 'react';

interface DownloadPdfButtonProps {
  reportId: string;
  contractorName?: string;
}

export function DownloadPdfButton({ reportId, contractorName }: DownloadPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/trust/report/${reportId}/pdf`);
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        setError(json.error === 'unauthorized' ? 'Sign in to download' : 'Could not generate PDF');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = (contractorName ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      a.download = `groundcheck-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        {loading ? 'Generating PDF…' : 'Download PDF'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
