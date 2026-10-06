import { ValidationError } from '../errors/index.js';
import { assertValidAmount } from '../utils/validators.js';

export const TransactionType = Object.freeze({
  PIX: 'PIX',
  TRANSFER: 'TRANSFER',
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
});

const FREE_PIX_PER_MONTH = 10;
const PIX_RATE = 0.005; // 0,5%
const PIX_MIN_FEE = 50; // R$ 0,50
const PIX_MAX_FEE = 500; // R$ 5,00

const TRANSFER_TIERS = [
  { upTo: 100_000, fee: 850 }, // até R$ 1.000
  { upTo: 500_000, fee: 1_200 }, // até R$ 5.000
];
const TRANSFER_RATE_ABOVE_TIERS = 0.003; // 0,3%
const TRANSFER_MAX_FEE = 6_000; // R$ 60,00
const OFF_HOURS_SURCHARGE = 0.2; // +20%

/**
 * Taxas dinâmicas (valores em centavos):
 *  - PIX: grátis nas 10 primeiras do mês; depois 0,5% (mín. R$ 0,50, máx. R$ 5,00).
 *  - Transferência: taxa por faixa de valor, +20% fora do horário comercial (dias úteis, 8h-18h).
 */
export class FeeService {
  calculate({ type, amount, monthlyPixCount = 0, at = new Date() }) {
    assertValidAmount(amount);

    if (type === TransactionType.PIX) return this.#pixFee(amount, monthlyPixCount);
    if (type === TransactionType.TRANSFER) return this.#transferFee(amount, at);
    throw new ValidationError(`Tipo de transação sem taxa definida: ${type}`);
  }

  #pixFee(amount, monthlyPixCount) {
    if (monthlyPixCount < FREE_PIX_PER_MONTH) return 0;
    return Math.min(Math.max(Math.round(amount * PIX_RATE), PIX_MIN_FEE), PIX_MAX_FEE);
  }

  #transferFee(amount, at) {
    const tier = TRANSFER_TIERS.find(({ upTo }) => amount <= upTo);
    const baseFee = tier
      ? tier.fee
      : Math.min(Math.round(amount * TRANSFER_RATE_ABOVE_TIERS), TRANSFER_MAX_FEE);

    return this.#isBusinessHours(at) ? baseFee : Math.round(baseFee * (1 + OFF_HOURS_SURCHARGE));
  }

  #isBusinessHours(date) {
    const isWeekday = date.getDay() !== 0 && date.getDay() !== 6;
    return isWeekday && date.getHours() >= 8 && date.getHours() < 18;
  }
}
