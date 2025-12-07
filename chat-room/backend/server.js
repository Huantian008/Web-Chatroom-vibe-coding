// ===== 引入所需的库和模块 =====

// dotenv：加载 .env 文件中的环境变量
require('dotenv').config();

// express：Node.js 的 Web 框架，用于创建 HTTP 服务器和 API
const express = require('express');

// http：Node.js 内置的 HTTP 模块，用于创建 HTTP 服务器
const http = require('http');

// socket.io：实时通信库，用于实现 WebSocket 连接（双向通信）
// WebSocket 让服务器可以主动推送消息给客户端，不用客户端反复请求
const socketIo = require('socket.io');

// cors：跨域资源共享中间件，允许前端从不同域名访问后端
const cors = require('cors');

// jsonwebtoken（jwt）：用于生成和验证 JWT 令牌（身份认证）
const jwt = require('jsonwebtoken');

// axios：HTTP 客户端，用于向 AI 服务发送请求
const axios = require('axios');

// ===== 引入数据库配置 =====
const connectDB = require('./config/database');

// ===== 引入数据模型 =====
const User = require('./models/User');                      // 用户模型
const Message = require('./models/Message');                // 消息模型
const Channel = require('./models/Channel');                // 频道模型
const ChannelMember = require('./models/ChannelMember');    // 频道成员模型

// ===== 引入中间件 =====
const { checkWordFilter, updateFilterCache } = require('./middleware/wordFilter');  // 敏感词过滤
const { checkMuteStatus } = require('./middleware/muteCheck');                      // 禁言检查

// ===== 引入工具类 =====
const adminHelper = require('./utils/adminHelper');  // 管理员辅助工具

// ===== 创建 Express 应用 =====
const app = express();

// ===== 创建 HTTP 服务器 =====
// http.createServer(app)：将 Express 应用包装成 HTTP 服务器
// 为什么要这样做？因为 Socket.io 需要一个 HTTP 服务器来工作
const server = http.createServer(app);

// ===== 创建 Socket.io 实例 =====
// 这是实时通信的核心，用于处理 WebSocket 连接
const io = socketIo(server, {
    cors: {
        origin: "*",                   // 允许所有域名访问（开发环境用）
                                       // 生产环境应该改为具体的前端域名
        methods: ["GET", "POST"]       // 允许的 HTTP 方法
    }
});

// ===== 配置 Express 中间件 =====

// cors()：允许跨域请求
// 为什么需要？因为前端（localhost:8080）和后端（localhost:3000）是不同的域名
app.use(cors());

// express.json()：解析 JSON 格式的请求体
// 这样我们才能从 req.body 中获取前端发送的数据
app.use(express.json());

// ===== 连接到 MongoDB 数据库 =====
connectDB();

// ===== 初始化敏感词缓存 =====
// 启动服务器时就加载敏感词，不用等到第一次检查时才加载
updateFilterCache();

// ===== 定义常量 =====

// JWT_SECRET：JWT 令牌的密钥，用于加密和解密令牌
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// AI_SERVICE_URL：AI 服务的地址（Python Flask 服务）
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

// ===== 存储在线用户 =====
// activeUsers：Map 数据结构，存储所有在线用户
// Key: socket.id（每个连接的唯一标识）
// Value: { userId, username, socketId }（用户信息）
const activeUsers = new Map();

// ============================================================
// ===== 第一部分：REST API 路由 =====
// 这部分是传统的 HTTP API，用于注册、登录等一次性操作
// ============================================================

// ===== API 1：用户注册 =====
// POST /api/auth/register
// 这个接口用于新用户注册
app.post('/api/auth/register', async (req, res) => {
    try {
        // ===== 从请求体中获取用户名和密码 =====
        const { username, password } = req.body;

        // ===== 验证输入不能为空 =====
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        // ===== 验证用户名长度 =====
        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度必须在2-20个字符之间' });
        }

        // ===== 验证密码长度 =====
        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少为6个字符' });
        }

        // ===== 检查用户名是否已存在 =====
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ error: '用户名已存在' });
        }

        // ===== 创建新用户 =====
        // new User()：创建用户对象
        // 密码会在 User 模型的 pre('save') 钩子中自动加密
        const user = new User({ username, password });
        await user.save();

        // ===== 自动将用户加入默认频道 =====
        // 为什么要这样做？因为每个用户注册后都应该能立即使用聊天功能
        // 找到默认频道（isDefault: true）
        const defaultChannel = await Channel.findOne({ isDefault: true });
        if (defaultChannel) {
            // 创建频道成员关系
            await ChannelMember.create({
                userId: user._id,
                channelId: defaultChannel._id
            });
        }

        // ===== 生成 JWT 令牌 =====
        // jwt.sign()：生成令牌
        // 参数1：要加密的数据（用户ID和用户名）
        // 参数2：密钥
        // 参数3：选项（expiresIn: '7d' 表示令牌7天后过期）
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // ===== 返回成功信息 =====
        res.status(201).json({
            message: '注册成功',
            token,                          // 返回令牌，前端保存后用于后续请求
            user: {
                id: user._id,
                username: user.username
            }
        });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Register error:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// ===== API 2：用户登录 =====
// POST /api/auth/login
// 这个接口用于用户登录
app.post('/api/auth/login', async (req, res) => {
    try {
        // ===== 从请求体中获取用户名和密码 =====
        const { username, password } = req.body;

        // ===== 验证输入不能为空 =====
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        // ===== 查找用户 =====
        const user = await User.findOne({ username });
        if (!user) {
            // 为什么不说"用户不存在"？
            // 因为这样会泄露用户名是否存在，有安全隐患
            // 统一说"用户名或密码错误"更安全
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // ===== 验证密码 =====
        // comparePassword() 是我们在 User 模型中定义的方法
        // 它会自动处理密码的加密对比
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // ===== 更新最后登录时间 =====
        user.lastLogin = new Date();
        await user.save();

        // ===== 生成 JWT 令牌 =====
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // ===== 返回成功信息 =====
        res.json({
            message: '登录成功',
            token,
            user: {
                id: user._id,
                username: user.username
            }
        });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Login error:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// ===== API 3：验证令牌 =====
// GET /api/auth/verify
// 这个接口用于验证用户的令牌是否有效
// 前端刷新页面时会调用这个接口，检查用户是否还在登录状态
app.get('/api/auth/verify', async (req, res) => {
    try {
        // ===== 从请求头中获取令牌 =====
        // Authorization 头的格式通常是 "Bearer xxxxx"
        const token = req.headers.authorization?.split(' ')[1];

        // ===== 检查令牌是否存在 =====
        if (!token) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }

        // ===== 验证令牌 =====
        // jwt.verify()：解密令牌并验证是否有效
        const decoded = jwt.verify(token, JWT_SECRET);

        // ===== 查找用户 =====
        // .select('-password')：不返回密码字段（安全考虑）
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // ===== 返回用户信息 =====
        res.json({
            user: {
                id: user._id,
                username: user.username
            }
        });

    } catch (error) {
        // ===== 如果令牌无效或过期 =====
        console.error('Verify error:', error);
        res.status(401).json({ error: '无效的认证令牌' });
    }
});

// ===== 注册其他路由 =====
// app.use()：将路由模块挂载到指定的路径

// 频道相关的所有路由（/api/channels/...）
app.use('/api/channels', require('./routes/channels'));

// 管理员相关的所有路由（/api/admin/...）
app.use('/api/admin', require('./routes/admin'));

// ============================================================
// ===== 第二部分：Socket.io 实时通信 =====
// 这部分处理实时消息、在线状态等需要双向通信的功能
// ============================================================

// ===== Socket.io 认证中间件 =====
// io.use()：在 Socket.io 连接建立前执行的中间件
// 用于验证用户身份，只有通过验证的用户才能建立 WebSocket 连接
io.use((socket, next) => {
    // ===== 从握手信息中获取令牌 =====
    // socket.handshake.auth.token：前端在建立 Socket 连接时传递的令牌
    const token = socket.handshake.auth.token;

    // ===== 检查令牌是否存在 =====
    if (!token) {
        // next(new Error(...))：拒绝连接并返回错误信息
        return next(new Error('认证失败：未提供令牌'));
    }

    try {
        // ===== 验证令牌 =====
        const decoded = jwt.verify(token, JWT_SECRET);

        // ===== 将用户信息附加到 socket 对象上 =====
        // 这样在后续的事件处理中就可以通过 socket.userId 和 socket.username 访问用户信息
        socket.userId = decoded.userId;
        socket.username = decoded.username;

        // ===== 继续连接 =====
        // next()：允许连接建立
        next();

    } catch (error) {
        // ===== 如果令牌无效，拒绝连接 =====
        return next(new Error('认证失败：无效的令牌'));
    }
});

// ===== Socket.io 连接事件 =====
// io.on('connection', ...)：当有新的 WebSocket 连接建立时触发
// 每个用户打开聊天页面时都会建立一个连接
io.on('connection', async (socket) => {
    // socket：代表一个客户端的连接
    // 每个连接都有唯一的 socket.id

    console.log(`✅ User connected: ${socket.username} (${socket.id})`);

    // ===== 将用户添加到在线用户列表 =====
    activeUsers.set(socket.id, {
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id
    });

    try {
        // ===== 检查用户是否是管理员 =====
        const isAdmin = adminHelper.isAdmin(socket.username);
        socket.isAdmin = isAdmin;

        // ===== 加载用户已加入的频道列表 =====
        // 查询用户的所有频道成员关系
        const memberships = await ChannelMember.find({ userId: socket.userId })
            // .populate('channelId')：关联查询，填充频道的详细信息
            .populate('channelId');

        // 提取频道ID列表（用于后续查询可加入的频道）
        const memberChannelIds = memberships
            .filter(m => m.channelId)                   // 过滤掉频道被删除的情况
            .map(m => m.channelId._id.toString());      // 提取ID并转换为字符串

        // 将频道数据转换为前端需要的格式
        const channels = memberships
            .filter(m => m.channelId)
            .map(m => ({
                id: m.channelId._id.toString(),
                name: m.channelId.name,
                description: m.channelId.description,
                isDefault: m.channelId.isDefault,
                icon: m.channelId.icon
            }));

        // ===== 查询用户还未加入的频道（可加入列表） =====
        // { _id: { $nin: memberChannelIds } }：MongoDB 查询，$nin 表示"不在...中"
        // 找出 ID 不在 memberChannelIds 中的频道
        const availableChannels = await Channel.find({
            _id: { $nin: memberChannelIds }
        })
            .sort({ isDefault: -1, name: 1 })  // 按默认频道优先、名称升序排列
            .lean();                           // .lean()：返回普通 JavaScript 对象，性能更好

        // ===== 将用户加入所有频道的 Socket.io 房间 =====
        // Socket.io 的"房间"机制：可以向特定房间广播消息
        // 每个频道对应一个房间，格式：channel:频道ID
        // 这样发送消息时就可以只发给该频道的成员
        channels.forEach(channel => {
            socket.join(`channel:${channel.id}`);
        });

        // ===== 向客户端发送初始化数据 =====
        // socket.emit()：向当前客户端发送消息
        socket.emit('initial-data', {
            channels,                                    // 已加入的频道列表
            availableChannels: availableChannels.map(ch => ({
                id: ch._id.toString(),
                name: ch.name,
                description: ch.description,
                isDefault: ch.isDefault,
                icon: ch.icon
            })),                                         // 可加入的频道列表
            isAdmin,                                     // 是否是管理员
            username: socket.username,                   // 用户名
            userId: socket.userId                        // 用户ID
        });

        // ===== 通知其他用户：新用户加入了频道 =====
        // socket.to()：向指定房间发送消息（不包括自己）
        channels.forEach(channel => {
            socket.to(`channel:${channel.id}`).emit('user-joined-channel', {
                username: socket.username,
                channelId: channel.id
            });
        });

        // ===== 向所有客户端广播更新后的在线用户列表 =====
        // io.emit()：向所有已连接的客户端发送消息
        // Array.from(activeUsers.values())：将 Map 的值转换为数组
        io.emit('user-list', Array.from(activeUsers.values()).map(u => u.username));

        console.log(`📨 ${socket.username} joined ${channels.length} channel(s)`);

    } catch (error) {
        // ===== 如果初始化失败，通知客户端 =====
        console.error('Connection error:', error);
        socket.emit('error', { message: '连接失败' });
    }

    // ===== Socket 事件 1：切换频道 =====
    // socket.on()：监听客户端发送的事件
    socket.on('switch-channel', async (data) => {
        try {
            // ===== 从事件数据中获取频道ID =====
            const { channelId } = data;

            // ===== 记录用户当前所在的频道 =====
            // 这样可以知道用户在哪个频道，方便后续消息的发送
            socket.currentChannel = channelId;

            // ===== 验证用户是否是该频道的成员 =====
            // 安全检查：防止用户访问未加入的频道
            const membership = await ChannelMember.findOne({
                userId: socket.userId,
                channelId
            });

            if (!membership) {
                return socket.emit('error', { message: '您不是该频道成员' });
            }

            // ===== 查询频道的历史消息 =====
            const messages = await Message.find({
                channelId,              // 指定频道
                isDeleted: false        // 只查询未删除的消息
            })
                .sort({ timestamp: -1 })  // 按时间降序（最新的在前）
                .limit(100);              // 最多100条

            // ===== 发送历史消息给客户端 =====
            // .reverse()：反转数组顺序，让最旧的消息在前面
            socket.emit('channel-history', messages.reverse());

            console.log(`📺 ${socket.username} switched to channel ${channelId}`);

        } catch (error) {
            // ===== 如果切换频道失败 =====
            console.error('Switch channel error:', error);
            socket.emit('error', { message: '切换频道失败' });
        }
    });

    // ===== Socket 事件 2：发送消息 =====
    socket.on('send-message', async (data) => {
        try {
            // ===== 从事件数据中获取消息内容和频道ID =====
            const { message, channelId } = data;

            // ===== 验证消息不能为空 =====
            if (!message || !message.trim()) {
                return socket.emit('error', { message: '消息不能为空' });
            }

            // ===== 验证频道ID不能为空 =====
            if (!channelId) {
                return socket.emit('error', { message: '未指定频道' });
            }

            // ===== 检查是否是 AI 命令 =====
            // 如果消息以 "/chat " 开头，就是 AI 命令
            if (message.trim().startsWith('/chat ')) {
                // 调用 AI 命令处理函数
                await handleAICommand(socket, channelId, message);
                return;  // 不继续执行后面的代码
            }

            // ===== 检查用户是否被禁言 =====
            const muteStatus = await checkMuteStatus(socket.userId, socket.username);
            if (muteStatus.isMuted) {
                // 如果被禁言，通知客户端消息被拦截
                return socket.emit('message-blocked', {
                    reason: muteStatus.reason,
                    isGlobal: muteStatus.isGlobal || false
                });
            }

            // ===== 检查消息是否包含敏感词 =====
            const hasBlacklisted = await checkWordFilter(message);
            if (hasBlacklisted) {
                // 如果包含敏感词，通知客户端消息被拦截
                return socket.emit('message-blocked', {
                    reason: '消息包含禁用词汇',
                    isGlobal: false
                });
            }

            // ===== 保存消息到数据库 =====
            const newMessage = new Message({
                username: socket.username,
                userId: socket.userId,
                message: message.trim(),
                channelId,
                messageType: 'user'  // 用户消息
            });

            await newMessage.save();

            // ===== 向频道内的所有成员广播消息 =====
            // io.to(`channel:${channelId}`)：向指定频道的所有成员发送消息
            // 包括发送者自己，这样发送者也能看到自己的消息
            io.to(`channel:${channelId}`).emit('new-message', {
                id: newMessage._id,
                username: newMessage.username,
                userId: newMessage.userId,
                message: newMessage.message,
                timestamp: newMessage.timestamp,
                messageType: 'user',
                channelId
            });

            // ===== 在服务器控制台打印日志 =====
            // .substring(0, 50)：只打印前50个字符，避免日志太长
            console.log(`💬 [${channelId}] ${socket.username}: ${message.substring(0, 50)}`);

        } catch (error) {
            // ===== 如果发送消息失败 =====
            console.error('Send message error:', error);
            socket.emit('error', { message: '发送消息失败' });
        }
    });

    // ===== Socket 事件 3：用户正在输入 =====
    // 这个事件用于显示"xxx 正在输入..."的提示
    socket.on('typing', (data) => {
        const { channelId } = data;
        if (channelId) {
            // socket.to()：向其他用户发送消息（不包括自己）
            // 为什么不包括自己？因为自己已经知道自己在输入了
            socket.to(`channel:${channelId}`).emit('user-typing', {
                username: socket.username,
                channelId
            });
        }
    });

    // ===== Socket 事件 4：用户停止输入 =====
    socket.on('stop-typing', (data) => {
        const { channelId } = data;
        if (channelId) {
            socket.to(`channel:${channelId}`).emit('user-stop-typing', {
                username: socket.username,
                channelId
            });
        }
    });

    // ===== Socket 事件 5：用户断开连接 =====
    // 当用户关闭页面或网络断开时触发
    socket.on('disconnect', () => {
        // ===== 从在线用户列表中移除该用户 =====
        const user = activeUsers.get(socket.id);
        if (user) {
            activeUsers.delete(socket.id);

            // ===== 向所有客户端广播更新后的在线用户列表 =====
            io.emit('user-list', Array.from(activeUsers.values()).map(u => u.username));

            console.log(`👋 ${user.username} disconnected`);
        }
    });
});

// ============================================================
// ===== 第三部分：AI 服务集成 =====
// ============================================================

// ===== AI 命令处理函数 =====
// 当用户发送 "/chat xxx" 时调用这个函数
// 参数：
// - socket：当前用户的 Socket 连接
// - channelId：当前频道ID
// - message：原始消息（包含 /chat）
async function handleAICommand(socket, channelId, message) {
    try {
        // ===== 提取 AI 消息内容 =====
        // 使用正则表达式去掉 "/chat " 前缀
        // 例如："/chat 你好" -> "你好"
        const aiMessage = message.replace(/^\/chat\s+/, '').trim();

        // ===== 验证消息不能为空 =====
        if (!aiMessage) {
            return socket.emit('error', { message: '请在 /chat 后输入消息' });
        }

        // ===== 显示 AI 正在输入的提示 =====
        // 让其他用户看到 "DeepSeek AI 正在输入..."
        io.to(`channel:${channelId}`).emit('user-typing', {
            username: 'DeepSeek AI',
            channelId
        });

        // ===== 调用 AI 服务 =====
        try {
            // axios.post()：发送 POST 请求到 AI 服务（Python Flask）
            const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
                message: aiMessage,      // 用户的问题
                channelId,               // 频道ID（用于维护对话历史）
                username: socket.username // 用户名
            }, {
                timeout: 35000  // 超时时间：35秒
                                // 为什么这么长？因为 AI 生成回复需要时间
            });

            // ===== 停止 AI 正在输入的提示 =====
            io.to(`channel:${channelId}`).emit('user-stop-typing', {
                username: 'DeepSeek AI',
                channelId
            });

            // ===== 获取 AI 的回复 =====
            const aiResponse = response.data.response;

            // ===== 保存 AI 回复到数据库 =====
            const aiResponseMessage = new Message({
                username: 'DeepSeek AI',
                userId: null,              // AI 没有用户ID
                message: aiResponse,
                channelId,
                messageType: 'ai'          // 标记为 AI 消息
            });

            await aiResponseMessage.save();

            // ===== 向频道内的所有成员广播 AI 回复 =====
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
            // ===== 如果 AI 服务调用失败 =====

            // 停止 AI 正在输入的提示
            io.to(`channel:${channelId}`).emit('user-stop-typing', {
                username: 'DeepSeek AI',
                channelId
            });

            // ===== 检查错误类型 =====
            if (aiError.code === 'ECONNREFUSED') {
                // ECONNREFUSED：连接被拒绝，说明 AI 服务没有启动
                return socket.emit('error', { message: 'AI服务未启动，请启动Python服务' });
            }

            // 其他错误（如超时、服务器错误等）
            console.error('AI Service error:', aiError.message);
            socket.emit('error', { message: 'AI服务暂时不可用' });
        }

    } catch (error) {
        // ===== 如果 AI 命令处理过程中发生其他错误 =====
        console.error('AI command error:', error);
        socket.emit('error', { message: 'AI命令处理失败' });
    }
}

// ============================================================
// ===== 第四部分：启动服务器 =====
// ============================================================

// ===== 定义服务器端口 =====
// PORT：从环境变量读取端口，如果没有就用 3000
const PORT = process.env.PORT || 3000;

// ===== 启动服务器 =====
// server.listen()：让服务器开始监听指定端口
// 参数1：端口号
// 参数2：回调函数，服务器启动后执行
server.listen(PORT, () => {
    // ===== 打印启动信息 =====
    console.log(`🚀 Chat server running on port ${PORT}`);
    console.log(`📡 WebSocket server is ready for connections`);
    console.log(`🤖 AI Service URL: ${AI_SERVICE_URL}`);
    console.log(`👑 Admins: ${adminHelper.getAdminList().join(', ') || 'None'}`);
    // adminHelper.getAdminList()：获取管理员列表
    // .join(', ')：用逗号连接管理员名字
    // || 'None'：如果没有管理员，显示 'None'
});
