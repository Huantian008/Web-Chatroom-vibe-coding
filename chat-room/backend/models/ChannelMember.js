const mongoose = require('mongoose');

const channelMemberSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    channelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Channel',
        required: true,
        index: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    lastReadAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index to prevent duplicate memberships
channelMemberSchema.index({ userId: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.model('ChannelMember', channelMemberSchema);
