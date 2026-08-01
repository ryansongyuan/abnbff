export type PricePoint = { price: number; date: string };

export type YearData = {
  year: number;
  change: number;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: string;
  days: PricePoint[];
  top: PricePoint[];
  bottom: PricePoint[];
};

export type StockData = {
  source: string;
  updated: string;
  latest: number;
  delta: number;
  deltaPercent: number;
  years: YearData[];
};

export type StockResponse = StockData & {
  fetchedAt: string;
  stale: boolean;
};

export function buildNasdaqHistoricalUrl(date?: Date): string;

export function createStockService(options: {
  fetchImpl?: typeof fetch;
  fallback: StockData;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
}): {
  getStockData(): Promise<StockResponse>;
};
