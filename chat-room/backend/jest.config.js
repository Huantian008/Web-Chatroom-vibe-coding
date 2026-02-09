module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    // mongodb-memory-server can be slow to start/download on first run (especially on Windows/WSL),
    // and tests share a global mongoose connection. Run serially and increase timeouts for stability.
    maxWorkers: 1,
    testTimeout: 60000,
    setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
    collectCoverageFrom: [
        'models/**/*.js',
        'routes/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**'
    ],
    verbose: true
};
