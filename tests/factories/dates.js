// Datas fixas (horário local). 05/01/2026 é uma segunda-feira.
export const MONDAY_10H = new Date(2026, 0, 5, 10, 0, 0);
export const MONDAY_22H = new Date(2026, 0, 5, 22, 30, 0);
export const SATURDAY_11H = new Date(2026, 0, 10, 11, 0, 0);

export const daysAgo = (days) => new Date(MONDAY_10H.getTime() - days * 86_400_000);
