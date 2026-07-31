import assert from "node:assert/strict";
import test from "node:test";
import { buildStockData } from "../scripts/build-stock-data.mjs";

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
