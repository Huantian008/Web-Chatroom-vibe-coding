// ===== 引入 mongoose 库 =====
// 用于定义敏感词过滤的数据结构
const mongoose = require('mongoose');

// ===== 定义敏感词的数据结构（Schema） =====
// 这个模型用于存储需要过滤的敏感词（脏话、广告等不良内容）
// 当用户发送消息时，系统会检查消息中是否包含这些敏感词
const wordFilterSchema = new mongoose.Schema({
    // ----- 敏感词 -----
    word: {
        type: String,              // 数据类型是字符串
        required: true,            // 必填项，必须指定敏感词是什么
        unique: true,              // 必须唯一，不能添加重复的敏感词
        lowercase: true,           // 自动转换为小写字母
                                   // 这样可以不区分大小写，"FUCK" 和 "fuck" 会被视为同一个词
        trim: true                 // 自动去掉前后空格
    },

    // ----- 添加者 -----
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
        ref: 'User',                           // 引用 User 模型，指向添加这个敏感词的管理员
        required: true                         // 必填项，要知道是哪个管理员添加的
    },

    // ----- 添加时间 -----
    addedAt: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间，添加敏感词时自动记录
    },

    // ----- 是否激活 -----
    isActive: {
        type: Boolean,             // 数据类型是布尔值（true 或 false）
        default: true              // 默认激活（生效）
                                   // 为什么需要这个字段？
                                   // 因为有时候可能需要临时禁用某个敏感词，而不是删除它
                                   // 这样以后还可以重新启用
    }
});

// ===== 创建索引以提高查询速度 =====
// 索引就像书的目录，可以让查找更快

// 为 word 字段创建索引
// 为什么？因为每次用户发送消息时，都需要查询敏感词库
// 索引可以让查询更快，提高系统性能
wordFilterSchema.index({ word: 1 });

// 为 isActive 字段创建索引
// 为什么？因为我们只需要查询激活的敏感词（isActive: true）
// 不需要查询被禁用的敏感词
wordFilterSchema.index({ isActive: 1 });

// ===== 导出敏感词模型 =====
// mongoose.model('WordFilter', wordFilterSchema) 创建一个名为 'WordFilter' 的模型
// 这个模型对应数据库中的 'wordfilters' 集合
// 导出后，其他文件就可以用这个模型来：
// - 添加新的敏感词
// - 查询所有敏感词
// - 删除敏感词
// - 启用或禁用敏感词
// - 检查消息是否包含敏感词
module.exports = mongoose.model('WordFilter', wordFilterSchema);
