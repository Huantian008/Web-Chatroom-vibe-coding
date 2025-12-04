const WordFilter = require('../models/WordFilter');

// Cache for better performance
let filterCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const updateFilterCache = async () => {
    try {
        const filters = await WordFilter.find({ isActive: true }).select('word');
        filterCache = filters.map(f => f.word.toLowerCase());
        lastCacheUpdate = Date.now();
        console.log(`✅ Word filter cache updated: ${filterCache.length} words`);
    } catch (error) {
        console.error('❌ Error updating filter cache:', error);
    }
};

const containsBlacklistedWord = (message) => {
    const lowerMessage = message.toLowerCase();
    return filterCache.some(word => lowerMessage.includes(word));
};

const checkWordFilter = async (message) => {
    // Update cache if expired or empty
    if (filterCache.length === 0 || Date.now() - lastCacheUpdate > CACHE_DURATION) {
        await updateFilterCache();
    }

    return containsBlacklistedWord(message);
};

module.exports = { checkWordFilter, updateFilterCache };
