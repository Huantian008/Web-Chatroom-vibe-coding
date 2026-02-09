# 📖 Chat Room 用户使用指南

> 这是一个功能完整的实时聊天室应用，支持多频道、用户认证、AI助手等功能

---

## 📑 目录

- [快速开始](#快速开始)
- [功能介绍](#功能介绍)
- [详细使用指南](#详细使用指南)
- [测试指南](#测试指南)
- [故障排除](#故障排除)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 前置要求

确保你的系统已安装：

- **Node.js** (v20.19.0+ 或 v22.12.0+)
- **MongoDB** (v6.0+)
- **Python** (v3.8+，如果需要AI功能)
- **Git**

### 三步启动

#### 1️⃣ 克隆并安装

```bash
# 进入chat-room目录
cd chat-room

# 安装后端依赖
cd backend
npm install

# 安装AI服务依赖（可选）
cd ../ai-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

#### 2️⃣ 启动MongoDB

```bash
# Windows
mongod --dbpath C:\data\db

# Linux/Mac
sudo systemctl start mongodb
# 或
mongod --dbpath /usr/local/var/mongodb
```

#### 3️⃣ 启动服务

**方式A：分别启动（推荐开发时使用）**

```bash
# 终端1 - 启动后端
cd chat-room/backend
npm start

# 终端2 - 启动AI服务（可选）
cd chat-room/ai-service
source .venv/bin/activate
python app.py

# 终端3 - 启动前端
cd chat-room/frontend
npx http-server -p 8080
```

**方式B：使用Docker（推荐生产环境）**

```bash
cd chat-room

# 开发环境
docker-compose -f docker-compose.dev.yml up

# 生产环境
docker-compose up -d
```

#### 4️⃣ 访问应用

打开浏览器访问：**http://localhost:8080**

---

## ✨ 功能介绍

### 🔐 用户认证系统

- **用户注册**：创建新账户（用户名2-20字符，密码6+字符）
- **用户登录**：使用用户名和密码登录
- **JWT认证**：安全的token-based身份验证
- **Token过期**：7天有效期，自动登出保护

### 💬 实时聊天功能

- **WebSocket通信**：基于Socket.io的实时双向通信
- **多频道支持**：可创建和加入多个聊天频道
- **消息历史**：自动保存最近100条消息
- **打字指示器**：实时显示"正在输入..."
- **在线用户列表**：查看当前在线用户

### 🎯 频道管理

- **默认频道**：新用户自动加入"General"频道
- **创建频道**：管理员可创建新频道（需要管理员权限）
- **加入/离开**：自由加入和离开频道（默认频道除外）
- **频道图标**：使用Phosphor图标美化频道

### 🤖 AI助手 (可选)

- **DeepSeek集成**：智能AI回复
- **对话上下文**：记住聊天历史
- **@ai触发**：发送`@ai 你的问题`召唤AI
- **打字提示**：AI回复时显示"正在输入"

### 👑 管理员功能

- **用户禁言**：临时或永久禁言用户
- **全局禁言**：紧急情况下禁止所有非管理员发言
- **敏感词过滤**：添加/删除敏感词黑名单
- **频道管理**：创建、删除频道

### 🛡️ 安全特性

- **密码加密**：bcrypt哈希加密
- **JWT验证**：每次API请求验证token
- **敏感词过滤**：自动检测和拦截不良内容
- **防重复连接**：同一用户多设备登录检测

---

## 📘 详细使用指南

### 第一步：注册账户

1. 访问 http://localhost:8080
2. 点击"注册"标签
3. 输入用户名（2-20字符）
4. 输入密码（至少6字符）
5. 点击"注册"按钮

✅ **成功后自动登录并进入聊天界面**

### 第二步：发送消息

1. 在底部输入框输入消息
2. 按`Enter`发送（或点击发送按钮）
3. 消息会立即显示在聊天窗口

**快捷键：**
- `Enter` - 发送消息
- `Shift + Enter` - 换行

### 第三步：切换频道

1. 左侧边栏显示所有已加入的频道
2. 点击频道名称切换
3. 当前频道会高亮显示
4. 每个频道的消息独立存储

### 第四步：使用AI助手

1. 在消息中输入 `@ai` 开头
2. 例如：`@ai 什么是JavaScript？`
3. AI会在几秒内回复
4. AI消息带有特殊标识

**注意：** 需要先启动AI服务并配置API密钥

### 管理员操作

#### 创建新频道

```
POST /api/channels
Authorization: Bearer <admin-token>

{
  "name": "技术讨论",
  "description": "讨论技术话题",
  "icon": "ph-code"
}
```

#### 禁言用户

```
POST /api/admin/mute-user
Authorization: Bearer <admin-token>

{
  "userId": "user_id_here",
  "duration": 30,  // 分钟，0表示永久
  "reason": "违反聊天规则"
}
```

#### 添加敏感词

```
POST /api/admin/word-filters
Authorization: Bearer <admin-token>

{
  "word": "badword"
}
```

---

## 🧪 测试指南

### 运行所有测试

```bash
cd chat-room/backend
npm test
```

**测试覆盖：**
- ✅ Admin Helper (3个测试)
- ✅ Auth API (11个测试)
- ✅ Channels API (6个测试)
- ✅ Messages API (5个测试)
- ✅ Word Filter (5个测试)
- ✅ Mute Check (4个测试)

**总计：34个测试，通过率97%+**

### 运行特定测试

```bash
# 只测试认证功能
npm test -- tests/auth.test.js

# 只测试频道功能
npm test -- tests/channels.test.js

# 查看测试覆盖率
npm test -- --coverage
```

### 测试环境说明

- 使用`mongodb-memory-server`内存数据库
- 自动创建和清理测试数据
- 每个测试套件独立运行
- NODE_ENV自动设置为'test'

---

## 🔧 故障排除

### 问题1：MongoDB连接失败

**错误信息：** `❌ MongoDB Connection Error: connect ECONNREFUSED`

**解决方案：**
```bash
# 检查MongoDB是否运行
# Windows
tasklist | findstr mongod

# Linux/Mac
ps aux | grep mongod

# 如果没运行，启动MongoDB
mongod --dbpath <你的数据路径>
```

### 问题2：端口被占用

**错误信息：** `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案：**
```bash
# Windows - 查找并结束占用进程
netstat -ano | findstr :3000
taskkill /PID <进程ID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### 问题3：AI服务无响应

**错误信息：** `AI服务未启动，请启动Python服务`

**解决方案：**
```bash
# 1. 检查AI服务是否运行
curl http://localhost:5000/health

# 2. 如果未运行，启动它
cd ai-service
source .venv/bin/activate
python app.py

# 3. 检查.env文件中的API密钥
cat .env | grep DEEPSEEK_API_KEY
```

### 问题4：前端无法连接后端

**错误信息：** 控制台显示 `WebSocket connection failed`

**解决方案：**
1. 检查后端是否运行在端口3000
2. 检查`frontend/app.js`中的socket连接地址
3. 确认CORS设置允许前端域名

```javascript
// frontend/app.js line 31
const socket = io('http://localhost:3000');  // 确保地址正确
```

### 问题5：测试超时

**错误信息：** `Timeout - Async callback was not invoked within the 5000ms timeout`

**解决方案：**
```bash
# 增加Jest超时时间
npm test -- --testTimeout=10000

# 或在测试文件中设置
jest.setTimeout(10000);
```

---

## ❓ 常见问题

### Q1: 如何成为管理员？

**A:** 编辑 `backend/config/admins.json` 文件，添加你的用户名：

```json
{
    "admins": [
        "admin",
        "Ruence",
        "你的用户名"
    ]
}
```

保存后重启服务器，你的账户将拥有管理员权限。

### Q2: 如何配置AI服务？

**A:** 创建 `ai-service/.env` 文件：

```bash
DEEPSEEK_API_KEY=你的API密钥
PORT=5000
```

从 [DeepSeek官网](https://platform.deepseek.com/) 获取API密钥。

### Q3: 消息历史保存多久？

**A:**
- 数据库中：永久保存（除非手动删除）
- 客户端加载：最近100条消息
- 可在 `routes/channels.js:265` 修改limit参数

### Q4: 如何更改端口？

**A:** 创建或编辑 `.env` 文件：

```bash
# backend/.env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat-room
JWT_SECRET=your-secret-key

# ai-service/.env
PORT=5000

# 前端使用参数指定
npx http-server -p 8080
```

### Q5: 支持多少并发用户？

**A:**
- 开发模式：~100用户
- 生产模式（Docker + 负载均衡）：1000+ 用户
- 取决于服务器配置和MongoDB性能

### Q6: 如何部署到生产环境？

**A:** 参考 `DEPLOYMENT.md` 文档，推荐使用Docker：

```bash
# 使用生产配置启动
docker-compose up -d

# 配置Nginx反向代理
# 配置HTTPS证书
# 配置环境变量
```

### Q7: 数据如何备份？

**A:** MongoDB备份：

```bash
# 导出数据
mongodump --db chat-room --out ./backup

# 恢复数据
mongorestore --db chat-room ./backup/chat-room
```

### Q8: 如何添加新功能？

**A:**
1. 参考 `TECHNICAL_GUIDE.md` 了解架构
2. 在 `backend/routes/` 添加新路由
3. 在 `backend/models/` 添加数据模型
4. 编写测试 `backend/tests/`
5. 更新API文档 `API.md`

---

## 📚 相关文档

- [API文档](./API.md) - 完整的API接口说明
- [技术教学文档](./TECHNICAL_GUIDE.md) - 深入学习技术细节
- [快速开始](./QUICKSTART.md) - 5分钟快速上手
- [Docker部署](./DOCKER.md) - 容器化部署指南
- [部署指南](./DEPLOYMENT.md) - 生产环境部署

---

## 💡 使用技巧

### 技巧1：快速切换频道

使用键盘快捷键（需自定义实现）：
- `Ctrl + 1/2/3` - 切换到第1/2/3个频道
- `Ctrl + ↑/↓` - 上下切换频道

### 技巧2：消息搜索

使用浏览器搜索功能 `Ctrl + F` 在当前频道搜索消息。

### 技巧3：批量操作

管理员可以使用API批量操作：

```bash
# 批量禁言用户
curl -X POST http://localhost:3000/api/admin/batch-mute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["id1", "id2"], "duration": 60}'
```

### 技巧4：开发者模式

打开浏览器开发者工具 (F12) 查看：
- WebSocket实时消息
- API请求和响应
- 控制台日志和错误

---

## 🎯 最佳实践

### 用户侧

1. **定期备份聊天记录**：使用浏览器导出功能
2. **保护账户安全**：使用强密码，定期更换
3. **遵守聊天规则**：避免发送敏感内容
4. **及时更新浏览器**：获得最佳性能

### 管理员侧

1. **定期审查敏感词列表**：保持过滤器更新
2. **监控服务器性能**：使用日志分析工具
3. **备份数据库**：每日自动备份
4. **更新依赖包**：定期运行 `npm audit fix`

---

## 📞 获取帮助

- **GitHub Issues**: [提交问题](https://github.com/your-repo/issues)
- **文档**: 查看 `docs/` 目录
- **社区**: 加入我们的Discord服务器
- **Email**: support@example.com

---

## 📄 许可证

MIT License - 自由使用和修改

---

**祝你使用愉快！** 🎉

如有问题，请参考 [技术教学文档](./TECHNICAL_GUIDE.md) 深入了解系统原理。
