module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'models/**/*.js',
        'routes/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**'
    ],
    verbose: true
};
