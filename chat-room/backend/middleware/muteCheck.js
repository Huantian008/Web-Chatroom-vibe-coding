const User = require('../models/User');
const GlobalMuteStatus = require('../models/GlobalMuteStatus');
const adminHelper = require('../utils/adminHelper');

const checkMuteStatus = async (userId, username) => {
    // Check global mute first (skip for admins)
    if (!adminHelper.isAdmin(username)) {
        const globalMute = await GlobalMuteStatus.findOne();
        if (globalMute && globalMute.isEnabled) {
            return {
                isMuted: true,
                reason: globalMute.reason || '全局禁言已启用',
                isGlobal: true
            };
        }
    }

    // Check individual user mute
    const user = await User.findById(userId);
    if (user && user.isMuted) {
        // Check if mute has expired
        if (user.mutedUntil && new Date() > user.mutedUntil) {
            // Unmute user automatically
            user.isMuted = false;
            user.mutedUntil = null;
            user.mutedBy = null;
            user.mutedReason = null;
            await user.save();
            console.log(`✅ Auto-unmuted user: ${username}`);
            return { isMuted: false };
        }

        return {
            isMuted: true,
            reason: user.mutedReason || '您已被禁言',
            until: user.mutedUntil,
            isGlobal: false
        };
    }

    return { isMuted: false };
};

module.exports = { checkMuteStatus };
