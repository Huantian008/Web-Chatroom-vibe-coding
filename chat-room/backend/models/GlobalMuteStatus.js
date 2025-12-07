// ===== 引入 mongoose 库 =====
// 用于定义全局禁言状态的数据结构
const mongoose = require('mongoose');

// ===== 定义全局禁言状态的数据结构（Schema） =====
// 这个模型用于控制"全局禁言"功能
// 当开启全局禁言时，除了管理员以外的所有用户都不能发言
// 这在紧急情况下很有用（比如有人刷屏、发广告等）
const globalMuteStatusSchema = new mongoose.Schema({
    // ----- 是否开启全局禁言 -----
    isEnabled: {
        type: Boolean,             // 数据类型是布尔值（true 或 false）
        default: false             // 默认不开启
                                   // true 表示全局禁言开启，所有非管理员用户不能发言
                                   // false 表示全局禁言关闭，所有用户都可以正常发言
    },

    // ----- 开启者 -----
    enabledBy: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 ObjectId
        ref: 'User',                           // 引用 User 模型，指向开启全局禁言的管理员
        default: null                          // 默认为空
                                               // 如果没有开启，这个字段就是 null
    },

    // ----- 开启时间 -----
    enabledAt: {
        type: Date,                // 数据类型是日期
        default: null              // 默认为空
                                   // 记录全局禁言是什么时候开启的
    },

    // ----- 原因 -----
    reason: {
        type: String,              // 数据类型是字符串
        default: ''                // 默认为空字符串
                                   // 管理员可以填写开启全局禁言的原因
                                   // 例如："有人恶意刷屏，临时禁言"
    }
});

// ===== 单例模式 =====
// 这个注释说明：这个模型只有一条记录（Singleton pattern）
// 为什么只有一条记录？
// 因为全局禁言状态是整个系统唯一的，不需要多条记录
// 就像一个"总开关"，只有一个开关状态

// ===== 导出全局禁言状态模型 =====
// mongoose.model('GlobalMuteStatus', globalMuteStatusSchema) 创建一个名为 'GlobalMuteStatus' 的模型
// 这个模型对应数据库中的 'globalmutestatuses' 集合
// 导出后，其他文件就可以用这个模型来：
// - 开启全局禁言
// - 关闭全局禁言
// - 查询全局禁言状态
// - 记录谁在什么时候开启了全局禁言以及原因
module.exports = mongoose.model('GlobalMuteStatus', globalMuteStatusSchema);
