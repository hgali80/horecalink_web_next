export function resolveErpSalesStockCost(balance, bucket, useOfficialCost) {
  const officialCost = Number(balance?.rAvgCost) || 0;
  const preferredCost = bucket === "F" ? Number(balance?.fAvgCost) || 0 : officialCost;
  const usedFallback = bucket === "F" && preferredCost <= 0 && useOfficialCost && officialCost > 0;
  return {
    unitCost: Math.round((usedFallback ? officialCost : Math.max(0, preferredCost)) * 100) / 100,
    costBucket: usedFallback ? "R" : bucket,
    usedFallback: Boolean(usedFallback),
  };
}
