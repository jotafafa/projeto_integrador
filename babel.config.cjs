// Usado apenas pelo babel-jest: converte os ES Modules (import/export) em algo
// que o runtime do Jest executa, permitindo rodar simplesmente `npx jest --coverage`.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
