export type PriceDirection = "up" | "down";

export function getPriceDirection(
  previous: number | undefined,
  next: number,
): PriceDirection | null;
