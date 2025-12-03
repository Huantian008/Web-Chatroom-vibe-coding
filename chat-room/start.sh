#!/bin/bash

echo "🚀 Lumina Chat - 启动脚本"
echo "=========================="
echo ""

# 检查 MongoDB 是否安装
if ! command -v mongod &> /dev/null && ! command -v mongo &> /dev/null; then
    echo "❌ MongoDB 未安装！"
    echo ""
    echo "请按照以下步骤安装 MongoDB:"
    echo "1. 更新包列表: sudo apt update"
    echo "2. 安装 MongoDB: sudo apt install -y mongodb"
    echo "3. 启动服务: sudo service mongodb start"
    echo ""
    echo "或者使用 MongoDB Atlas 云数据库:"
    echo "- 访问: https://www.mongodb.com/cloud/atlas"
    echo "- 创建免费集群并获取连接字符串"
    echo "- 在 backend/.env 中配置 MONGODB_URI"
    exit 1
fi

# 启动 MongoDB（如果未运行）
echo "📦 检查 MongoDB 状态..."
sudo service mongodb start 2>/dev/null || echo "MongoDB 可能已在运行或需要手动启动"
echo ""

# 检查后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend
    npm install
    cd ..
    echo ""
fi

# 启动后端服务器
echo "🚀 启动后端服务器..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo "✅ 后端服务器已启动 (PID: $BACKEND_PID)"
echo "📡 后端地址: http://localhost:3000"
echo ""

# 等待后端启动
sleep 3

# 启动前端服务器
echo "🌐 启动前端服务器..."
cd frontend

if command -v python3 &> /dev/null; then
    echo "📡 前端地址: http://localhost:8080"
    echo ""
    echo "✅ 应用已启动！在浏览器中打开 http://localhost:8080"
    echo "⏹️  按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "📡 前端地址: http://localhost:8080"
    echo ""
    echo "✅ 应用已启动！在浏览器中打开 http://localhost:8080"
    echo "⏹️  按 Ctrl+C 停止服务器"
    echo ""
    python -m http.server 8080
else
    echo "❌ Python 未安装，无法启动前端服务器"
    echo "请手动启动前端:"
    echo "  方法1: cd frontend && python -m http.server 8080"
    echo "  方法2: cd frontend && npx http-server -p 8080"
    echo "  方法3: 直接在浏览器中打开 frontend/index.html"
fi

# 清理后台进程
kill $BACKEND_PID 2>/dev/null
