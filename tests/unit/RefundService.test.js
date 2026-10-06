import {
  InsufficientFundsError,
  RefundNotAllowedError,
  TransactionNotFoundError,
  WalletNotFoundError,
} from '../../src/errors/index.js';
import { RefundService } from '../../src/services/RefundService.js';
import { daysAgo, MONDAY_10H } from '../factories/dates.js';
import {
  createNotificationServiceMock,
  createTransactionRepositoryMock,
  createWalletRepositoryMock,
  stubWallets,
} from '../factories/mocks.js';
import { buildTransaction } from '../factories/transactionFactory.js';
import { buildWallet } from '../factories/walletFactory.js';

function makeSut({ transaction, sender, receiver } = {}) {
  const deps = {
    walletRepository: createWalletRepositoryMock(),
    transactionRepository: createTransactionRepositoryMock(),
    notificationService: createNotificationServiceMock(),
  };
  const senderWallet = sender === undefined ? buildWallet({ id: 'sender' }) : sender;
  const receiverWallet =
    receiver === undefined ? buildWallet({ id: 'receiver', balance: 50_000 }) : receiver;

  deps.transactionRepository.findById.mockResolvedValue(
    transaction ?? buildTransaction({ createdAt: daysAgo(1) }),
  );
  stubWallets(deps.walletRepository, ...[senderWallet, receiverWallet].filter(Boolean));

  return { sut: new RefundService({ ...deps, clock: () => MONDAY_10H }), ...deps, senderWallet };
}

describe('RefundService.refund', () => {
  describe('caminho feliz', () => {
    test('devolve o valor, marca a transação como estornada e notifica', async () => {
      // Arrange
      const { sut, walletRepository, transactionRepository, notificationService, senderWallet } =
        makeSut();

      // Act
      await sut.refund('tx-1');

      // Assert
      expect(walletRepository.debit).toHaveBeenCalledWith('receiver', 10_000);
      expect(walletRepository.credit).toHaveBeenCalledWith('sender', 10_000);
      expect(transactionRepository.update).toHaveBeenCalledWith('tx-1', {
        status: 'REFUNDED',
        refundedAt: MONDAY_10H,
      });
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: senderWallet.ownerEmail, subject: 'Estorno concluído' }),
      );
    });

    test('aceita estorno exatamente no 90º dia (limite do prazo)', async () => {
      const { sut } = makeSut({ transaction: buildTransaction({ createdAt: daysAgo(90) }) });

      await expect(sut.refund('tx-1')).resolves.toBeUndefined();
    });

    test('permite quando o saldo do recebedor é exatamente o valor (limite)', async () => {
      const { sut } = makeSut({ receiver: buildWallet({ id: 'receiver', balance: 10_000 }) });

      await expect(sut.refund('tx-1')).resolves.toBeUndefined();
    });
  });

  describe('regras que impedem o estorno', () => {
    test('rejeita transação inexistente', async () => {
      const { sut, transactionRepository } = makeSut();
      transactionRepository.findById.mockResolvedValue(null);

      await expect(sut.refund('tx-1')).rejects.toThrow(TransactionNotFoundError);
    });

    test('rejeita transação já estornada (evita estorno duplo)', async () => {
      const { sut, walletRepository } = makeSut({
        transaction: buildTransaction({ status: 'REFUNDED' }),
      });

      await expect(sut.refund('tx-1')).rejects.toThrow('já foi estornada');

      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test.each([['FAILED'], ['PENDING']])('rejeita transação com status %s', async (status) => {
      const { sut } = makeSut({ transaction: buildTransaction({ status }) });

      await expect(sut.refund('tx-1')).rejects.toThrow(RefundNotAllowedError);
    });

    test('rejeita estorno após 90 dias (91º dia)', async () => {
      const { sut, walletRepository } = makeSut({
        transaction: buildTransaction({ createdAt: daysAgo(91) }),
      });

      await expect(sut.refund('tx-1')).rejects.toThrow('prazo de 90 dias');

      expect(walletRepository.debit).not.toHaveBeenCalled();
    });

    test('rejeita quando o recebedor não tem saldo para devolver', async () => {
      const { sut, walletRepository, transactionRepository } = makeSut({
        receiver: buildWallet({ id: 'receiver', balance: 9_999 }),
      });

      const promise = sut.refund('tx-1');

      await expect(promise).rejects.toThrow(InsufficientFundsError);
      await expect(promise).rejects.toMatchObject({ details: { required: 10_000, available: 9_999 } });
      expect(walletRepository.debit).not.toHaveBeenCalled();
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    test('rejeita quando a carteira do remetente não existe mais', async () => {
      const { sut } = makeSut({ sender: null });

      await expect(sut.refund('tx-1')).rejects.toThrow(WalletNotFoundError);
    });

    test('rejeita quando a carteira do recebedor não existe mais', async () => {
      const { sut } = makeSut({ receiver: null });

      await expect(sut.refund('tx-1')).rejects.toThrow(WalletNotFoundError);
    });
  });
});
