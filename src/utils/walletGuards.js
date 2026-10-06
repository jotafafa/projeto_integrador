import { WalletBlockedError, WalletNotFoundError } from '../errors/index.js';

/** Busca a carteira e garante que ela existe e não está bloqueada. */
export async function requireActiveWallet(walletRepository, walletId) {
  const wallet = await walletRepository.findById(walletId);
  if (!wallet) throw new WalletNotFoundError(walletId);
  if (wallet.status === 'BLOCKED') throw new WalletBlockedError(walletId);
  return wallet;
}
