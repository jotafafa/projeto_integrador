/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',

  clearMocks: true,

  roots: ['<rootDir>/tests'],

  testMatch: ['**/*.test.js'],

  transform: {},

  collectCoverageFrom: ['src/**/*.js'],

  coverageReporters: ['text'],

  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
