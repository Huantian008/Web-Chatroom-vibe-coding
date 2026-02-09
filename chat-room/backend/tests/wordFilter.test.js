const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { checkWordFilter, updateFilterCache } = require('../middleware/wordFilter');
const WordFilter = require('../models/WordFilter');
const User = require('../models/User');

let mongoServer;
let adminUserId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create an admin user for wordFilter tests
    const adminUser = new User({ username: 'admin', password: 'adminpass123', role: 'admin' });
    await adminUser.save();
    adminUserId = adminUser._id;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }

    // Recreate admin user after each test
    const adminUser = new User({ username: 'admin', password: 'adminpass123', role: 'admin' });
    await adminUser.save();
    adminUserId = adminUser._id;
});

describe('Word Filter Middleware', () => {
    describe('checkWordFilter', () => {
        it('should return false for clean text', async () => {
            const result = await checkWordFilter('Hello, this is a clean message');
            expect(result).toBe(false);
        });

        it('should return false for empty text', async () => {
            const result = await checkWordFilter('');
            expect(result).toBe(false);
        });

        it('should handle special characters', async () => {
            const result = await checkWordFilter('Hello @user #hashtag $100');
            expect(result).toBe(false);
        });

        it('should detect blacklisted words', async () => {
            // Add a test word to the filter with admin user
            await WordFilter.create({
                word: 'badword',
                isActive: true,
                addedBy: adminUserId
            });
            await updateFilterCache();

            const result = await checkWordFilter('This contains badword');
            expect(result).toBe(true);
        });

        it('should be case insensitive', async () => {
            await WordFilter.create({
                word: 'badword',
                isActive: true,
                addedBy: adminUserId
            });
            await updateFilterCache();

            const result = await checkWordFilter('This contains BADWORD');
            expect(result).toBe(true);
        });
    });
});
