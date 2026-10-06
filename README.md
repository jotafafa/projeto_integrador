# Grupo 1 – Módulo Financeiro & Carteira

Service Classes de uma carteira digital em **Node.js (ES Modules)**, testadas com **Jest**. O foco é a qualidade das regras de negócio: validação de saldo, limites de PIX/transferência, estorno e taxas dinâmicas.

**Integrantes:** _preencher com nome e RA de cada membro_

## 1. Visão Geral do Sistema

Não há banco nem API: repositórios, e-mail e consulta de chaves PIX são **injetados** nos services, e nos testes viram *mocks*. Valores são **inteiros em centavos**.

| Service | Responsabilidade |
|---|---|
| `WalletService` | Consulta de saldo, depósito e saque. |
| `FeeService` | Taxas dinâmicas (função pura). |
| `PixService` | Envio de PIX com limites e taxa. |
| `TransferService` | Transferência entre carteiras com limite e taxa. |
| `RefundService` | Estorno de PIX/transferência. |

**Regras testadas**

- **Saldo:** o saldo deve cobrir *valor + taxa* (saldo exatamente igual é permitido); valor zero, negativo ou decimal é rejeitado; carteira inexistente ou bloqueada não opera.
- **Limites de PIX:** limite diário por carteira (somando o já enviado no dia) e, das 20h às 5h59, máximo de R$ 1.000,00 por PIX.
- **Limites de transferência:** limite diário acumulado por carteira.
- **Taxa de PIX:** 10 primeiros do mês grátis; depois 0,5% (mín. R$ 0,50, máx. R$ 5,00).
- **Taxa de transferência:** R$ 8,50 até R$ 1.000; R$ 12,00 até R$ 5.000; acima, 0,3% (máx. R$ 60,00). **+20%** fora do horário comercial (dias úteis, 8h–18h).
- **Estorno:** só transação `COMPLETED`, uma única vez, em até 90 dias; o recebedor precisa ter saldo; a taxa não é devolvida.

```
src/
  errors/      erros de domínio (code + details)
  services/    Service Classes
  utils/       validators, dates, walletGuards
tests/
  factories/   factories de dados (wallet, transaction), datas fixas e mocks
  unit/        um arquivo de testes por service
```

## 2. Conceitos de Testes Aplicados

**Pirâmide de Testes.** Organiza a suíte em camadas: muitos testes unitários na base (rápidos, baratos e isolados), alguns de integração no meio e poucos end-to-end no topo (lentos e frágeis). Este projeto concentra-se na base: cada service é testado isoladamente, com todas as dependências substituídas por mocks. Integração e E2E ficam fora do escopo, pois não há banco, API nem interface.

**Mocks vs. Stubs.** São dublês de teste com propósitos diferentes. O *stub* devolve respostas pré-programadas para conduzir o código pelo caminho desejado (`walletRepository.findById.mockResolvedValue(wallet)`). O *mock* é verificado: confere-se se foi chamado, quantas vezes e com quais argumentos (`expect(walletRepository.debit).toHaveBeenCalledWith('sender', 10_050)` ou `not.toHaveBeenCalled()` para provar que nada foi debitado). No Jest ambos usam `jest.fn()`; o que muda é o uso.

**Padrão Factory.** Centraliza a criação de dados de teste em funções que devolvem objetos válidos por padrão e aceitam `overrides`. Aqui temos `buildWallet()`, `buildBlockedWallet()`, `buildTransaction()` e fábricas de mocks. Um teste de saldo insuficiente escreve só `buildWallet({ balance: 10_049 })`, deixando claro o dado relevante e evitando repetição: se o modelo mudar, só a factory muda.

**Princípios F.I.R.S.T.**
- **Fast:** sem rede, disco ou banco; a suíte roda em poucos segundos.
- **Isolated:** cada teste monta seu próprio `makeSut()` e o Jest limpa os mocks entre testes (`clearMocks: true`).
- **Repeatable:** o relógio é injetado (`clock`) e as datas são fixas, sem depender da hora real.
- **Self-validating:** todo teste termina em `expect`, ficando verde ou vermelho.
- **Timely:** os testes cobrem cada regra junto com sua implementação, e o `coverageThreshold` de 80% no `jest.config.js` falha o comando se a cobertura cair.

Todos os testes seguem **AAA** (Arrange, Act, Assert), os erros assíncronos são verificados com `await expect(...).rejects.toThrow(...)`, e as regras com fronteira são testadas dos dois lados (ex.: saldo 10.049 falha, 10.050 passa).

## 3. Como Executar

Requer Node.js 18+.

```bash
npm install
npx jest              # roda os testes
npx jest --coverage   # roda com cobertura (mínimo exigido: 80%)
```

> O código usa ES Modules nativos (`"type": "module"`). O `babel-jest` (`babel.config.cjs`) só transforma o `import`/`export` na hora do teste, para que `npx jest` funcione sem flags.

## 4. Relatório de Resultados

```
---------------------|---------|----------|---------|---------|
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|
All files            |   98.02 |    95.52 |      90 |   97.82 |
 errors              |     100 |      100 |     100 |     100 |
 services            |   97.61 |    94.82 |   81.25 |   97.41 |
  FeeService.js      |     100 |      100 |     100 |     100 |
  PixService.js      |   97.36 |    93.33 |      75 |   97.22 |
  RefundService.js   |   96.42 |    93.33 |   66.66 |      96 |
  TransferService.js |   95.65 |    85.71 |   66.66 |   95.65 |
  WalletService.js   |     100 |      100 |     100 |     100 |
 utils               |     100 |      100 |     100 |     100 |
---------------------|---------|----------|---------|---------|
Test Suites: 5 passed | Tests: 71 passed
```

Todas as métricas passam da meta de 80%. As linhas não cobertas são apenas o valor padrão do relógio (`clock = () => new Date()`), que os testes sempre substituem por uma data fixa.

📸 _Anexar aqui um print do terminal com a cobertura, gerado na máquina do grupo._

### Análise crítica dos cenários mais complexos

1. **Limites de PIX combinados com taxa e saldo.** Três regras interagem: limite noturno por operação, limite diário acumulado e saldo que precisa cobrir valor *mais* taxa. Testamos os dois lados de cada fronteira (acumulado de 450.000 + 50.000 passa; + 50.001 falha; saldo 10.049 falha, 10.050 passa). Em todo caso de rejeição, o mock confirma que `debit` **não** foi chamado, ou seja, validar nunca deixa rastro financeiro.
2. **Taxas que dependem do horário.** A taxa varia com valor, franquia mensal e horário. Para ser repetível, o relógio é injetado e usamos datas fixas (segunda 10h, segunda 22h30, sábado 11h), com os limites do horário comercial testados em 7h59, 8h00, 17h59 e 18h00, e as faixas de valor em R$ 1.000,00 e R$ 1.000,01.
3. **Elegibilidade do estorno.** São várias condições (transação existente, status, prazo, carteiras existentes e saldo do recebedor). O prazo é testado no 90º dia (aceito) e no 91º (rejeitado), e quando o saldo do recebedor é insuficiente verificamos que nada foi debitado nem marcado como estornado.
4. **Falha de dependência externa.** Se a API de chaves PIX cair, o erro técnico é convertido em `ExternalServiceError`, sem vazar detalhes internos ao chamador.

### Limitação conhecida
`debit` e `credit` são chamadas separadas. Em produção seriam uma única transação atômica no banco; isso está fora do escopo da camada de serviços testada aqui.
