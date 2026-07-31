module.exports = {
  testEnvironment: 'node',
  // Tests live under src/__tests__ but require ../../build (compiled output)
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
};
