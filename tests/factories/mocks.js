import { jest } from '@jest/globals';

/** Dublês das dependências externas. Os retornos padrão são o "caminho feliz". */
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
});

export const createNotificationServiceMock = () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
});

export const createDictGatewayMock = () => ({
  resolveKey: jest.fn().mockResolvedValue(null),
});

export const createFeeServiceMock = (fee = 0) => ({
  calculate: jest.fn().mockReturnValue(fee),
});

/** Faz o findById do repositório devolver as carteiras informadas (ou null). */
export function stubWallets(walletRepository, ...wallets) {
  const byId = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  walletRepository.findById.mockImplementation(async (id) => byId.get(id) ?? null);
}
