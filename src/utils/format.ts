export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount == null || isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('en-US');
};
