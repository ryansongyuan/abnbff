import fallback from "../../abnb-data.json";
import { createStockService, type StockData } from "../../../lib/live-stock.mjs";

const service = createStockService({ fallback: fallback as StockData });

export async function GET() {
  const data = await service.getStockData();
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
