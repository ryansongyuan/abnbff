export function getPriceDirection(previous, next) {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous === next) return null;
  return next > previous ? "up" : "down";
}
