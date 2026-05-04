import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const EVERGREEN = rgb(0x0E / 255, 0x2A / 255, 0x22 / 255);
const STONE_500 = rgb(0x78 / 255, 0x71 / 255, 0x6c / 255);
const STONE_700 = rgb(0x44 / 255, 0x40 / 255, 0x3c / 255);
const CREAM = rgb(0xF5 / 255, 0xF1 / 255, 0xE8 / 255);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { reportId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(reportId)) {
    return NextResponse.json({ error: 'invalid_report_id' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Auth gate: same logic as create_trust_share_grant — owner OR job-requester OR access row
  const { data: report, error: rerr } = await admin
    .from('trust_reports')
    .select('id, user_id, job_id, contractor_name, state_code, city, trust_score, risk_level, summary, created_at, lic_status, biz_status, bbb_rating, red_flags, positive_indicators, data_sources_searched')
    .eq('id', reportId)
    .maybeSingle();

  if (rerr || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let authorized = report.user_id === user.id;
  if (!authorized && report.job_id) {
    const { data: job } = await admin
      .from('trust_jobs').select('requested_by_user_id').eq('id', report.job_id).maybeSingle();
    authorized = job?.requested_by_user_id === user.id;
  }
  if (!authorized) {
    const { data: access } = await admin
      .from('trust_report_access').select('id').eq('report_id', reportId).eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    authorized = !!access;
  }
  if (!authorized) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Evidence count for the integrity footer
  const { count: evidenceCount } = await admin
    .from('trust_evidence').select('id', { count: 'exact', head: true }).eq('job_id', report.job_id);

  // QR encodes the public verify URL — anyone scanning can hit our anonymous endpoint
  // and confirm the chain hashes match the evidence rows in our DB.
  const verifyUrl = `${req.nextUrl.origin}/api/trust/verify/${reportId}`;
  const qrPngBytes = await QRCode.toBuffer(verifyUrl, { width: 240, margin: 1, errorCorrectionLevel: 'M' });

  // Build PDF
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Groundcheck Report — ${report.contractor_name}`);
  pdf.setAuthor('Groundcheck (Earth Pro Connect LLC)');
  pdf.setProducer('Groundcheck');
  pdf.setCreator('earthmove.io/trust');
  pdf.setSubject('Public-records contractor verification');
  pdf.setCreationDate(new Date());

  const page = pdf.addPage([612, 792]); // US Letter
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Header band
  page.drawRectangle({ x: 0, y: 740, width: 612, height: 52, color: CREAM });
  page.drawText('Groundcheck', { x: 40, y: 758, size: 22, font: helvBold, color: EVERGREEN });
  page.drawText('dig before you sign.', { x: 40, y: 745, size: 9, font: helv, color: STONE_700 });

  // Subject block
  let y = 700;
  page.drawText(report.contractor_name, { x: 40, y, size: 18, font: helvBold, color: EVERGREEN });
  y -= 18;
  const locLine = [report.city, report.state_code].filter(Boolean).join(', ');
  if (locLine) {
    page.drawText(locLine, { x: 40, y, size: 11, font: helv, color: STONE_500 });
    y -= 16;
  }
  page.drawText(`Report generated ${new Date(report.created_at).toISOString().slice(0, 10)}`, {
    x: 40, y, size: 9, font: helv, color: STONE_500,
  });
  y -= 30;

  // Trust score box
  page.drawRectangle({ x: 40, y: y - 80, width: 300, height: 80, color: CREAM });
  page.drawText('Trust score', { x: 56, y: y - 18, size: 9, font: helv, color: STONE_700 });
  page.drawText(report.trust_score != null ? String(report.trust_score) : '—', {
    x: 56, y: y - 58, size: 36, font: helvBold, color: EVERGREEN,
  });
  page.drawText(report.risk_level ?? '—', {
    x: 180, y: y - 38, size: 14, font: helvBold, color: EVERGREEN,
  });
  page.drawText('out of 100', { x: 130, y: y - 58, size: 9, font: helv, color: STONE_500 });
  y -= 100;

  // Status lines
  const statusRows: Array<[string, string | null | undefined]> = [
    ['Business registration', report.biz_status],
    ['Licensing', report.lic_status],
    ['Better Business Bureau', report.bbb_rating],
  ];
  for (const [label, val] of statusRows) {
    page.drawText(label, { x: 40, y, size: 10, font: helvBold, color: STONE_700 });
    page.drawText(val ?? 'No data', { x: 220, y, size: 10, font: helv, color: STONE_700 });
    y -= 16;
  }
  y -= 10;

  // Summary
  if (report.summary) {
    page.drawText('Summary', { x: 40, y, size: 11, font: helvBold, color: EVERGREEN });
    y -= 16;
    const wrapped = wrapText(report.summary, 80);
    for (const line of wrapped.slice(0, 12)) {
      page.drawText(line, { x: 40, y, size: 9, font: helv, color: STONE_700 });
      y -= 12;
    }
    y -= 10;
  }

  // QR + verify footer
  const qrImage = await pdf.embedPng(qrPngBytes);
  page.drawImage(qrImage, { x: 432, y: 60, width: 120, height: 120 });
  page.drawText('Verify this report', { x: 432, y: 192, size: 9, font: helvBold, color: EVERGREEN });
  page.drawText('Scan to verify chain integrity', { x: 432, y: 50, size: 7, font: helv, color: STONE_500 });
  page.drawText(`evidence rows: ${evidenceCount ?? 0}`, { x: 432, y: 40, size: 7, font: helv, color: STONE_500 });

  // Compliance footer
  const disclaimer = 'This report compiles publicly available business records. It is not a consumer report under the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq. Findings are point-in-time observations and should be independently verified.';
  const wrapDisc = wrapText(disclaimer, 65);
  let dy = 130;
  for (const line of wrapDisc) {
    page.drawText(line, { x: 40, y: dy, size: 7, font: helv, color: STONE_500 });
    dy -= 9;
  }
  page.drawText('Earth Pro Connect LLC · earthmove.io/trust', {
    x: 40, y: 40, size: 7, font: helv, color: STONE_500,
  });

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="groundcheck-${slugify(report.contractor_name)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

function wrapText(s: string, max: number): string[] {
  const words = s.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
