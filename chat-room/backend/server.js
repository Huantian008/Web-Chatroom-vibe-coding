require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Database
const connectDB = require('./config/database');

// Models
const User = require('./models/User');
const Message = require('./models/Message');
const Channel = require('./models/Channel');
const ChannelMember = require('./models/ChannelMember');

// Middleware
const { checkWordFilter, updateFilterCache } = require('./middleware/wordFilter');
const { checkMuteStatus } = require('./middleware/muteCheck');

// Utils
const adminHelper = require('./utils/adminHelper');

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

// Initialize word filter cache
updateFilterCache();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

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

        // Auto-join user to default channel
        const defaultChannel = await Channel.findOne({ isDefault: true });
        if (defaultChannel) {
            await ChannelMember.create({
                userId: user._id,
                channelId: defaultChannel._id
            });
        }

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
            return res.status(401).json({ error: '用户名或密码错误' });
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

// Register channel routes
app.use('/api/channels', require('./routes/channels'));

// Register admin routes
app.use('/api/admin', require('./routes/admin'));

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
        // Check if user is admin
        const isAdmin = adminHelper.isAdmin(socket.username);
        socket.isAdmin = isAdmin;

        // Load user's channels
        const memberships = await ChannelMember.find({ userId: socket.userId })
            .populate('channelId');

        const memberChannelIds = memberships
            .filter(m => m.channelId)
            .map(m => m.channelId._id.toString());

        const channels = memberships
            .filter(m => m.channelId) // Filter out null channels
            .map(m => ({
                id: m.channelId._id.toString(),
                name: m.channelId.name,
                description: m.channelId.description,
                isDefault: m.channelId.isDefault,
                icon: m.channelId.icon
            }));

        // Channels the user is NOT in yet (for join list)
        const availableChannels = await Channel.find({
            _id: { $nin: memberChannelIds }
        })
            .sort({ isDefault: -1, name: 1 })
            .lean();

        // Auto-join all user's channels as Socket.io rooms
        channels.forEach(channel => {
            socket.join(`channel:${channel.id}`);
        });

        // Send initial data to client
        socket.emit('initial-data', {
            channels,
            availableChannels: availableChannels.map(ch => ({
                id: ch._id.toString(),
                name: ch.name,
                description: ch.description,
                isDefault: ch.isDefault,
                icon: ch.icon
            })),
            isAdmin,
            username: socket.username,
            userId: socket.userId
        });

        // Notify all users in all channels
        channels.forEach(channel => {
            socket.to(`channel:${channel.id}`).emit('user-joined-channel', {
                username: socket.username,
                channelId: channel.id
            });
        });

        // Send updated online user list
        io.emit('user-list', Array.from(activeUsers.values()).map(u => u.username));

        console.log(`📨 ${socket.username} joined ${channels.length} channel(s)`);
    } catch (error) {
        console.error('Connection error:', error);
        socket.emit('error', { message: '连接失败' });
    }

    // Handle channel switch
    socket.on('switch-channel', async (data) => {
        try {
            const { channelId } = data;
            socket.currentChannel = channelId;

            // Verify user is member of channel
            const membership = await ChannelMember.findOne({
                userId: socket.userId,
                channelId
            });

            if (!membership) {
                return socket.emit('error', { message: '您不是该频道成员' });
            }

            // Send channel history
            const messages = await Message.find({
                channelId,
                isDeleted: false
            })
                .sort({ timestamp: -1 })
                .limit(100);

            socket.emit('channel-history', messages.reverse());

            console.log(`📺 ${socket.username} switched to channel ${channelId}`);
        } catch (error) {
            console.error('Switch channel error:', error);
            socket.emit('error', { message: '切换频道失败' });
        }
    });

    // Handle send message
    socket.on('send-message', async (data) => {
        try {
            const { message, channelId } = data;

            if (!message || !message.trim()) {
                return socket.emit('error', { message: '消息不能为空' });
            }

            if (!channelId) {
                return socket.emit('error', { message: '未指定频道' });
            }

            // Check if message is AI command
            if (message.trim().startsWith('/chat ')) {
                await handleAICommand(socket, channelId, message);
                return;
            }

            // Check mute status
            const muteStatus = await checkMuteStatus(socket.userId, socket.username);
            if (muteStatus.isMuted) {
                return socket.emit('message-blocked', {
                    reason: muteStatus.reason,
                    isGlobal: muteStatus.isGlobal || false
                });
            }

            // Check word filter
            const hasBlacklisted = await checkWordFilter(message);
            if (hasBlacklisted) {
                return socket.emit('message-blocked', {
                    reason: '消息包含禁用词汇',
                    isGlobal: false
                });
            }

            // Save and broadcast message
            const newMessage = new Message({
                username: socket.username,
                userId: socket.userId,
                message: message.trim(),
                channelId,
                messageType: 'user'
            });

            await newMessage.save();

            // Broadcast to channel members only
            io.to(`channel:${channelId}`).emit('new-message', {
                id: newMessage._id,
                username: newMessage.username,
                userId: newMessage.userId,
                message: newMessage.message,
                timestamp: newMessage.timestamp,
                messageType: 'user',
                channelId
            });

            console.log(`💬 [${channelId}] ${socket.username}: ${message.substring(0, 50)}`);
        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: '发送消息失败' });
        }
    });

    // Handle typing indicators (per channel)
    socket.on('typing', (data) => {
        const { channelId } = data;
        if (channelId) {
            socket.to(`channel:${channelId}`).emit('user-typing', {
                username: socket.username,
                channelId
            });
        }
    });

    socket.on('stop-typing', (data) => {
        const { channelId } = data;
        if (channelId) {
            socket.to(`channel:${channelId}`).emit('user-stop-typing', {
                username: socket.username,
                channelId
            });
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            activeUsers.delete(socket.id);

            // Send updated user list
            io.emit('user-list', Array.from(activeUsers.values()).map(u => u.username));

            console.log(`👋 ${user.username} disconnected`);
        }
    });
});

// ============ AI Service Integration ============

async function handleAICommand(socket, channelId, message) {
    try {
        // Extract actual message after /chat
        const aiMessage = message.replace(/^\/chat\s+/, '').trim();

        if (!aiMessage) {
            return socket.emit('error', { message: '请在 /chat 后输入消息' });
        }

        // Show typing indicator from AI
        io.to(`channel:${channelId}`).emit('user-typing', {
            username: 'DeepSeek AI',
            channelId
        });

        // Call AI service
        try {
            const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
                message: aiMessage,
                channelId,
                username: socket.username
            }, {
                timeout: 35000 // 35 seconds
            });

            // Stop typing indicator
            io.to(`channel:${channelId}`).emit('user-stop-typing', {
                username: 'DeepSeek AI',
                channelId
            });

            const aiResponse = response.data.response;

            // Save AI response as AI message
            const aiResponseMessage = new Message({
                username: 'DeepSeek AI',
                userId: null,
                message: aiResponse,
                channelId,
                messageType: 'ai'
            });

            await aiResponseMessage.save();

            // Broadcast AI response to channel
            io.to(`channel:${channelId}`).emit('new-message', {
                id: aiResponseMessage._id,
                username: 'DeepSeek AI',
                message: aiResponseMessage.message,
                timestamp: aiResponseMessage.timestamp,
                messageType: 'ai',
                channelId
            });

            console.log(`🤖 [${channelId}] DeepSeek AI responded to ${socket.username}`);
        } catch (aiError) {
            // Stop typing indicator
            io.to(`channel:${channelId}`).emit('user-stop-typing', {
                username: 'DeepSeek AI',
                channelId
            });

            if (aiError.code === 'ECONNREFUSED') {
                return socket.emit('error', { message: 'AI服务未启动，请启动Python服务' });
            }

            console.error('AI Service error:', aiError.message);
            socket.emit('error', { message: 'AI服务暂时不可用' });
        }
    } catch (error) {
        console.error('AI command error:', error);
        socket.emit('error', { message: 'AI命令处理失败' });
    }
}

// ============ Start Server ============

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Chat server running on port ${PORT}`);
    console.log(`📡 WebSocket server is ready for connections`);
    console.log(`🤖 AI Service URL: ${AI_SERVICE_URL}`);
    console.log(`👑 Admins: ${adminHelper.getAdminList().join(', ') || 'None'}`);
});
