import {
  ExternalServiceError,
  InsufficientFundsError,
  LimitExceededError,
  ValidationError,
  WalletNotFoundError,
} from '../errors/index.js';
import { startOfDay, startOfMonth } from '../utils/dates.js';
import { assertValidAmount } from '../utils/validators.js';
import { requireActiveWallet } from '../utils/walletGuards.js';
import { TransactionType } from './FeeService.js';

/** Repouso noturno (20h às 5h59): cada PIX fica limitado a R$ 1.000,00. */
const NIGHT_LIMIT_PER_PIX = 100_000;
const isNight = (date) => date.getHours() >= 20 || date.getHours() < 6;

export class PixService {
  constructor({
    walletRepository,
    transactionRepository,
    dictGateway,
    notificationService,
    feeService,
    clock = () => new Date(),
  }) {
    this.walletRepository = walletRepository;
    this.transactionRepository = transactionRepository;
    this.dictGateway = dictGateway;
    this.notificationService = notificationService;
    this.feeService = feeService;
    this.clock = clock;
  }

  async send({ fromWalletId, pixKey, amount }) {
    assertValidAmount(amount);
    const now = this.clock();

    const sender = await requireActiveWallet(this.walletRepository, fromWalletId);
    const receiverId = await this.#resolveReceiverId(pixKey);
    if (receiverId === sender.id) {
      throw new ValidationError('Não é possível enviar PIX para a própria carteira.');
    }
    const receiver = await requireActiveWallet(this.walletRepository, receiverId);

    await this.#assertWithinLimits(sender, amount, now);

    const monthlyPixCount = await this.transactionRepository.countSince(
      sender.id,
      TransactionType.PIX,
      startOfMonth(now),
    );
    const fee = this.feeService.calculate({
      type: TransactionType.PIX,
      amount,
      monthlyPixCount,
      at: now,
    });

    if (sender.balance < amount + fee) {
      throw new InsufficientFundsError(amount + fee, sender.balance);
    }

    await this.walletRepository.debit(sender.id, amount + fee);
    await this.walletRepository.credit(receiver.id, amount);

    const transaction = await this.transactionRepository.save({
      type: TransactionType.PIX,
      status: 'COMPLETED',
      fromWalletId: sender.id,
      toWalletId: receiver.id,
      amount,
      fee,
      createdAt: now,
    });

    await this.notificationService.sendEmail({
      to: sender.ownerEmail,
      subject: 'PIX enviado',
      body: `PIX de ${amount} centavos enviado. Taxa: ${fee} centavos.`,
    });

    return transaction;
  }

  async #resolveReceiverId(pixKey) {
    let resolved;
    try {
      resolved = await this.dictGateway.resolveKey(pixKey);
    } catch (error) {
      throw new ExternalServiceError('Não foi possível consultar o diretório de chaves PIX.', {
        reason: error.message,
      });
    }
    if (!resolved?.walletId) throw new WalletNotFoundError(`chave PIX ${pixKey}`);
    return resolved.walletId;
  }

  async #assertWithinLimits(sender, amount, now) {
    if (isNight(now) && amount > NIGHT_LIMIT_PER_PIX) {
      throw new LimitExceededError('Limite noturno por PIX excedido.', {
        amount,
        limit: NIGHT_LIMIT_PER_PIX,
      });
    }

    const alreadySent = await this.transactionRepository.sumOutgoingSince(
      sender.id,
      [TransactionType.PIX],
      startOfDay(now),
    );
    if (alreadySent + amount > sender.pixDailyLimit) {
      throw new LimitExceededError('Limite diário de PIX excedido.', {
        alreadySent,
        amount,
        limit: sender.pixDailyLimit,
      });
    }
  }
}
