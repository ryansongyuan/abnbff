import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const destination = "https://stayalpha-abnb.jn34t34.chatgpt.site/";

test("GitHub Pages entry redirects and offers a manual canonical link", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /http-equiv=["']refresh["']/i);
  assert.ok(html.includes(`location.replace(${JSON.stringify(destination)})`));
  assert.ok(html.includes(`href="${destination}"`));
  assert.match(html, /rel=["']canonical["']/i);
  assert.match(html, /noindex/i);
});
