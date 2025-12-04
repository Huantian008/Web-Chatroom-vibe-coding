const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');
const Message = require('../models/Message');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Get all channels user has access to
router.get('/', verifyToken, async (req, res) => {
    try {
        // Get all channels user is a member of
        const memberships = await ChannelMember.find({ userId: req.user.userId })
            .populate('channelId')
            .sort({ 'channelId.isDefault': -1, 'channelId.name': 1 });

        const channels = memberships
            .filter(m => m.channelId) // Filter out null channels
            .map(m => ({
                id: m.channelId._id,
                name: m.channelId.name,
                description: m.channelId.description,
                isDefault: m.channelId.isDefault,
                icon: m.channelId.icon,
                joinedAt: m.joinedAt
            }));

        res.json(channels);
    } catch (error) {
        console.error('Get channels error:', error);
        res.status(500).json({ error: '获取频道列表失败' });
    }
});

// Get all available channels (for joining)
router.get('/available', verifyToken, async (req, res) => {
    try {
        // Get all channels
        const allChannels = await Channel.find().sort({ isDefault: -1, name: 1 });

        // Get channels user is already member of
        const memberships = await ChannelMember.find({ userId: req.user.userId });
        const memberChannelIds = memberships.map(m => m.channelId.toString());

        // Filter out channels user is already in
        const availableChannels = allChannels
            .filter(ch => !memberChannelIds.includes(ch._id.toString()))
            .map(ch => ({
                id: ch._id,
                name: ch.name,
                description: ch.description,
                icon: ch.icon,
                isDefault: ch.isDefault
            }));

        res.json(availableChannels);
    } catch (error) {
        console.error('Get available channels error:', error);
        res.status(500).json({ error: '获取可用频道失败' });
    }
});

// Create new channel (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, icon } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: '频道名称至少2个字符' });
        }

        // Check if channel name already exists
        const existing = await Channel.findOne({ name: name.trim() });
        if (existing) {
            return res.status(409).json({ error: '频道名称已存在' });
        }

        const channel = new Channel({
            name: name.trim(),
            description: description || '',
            icon: icon || 'ph-hash',
            createdBy: req.user.userId,
            isDefault: false
        });

        await channel.save();

        // Auto-join creator to channel
        await ChannelMember.create({
            userId: req.user.userId,
            channelId: channel._id
        });

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
        console.error('Create channel error:', error);
        res.status(500).json({ error: '创建频道失败' });
    }
});

// Join a channel
router.post('/:channelId/join', verifyToken, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Check if channel exists
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ error: '频道不存在' });
        }

        // Check if already a member
        const existing = await ChannelMember.findOne({
            userId: req.user.userId,
            channelId
        });

        if (existing) {
            return res.status(409).json({ error: '已经加入该频道' });
        }

        // Join channel
        await ChannelMember.create({
            userId: req.user.userId,
            channelId
        });

        res.json({ message: '加入频道成功' });
    } catch (error) {
        console.error('Join channel error:', error);
        res.status(500).json({ error: '加入频道失败' });
    }
});

// Leave a channel (cannot leave default channel)
router.post('/:channelId/leave', verifyToken, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Check if it's default channel
        const channel = await Channel.findById(channelId);
        if (channel && channel.isDefault) {
            return res.status(400).json({ error: '无法离开默认频道' });
        }

        // Remove membership
        await ChannelMember.deleteOne({
            userId: req.user.userId,
            channelId
        });

        res.json({ message: '离开频道成功' });
    } catch (error) {
        console.error('Leave channel error:', error);
        res.status(500).json({ error: '离开频道失败' });
    }
});

// Get channel messages
router.get('/:channelId/messages', verifyToken, async (req, res) => {
    try {
        const { channelId } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        // Verify user is member of channel
        const membership = await ChannelMember.findOne({
            userId: req.user.userId,
            channelId
        });

        if (!membership) {
            return res.status(403).json({ error: '您不是该频道成员' });
        }

        const messages = await Message.find({
            channelId,
            isDeleted: false
        })
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json(messages.reverse());
    } catch (error) {
        console.error('Get channel messages error:', error);
        res.status(500).json({ error: '获取消息失败' });
    }
});

module.exports = router;
