const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
messageSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
