import { createSecurityClient, createPublicClient } from './server-client';

export type GpsPing = { lat: number; lng: number; ts: string; accuracy_m?: number };
export type GpsAnomaly = { type: 'accuracy_radius' | 'time_reversal' | 'teleportation' | 'impossible_speed'; computed: number; threshold: number };

/**
 * WIRING into /api/driver/ping route:
 *
 *   import { checkGpsAnomaly } from '@/lib/security/gps-anomaly';
 *   const prev = await fetchPreviousPing(driverId);
 *   const anomaly = await checkGpsAnomaly(
 *     { driverId, dispatchId },
 *     { lat, lng, ts, accuracy_m },
 *     prev ? { lat: prev.lat, lng: prev.lng, ts: prev.ts } : null
 *   );
 *   if (anomaly) return NextResponse.json({ rejected: anomaly }, { status: 422 });
 */
export async function checkGpsAnomaly(
  ctx: { driverId: string; dispatchId?: string },
  curr: GpsPing,
  prev: GpsPing | null
): Promise<GpsAnomaly | null> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('fn_gps_anomaly_check', {
      p_lat: curr.lat, p_lng: curr.lng, p_ts: curr.ts,
      p_prev_lat: prev?.lat ?? null, p_prev_lng: prev?.lng ?? null, p_prev_ts: prev?.ts ?? null,
      p_accuracy_m: curr.accuracy_m ?? null,
    });
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const row = Array.isArray(data) ? data[0] : data;
    const anomaly: GpsAnomaly = { type: row.anomaly_type, computed: Number(row.computed_value), threshold: Number(row.threshold) };
    try {
      const sb2 = createSecurityClient();
      await sb2.from('gps_anomalies').insert({
        driver_id: ctx.driverId, dispatch_id: ctx.dispatchId,
        anomaly_type: anomaly.type, computed_value: anomaly.computed, threshold: anomaly.threshold,
        prev_lat: prev?.lat, prev_lng: prev?.lng, prev_ts: prev?.ts,
        curr_lat: curr.lat, curr_lng: curr.lng, curr_ts: curr.ts,
      });
    } catch { /* swallow */ }
    return anomaly;
  } catch { return null; }
}
