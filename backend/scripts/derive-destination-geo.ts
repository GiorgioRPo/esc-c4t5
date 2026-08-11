

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { buildAscendaUrl } from "../src/lib/ascenda.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DESTINATIONS_TS = resolve(REPO_ROOT, "frontend/src/data/destinations.ts");
const OUT_SEED = resolve(REPO_ROOT, "database/seed/destinations.json");
const OUT_GAPS = resolve(REPO_ROOT, "database/seed/destinations.gaps.json");

/** Concurrency limit so we do not hammer the Ascenda API. */
const CONCURRENCY = 2;

/** Retry settings for Ascenda 429 (rate limit) responses. */
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LocalDestination {
  term: string;
  value: string;
  type: string;
}

interface AscendaHotelGeo {
  id?: string;
  latitude?: number;
  longitude?: number;
}

/** A seed record. Fields marked null require manual curation. */
interface SeedDestination {
  uid: string;
  name: string;
  country_name: string;
  country_code: string | null;
  region: string | null;
  destination_type: string | null;
  description: string | null;
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  /**
   * Count of hotels in Ascenda's STATIC inventory for this destination.
   * This is NOT dated availability.
   */
  hotel_count: number;
  metadata: Record<string, unknown>;
}

function readLocalDestinations(): LocalDestination[] {
  const source = readFileSync(DESTINATIONS_TS, "utf-8");
  const entry =
    /\{\s*term:\s*'([^']+)',\s*value:\s*'([^']+)',\s*type:\s*'([^']+)'\s*\}/g;

  const results: LocalDestination[] = [];
  let match: RegExpExecArray | null;
  while ((match = entry.exec(source)) !== null) {
    results.push({ term: match[1], value: match[2], type: match[3] });
  }
  return results;
}

/** "Bangkok, Thailand" -> { name: "Bangkok", country: "Thailand" } */
function splitTerm(term: string): { name: string; country: string } {
  const parts = term.split(",").map((p) => p.trim());
  if (parts.length < 2) {
    return { name: parts[0], country: parts[0] };
  }
  return {
    name: parts.slice(0, -1).join(", "),
    country: parts[parts.length - 1],
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function isUsableCoord(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // Ascenda uses 0,0 as a placeholder for missing geocoding.
  if (lat === 0 && lng === 0) return false;
  return true;
}

async function fetchHotelsForDestination(
  uid: string,
): Promise<AscendaHotelGeo[]> {
  const url = buildAscendaUrl("hotels", { destination_id: uid });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString());

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? (data as AscendaHotelGeo[]) : [];
    }

    // 429 = rate limited, 5xx = transient. Both are worth retrying with
    // exponential backoff. Everything else is a real error.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      throw new Error(`Ascenda returned ${response.status}`);
    }

    const backoff = BASE_BACKOFF_MS * 2 ** attempt;
    // Jitter avoids all workers retrying in lockstep and re-triggering the limit.
    await sleep(backoff + Math.random() * 500);
  }

  throw new Error("unreachable");
}

/** Runs an async mapper over items with a bounded number of workers. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

async function buildSeedRecord(
  local: LocalDestination,
): Promise<{ record: SeedDestination; error: string | null }> {
  const { name, country } = splitTerm(local.term);

  const record: SeedDestination = {
    uid: local.value,
    name,
    country_name: country,
    // Curation required — no trustworthy in-repo source for these.
    country_code: null,
    region: null,
    destination_type: local.type === "airport" ? "airport" : null,
    description: null,
    tags: [],
    latitude: null,
    longitude: null,
    hotel_count: 0,
    metadata: { source_term: local.term, source_type: local.type },
  };

  try {
    const hotels = await fetchHotelsForDestination(local.value);
    record.hotel_count = hotels.length;

    const lats: number[] = [];
    const lngs: number[] = [];
    for (const hotel of hotels) {
      if (isUsableCoord(hotel.latitude, hotel.longitude)) {
        lats.push(hotel.latitude as number);
        lngs.push(hotel.longitude as number);
      }
    }

    record.latitude = median(lats);
    record.longitude = median(lngs);
    record.metadata.geocoded_from_hotels = lats.length;

    if (record.latitude === null) {
      return {
        record,
        error: `no hotel returned usable coordinates (${hotels.length} hotels)`,
      };
    }
    return { record, error: null };
  } catch (error) {
    return {
      record,
      error: error instanceof Error ? error.message : "unknown fetch failure",
    };
  }
}

async function main(): Promise<void> {
  if (!process.env.ASCENDA_API_URL) {
    console.error("ASCENDA_API_URL is not set. Check backend/.env");
    process.exit(1);
  }

  const locals = readLocalDestinations();
  if (locals.length === 0) {
    console.error(`Parsed 0 destinations from ${DESTINATIONS_TS}`);
    process.exit(1);
  }

  // Resume support: reuse any destination that already has coordinates so a
  // re-run only retries the ones that previously failed (e.g. rate limited).
  const previous = new Map<string, SeedDestination>();
  if (existsSync(OUT_SEED)) {
    try {
      const prior: SeedDestination[] = JSON.parse(
        readFileSync(OUT_SEED, "utf-8"),
      );
      for (const record of prior) {
        if (record.latitude !== null && record.longitude !== null) {
          previous.set(record.uid, record);
        }
      }
    } catch {
      console.warn("Could not parse existing seed file; refetching everything.");
    }
  }

  console.log(
    `Parsed ${locals.length} destinations ` +
      `(${previous.size} already have coordinates, will be reused).\n`,
  );

  const outcomes = await mapWithConcurrency(
    locals,
    CONCURRENCY,
    async (local, index) => {
      const cached = previous.get(local.value);
      if (cached) {
        console.log(
          `[${String(index + 1).padStart(2)}/${locals.length}] kept ` +
            `${local.term.padEnd(34)} (cached)`,
        );
        return { record: cached, error: null };
      }

      const result = await buildSeedRecord(local);
      const status = result.error ? "SKIP" : "ok  ";
      const coords = result.error
        ? result.error
        : `${result.record.latitude?.toFixed(4)}, ${result.record.longitude?.toFixed(4)} ` +
          `(${result.record.hotel_count} hotels)`;
      console.log(
        `[${String(index + 1).padStart(2)}/${locals.length}] ${status} ` +
          `${local.term.padEnd(34)} ${coords}`,
      );
      return result;
    },
  );

  const records = outcomes.map((o) => o.record);

  // Duplicate UID detection — a duplicate would silently overwrite on upsert.
  const seen = new Map<string, string>();
  const duplicates: Array<{ uid: string; names: string[] }> = [];
  for (const record of records) {
    const previous = seen.get(record.uid);
    if (previous) {
      duplicates.push({ uid: record.uid, names: [previous, record.name] });
    } else {
      seen.set(record.uid, record.name);
    }
  }

  const gaps = {
    generated_at: new Date().toISOString(),
    total: records.length,
    missing_coordinates: outcomes
      .filter((o) => o.error !== null)
      .map((o) => ({ uid: o.record.uid, name: o.record.name, reason: o.error })),
    requires_manual_curation: records
      .filter((r) => !r.description || r.tags.length === 0)
      .map((r) => ({
        uid: r.uid,
        name: r.name,
        missing: [
          !r.description ? "description" : null,
          r.tags.length === 0 ? "tags" : null,
          !r.country_code ? "country_code" : null,
          !r.region ? "region" : null,
          !r.destination_type ? "destination_type" : null,
        ].filter(Boolean),
      })),
    duplicate_uids: duplicates,
  };

  mkdirSync(dirname(OUT_SEED), { recursive: true });
  writeFileSync(OUT_SEED, JSON.stringify(records, null, 2) + "\n", "utf-8");
  writeFileSync(OUT_GAPS, JSON.stringify(gaps, null, 2) + "\n", "utf-8");

  const withCoords = records.filter((r) => r.latitude !== null).length;
  console.log(`\n--- Summary -------------------------------------`);
  console.log(`Destinations parsed:        ${records.length}`);
  console.log(`Coordinates derived:        ${withCoords}`);
  console.log(`Missing coordinates:        ${records.length - withCoords}`);
  console.log(`Awaiting manual curation:   ${gaps.requires_manual_curation.length}`);
  console.log(`Duplicate UIDs:             ${duplicates.length}`);
  console.log(`\nSeed written to:  ${OUT_SEED}`);
  console.log(`Gap report:       ${OUT_GAPS}`);

  if (duplicates.length > 0) {
    console.error("\nFAIL: duplicate destination UIDs found.");
    process.exit(1);
  }
  if (withCoords === 0) {
    console.error("\nFAIL: no coordinates could be derived.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("derive-destination-geo failed:", error);
  process.exit(1);
});