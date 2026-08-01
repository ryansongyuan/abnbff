import assert from "node:assert/strict";
import test from "node:test";
import { createStockService } from "../lib/live-stock.mjs";

const source = {
  data: {
    tradesTable: {
      rows: [
        { date: "01/05/2026", close: "$15.00", open: "$14.00", high: "$16.00", low: "$13.00", volume: "100" },
        { date: "01/04/2026", close: "$14.00", open: "$13.00", high: "$15.00", low: "$9.00", volume: "100" },
        { date: "01/03/2026", close: "$13.00", open: "$12.00", high: "$14.00", low: "$11.00", volume: "100" },
        { date: "01/02/2026", close: "$12.00", open: "$11.00", high: "$13.00", low: "$8.00", volume: "100" },
        { date: "01/01/2026", close: "$11.00", open: "$10.00", high: "$12.00", low: "$10.00", volume: "100" },
      ],
    },
  },
};

const fallback = {
  source: "Nasdaq",
  updated: "12/31/2025",
  latest: 99,
  delta: 1,
  deltaPercent: 1.02,
  years: [],
};

test("caches a successful normalized response for 60 seconds", async () => {
  let calls = 0;
  let currentTime = 1_000_000;
  const service = createStockService({
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify(source), { status: 200 });
    },
    fallback,
    now: () => currentTime,
    ttlMs: 60_000,
  });

  const first = await service.getStockData();
  currentTime += 59_999;
  const second = await service.getStockData();

  assert.equal(calls, 1);
  assert.equal(first.stale, false);
  assert.deepEqual(second, first);
});

test("refetches after the 60 second cache window", async () => {
  let calls = 0;
  let currentTime = 1_000_000;
  const service = createStockService({
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify(source), { status: 200 });
    },
    fallback,
    now: () => currentTime,
    ttlMs: 60_000,
  });

  await service.getStockData();
  currentTime += 60_001;
  await service.getStockData();

  assert.equal(calls, 2);
});

test("returns the most recent successful cache when refresh fails", async () => {
  let fail = false;
  let currentTime = 1_000_000;
  const service = createStockService({
    fetchImpl: async () => {
      if (fail) throw new Error("offline");
      return new Response(JSON.stringify(source), { status: 200 });
    },
    fallback,
    now: () => currentTime,
    ttlMs: 60_000,
  });

  const fresh = await service.getStockData();
  fail = true;
  currentTime += 60_001;
  const recovered = await service.getStockData();

  assert.equal(recovered.latest, fresh.latest);
  assert.equal(recovered.stale, true);
});

test("returns bundled data as stale when the first upstream request fails", async () => {
  const service = createStockService({
    fetchImpl: async () => new Response("bad gateway", { status: 502 }),
    fallback,
    now: () => 1_000_000,
  });

  const result = await service.getStockData();

  assert.equal(result.latest, fallback.latest);
  assert.equal(result.stale, true);
});

test("shares one in-flight upstream request between concurrent callers", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = createStockService({
    fetchImpl: async () => {
      calls += 1;
      await pending;
      return new Response(JSON.stringify(source), { status: 200 });
    },
    fallback,
    now: () => 1_000_000,
  });

  const first = service.getStockData();
  const second = service.getStockData();
  release();
  await Promise.all([first, second]);

  assert.equal(calls, 1);
});
