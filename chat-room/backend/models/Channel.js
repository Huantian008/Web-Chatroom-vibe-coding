// ===== 引入 mongoose 库 =====
// 用于定义频道的数据结构
const mongoose = require('mongoose');

// ===== 定义频道的数据结构（Schema） =====
// 频道就像 QQ 群或微信群，用户可以在频道里聊天
const channelSchema = new mongoose.Schema({
    // ----- 频道名称 -----
    name: {
        type: String,              // 数据类型是字符串
        required: true,            // 必填项，每个频道都要有名字
        trim: true,                // 自动去掉前后空格
        minlength: 2,              // 最少2个字符
        maxlength: 50              // 最多50个字符
    },

    // ----- 频道描述 -----
    description: {
        type: String,              // 数据类型是字符串
        default: '',               // 默认为空字符串（可以不填写描述）
        maxlength: 200             // 最多200个字符
    },

    // ----- 创建者 -----
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
                                                 // ObjectId 是 MongoDB 中的唯一标识符
        ref: 'User',                           // 引用 User 模型，表示这是哪个用户创建的
                                                 // 这样我们就能知道频道的创建者是谁
        default: null                          // 默认为空（系统创建的默认频道可以没有创建者）
    },

    // ----- 是否为默认频道 -----
    isDefault: {
        type: Boolean,             // 数据类型是布尔值（true 或 false）
        default: false             // 默认不是默认频道
                                   // 默认频道是新用户注册后自动加入的频道（通常是 "general"）
    },

    // ----- 创建时间 -----
    createdAt: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间，创建频道时自动记录
    },

    // ----- 频道图标 -----
    icon: {
        type: String,              // 数据类型是字符串
        default: 'ph-hash'         // 默认图标是 'ph-hash'（井号图标）
                                   // 这是 Phosphor 图标库中的图标名称
                                   // 前端会根据这个名称显示对应的图标
    }
});

// ===== 创建索引以提高查询速度 =====
// 索引就像书的目录，可以让查找更快

// 为 isDefault 字段创建索引
// 为什么？因为我们经常需要查找默认频道（新用户注册时需要）
channelSchema.index({ isDefault: 1 });

// 为 name 字段创建索引
// 为什么？因为可能需要通过频道名称来查找频道
channelSchema.index({ name: 1 });

// ===== 导出频道模型 =====
// mongoose.model('Channel', channelSchema) 创建一个名为 'Channel' 的模型
// 这个模型对应数据库中的 'channels' 集合
// 导出后，其他文件就可以用这个模型来创建、查询、修改、删除频道
module.exports = mongoose.model('Channel', channelSchema);
