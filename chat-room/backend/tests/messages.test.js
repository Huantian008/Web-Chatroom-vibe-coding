const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');

let app;
let server;
let mongoServer;
let authToken;
let userId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const module = require('../server');
    app = module.app;
    server = module.server;

    const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
    authToken = res.body.token;
    userId = res.body.user.id;
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

    const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
    authToken = res.body.token;
    userId = res.body.user.id;
});

describe('Messages', () => {
    let channel;
    let channelId;

    beforeEach(async () => {
        channel = new Channel({ name: 'Test Channel', description: 'A test channel' });
        await channel.save();
        channelId = channel._id;

        await ChannelMember.create({
            userId,
            channelId
        });
    });

    describe('POST /api/channels/:channelId/messages', () => {
        it('should send a message to a channel', async () => {
            const res = await request(app)
                .post(`/api/channels/${channelId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ message: 'Hello, world!' });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Hello, world!');
            expect(res.body.username).toBe('testuser');
        });

        it('should not send empty message', async () => {
            const res = await request(app)
                .post(`/api/channels/${channelId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ message: '' });

            expect(res.status).toBe(400);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post(`/api/channels/${channelId}/messages`)
                .send({ message: 'Hello, world!' });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/channels/:channelId/messages', () => {
        it('should get channel messages', async () => {
            await new Message({
                username: 'testuser',
                userId,
                message: 'Test message',
                channelId
            }).save();

            const res = await request(app)
                .get(`/api/channels/${channelId}/messages`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('should return empty array for channel with no messages', async () => {
            const newChannel = new Channel({ name: 'Empty Channel', description: 'Empty' });
            await newChannel.save();

            await ChannelMember.create({
                userId,
                channelId: newChannel._id
            });

            const res = await request(app)
                .get(`/api/channels/${newChannel._id}/messages`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
});
