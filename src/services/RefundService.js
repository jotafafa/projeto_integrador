import {
  InsufficientFundsError,
  RefundNotAllowedError,
  TransactionNotFoundError,
  WalletNotFoundError,
} from '../errors/index.js';
import { daysBetween } from '../utils/dates.js';

export const REFUND_WINDOW_DAYS = 90;

/**
 * Estorno de PIX/transferência:
 *  - só transações COMPLETED e uma única vez;
 *  - até 90 dias após a data da transação;
 *  - o recebedor precisa ter saldo para devolver o valor (a taxa cobrada não é devolvida).
 */
export class RefundService {
  constructor({
    walletRepository,
    transactionRepository,
    notificationService,
    clock = () => new Date(),
  }) {
    this.walletRepository = walletRepository;
    this.transactionRepository = transactionRepository;
    this.notificationService = notificationService;
    this.clock = clock;
  }

  async refund(transactionId) {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) throw new TransactionNotFoundError(transactionId);

    if (transaction.status === 'REFUNDED') {
      throw new RefundNotAllowedError('Esta transação já foi estornada.');
    }
    if (transaction.status !== 'COMPLETED') {
      throw new RefundNotAllowedError('Apenas transações concluídas podem ser estornadas.');
    }

    const now = this.clock();
    if (daysBetween(transaction.createdAt, now) > REFUND_WINDOW_DAYS) {
      throw new RefundNotAllowedError(`O prazo de ${REFUND_WINDOW_DAYS} dias para estorno expirou.`);
    }

    const sender = await this.walletRepository.findById(transaction.fromWalletId);
    const receiver = await this.walletRepository.findById(transaction.toWalletId);
    if (!sender) throw new WalletNotFoundError(transaction.fromWalletId);
    if (!receiver) throw new WalletNotFoundError(transaction.toWalletId);

    if (receiver.balance < transaction.amount) {
      throw new InsufficientFundsError(transaction.amount, receiver.balance);
    }

    await this.walletRepository.debit(receiver.id, transaction.amount);
    await this.walletRepository.credit(sender.id, transaction.amount);
    await this.transactionRepository.update(transaction.id, {
      status: 'REFUNDED',
      refundedAt: now,
    });

    await this.notificationService.sendEmail({
      to: sender.ownerEmail,
      subject: 'Estorno concluído',
      body: `${transaction.amount} centavos foram devolvidos à sua carteira.`,
    });
  }
}
