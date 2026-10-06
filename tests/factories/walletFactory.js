let sequence = 0;

/** Factory: carteira válida por padrão; cada teste sobrescreve só o que importa. */
export function buildWallet(overrides = {}) {
  sequence += 1;
  return {
    id: `wallet-${sequence}`,
    ownerEmail: `user${sequence}@example.com`,
    balance: 100_000, // R$ 1.000,00
    status: 'ACTIVE',
    pixDailyLimit: 500_000,
    transferDailyLimit: 2_000_000,
    ...overrides,
  };
}

export const buildBlockedWallet = (overrides = {}) =>
  buildWallet({ status: 'BLOCKED', ...overrides });
