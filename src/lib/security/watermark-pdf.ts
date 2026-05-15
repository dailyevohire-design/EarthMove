import { createHash } from 'crypto';

const ZW = ['​', '‌', '‍'];

export function generateWatermarkPayload(userId: string, citeId: string): string {
  const ts = Math.floor(Date.now() / 1000).toString(16);
  const hash = createHash('sha256').update(`${userId}:${citeId}:${ts}`).digest('hex').slice(0, 16);
  return `${userId.slice(0, 8)}:${ts}:${hash}`;
}

export function encodeWatermark(payload: string): string {
  const bytes = Buffer.from(payload, 'utf8');
  let out = '';
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 2) {
      const pair = (byte >> bit) & 0b11;
      out += ZW[pair % ZW.length];
    }
  }
  return out;
}

export function embedWatermarkInText(text: string, watermark: string): string {
  const parts = text.match(/[\s\S]{1,50}/g) ?? [text];
  let wmIdx = 0;
  return parts.map((part, i) => {
    if (wmIdx >= watermark.length) return part;
    const ch = watermark[wmIdx++];
    return i === 0 ? part : ch + part;
  }).join('');
}

export function watermarkPdfText(text: string, ctx: { userId: string; citeId: string }): { watermarkedText: string; visibleFooter: string; payload: string } {
  const payload = generateWatermarkPayload(ctx.userId, ctx.citeId);
  const encoded = encodeWatermark(payload);
  const watermarkedText = embedWatermarkInText(text, encoded);
  const visibleFooter = `Generated ${new Date().toISOString().slice(0, 10)} · Report ${ctx.citeId} · Verify at earthmove.io/verify/${ctx.citeId}`;
  return { watermarkedText, visibleFooter, payload };
}

/**
 * PDF /Info dictionary metadata. Survives NFC text normalization that may
 * strip zero-width chars. Apply via pdf-lib:
 *   const meta = watermarkPdfMetadata({ userId, citeId });
 *   pdfDoc.setTitle(meta.title);
 *   pdfDoc.setAuthor(meta.author);
 *   pdfDoc.setSubject(meta.subject);
 *   pdfDoc.setProducer(meta.producer);
 *   pdfDoc.setKeywords(meta.keywords);
 */
export function watermarkPdfMetadata(ctx: { userId: string; citeId: string }): {
  title: string; author: string; subject: string; producer: string; keywords: string[];
} {
  const userHash = createHash('sha256').update(ctx.userId).digest('hex').slice(0, 12);
  const ts = new Date().toISOString();
  return {
    title: `Groundcheck Report ${ctx.citeId}`,
    author: `Groundcheck v1 · ${userHash}`,
    subject: ctx.citeId,
    producer: `earthmove-v1 / ${ts}`,
    keywords: [`cite:${ctx.citeId}`, `user:${userHash}`, `ts:${Math.floor(Date.now() / 1000)}`],
  };
}
