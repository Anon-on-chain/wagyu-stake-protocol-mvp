// Apply buffer percentage to an amount
export const applyBuffer = (amount: number, bufferPercent: number): number => {
  if (bufferPercent <= 0) return amount;
  return amount * (1 + bufferPercent / 100);
};