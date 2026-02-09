# 🚀 Chat Room - Quick Start Guide

## Docker 部署（推荐）

### 一键启动

```bash
# 1. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 2. 启动服务
make docker-up
# 或
./docker-start.sh

# 3. 访问应用
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
# AI Service: http://localhost:5000
```

### 开发环境

```bash
make dev
# 或
./docker-start-dev.sh
```

### 常用命令

```bash
make help           # 查看所有命令
make docker-logs    # 查看日志
make docker-restart  # 重启服务
make docker-clean    # 清理容器
make test           # 运行测试
make health         # 健康检查
```

## 本地开发

### 后端

```bash
cd backend
npm install
npm start        # 生产模式
npm run dev      # 开发模式
```

### AI 服务

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 前端

```bash
cd frontend
python -m http.server 8080
```

## 测试

```bash
# 运行所有测试
make test

# 后端测试
cd backend
npm test

# AI 服务测试
cd ai-service
source .venv/bin/activate
pytest test_app.py -v
```

## 数据库

### 连接 MongoDB

```bash
# Docker
make db-shell
# 或
docker-compose exec mongodb mongosh

# 本地
mongosh mongodb://localhost:27017/chatroom
```

### 备份

```bash
make db-backup
```

### 恢复

```bash
make db-restore BACKUP=backup-filename.gz
```

## 配置说明

### 环境变量

在 `.env` 文件中配置：

```env
# MongoDB
MONGO_USER=admin
MONGO_PASSWORD=secure_password
MONGO_DATABASE=chatroom

# Backend
NODE_ENV=production
PORT=3000
JWT_SECRET=generate_with_openssl_rand_base64_32

# AI Service
DEEPSEEK_API_KEY=your_api_key

# CORS (可选)
CORS_ORIGIN=https://your-domain.com
```

### 生成安全密钥

```bash
# JWT Secret
openssl rand -base64 32

# MongoDB Password
openssl rand -base64 24
```

## 故障排除

### 服务无法启动

```bash
# 查看日志
docker-compose logs -f

# 检查端口占用
netstat -tuln | grep -E '3000|5000|8080|27017'

# 重启服务
docker-compose restart
```

### 数据库连接失败

```bash
# 检查 MongoDB 状态
docker-compose ps mongodb

# 检查连接字符串
docker-compose exec backend sh -c "echo $MONGODB_URI"
```

### 权限问题

```bash
# 修复权限
sudo chown -R $USER:$USER .

# 重新构建
docker-compose down
docker-compose build
docker-compose up
```

## 文档

- 📖 [Docker 使用指南](DOCKER.md)
- 🚀 [生产部署指南](DEPLOYMENT.md)
- 📚 [API 文档](API.md)
- 🧪 [测试报告](../TEST_REPORT.md)

## 支持

遇到问题？

1. 查看 [DOCKER.md](DOCKER.md) 了解详细配置
2. 查看 [DEPLOYMENT.md](DEPLOYMENT.md) 了解生产部署
3. 检查 [API.md](API.md) 了解 API 使用
4. 查看日志: `make docker-logs`
