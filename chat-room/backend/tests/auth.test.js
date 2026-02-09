const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let app;
let server;
let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
        instance: { launchTimeout: 60000 }
    });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const module = require('../server');
    app = module.app;
    server = module.server;
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
        if (server && typeof server.close === 'function') {
            await new Promise((resolve) => server.close(resolve));
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

describe('Auth API', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: 'password123' });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe('注册成功');
            expect(res.body.token).toBeDefined();
            expect(res.body.user.username).toBe('testuser');
        });

        it('should not register user with existing username', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: 'password123' });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: 'password456' });

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('用户名已存在');
        });

        it('should validate username length', async () => {
            const res1 = await request(app)
                .post('/api/auth/register')
                .send({ username: 'a', password: 'password123' });

            expect(res1.status).toBe(400);
            expect(res1.body.error).toBe('用户名长度必须在2-20个字符之间');

            const res2 = await request(app)
                .post('/api/auth/register')
                .send({ username: 'a'.repeat(21), password: 'password123' });

            expect(res2.status).toBe(400);
        });

        it('should validate password length', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: '12345' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('密码长度至少为6个字符');
        });

        it('should require username and password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: 'password123' });
        });

        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('登录成功');
            expect(res.body.token).toBeDefined();
            expect(res.body.user.username).toBe('testuser');
        });

        it('should not login with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('用户名或密码错误');
        });

        it('should not login with non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nonexistent', password: 'password123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('用户名或密码错误');
        });
    });

    describe('GET /api/auth/verify', () => {
        it('should verify valid token', async () => {
            const registerRes = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: 'password123' });

            const res = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', `Bearer ${registerRes.body.token}`);

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('testuser');
        });

        it('should reject invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer invalid-token');

            expect(res.status).toBe(401);
        });

        it('should reject missing token', async () => {
            const res = await request(app)
                .get('/api/auth/verify');

            expect(res.status).toBe(401);
        });
    });
});
