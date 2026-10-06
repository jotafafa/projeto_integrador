import { ValidationError } from '../errors/index.js';

/** Valores monetários são sempre inteiros, em centavos. */
export function assertValidAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError('O valor deve ser um número inteiro positivo, em centavos.');
  }
}
