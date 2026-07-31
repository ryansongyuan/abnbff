import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders Bottom 3 for every annual card with the Ryan footer", async () => {
  const response = await render();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal((html.match(/Lowest prices/g) ?? []).length, 6);
  assert.equal((html.match(/BOTTOM 3/g) ?? []).length, 6);
  assert.match(html, /<footer[^>]*>A Ryan Website\.<\/footer>/i);
});
