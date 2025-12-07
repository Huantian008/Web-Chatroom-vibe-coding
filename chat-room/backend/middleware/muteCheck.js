// ===== 引入所需的模型和工具 =====

// User 模型：用于查询用户的禁言状态
const User = require('../models/User');

// GlobalMuteStatus 模型：用于查询全局禁言状态
const GlobalMuteStatus = require('../models/GlobalMuteStatus');

// adminHelper：用于检查用户是否是管理员
const adminHelper = require('../utils/adminHelper');

// ===== 检查禁言状态的函数 =====
// 这个函数用于判断用户是否被禁言，以及禁言的原因
// 参数 userId：用户ID
// 参数 username：用户名
// async 表示这是异步函数，因为需要查询数据库
const checkMuteStatus = async (userId, username) => {
    // ===== 第一步：检查全局禁言（管理员除外） =====
    // 为什么要先检查全局禁言？
    // 因为全局禁言的优先级更高，一旦开启，所有非管理员用户都不能发言

    // 检查用户是否是管理员
    // 如果不是管理员，才需要检查全局禁言
    if (!adminHelper.isAdmin(username)) {
        // ===== 从数据库中查询全局禁言状态 =====
        // GlobalMuteStatus.findOne()：查询全局禁言状态（只有一条记录）
        const globalMute = await GlobalMuteStatus.findOne();

        // ===== 如果全局禁言已开启 =====
        // globalMute 存在 && globalMute.isEnabled 为 true
        if (globalMute && globalMute.isEnabled) {
            // 返回禁言信息
            return {
                isMuted: true,                              // 是否被禁言：是
                reason: globalMute.reason || '全局禁言已启用',  // 禁言原因
                isGlobal: true                              // 是否是全局禁言：是
            };
        }
    }

    // ===== 第二步：检查单个用户的禁言状态 =====
    // 如果全局禁言没有开启（或用户是管理员），就检查用户自己是否被禁言

    // ===== 从数据库中查询用户信息 =====
    // User.findById(userId)：通过用户ID查找用户
    const user = await User.findById(userId);

    // ===== 如果用户存在且被禁言 =====
    if (user && user.isMuted) {
        // ===== 检查禁言是否已过期 =====
        // 为什么要检查过期？
        // 因为管理员可以设置定时禁言，例如禁言3天
        // 如果时间到了，需要自动解除禁言

        // user.mutedUntil：禁言截止时间
        // new Date()：当前时间
        // 如果当前时间 > 禁言截止时间，说明禁言已过期
        if (user.mutedUntil && new Date() > user.mutedUntil) {
            // ===== 自动解除禁言 =====
            // 清空所有禁言相关的字段
            user.isMuted = false;         // 不再禁言
            user.mutedUntil = null;       // 清空禁言截止时间
            user.mutedBy = null;          // 清空禁言者
            user.mutedReason = null;      // 清空禁言原因

            // ===== 保存到数据库 =====
            // await user.save()：将修改保存到数据库
            await user.save();

            // ===== 打印日志 =====
            console.log(`✅ Auto-unmuted user: ${username}`);

            // 返回：用户没有被禁言
            return { isMuted: false };
        }

        // ===== 如果禁言未过期，返回禁言信息 =====
        return {
            isMuted: true,                          // 是否被禁言：是
            reason: user.mutedReason || '您已被禁言',  // 禁言原因
            until: user.mutedUntil,                  // 禁言截止时间（如果是永久禁言，这个字段是 null）
            isGlobal: false                          // 是否是全局禁言：否（这是单个用户的禁言）
        };
    }

    // ===== 如果用户没有被禁言 =====
    // 返回：用户没有被禁言
    return { isMuted: false };
};

// ===== 导出函数 =====
// checkMuteStatus：给其他文件使用，检查用户是否被禁言
// 使用场景：
// 1. 用户发送消息时，先检查是否被禁言
// 2. Socket.io 事件处理中，检查用户状态
module.exports = { checkMuteStatus };
