import { ValidationError } from '../../src/errors/index.js';
import { FeeService, TransactionType } from '../../src/services/FeeService.js';
import { MONDAY_10H, MONDAY_22H, SATURDAY_11H } from '../factories/dates.js';

describe('FeeService', () => {
  const sut = new FeeService();

  describe('taxa de PIX', () => {
    test('é gratuito dentro da franquia mensal (9 transações já feitas)', () => {
      // Arrange
      const input = { type: TransactionType.PIX, amount: 50_000, monthlyPixCount: 9 };
      // Act
      const fee = sut.calculate(input);
      // Assert
      expect(fee).toBe(0);
    });

    test.each([
      ['mínimo de R$ 0,50', 1_000, 50],
      ['0,5% do valor', 40_000, 200],
      ['teto de R$ 5,00', 1_000_000, 500],
    ])('após a franquia aplica %s', (_, amount, expectedFee) => {
      const fee = sut.calculate({ type: TransactionType.PIX, amount, monthlyPixCount: 10 });

      expect(fee).toBe(expectedFee);
    });
  });

  describe('taxa de transferência em horário comercial', () => {
    test.each([
      ['faixa 1 (até R$ 1.000)', 100_000, 850],
      ['faixa 2 (R$ 1.000,01)', 100_001, 1_200],
      ['faixa 2 (até R$ 5.000)', 500_000, 1_200],
      ['acima das faixas: 0,3%', 1_000_000, 3_000],
      ['acima das faixas: teto de R$ 60,00', 5_000_000, 6_000],
    ])('%s', (_, amount, expectedFee) => {
      const fee = sut.calculate({ type: TransactionType.TRANSFER, amount, at: MONDAY_10H });

      expect(fee).toBe(expectedFee);
    });
  });

  describe('acréscimo de 20% fora do horário comercial', () => {
    test.each([
      ['à noite', MONDAY_22H],
      ['no fim de semana', SATURDAY_11H],
      ['um minuto antes da abertura (7h59)', new Date(2026, 0, 5, 7, 59)],
      ['no fechamento (18h00)', new Date(2026, 0, 5, 18, 0)],
    ])('transferência %s', (_, at) => {
      const fee = sut.calculate({ type: TransactionType.TRANSFER, amount: 100_000, at });

      expect(fee).toBe(1_020); // 850 * 1,2
    });

    test('não há acréscimo na abertura (8h00) nem no último minuto (17h59)', () => {
      const open = sut.calculate({
        type: TransactionType.TRANSFER,
        amount: 100_000,
        at: new Date(2026, 0, 5, 8, 0),
      });
      const close = sut.calculate({
        type: TransactionType.TRANSFER,
        amount: 100_000,
        at: new Date(2026, 0, 5, 17, 59),
      });

      expect([open, close]).toEqual([850, 850]);
    });
  });

  describe('entradas inválidas', () => {
    test('rejeita valor inválido', () => {
      expect(() => sut.calculate({ type: TransactionType.PIX, amount: -1 })).toThrow(ValidationError);
    });

    test('rejeita tipo sem taxa definida', () => {
      expect(() => sut.calculate({ type: TransactionType.DEPOSIT, amount: 100 })).toThrow(
        'Tipo de transação sem taxa definida: DEPOSIT',
      );
    });
  });
});
