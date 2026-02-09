// ===== 引入 mongoose 库 =====
// 用于定义频道成员关系的数据结构
const mongoose = require('mongoose');

// ===== 定义频道成员的数据结构（Schema） =====
// 这个模型用于记录"哪个用户加入了哪个频道"
// 就像是一个"会员名单"，记录了用户和频道之间的关系
const channelMemberSchema = new mongoose.Schema({
    // ----- 用户ID -----
    userId: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
        ref: 'User',                           // 引用 User 模型，指向某个用户
        required: true,                        // 必填项，必须知道是哪个用户
        index: true                            // 创建索引，因为经常需要查询某个用户加入了哪些频道
    },

    // ----- 频道ID -----
    channelId: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
        ref: 'Channel',                        // 引用 Channel 模型，指向某个频道
        required: true,                        // 必填项，必须知道是哪个频道
        index: true                            // 创建索引，因为经常需要查询某个频道有哪些成员
    },

    // ----- 加入时间 -----
    joinedAt: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间，用户加入频道时自动记录
    },

    // ----- 最后阅读时间 -----
    lastReadAt: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间
                                   // 这个字段可以用来实现"未读消息"功能
                                   // 比较消息时间和 lastReadAt，就能知道哪些消息是未读的
    }
});

// ===== 创建复合唯一索引 =====
// 这是一个特殊的索引，同时对两个字段创建索引，并且保证唯一性
// { userId: 1, channelId: 1 } 表示：按用户ID和频道ID的组合创建索引
// { unique: true } 表示：同一个用户不能重复加入同一个频道
// 例如：用户A只能加入频道X一次，不能加入两次
channelMemberSchema.index({ userId: 1, channelId: 1 }, { unique: true });

// ===== 导出频道成员模型 =====
// mongoose.model('ChannelMember', channelMemberSchema) 创建一个名为 'ChannelMember' 的模型
// 这个模型对应数据库中的 'channelmembers' 集合
// 导出后，其他文件就可以用这个模型来：
// - 记录用户加入频道
// - 查询某个频道的所有成员
// - 查询某个用户加入了哪些频道
// - 防止用户重复加入同一个频道
module.exports = mongoose.model('ChannelMember', channelMemberSchema);
