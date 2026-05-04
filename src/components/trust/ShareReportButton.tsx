'use client';

import { useState } from 'react';

interface ShareReportButtonProps {
  reportId: string;
}

export function ShareReportButton({ reportId }: ShareReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/trust/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, expires_days: 7 }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error === 'unauthorized' ? 'Sign in to share' : 'Could not create share link');
        return;
      }
      setShareUrl(json.share_url);
      await navigator.clipboard.writeText(json.share_url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        {loading ? 'Generating…' : copied ? 'Link copied to clipboard ✓' : 'Share this report'}
      </button>
      {shareUrl && !copied && (
        <code className="text-xs text-stone-500 break-all">{shareUrl}</code>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
