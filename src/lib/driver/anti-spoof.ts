/**
 * Synchronous anti-spoof gates for /api/driver/ping.
 * Cheap checks only — expensive ones (straight-line detection, ASN mismatch) are deferred
 * to an Inngest worker that populates additional flags asynchronously.
 *
 * Philosophy: FLAG, NEVER REJECT. Rejecting teaches attackers the thresholds.
 * Admin dashboard surfaces flagged sessions for human review.
 */

export type PingInput = {
  lat: number;
  lng: number;
  recorded_at: string; // ISO 8601
  accuracy_m: number | null;
};

export type PreviousPing = {
  lat: number;
  lng: number;
  recorded_at: string;
};

const MAX_VELOCITY_MPS = 37.95; // 85 mph — dump truck top speed with comfortable margin
const TELEPORT_DISTANCE_M = 5000; // 5 km
const TELEPORT_DT_S = 30; // in under 30 seconds
const CLOCK_SKEW_S = 60;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function detectAnomalies(
  current: PingInput,
  previous: PreviousPing | null,
  serverNow: Date = new Date()
): string[] {
  const flags: string[] = [];
  const currentTs = new Date(current.recorded_at).getTime();
  const serverTs = serverNow.getTime();

  // Clock skew: client-reported time ≠ server time by more than 60s
  if (Math.abs(serverTs - currentTs) > CLOCK_SKEW_S * 1000) {
    flags.push('clock_skew');
  }

  // Accuracy: >500m is unusable for arrival detection
  if (current.accuracy_m != null && current.accuracy_m > 500) {
    flags.push('accuracy');
  }

  if (previous) {
    const prevTs = new Date(previous.recorded_at).getTime();
    const dt = (currentTs - prevTs) / 1000; // seconds

    if (dt <= 0) {
      // Out-of-order ping or duplicate — flag but allow (DB ordering handles this)
      flags.push('out_of_order');
    } else {
      const distance = haversineMeters(previous.lat, previous.lng, current.lat, current.lng);
      const velocityMps = distance / dt;

      if (velocityMps > MAX_VELOCITY_MPS) {
        flags.push('velocity');
      }

      if (distance > TELEPORT_DISTANCE_M && dt < TELEPORT_DT_S) {
        flags.push('teleport');
      }
    }
  }

  return flags;
}
