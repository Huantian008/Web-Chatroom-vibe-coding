require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');
const User = require('../models/User');
const connectDB = require('../config/database');

async function initDatabase() {
    try {
        await connectDB();

        console.log('🚀 Initializing database...\n');

        // Create default "general" channel
        let generalChannel = await Channel.findOne({ isDefault: true });

        if (!generalChannel) {
            generalChannel = new Channel({
                name: 'general',
                description: '默认频道，所有用户自动加入',
                isDefault: true,
                createdBy: null,
                icon: 'ph-hash'
            });

            await generalChannel.save();
            console.log('✅ Created default "general" channel');
        } else {
            console.log('✅ Default channel already exists');
        }

        // Auto-join all existing users to default channel
        const users = await User.find();
        let joinedCount = 0;

        for (const user of users) {
            const existing = await ChannelMember.findOne({
                userId: user._id,
                channelId: generalChannel._id
            });

            if (!existing) {
                await ChannelMember.create({
                    userId: user._id,
                    channelId: generalChannel._id
                });
                joinedCount++;
            }
        }

        console.log(`✅ Joined ${joinedCount} existing user(s) to default channel`);
        console.log(`\n✨ Database initialization complete!`);
        console.log(`\nChannel ID: ${generalChannel._id}`);
        console.log(`Channel Name: ${generalChannel.name}`);
        console.log(`Total Users: ${users.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Initialization error:', error);
        process.exit(1);
    }
}

initDatabase();
