import { buildStockData } from "./stock-data.mjs";

export function buildNasdaqHistoricalUrl(date = new Date()) {
  const to = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
  const params = new URLSearchParams({
    assetclass: "stocks",
    fromdate: "01/01/2021",
    limit: "5000",
    todate: to,
  });
  return `https://api.nasdaq.com/api/quote/ABNB/historical?${params}`;
}

export function createStockService({
  fetchImpl = fetch,
  fallback,
  now = Date.now,
  ttlMs = 60_000,
  timeoutMs = 8_000,
}) {
  let cached = null;
  let cachedAt = 0;
  let inFlight = null;

  async function refresh() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(buildNasdaqHistoricalUrl(new Date(now())), {
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (compatible; ABNBFinalFight/1.0)",
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Nasdaq request failed: ${response.status}`);
      const normalized = buildStockData(await response.json());
      cachedAt = now();
      cached = {
        ...normalized,
        fetchedAt: new Date(cachedAt).toISOString(),
        stale: false,
      };
      return cached;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getStockData() {
    if (cached && now() - cachedAt < ttlMs) return cached;

    try {
      inFlight ??= refresh().finally(() => { inFlight = null; });
      return await inFlight;
    } catch {
      const base = cached ?? fallback;
      return {
        ...base,
        fetchedAt: new Date(now()).toISOString(),
        stale: true,
      };
    }
  }

  return { getStockData };
}
