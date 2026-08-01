import assert from "node:assert/strict";
import test from "node:test";
import { buildStockData, getAvailableYears } from "../lib/stock-data.mjs";

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

test("buildStockData ranks the three lowest intraday prices in ascending order", () => {
  const result = buildStockData(source, [2026]);

  assert.deepEqual(result.years[0].bottom, [
    { price: 8, date: "01/02/2026" },
    { price: 9, date: "01/04/2026" },
    { price: 10, date: "01/01/2026" },
  ]);
});

test("getAvailableYears returns source years newest first from 2021 onward", () => {
  const multiYear = structuredClone(source);
  multiYear.data.tradesTable.rows.push(
    { date: "12/31/2025", close: "$10.00", open: "$9.00", high: "$11.00", low: "$8.00", volume: "100" },
    { date: "12/31/2020", close: "$8.00", open: "$7.00", high: "$9.00", low: "$6.00", volume: "100" },
  );

  assert.deepEqual(getAvailableYears(multiYear), [2026, 2025]);
});

test("buildStockData rejects a response with no trading rows", () => {
  assert.throws(
    () => buildStockData({ data: { tradesTable: { rows: [] } } }),
    /trading rows/i,
  );
});

test("buildStockData rejects non-numeric market values", () => {
  const invalid = structuredClone(source);
  invalid.data.tradesTable.rows[0].close = "N/A";

  assert.throws(() => buildStockData(invalid, [2026]), /numeric/i);
});
