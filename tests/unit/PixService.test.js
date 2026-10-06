import {
  ExternalServiceError,
  InsufficientFundsError,
  LimitExceededError,
  ValidationError,
  WalletBlockedError,
  WalletNotFoundError,
} from '../../src/errors/index.js';
import { PixService } from '../../src/services/PixService.js';
import { MONDAY_10H, MONDAY_22H } from '../factories/dates.js';
import {
  createDictGatewayMock,
  createFeeServiceMock,
  createNotificationServiceMock,
  createTransactionRepositoryMock,
  createWalletRepositoryMock,
  stubWallets,
} from '../factories/mocks.js';
import { buildBlockedWallet, buildWallet } from '../factories/walletFactory.js';

function makeSut({ now = MONDAY_10H, fee = 0, sender, receiver } = {}) {
  const deps = {
    walletRepository: createWalletRepositoryMock(),
    transactionRepository: createTransactionRepositoryMock(),
    dictGateway: createDictGatewayMock(),
    notificationService: createNotificationServiceMock(),
    feeService: createFeeServiceMock(fee),
  };
  const senderWallet = sender ?? buildWallet({ id: 'sender', balance: 100_000 });
  const receiverWallet = receiver ?? buildWallet({ id: 'receiver' });
  stubWallets(deps.walletRepository, senderWallet, receiverWallet);
  deps.dictGateway.resolveKey.mockResolvedValue({ walletId: receiverWallet.id });

  return { sut: new PixService({ ...deps, clock: () => now }), ...deps, senderWallet };
}

const request = (overrides = {}) => ({
  fromWalletId: 'sender',
  pixKey: 'maria@email.com',
  amount: 10_000,
  ...overrides,
});

describe('PixService.send', () => {
  describe('caminho feliz', () => {
    test('debita o remetente, credita o destinatário, registra e notifica', async () => {
      // Arrange
      const { sut, walletRepository, transactionRepository, notificationService, senderWallet } =
        makeSut();

      // Act
      const transaction = await sut.send(request());

      // Assert
      expect(walletRepository.debit).toHaveBeenCalledWith('sender', 10_000);
      expect(walletRepository.credit).toHaveBeenCalledWith('receiver', 10_000);
      expect(transactionRepository.save).toHaveBeenCalledTimes(1);
      expect(transaction).toMatchObject({ type: 'PIX', status: 'COMPLETED', amount: 10_000, fee: 0 });
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: senderWallet.ownerEmail, subject: 'PIX enviado' }),
      );
    });

    test('debita valor + taxa do remetente, mas credita só o valor ao destinatário', async () => {
      const { sut, walletRepository } = makeSut({ fee: 50 });

      const transaction = await sut.send(request());

      expect(walletRepository.debit).toHaveBeenCalledWith('sender', 10_050);
      expect(walletRepository.credit).toHaveBeenCalledWith('receiver', 10_000);
      expect(transaction.fee).toBe(50);
    });

    test('envia ao cálculo de taxa o total de PIX já feitos no mês', async () => {
      const { sut, transactionRepository, feeService } = makeSut();
      transactionRepository.countSince.mockResolvedValue(10);

      await sut.send(request());

      expect(transactionRepository.countSince).toHaveBeenCalledWith('sender', 'PIX', new Date(2026, 0, 1));
      expect(feeService.calculate).toHaveBeenCalledWith({
        type: 'PIX',
        amount: 10_000,
        monthlyPixCount: 10,
        at: MONDAY_10H,
      });
    });
  });

  describe('validações', () => {
    test.each([[0], [-1], [10.5], ['100']])('rejeita valor %p', async (amount) => {
      const { sut, walletRepository } = makeSut();

      await expect(sut.send(request({ amount }))).rejects.toThrow(ValidationError);

      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('rejeita remetente inexistente', async () => {
      const { sut } = makeSut();

      await expect(sut.send(request({ fromWalletId: 'fantasma' }))).rejects.toThrow(WalletNotFoundError);
    });

    test('rejeita remetente bloqueado', async () => {
      const { sut, walletRepository } = makeSut({ sender: buildBlockedWallet({ id: 'sender' }) });

      await expect(sut.send(request())).rejects.toThrow(WalletBlockedError);

      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('rejeita destinatário bloqueado', async () => {
      const { sut } = makeSut({ receiver: buildBlockedWallet({ id: 'receiver' }) });

      await expect(sut.send(request())).rejects.toThrow(WalletBlockedError);
    });

    test('rejeita chave PIX não cadastrada', async () => {
      const { sut, dictGateway } = makeSut();
      dictGateway.resolveKey.mockResolvedValue(null);

      await expect(sut.send(request())).rejects.toThrow(WalletNotFoundError);
    });

    test('rejeita PIX para a própria carteira', async () => {
      const { sut, dictGateway } = makeSut();
      dictGateway.resolveKey.mockResolvedValue({ walletId: 'sender' });

      await expect(sut.send(request())).rejects.toThrow('própria carteira');
    });

    test('traduz falha da API de chaves PIX em ExternalServiceError', async () => {
      const { sut, dictGateway } = makeSut();
      dictGateway.resolveKey.mockRejectedValue(new Error('503 Service Unavailable'));

      const promise = sut.send(request());

      await expect(promise).rejects.toThrow(ExternalServiceError);
      await expect(promise).rejects.toMatchObject({ details: { reason: '503 Service Unavailable' } });
    });
  });

  describe('limites operacionais', () => {
    test('bloqueia PIX acima de R$ 1.000 à noite', async () => {
      const { sut, walletRepository } = makeSut({ now: MONDAY_22H });

      await expect(sut.send(request({ amount: 100_001 }))).rejects.toThrow(
        'Limite noturno por PIX excedido.',
      );

      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('permite exatamente R$ 1.000 à noite (limite)', async () => {
      const { sut } = makeSut({
        now: MONDAY_22H,
        sender: buildWallet({ id: 'sender', balance: 200_000 }),
      });

      await expect(sut.send(request({ amount: 100_000 }))).resolves.toBeDefined();
    });

    test('o limite noturno não vale durante o dia', async () => {
      const { sut } = makeSut({ sender: buildWallet({ id: 'sender', balance: 500_000 }) });

      await expect(sut.send(request({ amount: 300_000 }))).resolves.toBeDefined();
    });

    test('bloqueia quando o acumulado do dia + valor passa do limite diário', async () => {
      const { sut, transactionRepository } = makeSut({
        sender: buildWallet({ id: 'sender', pixDailyLimit: 500_000, balance: 900_000 }),
      });
      transactionRepository.sumOutgoingSince.mockResolvedValue(450_000);

      const promise = sut.send(request({ amount: 50_001 }));

      await expect(promise).rejects.toThrow(LimitExceededError);
      await expect(promise).rejects.toMatchObject({
        details: { alreadySent: 450_000, amount: 50_001, limit: 500_000 },
      });
      expect(transactionRepository.sumOutgoingSince).toHaveBeenCalledWith(
        'sender',
        ['PIX'],
        new Date(2026, 0, 5),
      );
    });

    test('permite atingir exatamente o limite diário', async () => {
      const { sut, transactionRepository } = makeSut({
        sender: buildWallet({ id: 'sender', pixDailyLimit: 500_000, balance: 900_000 }),
      });
      transactionRepository.sumOutgoingSince.mockResolvedValue(450_000);

      await expect(sut.send(request({ amount: 50_000 }))).resolves.toBeDefined();
    });
  });

  describe('saldo', () => {
    test('rejeita quando o saldo cobre o valor, mas não valor + taxa', async () => {
      const { sut, walletRepository } = makeSut({
        fee: 50,
        sender: buildWallet({ id: 'sender', balance: 10_049 }),
      });

      const promise = sut.send(request());

      await expect(promise).rejects.toThrow(InsufficientFundsError);
      await expect(promise).rejects.toMatchObject({ details: { required: 10_050, available: 10_049 } });
      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('permite quando o saldo é exatamente valor + taxa', async () => {
      const { sut } = makeSut({ fee: 50, sender: buildWallet({ id: 'sender', balance: 10_050 }) });

      await expect(sut.send(request())).resolves.toBeDefined();
    });
  });
});
