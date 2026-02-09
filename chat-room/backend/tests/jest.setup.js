// Ensure backend code can detect "test" mode (server.js skips some startup work),
// and give mongodb-memory-server enough time to download/start.
process.env.NODE_ENV = 'test';

jest.setTimeout(60000);

