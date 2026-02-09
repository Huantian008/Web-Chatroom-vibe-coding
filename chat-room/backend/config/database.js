// ===== 引入 mongoose 库 =====
// mongoose 是一个 Node.js 的 MongoDB 对象建模工具
// 它让我们可以用 JavaScript 代码来操作 MongoDB 数据库
// 就像是 JavaScript 和 MongoDB 之间的"翻译官"
const mongoose = require('mongoose');

// ===== 定义连接数据库的函数 =====
// async 关键字表示这是一个异步函数，因为连接数据库需要时间
// 异步函数可以让程序在等待数据库连接的同时，继续做其他事情（不会卡住）
const connectDB = async () => {
    // try-catch 是错误处理机制
    // try 里放我们要执行的代码，如果出错了就会跳到 catch 里
    try {
        // ===== 检查是否已经有活动连接 =====
        // 在测试环境中，测试框架可能已经建立了连接
        // mongoose.connection.readyState 返回连接状态：
        //   0 = 断开连接, 1 = 已连接, 2 = 正在连接, 3 = 正在断开
        if (mongoose.connection.readyState === 1) {
            console.log(`✅ MongoDB Already Connected: ${mongoose.connection.host}`);
            return; // 如果已连接，直接返回，不再重复连接
        }

        // ===== 获取数据库连接地址 =====
        // process.env.MONGODB_URI 是从环境变量中读取数据库地址（生产环境用）
        // || 是"或"运算符，如果左边不存在，就用右边的默认值
        // 'mongodb://localhost:27017/chat-room' 是本地数据库地址：
        //   - localhost:27017 是数据库服务器地址和端口
        //   - chat-room 是数据库名称
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-room';

        // ===== 连接到 MongoDB 数据库 =====
        // await 关键字表示等待连接完成后再继续执行
        // mongoose.connect() 方法用于建立数据库连接
        // conn 变量保存连接对象，里面包含连接的详细信息
        const conn = await mongoose.connect(uri);

        // ===== 连接成功后打印提示信息 =====
        // console.log 用于在控制台输出信息
        // ${conn.connection.host} 是模板字符串语法，会显示数据库服务器地址
        // 这样我们就知道成功连接到了哪个数据库
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        // ===== 如果连接失败，执行这里的代码 =====

        // console.error 用于输出错误信息（会显示为红色）
        // error.message 是错误的具体描述信息
        console.error(`❌ MongoDB Connection Error: ${error.message}`);

        // ===== 退出程序（仅在非测试环境） =====
        // process.env.NODE_ENV 可以判断当前运行环境
        // 在测试环境中不应该调用 process.exit(1)，因为会终止测试进程
        // 而是应该抛出错误，让测试框架处理
        if (process.env.NODE_ENV !== 'test') {
            // process.exit(1) 会终止 Node.js 程序
            // 参数 1 表示程序因错误退出（0 表示正常退出）
            // 为什么要退出？因为没有数据库，程序无法正常运行
            process.exit(1);
        } else {
            // 在测试环境中，抛出错误而不是退出进程
            throw error;
        }
    }
};

// ===== 导出函数 =====
// module.exports 用于将函数导出，让其他文件可以使用
// 这样在 server.js 中就可以 require 这个文件并调用 connectDB 函数
module.exports = connectDB;
