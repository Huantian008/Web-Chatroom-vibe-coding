// ===== 引入管理员辅助工具 =====
// adminHelper 包含管理员相关的工具函数，比如检查用户是否是管理员
const adminHelper = require('../utils/adminHelper');

// ===== 要求管理员权限的中间件函数 =====
// 这个中间件用于保护只有管理员才能访问的接口
// 例如：创建频道、禁言用户、添加敏感词等操作都需要管理员权限
// req：请求对象，包含客户端发送的数据
// res：响应对象，用于向客户端发送数据
// next：继续执行下一个函数（如果验证通过）
const requireAdmin = (req, res, next) => {
    // ===== 获取用户名 =====
    // req.user 是在 auth.js 中间件中设置的，包含用户信息
    // ?. 是可选链操作符，如果 req.user 不存在不会报错，而是返回 undefined
    const username = req.user?.username;

    // ===== 检查用户是否是管理员 =====
    // 两个条件：
    // 1. !username：用户名不存在（用户未登录或 token 无效）
    // 2. !adminHelper.isAdmin(username)：用户不在管理员名单中
    // 如果满足任一条件，就拒绝访问
    if (!username || !adminHelper.isAdmin(username)) {
        // 返回 403 状态码（Forbidden，禁止访问）
        // 403 和 401 的区别：
        // - 401：未认证（没有登录）
        // - 403：已认证但没有权限（登录了但不是管理员）
        return res.status(403).json({
            error: '需要管理员权限'
        });
    }

    // ===== 继续执行下一个函数 =====
    // next() 表示验证通过，用户是管理员，继续执行后续的路由处理函数
    next();
};

// ===== 导出函数 =====
// requireAdmin：给路由使用，保护只有管理员才能访问的接口
// 使用方式：router.post('/api/admin/mute-user', verifyToken, requireAdmin, 禁言处理函数)
// 这样会先验证 token，再验证是否是管理员，最后才执行实际的禁言操作
module.exports = { requireAdmin };
