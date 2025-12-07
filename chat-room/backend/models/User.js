// ===== 引入所需的库 =====

// mongoose：用于定义和操作 MongoDB 数据库的模型
const mongoose = require('mongoose');

// bcrypt：用于密码加密的库，让密码更安全
// 它可以把 "123456" 这样的明文密码加密成 "$2b$10$xxx..." 这样的乱码
const bcrypt = require('bcrypt');

// ===== 定义用户的数据结构（Schema） =====
// Schema 就像是一个"模板"，规定了用户数据应该包含哪些字段
// 就像填表格一样，这里定义了表格的格式
const userSchema = new mongoose.Schema({
    // ----- 用户名字段 -----
    username: {
        type: String,              // 数据类型是字符串
        required: true,            // 必填项，不能为空
        unique: true,              // 必须唯一，不能有两个相同的用户名
        trim: true,                // 自动去掉前后空格，"  admin  " 会变成 "admin"
        minlength: 2,              // 最少2个字符
        maxlength: 20              // 最多20个字符
    },

    // ----- 密码字段 -----
    password: {
        type: String,              // 数据类型是字符串
        required: true,            // 必填项
        minlength: 6               // 最少6个字符（为了安全）
    },

    // ----- 创建时间 -----
    createdAt: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间，创建用户时自动记录
    },

    // ----- 最后登录时间 -----
    lastLogin: {
        type: Date,                // 数据类型是日期
        default: Date.now          // 默认值是当前时间
    },

    // ----- 用户角色 -----
    role: {
        type: String,              // 数据类型是字符串
        enum: ['user', 'admin'],   // 只能是这两个值之一：普通用户或管理员
        default: 'user'            // 默认是普通用户
    },

    // ----- 是否被禁言 -----
    isMuted: {
        type: Boolean,             // 数据类型是布尔值（true 或 false）
        default: false             // 默认不禁言
    },

    // ----- 禁言截止时间 -----
    mutedUntil: {
        type: Date,                // 数据类型是日期
        default: null              // 默认为空，如果有值表示禁言到某个时间
    },

    // ----- 谁禁言了这个用户 -----
    mutedBy: {
        type: mongoose.Schema.Types.ObjectId,  // 数据类型是 MongoDB 的 ObjectId
                                                 // ObjectId 是 MongoDB 自动生成的唯一标识符
        ref: 'User',                           // 引用 User 模型，指向另一个用户（管理员）
        default: null                          // 默认为空
    },

    // ----- 禁言原因 -----
    mutedReason: {
        type: String,              // 数据类型是字符串
        default: null              // 默认为空，管理员可以填写禁言理由
    }
});

// ===== 密码加密的钩子函数 =====
// 这是一个"中间件"，在保存用户到数据库之前自动执行
// pre('save') 表示在保存之前触发
userSchema.pre('save', async function() {
    // 检查密码是否被修改过
    // 如果密码没有改变，就不需要重新加密，直接返回
    // 为什么要检查？因为每次保存用户数据都会触发这个函数
    // 但我们只需要在密码第一次创建或修改时加密
    if (!this.isModified('password')) return;

    // ===== 生成盐值（salt） =====
    // 盐值是一个随机字符串，用来让加密更安全
    // 参数 10 是"成本因子"，越大越安全但也越慢
    // await 表示等待生成完成（因为这需要时间）
    const salt = await bcrypt.genSalt(10);

    // ===== 加密密码 =====
    // bcrypt.hash() 把明文密码和盐值混合在一起，生成加密后的密码
    // 例如："123456" -> "$2b$10$abcd1234..." 这样的乱码
    // this.password 指向当前用户对象的密码字段
    this.password = await bcrypt.hash(this.password, salt);
});

// ===== 定义一个密码对比方法 =====
// 这是给用户模型添加一个自定义方法，用于登录时验证密码
// userSchema.methods 用于定义实例方法（每个用户对象都可以调用）
userSchema.methods.comparePassword = async function(candidatePassword) {
    // candidatePassword 是用户登录时输入的密码（明文）
    // this.password 是数据库中存储的加密密码

    // bcrypt.compare() 会自动进行以下操作：
    // 1. 用相同的盐值加密用户输入的密码
    // 2. 对比两个加密后的密码是否一致
    // 3. 返回 true（密码正确）或 false（密码错误）
    return await bcrypt.compare(candidatePassword, this.password);
};

// ===== 创建索引以提高查询速度 =====
// 索引就像书的目录，可以让查找更快

// 为 username 字段创建索引
// 参数 1 表示升序排列，-1 表示降序
// 因为经常需要通过用户名查找用户，所以创建索引可以加快速度
userSchema.index({ username: 1 });

// 为 role 字段创建索引
// 因为可能需要查找所有管理员或所有普通用户
userSchema.index({ role: 1 });

// ===== 导出用户模型 =====
// mongoose.model('User', userSchema) 创建一个名为 'User' 的模型
// 这个模型对应数据库中的 'users' 集合（MongoDB 会自动把 User 变成复数 users）
// 导出后，其他文件就可以用这个模型来创建、查询、修改、删除用户
module.exports = mongoose.model('User', userSchema);
