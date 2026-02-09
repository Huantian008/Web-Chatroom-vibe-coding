const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { checkMuteStatus } = require('../middleware/muteCheck');
const User = require('../models/User');
const GlobalMuteStatus = require('../models/GlobalMuteStatus');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
        instance: { launchTimeout: 60000 }
    });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    } finally {
        if (mongoServer) {
            await mongoServer.stop();
        }
    }
});

afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    }
});

describe('Mute Check Middleware', () => {
    describe('checkMuteStatus', () => {
        it('should return isMuted false for non-muted user', async () => {
            // Create a normal user
            const user = new User({ username: 'testuser', password: 'password123' });
            await user.save();

            const result = await checkMuteStatus(user._id.toString(), 'testuser');
            expect(result.isMuted).toBe(false);
        });

        it('should return mute status object', async () => {
            const user = new User({ username: 'testuser', password: 'password123' });
            await user.save();

            const result = await checkMuteStatus(user._id.toString(), 'testuser');
            expect(result).toHaveProperty('isMuted');
            expect(result).toHaveProperty('reason');
        });

        it('should detect muted user', async () => {
            const user = new User({
                username: 'testuser',
                password: 'password123',
                isMuted: true,
                mutedReason: 'Test mute'
            });
            await user.save();

            const result = await checkMuteStatus(user._id.toString(), 'testuser');
            expect(result.isMuted).toBe(true);
            expect(result.reason).toBe('Test mute');
        });

        it('should detect global mute', async () => {
            const user = new User({ username: 'testuser', password: 'password123' });
            await user.save();

            // Enable global mute
            const globalMute = new GlobalMuteStatus({
                isEnabled: true,
                reason: 'Global maintenance'
            });
            await globalMute.save();

            const result = await checkMuteStatus(user._id.toString(), 'testuser');
            expect(result.isMuted).toBe(true);
            expect(result.reason).toBe('Global maintenance');
        });
    });
});
