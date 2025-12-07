// ===== 引入所需的库和模型 =====

// express：Node.js 的 Web 框架
const express = require('express');

// router：Express 路由器，用于定义管理员相关的API接口
const router = express.Router();

// 引入数据模型
const User = require('../models/User');                          // 用户模型
const WordFilter = require('../models/WordFilter');              // 敏感词模型
const GlobalMuteStatus = require('../models/GlobalMuteStatus');  // 全局禁言模型

// 引入中间件
const { verifyToken } = require('../middleware/auth');           // 身份认证中间件
const { requireAdmin } = require('../middleware/adminAuth');     // 管理员权限中间件
const { updateFilterCache } = require('../middleware/wordFilter'); // 敏感词缓存更新函数

// ===== 路由1：获取所有敏感词 =====
// GET /api/admin/word-filters
// 这个接口返回所有激活的敏感词列表（仅管理员）
router.get('/word-filters', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从数据库中查询所有激活的敏感词 =====
        const filters = await WordFilter.find({ isActive: true })
            // .populate('addedBy', 'username')：关联查询添加者的用户名
            // 第一个参数是要关联的字段，第二个参数是只返回 username 字段
            .populate('addedBy', 'username')
            // .sort({ addedAt: -1 })：按添加时间降序排列（最新的在前面）
            .sort({ addedAt: -1 });

        // ===== 返回敏感词列表 =====
        res.json(filters);

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Get filters error:', error);
        res.status(500).json({ error: '获取过滤词失败' });
    }
});

// ===== 路由2：添加敏感词 =====
// POST /api/admin/word-filters
// 这个接口用于添加新的敏感词（仅管理员）
router.post('/word-filters', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从请求体中获取敏感词 =====
        const { word } = req.body;

        // ===== 验证敏感词不能为空 =====
        if (!word || word.trim().length === 0) {
            return res.status(400).json({ error: '过滤词不能为空' });
        }

        // ===== 创建新的敏感词对象 =====
        const filter = new WordFilter({
            // word.trim().toLowerCase()：去掉空格并转换为小写
            // 为什么要转小写？这样可以不区分大小写进行匹配
            word: word.trim().toLowerCase(),
            addedBy: req.user.userId  // 记录是哪个管理员添加的
        });

        // ===== 保存到数据库 =====
        await filter.save();

        // ===== 立即更新敏感词缓存 =====
        // 为什么要更新缓存？因为添加了新的敏感词，需要立即生效
        // 不然要等5分钟缓存过期后才会生效
        await updateFilterCache();

        // ===== 返回成功信息 =====
        res.status(201).json({
            message: '过滤词添加成功',
            filter: {
                id: filter._id,
                word: filter.word,
                addedAt: filter.addedAt
            }
        });

    } catch (error) {
        // ===== 处理重复敏感词错误 =====
        // error.code === 11000：MongoDB 唯一索引冲突错误代码
        // 表示这个敏感词已经存在了
        if (error.code === 11000) {
            return res.status(409).json({ error: '该过滤词已存在' });
        }

        // ===== 其他错误 =====
        console.error('Add filter error:', error);
        res.status(500).json({ error: '添加过滤词失败' });
    }
});

// ===== 路由3：删除敏感词 =====
// DELETE /api/admin/word-filters/:filterId
// 这个接口用于删除（实际是禁用）敏感词（仅管理员）
router.delete('/word-filters/:filterId', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 将敏感词标记为不激活 =====
        // 注意：这里不是真的删除，而是把 isActive 设置为 false（软删除）
        // 为什么不直接删除？因为可能以后还需要恢复或查看历史记录
        await WordFilter.findByIdAndUpdate(req.params.filterId, {
            isActive: false
        });

        // ===== 立即更新敏感词缓存 =====
        // 删除敏感词后，需要立即从缓存中移除
        await updateFilterCache();

        // ===== 返回成功信息 =====
        res.json({ message: '过滤词已移除' });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Remove filter error:', error);
        res.status(500).json({ error: '移除过滤词失败' });
    }
});

// ===== 路由4：获取所有用户列表 =====
// GET /api/admin/users
// 这个接口返回所有用户的信息（仅管理员）
// 用于管理员查看用户列表、管理用户（如禁言）
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从数据库中查询所有用户 =====
        const users = await User.find()
            // .select()：只返回指定的字段，不返回敏感信息（如密码）
            // 返回：用户名、角色、禁言状态、禁言截止时间、禁言原因、创建时间
            .select('username role isMuted mutedUntil mutedReason createdAt')
            // .sort({ createdAt: -1 })：按创建时间降序排列（最新注册的在前面）
            .sort({ createdAt: -1 });

        // ===== 返回用户列表 =====
        res.json(users);

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Get users error:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// ===== 路由5：禁言用户 =====
// POST /api/admin/mute-user
// 这个接口用于禁言某个用户（仅管理员）
// 可以设置禁言时长，也可以永久禁言
router.post('/mute-user', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从请求体中获取参数 =====
        const { userId, duration, reason } = req.body;
        // userId：要禁言的用户ID
        // duration：禁言时长（分钟），0或空表示永久禁言
        // reason：禁言原因

        // ===== 验证用户ID不能为空 =====
        if (!userId) {
            return res.status(400).json({ error: '用户ID不能为空' });
        }

        // ===== 查询用户是否存在 =====
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // ===== 检查是否是管理员 =====
        // 业务规则：不能禁言管理员
        if (user.role === 'admin') {
            return res.status(403).json({ error: '不能禁言管理员' });
        }

        // ===== 设置禁言状态 =====
        user.isMuted = true;                        // 标记为禁言
        user.mutedBy = req.user.userId;             // 记录是哪个管理员禁言的
        user.mutedReason = reason || '违反聊天规则'; // 禁言原因（如果没有就用默认值）

        // ===== 设置禁言截止时间 =====
        if (duration && duration > 0) {
            // 如果指定了时长，计算截止时间
            // Date.now()：当前时间戳（毫秒）
            // duration * 60 * 1000：将分钟转换为毫秒
            // 例如：禁言30分钟 = 30 * 60 * 1000 = 1800000毫秒
            user.mutedUntil = new Date(Date.now() + duration * 60 * 1000);
        } else {
            // 如果没有指定时长，表示永久禁言
            user.mutedUntil = null;
        }

        // ===== 保存到数据库 =====
        await user.save();

        // ===== 返回成功信息 =====
        res.json({
            message: '用户已被禁言',
            mutedUntil: user.mutedUntil  // 返回禁言截止时间（如果是永久禁言，这个字段是 null）
        });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Mute user error:', error);
        res.status(500).json({ error: '禁言用户失败' });
    }
});

// ===== 路由6：解除禁言 =====
// POST /api/admin/unmute-user
// 这个接口用于解除某个用户的禁言（仅管理员）
router.post('/unmute-user', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从请求体中获取用户ID =====
        const { userId } = req.body;

        // ===== 验证用户ID不能为空 =====
        if (!userId) {
            return res.status(400).json({ error: '用户ID不能为空' });
        }

        // ===== 查询用户是否存在 =====
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // ===== 清除所有禁言相关字段 =====
        user.isMuted = false;         // 不再禁言
        user.mutedUntil = null;       // 清空禁言截止时间
        user.mutedBy = null;          // 清空禁言者
        user.mutedReason = null;      // 清空禁言原因

        // ===== 保存到数据库 =====
        await user.save();

        // ===== 返回成功信息 =====
        res.json({ message: '用户已解除禁言' });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Unmute user error:', error);
        res.status(500).json({ error: '解除禁言失败' });
    }
});

// ===== 路由7：切换全局禁言 =====
// POST /api/admin/global-mute
// 这个接口用于开启或关闭全局禁言（仅管理员）
// 全局禁言开启后，除了管理员以外的所有用户都不能发言
router.post('/global-mute', verifyToken, requireAdmin, async (req, res) => {
    try {
        // ===== 从请求体中获取参数 =====
        const { enabled, reason } = req.body;
        // enabled：true 表示开启，false 表示关闭
        // reason：开启全局禁言的原因

        // ===== 查询或创建全局禁言状态对象 =====
        // 因为全局禁言状态只有一条记录（单例模式）
        let status = await GlobalMuteStatus.findOne();

        // 如果数据库中还没有这条记录，就创建一个新的
        if (!status) {
            status = new GlobalMuteStatus();
        }

        // ===== 设置全局禁言状态 =====
        status.isEnabled = enabled;  // 设置是否开启

        // 如果开启，记录开启者和开启时间；如果关闭，清空这些字段
        status.enabledBy = enabled ? req.user.userId : null;
        status.enabledAt = enabled ? new Date() : null;
        status.reason = enabled ? (reason || '管理员启用全局禁言') : '';

        // ===== 保存到数据库 =====
        await status.save();

        // ===== 返回成功信息 =====
        res.json({
            message: enabled ? '全局禁言已启用' : '全局禁言已关闭',
            status: {
                isEnabled: status.isEnabled,
                reason: status.reason
            }
        });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Global mute error:', error);
        res.status(500).json({ error: '设置全局禁言失败' });
    }
});

// ===== 路由8：获取全局禁言状态 =====
// GET /api/admin/global-mute
// 这个接口返回当前的全局禁言状态
// 注意：这个接口不需要管理员权限，所有登录用户都可以查询
router.get('/global-mute', verifyToken, async (req, res) => {
    try {
        // ===== 查询全局禁言状态 =====
        let status = await GlobalMuteStatus.findOne();

        // ===== 如果数据库中没有记录，返回默认值 =====
        if (!status) {
            status = { isEnabled: false, reason: '' };
        }

        // ===== 返回全局禁言状态 =====
        res.json({
            isEnabled: status.isEnabled,  // 是否开启
            reason: status.reason || ''   // 开启原因
        });

    } catch (error) {
        // ===== 如果发生错误，返回错误信息 =====
        console.error('Get global mute error:', error);
        res.status(500).json({ error: '获取全局禁言状态失败' });
    }
});

// ===== 导出路由器 =====
// module.exports = router：导出路由器，让 server.js 可以使用
// 在 server.js 中会这样使用：app.use('/api/admin', adminRouter)
// 这样所有以 /api/admin 开头的请求都会由这个路由器处理
module.exports = router;
