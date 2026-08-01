import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { buildStockData } from "../lib/stock-data.mjs";

export { buildStockData } from "../lib/stock-data.mjs";

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: node build-stock-data.mjs input.json output.json");

  fs.writeFileSync(output, JSON.stringify(buildStockData(JSON.parse(fs.readFileSync(input, "utf8")))));
}
