// ===== 引入敏感词模型 =====
// 用于从数据库中查询敏感词
const WordFilter = require('../models/WordFilter');

// ===== 缓存机制（为了提高性能） =====
// 为什么要缓存？
// 因为每次用户发送消息都要检查敏感词，如果每次都查询数据库会很慢
// 所以我们把敏感词列表存在内存中（缓存），这样查询就很快了

// filterCache：存储敏感词的数组，例如：['fuck', 'shit', '广告']
let filterCache = [];

// lastCacheUpdate：上次更新缓存的时间（毫秒时间戳）
let lastCacheUpdate = 0;

// CACHE_DURATION：缓存有效期，5分钟 = 5 * 60 * 1000 毫秒
// 为什么要过期？因为管理员可能会添加或删除敏感词，需要定期刷新缓存
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ===== 更新敏感词缓存的函数 =====
// async 表示这是异步函数，因为需要从数据库查询数据
const updateFilterCache = async () => {
    // try-catch 用于捕获错误（如果数据库连接失败等）
    try {
        // ===== 从数据库中查询所有激活的敏感词 =====
        // WordFilter.find({ isActive: true })：查找所有 isActive 为 true 的敏感词
        // .select('word')：只返回 word 字段，不返回其他字段（节省内存和时间）
        // await 表示等待查询完成
        const filters = await WordFilter.find({ isActive: true }).select('word');

        // ===== 将查询结果转换为小写字符串数组 =====
        // filters.map()：遍历每个敏感词对象
        // f => f.word.toLowerCase()：取出 word 字段并转换为小写
        // 为什么转小写？这样可以不区分大小写进行匹配
        // 例如：数据库中存的是 "FUCK"，转换后是 "fuck"
        filterCache = filters.map(f => f.word.toLowerCase());

        // ===== 记录更新时间 =====
        // Date.now() 返回当前时间的毫秒时间戳
        lastCacheUpdate = Date.now();

        // ===== 打印日志 =====
        // 输出缓存中有多少个敏感词
        console.log(`✅ Word filter cache updated: ${filterCache.length} words`);

    } catch (error) {
        // ===== 如果查询出错，打印错误信息 =====
        console.error('❌ Error updating filter cache:', error);
    }
};

// ===== 检查消息是否包含敏感词的函数 =====
// 参数 message：用户发送的消息内容
const containsBlacklistedWord = (message) => {
    // ===== 将消息转换为小写 =====
    // 为什么？因为缓存中的敏感词都是小写的
    // 这样可以不区分大小写进行匹配
    const lowerMessage = message.toLowerCase();

    // ===== 检查消息中是否包含任何敏感词 =====
    // filterCache.some()：遍历敏感词数组，检查是否有任何一个敏感词满足条件
    // word => lowerMessage.includes(word)：检查消息中是否包含这个敏感词
    // includes() 方法：判断字符串中是否包含另一个字符串
    // 例如："你是个fuck".includes("fuck") 返回 true
    // some() 方法：只要有一个敏感词匹配，就返回 true；否则返回 false
    return filterCache.some(word => lowerMessage.includes(word));
};

// ===== 检查敏感词的主函数 =====
// 这是对外提供的接口，其他文件调用这个函数来检查消息
// 参数 message：用户发送的消息内容
const checkWordFilter = async (message) => {
    // ===== 检查缓存是否需要更新 =====
    // 两种情况需要更新：
    // 1. filterCache.length === 0：缓存为空（首次运行或被清空）
    // 2. Date.now() - lastCacheUpdate > CACHE_DURATION：缓存过期（超过5分钟）
    if (filterCache.length === 0 || Date.now() - lastCacheUpdate > CACHE_DURATION) {
        // 更新缓存（从数据库重新加载敏感词）
        await updateFilterCache();
    }

    // ===== 检查消息是否包含敏感词 =====
    // 调用上面定义的函数，返回 true（包含敏感词）或 false（不包含）
    return containsBlacklistedWord(message);
};

// ===== 导出函数 =====
// checkWordFilter：给其他文件使用，检查消息是否包含敏感词
// updateFilterCache：给其他文件使用，手动更新缓存（比如管理员添加敏感词后立即刷新）
module.exports = { checkWordFilter, updateFilterCache };
