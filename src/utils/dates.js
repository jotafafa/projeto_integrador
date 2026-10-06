export const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const daysBetween = (from, to) => (to.getTime() - from.getTime()) / 86_400_000;
