const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    description: {
        type: String,
        default: '',
        maxlength: 200
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    icon: {
        type: String,
        default: 'ph-hash'  // Phosphor icon name
    }
});

// Index for faster queries
channelSchema.index({ isDefault: 1 });
channelSchema.index({ name: 1 });

module.exports = mongoose.model('Channel', channelSchema);
