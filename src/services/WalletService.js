import { InsufficientFundsError, WalletNotFoundError } from '../errors/index.js';
import { assertValidAmount } from '../utils/validators.js';
import { requireActiveWallet } from '../utils/walletGuards.js';

export class WalletService {
  constructor({ walletRepository }) {
    this.walletRepository = walletRepository;
  }

  async getBalance(walletId) {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) throw new WalletNotFoundError(walletId);
    return wallet.balance;
  }

  async deposit(walletId, amount) {
    assertValidAmount(amount);
    const wallet = await requireActiveWallet(this.walletRepository, walletId);
    await this.walletRepository.credit(wallet.id, amount);
  }

  async withdraw(walletId, amount) {
    assertValidAmount(amount);
    const wallet = await requireActiveWallet(this.walletRepository, walletId);
    if (wallet.balance < amount) {
      throw new InsufficientFundsError(amount, wallet.balance);
    }
    await this.walletRepository.debit(wallet.id, amount);
  }
}
