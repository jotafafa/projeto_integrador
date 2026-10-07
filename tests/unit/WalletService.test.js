import {
  InsufficientFundsError,
  ValidationError,
  WalletBlockedError,
  WalletNotFoundError,
} from '../../src/errors/index.js';
import { WalletService } from '../../src/services/WalletService.js';
import { createWalletRepositoryMock, stubWallets } from '../factories/mocks.js';
import { buildBlockedWallet, buildWallet } from '../factories/walletFactory.js';

function makeSut(...wallets) {
  const walletRepository = createWalletRepositoryMock();
  stubWallets(walletRepository, ...wallets);
  return { sut: new WalletService({ walletRepository }), walletRepository };
}

describe('WalletService', () => {
  describe('getBalance', () => {
    test('retorna o saldo da carteira', async () => {
      const { sut } = makeSut(buildWallet({ id: 'w1', balance: 7_500 }));

      const balance = await sut.getBalance('w1');

      expect(balance).toBe(7_500);
    });

    test('rejeita carteira inexistente', async () => {
      const { sut } = makeSut();
      await expect(sut.getBalance('nope')).rejects.toThrow(WalletNotFoundError);
    });
  });

  describe('deposit', () => {
    test('credita o valor na carteira', async () => {
      const { sut, walletRepository } = makeSut(buildWallet({ id: 'w1' }));

      await sut.deposit('w1', 5_000);
      expect(walletRepository.credit).toHaveBeenCalledWith('w1', 5_000);
    });

    test.each([[0], [-1], [10.5]])('rejeita valor inválido (%p) sem consultar o banco', async (amount) => {
      const { sut, walletRepository } = makeSut();

      await expect(sut.deposit('w1', amount)).rejects.toThrow(ValidationError);
      expect(walletRepository.findById).not.toHaveBeenCalled();
    });

    test('rejeita carteira bloqueada', async () => {
      const { sut, walletRepository } = makeSut(buildBlockedWallet({ id: 'w1' }));

      await expect(sut.deposit('w1', 100)).rejects.toThrow(WalletBlockedError);
      expect(walletRepository.credit).not.toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    test('debita o valor da carteira', async () => {
      const { sut, walletRepository } = makeSut(buildWallet({ id: 'w1', balance: 10_000 }));

      await sut.withdraw('w1', 4_000);
      expect(walletRepository.debit).toHaveBeenCalledWith('w1', 4_000);
    });

    test('permite sacar exatamente o saldo (limite)', async () => {
      const { sut, walletRepository } = makeSut(buildWallet({ id: 'w1', balance: 4_000 }));

      await sut.withdraw('w1', 4_000);
      expect(walletRepository.debit).toHaveBeenCalledWith('w1', 4_000);
    });

    test('rejeita saque acima do saldo e não debita nada', async () => {
      const { sut, walletRepository } = makeSut(buildWallet({ id: 'w1', balance: 3_999 }));

      const promise = sut.withdraw('w1', 4_000);
      await expect(promise).rejects.toThrow(InsufficientFundsError);
      await expect(promise).rejects.toMatchObject({ details: { required: 4_000, available: 3_999 } });
      expect(walletRepository.debit).not.toHaveBeenCalled();
    });
  });
});
