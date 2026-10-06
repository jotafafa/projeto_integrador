import { InsufficientFundsError, LimitExceededError, ValidationError } from '../errors/index.js';
import { startOfDay } from '../utils/dates.js';
import { assertValidAmount } from '../utils/validators.js';
import { requireActiveWallet } from '../utils/walletGuards.js';
import { TransactionType } from './FeeService.js';

export class TransferService {
  constructor({
    walletRepository,
    transactionRepository,
    notificationService,
    feeService,
    clock = () => new Date(),
  }) {
    this.walletRepository = walletRepository;
    this.transactionRepository = transactionRepository;
    this.notificationService = notificationService;
    this.feeService = feeService;
    this.clock = clock;
  }

  async send({ fromWalletId, toWalletId, amount }) {
    assertValidAmount(amount);
    const now = this.clock();

    if (fromWalletId === toWalletId) {
      throw new ValidationError('Não é possível transferir para a própria carteira.');
    }

    const sender = await requireActiveWallet(this.walletRepository, fromWalletId);
    const receiver = await requireActiveWallet(this.walletRepository, toWalletId);

    const alreadySent = await this.transactionRepository.sumOutgoingSince(
      sender.id,
      [TransactionType.TRANSFER],
      startOfDay(now),
    );
    if (alreadySent + amount > sender.transferDailyLimit) {
      throw new LimitExceededError('Limite diário de transferências excedido.', {
        alreadySent,
        amount,
        limit: sender.transferDailyLimit,
      });
    }

    const fee = this.feeService.calculate({ type: TransactionType.TRANSFER, amount, at: now });
    if (sender.balance < amount + fee) {
      throw new InsufficientFundsError(amount + fee, sender.balance);
    }

    await this.walletRepository.debit(sender.id, amount + fee);
    await this.walletRepository.credit(receiver.id, amount);

    const transaction = await this.transactionRepository.save({
      type: TransactionType.TRANSFER,
      status: 'COMPLETED',
      fromWalletId: sender.id,
      toWalletId: receiver.id,
      amount,
      fee,
      createdAt: now,
    });

    await this.notificationService.sendEmail({
      to: sender.ownerEmail,
      subject: 'Transferência realizada',
      body: `Transferência de ${amount} centavos realizada. Taxa: ${fee} centavos.`,
    });

    return transaction;
  }
}
