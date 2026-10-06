import { MONDAY_10H } from './dates.js';

export function buildTransaction(overrides = {}) {
  return {
    id: 'tx-1',
    type: 'PIX',
    status: 'COMPLETED',
    fromWalletId: 'sender',
    toWalletId: 'receiver',
    amount: 10_000,
    fee: 0,
    createdAt: MONDAY_10H,
    ...overrides,
  };
}
