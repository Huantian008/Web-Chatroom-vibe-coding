const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/database');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Store active users (socket.id -> user data)
const activeUsers = new Map();

// ============ REST API Routes ============

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度必须在2-20个字符之间' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少为6个字符' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ error: '用户名已存在' });
        }

        // Create new user
        const user = new User({ username, password });
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: '注册成功',
            token,
            user: {
                id: user._id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: '用户名���密码错误' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user._id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// Verify token
app.get('/api/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({
            user: {
                id: user._id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(401).json({ error: '无效的认证令牌' });
    }
});

// Get chat history
app.get('/api/messages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const messages = await Message.find()
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json(messages.reverse());
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// ============ Socket.io Connection Handling ============

io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('认证失败：未提供令牌'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        next();
    } catch (error) {
        return next(new Error('认证失败：无效的令牌'));
    }
});

io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.username} (${socket.id})`);

    // Add user to active users
    activeUsers.set(socket.id, {
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id
    });

    try {
        // Send message history to new user
        const messages = await Message.find()
            .sort({ timestamp: -1 })
            .limit(100);

        socket.emit('message-history', messages.reverse());

        // Broadcast user joined to all clients
        io.emit('user-joined', {
            username: socket.username,
            userId: socket.id,
            users: Array.from(activeUsers.values()).map(u => u.username)
        });

        // Send updated user list
        io.emit('user-list', Array.from(activeUsers.values()).map(u => u.username));

        console.log(`📨 ${socket.username} joined the chat`);
    } catch (error) {
        console.error('Connection error:', error);
        socket.emit('error', { message: '加载历史消息失败' });
    }

    // Handle new message
    socket.on('send-message', async (data) => {
        try {
            const messageData = {
                username: socket.username,
                message: data.message,
                timestamp: new Date()
            };

            // Save message to database
            const newMessage = new Message(messageData);
            await newMessage.save();

            // Broadcast message to all clients
            io.emit('new-message', {
                id: newMessage._id,
                username: newMessage.username,
                message: newMessage.message,
                timestamp: newMessage.timestamp.toISOString()
            });

            console.log(`💬 ${socket.username}: ${data.message}`);
        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: '发送消息失败' });
        }
    });

    // Handle typing indicator
    socket.on('typing', () => {
        socket.broadcast.emit('user-typing', socket.username);
    });

    socket.on('stop-typing', () => {
        socket.broadcast.emit('user-stop-typing');
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            activeUsers.delete(socket.id);

            // Broadcast user left to all clients
            io.emit('user-left', {
                username: user.username,
                users: Array.from(activeUsers.values()).map(u => u.username)
            });

            // Send updated user list
            io.emit('user-list', Array.from(activeUsers.values()).map(u => u.username));

            console.log(`👋 ${user.username} left the chat`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Chat server running on port ${PORT}`);
    console.log(`📡 WebSocket server is ready for connections`);
});
