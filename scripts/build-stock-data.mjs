import fs from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node build-stock-data.mjs input.json output.json");

const source = JSON.parse(fs.readFileSync(input, "utf8"));
const rows = source.data.tradesTable.rows
  .map((row) => ({
    date: row.date,
    close: Number(row.close.replace(/[$,]/g, "")),
    open: Number(row.open.replace(/[$,]/g, "")),
    high: Number(row.high.replace(/[$,]/g, "")),
    low: Number(row.low.replace(/[$,]/g, "")),
    volume: Number(row.volume.replace(/,/g, "")),
  }))
  .reverse();

const fmtVolume = (value) =>
  value >= 1_000_000_000
    ? `${(value / 1_000_000_000).toFixed(2)}B`
    : `${Math.round(value / 1_000_000)}M`;

const years = [2026, 2025, 2024, 2023, 2022, 2021].map((year) => {
  const days = rows.filter((row) => Number(row.date.slice(-4)) === year);
  const first = days[0];
  const last = days.at(-1);
  const top = [...days]
    .sort((a, b) => b.high - a.high)
    .slice(0, 3)
    .map((day) => ({ price: day.high, date: day.date }));

  return {
    year,
    change: ((last.close - first.open) / first.open) * 100,
    open: first.open,
    close: last.close,
    low: Math.min(...days.map((day) => day.low)),
    high: Math.max(...days.map((day) => day.high)),
    volume: fmtVolume(days.reduce((sum, day) => sum + day.volume, 0)),
    days: days.map(({ date, close }) => ({ date, price: close })),
    top,
  };
});

const latest = rows.at(-1);
const previous = rows.at(-2);
const delta = latest.close - previous.close;

fs.writeFileSync(
  output,
  JSON.stringify({
    source: "Nasdaq",
    updated: latest.date,
    latest: latest.close,
    delta,
    deltaPercent: (delta / previous.close) * 100,
    years,
  }),
);
