import { updateEventTrust, type TrustPersist } from "./db/queries/events";
import { getUserEvents } from "./db/queries/events";
import { isKnownDevice, upsertTrustedDevice } from "./db/queries/trusted-devices";
import { haversineMetres } from "./geo";
import { computeTrustScore, type TrustFlag } from "./trust-scoring";

export type { TrustFlag, TrustLevel } from "./trust-scoring";
export {
  TRUST_BASE_SCORE,
  TRUST_FLAG_DELTAS,
  computeTrustScore,
  trustLevelFromScore,
} from "./trust-scoring";

interface EvalParams {
  eventId: string;
  userId: string;
  gpsAccuracyM: number | null;
  deviceTimezone: string | null;
  ipGeoLat: number | null;
  ipGeoLng: number | null;
  ipAddress: string;
  gpsLat: number | null;
  gpsLng: number | null;
  checkinAt: string;
  mockLocationEnabled?: boolean;
  deviceId?: string | null;
  nativePlatform?: string | null;
}

export async function evaluateTrust(params: EvalParams): Promise<TrustPersist> {
  const flags: TrustFlag[] = [];

  if (params.mockLocationEnabled) {
    flags.push("mock_location_enabled");
  }

  if (params.deviceId) {
    const known = await isKnownDevice(params.userId, params.deviceId);
    if (!known) flags.push("unknown_device");
    await upsertTrustedDevice({
      userId: params.userId,
      deviceHash: params.deviceId,
      platform: params.nativePlatform ?? "native",
    }).catch(() => {});
  }

  // 1. Mock GPS: accuracy <= 1m
  if (params.gpsAccuracyM !== null && params.gpsAccuracyM <= 1) {
    flags.push("mock_gps_suspected");
  }

  // 2. Timezone mismatch: browser timezone vs IP geolocation timezone
  if (params.deviceTimezone && params.ipGeoLng !== null) {
    try {
      const ipOffset = Math.round(params.ipGeoLng / 15) * 60;
      const tzName = params.deviceTimezone;
      const sample = new Date().toLocaleString("en-US", {
        timeZone: tzName,
        timeZoneName: "shortOffset",
      });
      const match = sample.match(/GMT([+-])(\d+)(?::(\d+))?/);
      if (match) {
        const sign = match[1] === "+" ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3] ?? "0", 10);
        const browserOffset = sign * (hours * 60 + minutes);
        if (Math.abs(browserOffset - ipOffset) > 90)
          flags.push("timezone_mismatch");
      }
    } catch {
      /* skip if timezone name is invalid */
    }
  }

  // 3. VPN/proxy check via ip-api
  const privatePatterns = ["127.", "::1", "192.168.", "10.", "172."];
  const isPrivate = privatePatterns.some((p) => params.ipAddress.startsWith(p));
  if (!isPrivate) {
    try {
      const res = await fetch(
        `http://ip-api.com/json/${params.ipAddress}?fields=proxy,hosting`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          proxy?: boolean;
          hosting?: boolean;
        };
        if (data.proxy || data.hosting) flags.push("vpn_suspected");
      }
    } catch {
      /* skip */
    }
  }

  // 4. Impossible travel: >500km from previous check-in within 2 hours
  if (params.gpsLat !== null && params.gpsLng !== null) {
    try {
      const { events } = await getUserEvents({
        userId: params.userId,
        limit: 5,
      });
      const prev = events.find(
        (e) =>
          e.id !== params.eventId && e.gps_lat !== null && e.gps_lng !== null,
      );
      if (prev && prev.gps_lat !== null && prev.gps_lng !== null) {
        const dist = haversineMetres(
          params.gpsLat,
          params.gpsLng,
          prev.gps_lat,
          prev.gps_lng,
        );
        const checkinTs = prev.checkin_at.includes("T")
          ? prev.checkin_at
          : prev.checkin_at.replace(" ", "T") + "Z";
        const tDiff = Math.abs(
          new Date(params.checkinAt).getTime() - new Date(checkinTs).getTime(),
        );
        if (dist > 500_000 && tDiff < 2 * 3600 * 1000)
          flags.push("impossible_travel");
      }
    } catch {
      /* skip */
    }
  }

  const trustScore = computeTrustScore(flags);
  const result: TrustPersist = { trustFlags: flags, trustScore };

  await updateEventTrust(params.eventId, result);
  return result;
}
