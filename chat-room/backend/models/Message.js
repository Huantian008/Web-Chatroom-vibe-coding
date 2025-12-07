// ===== 引入 mongoose 库 =====
// 用于定义消息的数据结构
const mongoose = require('mongoose');

// ===== 定义消息的数据结构（Schema） =====
// 每条聊天消息都会存储在数据库中
const messageSchema = new mongoose.Schema({
    // ----- 发送者用户名 -----
    username: {
        type: String,              // 数据类型是字符串
        required: true             // 必填项，每条消息都要知道是谁发的
    },

    // ----- 发送者用户ID -----
    userId: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
        ref: 'User',                           // 引用 User 模型，指向发送消息的用户
        default: null                          // 默认为空（系统消息可能没有用户ID）
    },

    // ----- 消息内容 -----
    message: {
        type: String,              // 数据类型是字符串
        required: true,            // 必填项，消息不能为空
        trim: true                 // 自动去掉前后空格
    },

    // ----- 所属频道ID -----
    channelId: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
        ref: 'Channel',                        // 引用 Channel 模型，表示消息属于哪个频道
        required: true,                        // 必填项，每条消息都要属于某个频道
        index: true                            // 创建索引，因为经常需要按频道查询消息
    },

    // ----- 消息类型 -----
    messageType: {
        type: String,              // 数据类型是字符串
        enum: ['user', 'system', 'ai'],  // 只能是这三个值之一：
                                         // 'user' - 普通用户消息
                                         // 'system' - 系统消息（如"用户加入频道"）
                                         // 'ai' - AI助手消息
        default: 'user'            // 默认是用户消息
    },

    // ----- 是否已删除 -----
    isDeleted: {
        type: Boolean,             // 数据类型是布尔值（true 或 false）
        default: false             // 默认不删除
                                   // 这是"软删除"：消息还在数据库里，但标记为已删除
                                   // 好处是可以恢复，也可以用于审计
    },

    // ----- 发送时间 -----
    timestamp: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间，发送消息时自动记录
    }
});

// ===== 创建索引以提高查询速度 =====
// 索引就像书的目录，可以让查找更快

// 复合索引：按频道ID和时间倒序排列
// 为什么？因为我们经常需要"获取某个频道的最新消息"
// channelId: 1 表示按频道ID升序，timestamp: -1 表示按时间降序（最新的在前面）
messageSchema.index({ channelId: 1, timestamp: -1 });

// 为 userId 字段创建索引
// 为什么？因为可能需要查找某个用户发送的所有消息
messageSchema.index({ userId: 1 });

// 为 timestamp 字段创建索引
// 为什么？因为可能需要按时间查询消息
messageSchema.index({ timestamp: -1 });

// ===== 导出消息模型 =====
// mongoose.model('Message', messageSchema) 创建一个名为 'Message' 的模型
// 这个模型对应数据库中的 'messages' 集合
// 导出后，其他文件就可以用这个模型来创建、查询、修改、删除消息
module.exports = mongoose.model('Message', messageSchema);
