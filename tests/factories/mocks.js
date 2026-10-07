```js
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

  // Valor total enviado pela carteira em determinado período.
  sumOutgoingSince: jest.fn().mockResolvedValue(0),

  // Quantidade de transações realizadas em determinado período.
  countSince: jest.fn().mockResolvedValue(0),

  // Permite consultar a quantidade de PIX realizados no mês.
  countPixSince: jest.fn().mockResolvedValue(0),

  // Permite consultar o total de transferências realizadas no período.
  sumTransfersSince: jest.fn().mockResolvedValue(0),
});

export const createNotificationServiceMock = () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
});

export const createDictGatewayMock = () => ({
  // Consulta uma chave PIX.
  resolveKey: jest.fn().mockResolvedValue(null),
});

export const createFeeServiceMock = (fee = 0) => ({
  // Retorna a taxa definida pelo teste.
  calculate: jest.fn().mockReturnValue(fee),
});

/**
 * Faz o findById do repositório devolver
 * as carteiras informadas.
 */
export function stubWallets(walletRepository, ...wallets) {
  const byId = new Map(
    wallets.map((wallet) => [wallet.id, wallet])
  );

  walletRepository.findById.mockImplementation(
    async (id) => byId.get(id) ?? null
  );
}
```
