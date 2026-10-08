export class DomainError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends DomainError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class WalletNotFoundError extends DomainError {
  constructor(walletId) {
    super(`Carteira não encontrada: ${walletId}`, 'WALLET_NOT_FOUND', {
      walletId,
    });
  }
}

export class WalletBlockedError extends DomainError {
  constructor(walletId) {
    super(`A carteira ${walletId} está bloqueada.`, 'WALLET_BLOCKED', {
      walletId,
    });
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(required, available) {
    super('Saldo insuficiente para concluir a operação.', 'INSUFFICIENT_FUNDS', {
      required,
      available,
    });
  }
}

export class LimitExceededError extends DomainError {
  constructor(message, details) {
    super(message, 'LIMIT_EXCEEDED', details);
  }
}

export class TransactionNotFoundError extends DomainError {
  constructor(transactionId) {
    super(`Transação não encontrada: ${transactionId}`, 'TRANSACTION_NOT_FOUND', {
      transactionId,
    });
  }
}

export class RefundNotAllowedError extends DomainError {
  constructor(message, details) {
    super(message, 'REFUND_NOT_ALLOWED', details);
  }
}

export class ExternalServiceError extends DomainError {
  constructor(message, details) {
    super(message, 'EXTERNAL_SERVICE_ERROR', details);
  }
}
