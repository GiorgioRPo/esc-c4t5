/**
 * Enriches recommendation candidates with live Ascenda inventory signals.
 *
 * Reuses the existing Ascenda client and cache -- this must not become a
 * second, divergent implementation of partner-API access.
 *
 * TRUTHFUL NAMING: Ascenda's prices endpoint tells us which hotels returned a
 * dated price, so we report `priced_hotel_count`. We never claim
 * `available_hotels` from this data, because a price response is not an
 * availability confirmation.
 */

import { buildAscendaUrl } from "./ascenda.js";
import { getCached, setCached } from "./cache.js";

/** How many destinations we enrich in parallel. Ascenda rate-limits above this. */
const CONCURRENCY = 3;

/** Per-destination timeout. Recommendations must degrade, never hang. */
const PER_REQUEST_TIMEOUT_MS = 4000;

/**
 * Dated prices go stale, so this TTL is deliberately short. Never raise it to
 * the point where a user could be shown a price that no longer exists.
 */
const PRICE_CACHE_TTL_MS = 3 * 60 * 1000;

export interface EnrichmentParams {
  checkin: string;
  checkout: string;
  guests: string;
  currency: string;
  countryCode: string;
}

export interface InventorySignals {
  priced_hotel_count: number | null;
  min_price: number | null;
  /** True when Ascenda reported its async pricing run as finished. */
  completed: boolean;
}

interface AscendaPriceRow {
  id?: string;
  lowest_converted_price?: number;
}

interface AscendaPricesResponse {
  completed?: boolean;
  hotels?: AscendaPriceRow[];
}

/**
 * One Ascenda prices call for a single destination.
 *
 * Deliberately does NOT poll. The recommendation endpoint must return quickly;
 * partial pricing is reported honestly via `completed: false` and the frontend
 * shows "Checking prices..." rather than a wrong number.
 */
async function fetchInventory(
  destinationUid: string,
  params: EnrichmentParams,
): Promise<InventorySignals> {
  const cacheKey =
    `rec_inv_${destinationUid}_${params.checkin}_${params.checkout}` +
    `_${params.guests}_${params.currency}`;

  const cached = getCached<InventorySignals>(cacheKey);
  if (cached) return cached;

  const url = buildAscendaUrl("hotels/prices", {
    destination_id: destinationUid,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: params.guests,
    currency: params.currency,
    country_code: params.countryCode,
    lang: "en_US",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Ascenda prices returned ${response.status}`);
    }

    const data = (await response.json()) as AscendaPricesResponse;
    const rows = Array.isArray(data.hotels) ? data.hotels : [];

    const priced = rows.filter(
      (row) =>
        typeof row.lowest_converted_price === "number" &&
        row.lowest_converted_price > 0,
    );

    const signals: InventorySignals = {
      priced_hotel_count: priced.length > 0 ? priced.length : null,
      min_price:
        priced.length > 0
          ? Math.min(...priced.map((r) => r.lowest_converted_price as number))
          : null,
      completed: data.completed === true,
    };

    // Only cache once Ascenda says the pricing run finished. Caching a partial
    // result would freeze an incomplete answer for every later request.
    if (signals.completed) {
      setCached(cacheKey, signals, PRICE_CACHE_TTL_MS);
    }
    return signals;
  } finally {
    clearTimeout(timer);
  }
}

/** Runs an async mapper with a bounded number of workers. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface EnrichmentResult {
  signals: Map<string, InventorySignals>;
  failureCount: number;
  pricingComplete: boolean;
}

/**
 * Enriches many destinations, tolerating partial failure.
 *
 * A single destination failing must never fail the whole recommendation
 * request -- that candidate simply loses its price/availability claims.
 */
export async function enrichCandidates(
  destinationUids: string[],
  params: EnrichmentParams,
): Promise<EnrichmentResult> {
  const settled = await mapWithConcurrency(destinationUids, CONCURRENCY, (uid) =>
    fetchInventory(uid, params),
  );

  const signals = new Map<string, InventorySignals>();
  let failureCount = 0;
  let pricingComplete = true;

  settled.forEach((result, index) => {
    const uid = destinationUids[index];
    if (result.status === "fulfilled") {
      signals.set(uid, result.value);
      if (!result.value.completed) pricingComplete = false;
    } else {
      failureCount += 1;
      pricingComplete = false;
      console.warn(
        `[recommendations] enrichment failed for ${uid}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  });

  return { signals, failureCount, pricingComplete };
}
