import { jest } from '@jest/globals';

export const createWalletRepositoryMock = () => ({
  findById: jest.fn().mockResolvedValue(null),
  debit: jest.fn().mockResolvedValue(undefined),
  credit: jest.fn().mockResolvedValue(undefined),
});

export const createTransactionRepositoryMock = () => ({
  save: jest.fn(async (transaction) => transaction),
  findById: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue(undefined),
  sumOutgoingSince: jest.fn().mockResolvedValue(0),
  countSince: jest.fn().mockResolvedValue(0),
  countPixSince: jest.fn().mockResolvedValue(0),
  sumTransfersSince: jest.fn().mockResolvedValue(0),
});

export const createNotificationServiceMock = () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
  notify: jest.fn().mockResolvedValue(undefined),
});

export const createDictGatewayMock = () => ({
  resolveKey: jest.fn().mockResolvedValue(null),
});

export const createPixGatewayMock = () => ({
  resolveKey: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
});

export const createFeeServiceMock = (fee = 0) => ({
  calculate: jest.fn().mockReturnValue(fee),
});

export const createExternalServiceMock = () => ({
  call: jest.fn().mockResolvedValue(undefined),
});

export function stubWallets(walletRepository, ...wallets) {
  const byId = new Map(
    wallets.map((wallet) => [wallet.id, wallet])
  );

  walletRepository.findById.mockImplementation(
    async (id) => byId.get(id) ?? null
  );
}
