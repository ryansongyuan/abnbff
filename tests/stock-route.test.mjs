import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("GET /api/stock returns a complete stock response with cache policy", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/stock", { headers: { accept: "application/json" } }),
    env,
    executionContext,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /s-maxage=60/);
  assert.equal(typeof body.latest, "number");
  assert.equal(Array.isArray(body.years), true);
  assert.equal(typeof body.stale, "boolean");
  assert.equal(typeof body.fetchedAt, "string");
});
