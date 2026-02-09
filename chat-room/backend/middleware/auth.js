// ===== 引入 jsonwebtoken 库 =====
// JWT（JSON Web Token）是一种用于身份认证的技术
// 用户登录后，服务器会生成一个 token（令牌），就像一张"门票"
// 用户之后的每次请求都要带上这张"门票"，服务器验证后才允许访问
const jwt = require('jsonwebtoken');

// ===== 定义 JWT 密钥 =====
// 这个密钥用于加密和解密 token，就像一把"钥匙"
// process.env.JWT_SECRET 从环境变量中读取（生产环境用，更安全）
// || 后面的是默认值（只用于开发环境）
// 注意：生产环境中一定要更换为复杂的密钥！
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ===== 验证 Token 的中间件函数 =====
// 中间件：在处理请求之前先执行的函数，用于验证用户身份
// req：请求对象，包含客户端发送的数据
// res：响应对象，用于向客户端发送数据
// next：继续执行下一个函数（如果验证通过）
const verifyToken = (req, res, next) => {
    // ===== 从请求头中获取 token =====
    // req.headers.authorization 通常是 "Bearer xxxxx" 格式
    // ?. 是可选链操作符，如果 authorization 不存在不会报错
    // split(' ') 把字符串按空格分割成数组，例如："Bearer abc123" -> ["Bearer", "abc123"]
    // [1] 取第二个元素，也就是实际的 token
    const token = req.headers.authorization?.split(' ')[1];

    // ===== 检查是否提供了 token =====
    if (!token) {
        // 如果没有 token，返回 401 状态码（未授权）
        // json() 方法发送 JSON 格式的错误信息
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    // ===== 验证 token 是否有效 =====
    try {
        // jwt.verify() 方法验证 token 是否有效
        // 参数1：要验证的 token
        // 参数2：用于验证的密钥
        // 如果验证成功，会返回 token 中的数据（解密后的用户信息）
        const decoded = jwt.verify(token, JWT_SECRET);

        // ===== 将用户信息附加到请求对象上 =====
        // 把解密后的用户信息（如 userId, username）存到 req.user 中
        // 这样后续的路由处理函数就可以通过 req.user 访问用户信息
        req.user = decoded;

        // ===== 继续执行下一个函数 =====
        // next() 表示验证通过，继续执行后续的路由处理函数
        next();

    } catch (error) {
        // ===== 如果 token 无效，返回错误 =====
        // 可能的原因：
        // 1. token 被篡改了
        // 2. token 过期了
        // 3. token 格式不正确
        return res.status(401).json({ error: '无效的认证令牌' });
    }
};

// ===== 导出函数和密钥 =====
// verifyToken：给路由使用，保护需要登录才能访问的接口
// JWT_SECRET：给其他文件使用，用于生成 token（如登录时）
module.exports = { verifyToken, JWT_SECRET };
