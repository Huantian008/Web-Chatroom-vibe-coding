const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-room';
        const conn = await mongoose.connect(uri);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
