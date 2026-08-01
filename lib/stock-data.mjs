const MINIMUM_YEAR = 2021;

const fmtVolume = (value) =>
  value >= 1_000_000_000
    ? `${(value / 1_000_000_000).toFixed(2)}B`
    : `${Math.round(value / 1_000_000)}M`;

const parseMarketNumber = (value) => {
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed)) throw new TypeError("Market values must be numeric");
  return parsed;
};

export function normalizeRows(source) {
  const rows = source?.data?.tradesTable?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TypeError("Nasdaq response has no trading rows");
  }

  return rows
    .map((row) => ({
      date: row.date,
      close: parseMarketNumber(row.close),
      open: parseMarketNumber(row.open),
      high: parseMarketNumber(row.high),
      low: parseMarketNumber(row.low),
      volume: parseMarketNumber(row.volume),
    }))
    .reverse();
}

function yearsFromRows(rows, minimumYear = MINIMUM_YEAR) {
  return [...new Set(rows.map((row) => Number(row.date.slice(-4))))]
    .filter((year) => Number.isInteger(year) && year >= minimumYear)
    .sort((a, b) => b - a);
}

export function getAvailableYears(source, minimumYear = MINIMUM_YEAR) {
  return yearsFromRows(normalizeRows(source), minimumYear);
}

export function buildStockData(source, yearsToInclude) {
  const rows = normalizeRows(source);
  const selectedYears = yearsToInclude ?? yearsFromRows(rows);
  if (selectedYears.length === 0) throw new TypeError("Nasdaq response has no supported trading years");

  const years = selectedYears.map((year) => {
    const days = rows.filter((row) => Number(row.date.slice(-4)) === year);
    if (days.length === 0) throw new TypeError(`Nasdaq response has no trading rows for ${year}`);
    const first = days[0];
    const last = days.at(-1);
    const top = [...days]
      .sort((a, b) => b.high - a.high)
      .slice(0, 3)
      .map((day) => ({ price: day.high, date: day.date }));
    const bottom = [...days]
      .sort((a, b) => a.low - b.low)
      .slice(0, 3)
      .map((day) => ({ price: day.low, date: day.date }));

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
      bottom,
    };
  });

  const latest = rows.at(-1);
  const previous = rows.at(-2);
  if (!previous) throw new TypeError("Nasdaq response needs at least two trading rows");
  const delta = latest.close - previous.close;

  return {
    source: "Nasdaq",
    updated: latest.date,
    latest: latest.close,
    delta,
    deltaPercent: (delta / previous.close) * 100,
    years,
  };
}
