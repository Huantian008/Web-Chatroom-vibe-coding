const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');

let app;
let server;
let mongoServer;
let authToken;
let adminToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const module = require('../server');
    app = module.app;
    server = module.server;

    // Create regular test user
    const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
    authToken = res.body.token;

    // Create admin user for admin-only tests
    const adminUser = new User({ username: 'admin', password: 'adminpass123', role: 'admin' });
    await adminUser.save();

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    adminToken = jwt.sign(
        { userId: adminUser._id, username: adminUser.username },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    server.close();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }

    // Recreate regular test user
    const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
    authToken = res.body.token;

    // Recreate admin user
    const adminUser = new User({ username: 'admin', password: 'adminpass123', role: 'admin' });
    await adminUser.save();

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    adminToken = jwt.sign(
        { userId: adminUser._id, username: adminUser.username },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
});

describe('Channels API', () => {
    describe('GET /api/channels', () => {
        it('should get user channels', async () => {
            const res = await request(app)
                .get('/api/channels')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .get('/api/channels');

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/channels', () => {
        it('should create a new channel', async () => {
            const res = await request(app)
                .post('/api/channels')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Test Channel', description: 'A test channel' });

            expect(res.status).toBe(201);
            expect(res.body.channel.name).toBe('Test Channel');
        });

        it('should validate channel name', async () => {
            const res = await request(app)
                .post('/api/channels')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: '', description: 'A test channel' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/channels/:channelId/join', () => {
        it('should join a channel', async () => {
            const channel = new Channel({ name: 'Test Channel', description: 'A test channel' });
            await channel.save();

            const res = await request(app)
                .post(`/api/channels/${channel._id}/join`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('加入频道');
        });
    });

    describe('POST /api/channels/:channelId/leave', () => {
        it('should leave a channel', async () => {
            const channel = new Channel({ name: 'Test Channel', description: 'A test channel' });
            await channel.save();

            await request(app)
                .post(`/api/channels/${channel._id}/join`)
                .set('Authorization', `Bearer ${authToken}`);

            const res = await request(app)
                .post(`/api/channels/${channel._id}/leave`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
        });
    });
});
