import {
  InsufficientFundsError,
  LimitExceededError,
  ValidationError,
  WalletBlockedError,
  WalletNotFoundError,
} from '../../src/errors/index.js';
import { TransferService } from '../../src/services/TransferService.js';
import { MONDAY_22H } from '../factories/dates.js';
import {
  createFeeServiceMock,
  createNotificationServiceMock,
  createTransactionRepositoryMock,
  createWalletRepositoryMock,
  stubWallets,
} from '../factories/mocks.js';
import { buildBlockedWallet, buildWallet } from '../factories/walletFactory.js';

function makeSut({ fee = 850, sender, receiver, now = new Date(2026, 0, 5, 10) } = {}) {
  const deps = {
    walletRepository: createWalletRepositoryMock(),
    transactionRepository: createTransactionRepositoryMock(),
    notificationService: createNotificationServiceMock(),
    feeService: createFeeServiceMock(fee),
  };
  const senderWallet = sender ?? buildWallet({ id: 'sender', balance: 500_000 });
  const receiverWallet = receiver ?? buildWallet({ id: 'receiver' });
  stubWallets(deps.walletRepository, senderWallet, receiverWallet);

  return { sut: new TransferService({ ...deps, clock: () => now }), ...deps, senderWallet };
}

const request = (overrides = {}) => ({
  fromWalletId: 'sender',
  toWalletId: 'receiver',
  amount: 100_000,
  ...overrides,
});

describe('TransferService.send', () => {
  test('transfere, cobra a taxa, registra e notifica', async () => {
    // Arrange
    const { sut, walletRepository, transactionRepository, notificationService, feeService, senderWallet } =
      makeSut();

    // Act
    const transaction = await sut.send(request());

    // Assert
    expect(feeService.calculate).toHaveBeenCalledWith({
      type: 'TRANSFER',
      amount: 100_000,
      at: new Date(2026, 0, 5, 10),
    });
    expect(walletRepository.debit).toHaveBeenCalledWith('sender', 100_850);
    expect(walletRepository.credit).toHaveBeenCalledWith('receiver', 100_000);
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
    expect(transaction).toMatchObject({ type: 'TRANSFER', fee: 850, amount: 100_000 });
    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: senderWallet.ownerEmail }),
    );
  });

  test('usa o horário do relógio para o cálculo da taxa', async () => {
    const { sut, feeService } = makeSut({ now: MONDAY_22H });

    await sut.send(request());

    expect(feeService.calculate).toHaveBeenCalledWith(expect.objectContaining({ at: MONDAY_22H }));
  });

  describe('validações', () => {
    test.each([[0], [-100], [99.9], ['abc']])('rejeita valor %p', async (amount) => {
      const { sut } = makeSut();

      await expect(sut.send(request({ amount }))).rejects.toThrow(ValidationError);
    });

    test('rejeita transferência para a mesma carteira', async () => {
      const { sut } = makeSut();

      await expect(sut.send(request({ toWalletId: 'sender' }))).rejects.toThrow('própria carteira');
    });

    test('rejeita carteira de origem inexistente', async () => {
      const { sut } = makeSut();

      await expect(sut.send(request({ fromWalletId: 'x' }))).rejects.toThrow(WalletNotFoundError);
    });

    test('rejeita origem bloqueada', async () => {
      const { sut } = makeSut({ sender: buildBlockedWallet({ id: 'sender' }) });

      await expect(sut.send(request())).rejects.toThrow(WalletBlockedError);
    });

    test('rejeita destino bloqueado', async () => {
      const { sut } = makeSut({ receiver: buildBlockedWallet({ id: 'receiver' }) });

      await expect(sut.send(request())).rejects.toThrow(WalletBlockedError);
    });
  });

  describe('limite diário', () => {
    test('rejeita quando o acumulado do dia + valor passa do limite', async () => {
      const { sut, transactionRepository, walletRepository } = makeSut({
        sender: buildWallet({ id: 'sender', balance: 900_000, transferDailyLimit: 300_000 }),
      });
      transactionRepository.sumOutgoingSince.mockResolvedValue(250_000);

      const promise = sut.send(request({ amount: 50_001 }));

      await expect(promise).rejects.toThrow(LimitExceededError);
      await expect(promise).rejects.toMatchObject({
        details: { alreadySent: 250_000, amount: 50_001, limit: 300_000 },
      });
      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('permite atingir exatamente o limite diário', async () => {
      const { sut, transactionRepository } = makeSut({
        sender: buildWallet({ id: 'sender', balance: 900_000, transferDailyLimit: 300_000 }),
      });
      transactionRepository.sumOutgoingSince.mockResolvedValue(250_000);

      await expect(sut.send(request({ amount: 50_000 }))).resolves.toBeDefined();
    });
  });

  describe('saldo', () => {
    test('rejeita quando o saldo não cobre valor + taxa', async () => {
      const { sut, walletRepository } = makeSut({
        sender: buildWallet({ id: 'sender', balance: 100_849 }),
      });

      await expect(sut.send(request())).rejects.toThrow(InsufficientFundsError);

      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('permite quando o saldo é exatamente valor + taxa', async () => {
      const { sut } = makeSut({ sender: buildWallet({ id: 'sender', balance: 100_850 }) });

      await expect(sut.send(request())).resolves.toBeDefined();
    });
  });
});
