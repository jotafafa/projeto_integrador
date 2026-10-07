describe('efeitos colaterais e consistência', () => {
  test('não credita nem salva quando o débito falha', async () => {
    const { sut, walletRepository, transactionRepository } = makeSut();

    walletRepository.debit.mockRejectedValue(new InsufficientFundsError());

    await expect(sut.send(request())).rejects.toThrow(InsufficientFundsError);

    expect(walletRepository.credit).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  test('não notifica quando a transação não é concluída', async () => {
    const { sut, walletRepository, notificationService } = makeSut();

    walletRepository.debit.mockRejectedValue(new Error('database unavailable'));

    await expect(sut.send(request())).rejects.toThrow('database unavailable');

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  test('não debita quando o destinatário não pode ser resolvido', async () => {
    const { sut, walletRepository, dictGateway } = makeSut();

    dictGateway.resolveKey.mockResolvedValue(null);

    await expect(sut.send(request())).rejects.toThrow(WalletNotFoundError);

    expect(walletRepository.debit).not.toHaveBeenCalled();
    expect(walletRepository.credit).not.toHaveBeenCalled();
  });

  test('calcula a taxa antes de debitar o remetente', async () => {
    const { sut, walletRepository, feeService } = makeSut({ fee: 50 });

    await sut.send(request());

    expect(feeService.calculate).toHaveBeenCalled();
    expect(walletRepository.debit).toHaveBeenCalledWith('sender', 10_050);

    const feeOrder = feeService.calculate.mock.invocationCallOrder[0];
    const debitOrder = walletRepository.debit.mock.invocationCallOrder[0];

    expect(feeOrder).toBeLessThan(debitOrder);
  });

  test('notifica somente depois de salvar a transação', async () => {
    const { sut, transactionRepository, notificationService } = makeSut();

    await sut.send(request());

    const saveOrder = transactionRepository.save.mock.invocationCallOrder[0];
    const notificationOrder =
      notificationService.sendEmail.mock.invocationCallOrder[0];

    expect(saveOrder).toBeLessThan(notificationOrder);
  });
});
