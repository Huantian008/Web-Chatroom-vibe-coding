// ===== 引入所需的模块 =====

// dotenv：用于加载 .env 文件中的环境变量
// .config()：读取 .env 文件并将变量加载到 process.env 中
require('dotenv').config();

// mongoose：MongoDB 数据库连接库
const mongoose = require('mongoose');

// 引入数据模型
const Channel = require('../models/Channel');              // 频道模型
const ChannelMember = require('../models/ChannelMember');  // 频道成员模型
const User = require('../models/User');                    // 用户模型

// 引入数据库连接函数
const connectDB = require('../config/database');

// ===== 定义数据库初始化的主函数 =====
// 这个函数的作用：
// 1. 创建默认的 "general" 频道（如果不存在）
// 2. 将所有现有用户自动加入默认频道
// async 表示这是异步函数
async function initDatabase() {
    // try-catch：错误处理
    try {
        // ===== 第一步：连接到数据库 =====
        // await connectDB()：等待数据库连接完成
        await connectDB();

        // ===== 打印开始信息 =====
        console.log('🚀 Initializing database...\n');

        // ===== 第二步：创建或查找默认频道 =====
        // 查找是否已经有默认频道（isDefault: true）
        let generalChannel = await Channel.findOne({ isDefault: true });

        // ===== 如果默认频道不存在，创建一个 =====
        if (!generalChannel) {
            // 创建新的频道对象
            generalChannel = new Channel({
                name: 'general',                          // 频道名称
                description: '默认频道，所有用户自动加入', // 频道描述
                isDefault: true,                          // 标记为默认频道
                createdBy: null,                          // 没有创建者（系统创建）
                icon: 'ph-hash'                           // 频道图标
            });

            // 保存到数据库
            await generalChannel.save();

            // 打印成功信息
            console.log('✅ Created default "general" channel');

        } else {
            // ===== 如果默认频道已存在 =====
            console.log('✅ Default channel already exists');
        }

        // ===== 第三步：将所有现有用户加入默认频道 =====
        // 为什么要这样做？
        // 因为可能有用户是在默认频道创建之前注册的
        // 所以需要把这些"老用户"也加入到默认频道中

        // 查询数据库中的所有用户
        const users = await User.find();

        // joinedCount：记录有多少用户被加入到默认频道
        let joinedCount = 0;

        // ===== 遍历每个用户 =====
        // for...of 循环：遍历数组中的每个元素
        for (const user of users) {
            // ===== 检查用户是否已经在默认频道中 =====
            // 查找频道成员关系
            const existing = await ChannelMember.findOne({
                userId: user._id,              // 用户ID
                channelId: generalChannel._id   // 默认频道ID
            });

            // ===== 如果用户还不是频道成员，就加入 =====
            if (!existing) {
                // 创建频道成员关系
                await ChannelMember.create({
                    userId: user._id,              // 用户ID
                    channelId: generalChannel._id   // 默认频道ID
                });

                // 计数器加1
                joinedCount++;
            }
        }

        // ===== 第四步：打印完成信息 =====
        console.log(`✅ Joined ${joinedCount} existing user(s) to default channel`);
        console.log(`\n✨ Database initialization complete!`);

        // 打印详细信息
        console.log(`\nChannel ID: ${generalChannel._id}`);
        console.log(`Channel Name: ${generalChannel.name}`);
        console.log(`Total Users: ${users.length}`);

        // ===== 第五步：退出程序 =====
        // process.exit(0)：退出 Node.js 程序
        // 参数 0 表示正常退出（成功）
        process.exit(0);

    } catch (error) {
        // ===== 如果发生错误 =====
        // 打印错误信息
        console.error('❌ Initialization error:', error);

        // 退出程序
        // 参数 1 表示因错误退出（失败）
        process.exit(1);
    }
}

// ===== 执行初始化函数 =====
// 直接调用 initDatabase() 函数，开始初始化
// 这个脚本的使用方式：在终端运行 node initDatabase.js
initDatabase();
