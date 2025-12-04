const express = require('express');
const router = express.Router();
const User = require('../models/User');
const WordFilter = require('../models/WordFilter');
const GlobalMuteStatus = require('../models/GlobalMuteStatus');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { updateFilterCache } = require('../middleware/wordFilter');

// Get all word filters
router.get('/word-filters', verifyToken, requireAdmin, async (req, res) => {
    try {
        const filters = await WordFilter.find({ isActive: true })
            .populate('addedBy', 'username')
            .sort({ addedAt: -1 });

        res.json(filters);
    } catch (error) {
        console.error('Get filters error:', error);
        res.status(500).json({ error: '获取过滤词失败' });
    }
});

// Add word filter
router.post('/word-filters', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { word } = req.body;

        if (!word || word.trim().length === 0) {
            return res.status(400).json({ error: '过滤词不能为空' });
        }

        const filter = new WordFilter({
            word: word.trim().toLowerCase(),
            addedBy: req.user.userId
        });

        await filter.save();
        await updateFilterCache(); // Update cache

        res.status(201).json({
            message: '过滤词添加成功',
            filter: {
                id: filter._id,
                word: filter.word,
                addedAt: filter.addedAt
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: '该过滤词已存在' });
        }
        console.error('Add filter error:', error);
        res.status(500).json({ error: '添加过滤词失败' });
    }
});

// Remove word filter
router.delete('/word-filters/:filterId', verifyToken, requireAdmin, async (req, res) => {
    try {
        await WordFilter.findByIdAndUpdate(req.params.filterId, {
            isActive: false
        });

        await updateFilterCache(); // Update cache

        res.json({ message: '过滤词已移除' });
    } catch (error) {
        console.error('Remove filter error:', error);
        res.status(500).json({ error: '移除过滤词失败' });
    }
});

// Get all users (for admin management)
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('username role isMuted mutedUntil mutedReason createdAt')
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// Mute user
router.post('/mute-user', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { userId, duration, reason } = req.body;

        if (!userId) {
            return res.status(400).json({ error: '用户ID不能为空' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // Don't mute admins
        if (user.role === 'admin') {
            return res.status(403).json({ error: '不能禁言管理员' });
        }

        user.isMuted = true;
        user.mutedBy = req.user.userId;
        user.mutedReason = reason || '违反聊天规则';

        if (duration && duration > 0) {
            user.mutedUntil = new Date(Date.now() + duration * 60 * 1000);
        } else {
            user.mutedUntil = null; // Permanent
        }

        await user.save();

        res.json({
            message: '用户已被禁言',
            mutedUntil: user.mutedUntil
        });
    } catch (error) {
        console.error('Mute user error:', error);
        res.status(500).json({ error: '禁言用户失败' });
    }
});

// Unmute user
router.post('/unmute-user', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: '用户ID不能为空' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        user.isMuted = false;
        user.mutedUntil = null;
        user.mutedBy = null;
        user.mutedReason = null;
        await user.save();

        res.json({ message: '用户已解除禁言' });
    } catch (error) {
        console.error('Unmute user error:', error);
        res.status(500).json({ error: '解除禁言失败' });
    }
});

// Toggle global mute
router.post('/global-mute', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { enabled, reason } = req.body;

        let status = await GlobalMuteStatus.findOne();

        if (!status) {
            status = new GlobalMuteStatus();
        }

        status.isEnabled = enabled;
        status.enabledBy = enabled ? req.user.userId : null;
        status.enabledAt = enabled ? new Date() : null;
        status.reason = enabled ? (reason || '管理员启用全局禁言') : '';

        await status.save();

        res.json({
            message: enabled ? '全局禁言已启用' : '全局禁言已关闭',
            status: {
                isEnabled: status.isEnabled,
                reason: status.reason
            }
        });
    } catch (error) {
        console.error('Global mute error:', error);
        res.status(500).json({ error: '设置全局禁言失败' });
    }
});

// Get global mute status
router.get('/global-mute', verifyToken, async (req, res) => {
    try {
        let status = await GlobalMuteStatus.findOne();

        if (!status) {
            status = { isEnabled: false, reason: '' };
        }

        res.json({
            isEnabled: status.isEnabled,
            reason: status.reason || ''
        });
    } catch (error) {
        console.error('Get global mute error:', error);
        res.status(500).json({ error: '获取全局禁言状态失败' });
    }
});

module.exports = router;
