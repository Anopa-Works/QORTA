/**
 * Jest Configuration
 */

module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'middleware/**/*.js',
        'utils/**/*.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
    clearMocks: true,
    resetMocks: false,
    restoreMocks: true,
    forceExit: true,
    detectOpenHandles: false
};
