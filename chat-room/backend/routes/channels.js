// ===== 引入所需的库和模块 =====

// express：Node.js 的 Web 框架，用于创建 API
const express = require('express');

// router：Express 路由器，用于定义路由（API 接口）
// 路由就像是"地址簿"，告诉服务器不同的 URL 应该做什么
const router = express.Router();

// 引入数据模型
const Channel = require('../models/Channel');              // 频道模型
const ChannelMember = require('../models/ChannelMember');  // 频道成员模型
const Message = require('../models/Message');              // 消息模型

// 引入中间件
const { verifyToken } = require('../middleware/auth');          // 身份认证中间件
const { requireAdmin } = require('../middleware/adminAuth');    // 管理员权限中间件

// ===== 路由1：获取用户已加入的所有频道 =====
// GET /api/channels
// 这个接口返回用户已经加入的所有频道列表
// verifyToken：中间件，验证用户是否登录
// async (req, res)：异步路由处理函数
router.get('/', verifyToken, async (req, res) => {
    // try-catch：错误处理
    try {
        // ===== 从数据库中查询用户的频道成员关系 =====
        // ChannelMember.find({ userId: req.user.userId })：查找用户加入的所有频道
        // req.user.userId 是从 verifyToken 中间件中获取的当前登录用户的 ID
        const memberships = await ChannelMember.find({ userId: req.user.userId })
            // .populate('channelId')：关联查询，自动填充频道的详细信息
            // 相当于 SQL 的 JOIN 操作，把 channelId 从 ID 变成完整的频道对象
            .populate('channelId')
            // .sort()：排序
            // 'channelId.isDefault': -1 表示默认频道排在前面（-1 是降序）
            // 'channelId.name': 1 表示按频道名称升序排列（1 是升序）
            .sort({ 'channelId.isDefault': -1, 'channelId.name': 1 });

        // ===== 将数据库结果转换为前端需要的格式 =====
        const channels = memberships
            // .filter(m => m.channelId)：过滤掉 channelId 为 null 的记录
            // 为什么会有 null？可能是频道被删除了，但成员关系还在
            .filter(m => m.channelId)
            // .map()：遍历每个成员关系，转换为频道对象
            .map(m => ({
                id: m.channelId._id,                // 频道ID
                name: m.channelId.name,             // 频道名称
                description: m.channelId.description, // 频道描述
                isDefault: m.channelId.isDefault,   // 是否是默认频道
                icon: m.channelId.icon,             // 频道图标
                joinedAt: m.joinedAt                // 加入时间
            }));

        // ===== 返回频道列表给前端 =====
        // res.json()：以 JSON 格式返回数据
        res.json(channels);

    } catch (error) {
        // ===== 如果发生错误，打印日志并返回错误信息 =====
        console.error('Get channels error:', error);
        // 返回 500 状态码（服务器内部错误）
        res.status(500).json({ error: '获取频道列表失败' });
    }
});

// ===== 路由2：获取所有可加入的频道 =====
// GET /api/channels/available
// 这个接口返回用户还没有加入的频道列表（用于"加入频道"功能）
// verifyToken：中间件，验证用户是否登录
router.get('/available', verifyToken, async (req, res) => {
    try {
        // ===== 第一步：获取系统中所有的频道 =====
        // Channel.find()：查询所有频道
        // .sort()：按默认频道优先、名称升序排列
        const allChannels = await Channel.find().sort({ isDefault: -1, name: 1 });

        // ===== 第二步：获取用户已经加入的频道 ID 列表 =====
        // 查询用户的所有频道成员关系
        const memberships = await ChannelMember.find({ userId: req.user.userId });

        // .map()：遍历每个成员关系，提取频道ID
        // .toString()：将 ObjectId 转换为字符串，方便后续比较
        const memberChannelIds = memberships.map(m => m.channelId.toString());

        // ===== 第三步：过滤出用户还没有加入的频道 =====
        // 逻辑：所有频道 - 已加入的频道 = 可加入的频道
        const availableChannels = allChannels
            // .filter()：过滤频道
            // !memberChannelIds.includes(ch._id.toString())：如果频道ID不在已加入列表中，就保留
            .filter(ch => !memberChannelIds.includes(ch._id.toString()))
            // .map()：转换为前端需要的格式
            .map(ch => ({
                id: ch._id,                   // 频道ID
                name: ch.name,                // 频道名称
                description: ch.description,  // 频道描述
                icon: ch.icon,                // 频道图标
                isDefault: ch.isDefault       // 是否是默认频道
            }));

        // ===== 返回可加入的频道列表 =====
        res.json(availableChannels);

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Get available channels error:', error);
        res.status(500).json({ error: '获取可用频道失败' });
    }
});

// ===== 路由3：创建新频道（仅管理员） =====
// POST /api/channels
// 这个接口用于创建新频道，只有管理员可以调用
// verifyToken：验证用户是否登录
// requireAdmin：验证用户是否是管理员
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从请求体中获取频道信息 =====
        // req.body 包含前端发送的数据
        const { name, description, icon } = req.body;

        // ===== 验证频道名称 =====
        // 检查名称是否存在且长度至少2个字符
        if (!name || name.trim().length < 2) {
            // 返回 400 状态码（Bad Request，请求参数错误）
            return res.status(400).json({ error: '频道名称至少2个字符' });
        }

        // ===== 检查频道名称是否已存在 =====
        // Channel.findOne({ name: name.trim() })：查找是否有相同名称的频道
        const existing = await Channel.findOne({ name: name.trim() });
        if (existing) {
            // 返回 409 状态码（Conflict，冲突）
            return res.status(409).json({ error: '频道名称已存在' });
        }

        // ===== 创建新频道对象 =====
        // new Channel({...})：创建频道实例
        const channel = new Channel({
            name: name.trim(),                    // 频道名称（去掉前后空格）
            description: description || '',       // 频道描述（如果没有就用空字符串）
            icon: icon || 'ph-hash',              // 频道图标（如果没有就用默认图标）
            createdBy: req.user.userId,           // 创建者ID（当前登录的管理员）
            isDefault: false                      // 不是默认频道
        });

        // ===== 保存频道到数据库 =====
        await channel.save();

        // ===== 自动将创建者加入频道 =====
        // 为什么要自动加入？因为创建者肯定要在自己创建的频道里
        await ChannelMember.create({
            userId: req.user.userId,    // 用户ID（创建者）
            channelId: channel._id      // 频道ID（刚创建的频道）
        });

        // ===== 返回成功信息 =====
        // 返回 201 状态码（Created，创建成功）
        res.status(201).json({
            message: '频道创建成功',
            channel: {
                id: channel._id,
                name: channel.name,
                description: channel.description,
                icon: channel.icon,
                isDefault: channel.isDefault
            }
        });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Create channel error:', error);
        res.status(500).json({ error: '创建频道失败' });
    }
});

// ===== 路由4：加入频道 =====
// POST /api/channels/:channelId/join
// 这个接口用于用户加入一个频道
// :channelId 是路由参数，表示要加入的频道ID
router.post('/:channelId/join', verifyToken, async (req, res) => {
    try {
        // ===== 从路由参数中获取频道ID =====
        // req.params 包含 URL 中的动态参数
        // 例如：/api/channels/abc123/join，channelId 就是 "abc123"
        const { channelId } = req.params;

        // ===== 检查频道是否存在 =====
        const channel = await Channel.findById(channelId);
        if (!channel) {
            // 返回 404 状态码（Not Found，资源不存在）
            return res.status(404).json({ error: '频道不存在' });
        }

        // ===== 检查用户是否已经是频道成员 =====
        // 避免重复加入
        const existing = await ChannelMember.findOne({
            userId: req.user.userId,
            channelId
        });

        if (existing) {
            // 返回 409 状态码（Conflict，冲突）
            return res.status(409).json({ error: '已经加入该频道' });
        }

        // ===== 创建频道成员关系 =====
        // 将用户添加到频道中
        await ChannelMember.create({
            userId: req.user.userId,    // 用户ID
            channelId                   // 频道ID
        });

        // ===== 返回成功信息 =====
        res.json({ message: '加入频道成功' });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Join channel error:', error);
        res.status(500).json({ error: '加入频道失败' });
    }
});

// ===== 路由5：离开频道 =====
// POST /api/channels/:channelId/leave
// 这个接口用于用户离开一个频道
// 注意：不能离开默认频道（默认频道是必须加入的）
router.post('/:channelId/leave', verifyToken, async (req, res) => {
    try {
        // ===== 从路由参数中获取频道ID =====
        const { channelId } = req.params;

        // ===== 检查是否是默认频道 =====
        // 默认频道不能离开，这是一个业务规则
        const channel = await Channel.findById(channelId);
        if (channel && channel.isDefault) {
            // 返回 400 状态码（Bad Request，请求不合法）
            return res.status(400).json({ error: '无法离开默认频道' });
        }

        // ===== 删除频道成员关系 =====
        // ChannelMember.deleteOne()：删除一条记录
        await ChannelMember.deleteOne({
            userId: req.user.userId,    // 用户ID
            channelId                   // 频道ID
        });

        // ===== 返回成功信息 =====
        res.json({ message: '离开频道成功' });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Leave channel error:', error);
        res.status(500).json({ error: '离开频道失败' });
    }
});

// ===== 路由6：发送消息到频道 =====
// POST /api/channels/:channelId/messages
// 这个接口用于向频道发送新消息
router.post('/:channelId/messages', verifyToken, async (req, res) => {
    try {
        // ===== 获取频道ID和消息内容 =====
        const { channelId } = req.params;
        const { message } = req.body;

        // ===== 验证消息内容不能为空 =====
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: '消息内容不能为空' });
        }

        // ===== 验证用户是否是频道成员 =====
        const membership = await ChannelMember.findOne({
            userId: req.user.userId,
            channelId
        });

        if (!membership) {
            return res.status(403).json({ error: '您不是该频道成员' });
        }

        // ===== 创建并保存消息 =====
        const newMessage = new Message({
            username: req.user.username,
            userId: req.user.userId,
            message: message.trim(),
            channelId,
            messageType: 'user'
        });

        await newMessage.save();

        // ===== 返回创建的消息 =====
        res.status(201).json({
            id: newMessage._id,
            username: newMessage.username,
            message: newMessage.message,
            timestamp: newMessage.timestamp,
            channelId: newMessage.channelId,
            messageType: newMessage.messageType
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: '发送消息失败' });
    }
});

// ===== 路由7：获取频道的历史消息 =====
// GET /api/channels/:channelId/messages
// 这个接口用于获取某个频道的历史消息
// 可以通过 limit 参数指定获取多少条消息（默认100条）
router.get('/:channelId/messages', verifyToken, async (req, res) => {
    try {
        // ===== 获取频道ID和消息数量限制 =====
        const { channelId } = req.params;                  // 从 URL 参数获取频道ID
        const limit = parseInt(req.query.limit) || 100;    // 从查询参数获取限制数量
                                                             // req.query 包含 URL 中 ? 后面的参数
                                                             // 例如：/messages?limit=50，limit 就是 50

        // ===== 验证用户是否是频道成员 =====
        // 只有频道成员才能查看历史消息
        const membership = await ChannelMember.findOne({
            userId: req.user.userId,
            channelId
        });

        if (!membership) {
            // 返回 403 状态码（Forbidden，禁止访问）
            return res.status(403).json({ error: '您不是该频道成员' });
        }

        // ===== 从数据库中查询消息 =====
        const messages = await Message.find({
            channelId,              // 指定频道
            isDeleted: false        // 只查询未删除的消息
        })
            // .sort({ timestamp: -1 })：按时间降序排列（最新的在前面）
            .sort({ timestamp: -1 })
            // .limit(limit)：限制返回的消息数量
            .limit(limit);

        // ===== 反转消息顺序并返回 =====
        // 为什么要反转？
        // 因为我们按时间降序查询（最新的在前），但前端需要按时间升序显示（最旧的在前）
        // .reverse() 会把数组反转
        res.json(messages.reverse());

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Get channel messages error:', error);
        res.status(500).json({ error: '获取消息失败' });
    }
});

// ===== 导出路由器 =====
// module.exports = router：导出路由器，让 server.js 可以使用
// 在 server.js 中会这样使用：app.use('/api/channels', channelsRouter)
// 这样所有以 /api/channels 开头的请求都会由这个路由器处理
module.exports = router;
