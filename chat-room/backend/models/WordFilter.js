const mongoose = require('mongoose');

const wordFilterSchema = new mongoose.Schema({
    word: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

wordFilterSchema.index({ word: 1 });
wordFilterSchema.index({ isActive: 1 });

module.exports = mongoose.model('WordFilter', wordFilterSchema);
