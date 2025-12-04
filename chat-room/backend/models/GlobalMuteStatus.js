const mongoose = require('mongoose');

const globalMuteStatusSchema = new mongoose.Schema({
    isEnabled: {
        type: Boolean,
        default: false
    },
    enabledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    enabledAt: {
        type: Date,
        default: null
    },
    reason: {
        type: String,
        default: ''
    }
});

// Singleton pattern - only one document
module.exports = mongoose.model('GlobalMuteStatus', globalMuteStatusSchema);
