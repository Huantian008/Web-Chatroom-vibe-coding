# Lumina Chat - 实时聊天室应用

一个功能完善的实时聊天室应用，支持用户注册、登录、历史消息持久化存储。

## 功能特性

- ✅ 用户注册和登录系统
- ✅ JWT Token 认证
- ✅ 实时消息传输 (Socket.io)
- ✅ 历史聊天记录持久化 (MongoDB)
- ✅ 在线用户列表
- ✅ 打字指示器
- ✅ 响应式设计 (支持移动端)
- ✅ 精美的玻璃态UI设计

## 技术栈

### 后端
- Node.js + Express
- Socket.io (实时通信)
- MongoDB + Mongoose (数据持久化)
- JWT (身份认证)
- bcrypt (密码加密)

### 前端
- Vue 3 (CDN版本)
- Socket.io Client
- 原生CSS (玻璃态设计)

## 安装和运行

### 前置要求

1. **Node.js** (推荐 v16 或更高版本)
2. **MongoDB** (本地安装或使用 MongoDB Atlas)

### 安装步骤

#### 1. 安装 MongoDB

**Windows (使用 WSL):**
```bash
# 更新包列表
sudo apt update

# 安装 MongoDB
sudo apt install -y mongodb

# 启动 MongoDB 服务
sudo service mongodb start

# 验证 MongoDB 是否运行
sudo service mongodb status
```

**或使用 MongoDB Atlas (云数据库):**
- 访问 https://www.mongodb.com/cloud/atlas
- 创建免费账户和集群
- 获取连接字符串并配置到 `.env` 文件

#### 2. 安装后端依赖

```bash
cd chat-room/backend
npm install
```

#### 3. 配置环境变量（可选）

在 `backend/` 目录创建 `.env` 文件：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat-room
JWT_SECRET=your-secret-key-change-this-in-production
```

如果不创建 `.env` 文件，将使用默认配置。

#### 4. 启动后端服务器

```bash
cd chat-room/backend
npm start
```

服务器将在 http://localhost:3000 运行

#### 5. 启动前端

打开新的终端窗口：

**方法 1: 使用 Python**
```bash
cd chat-room/frontend
python -m http.server 8080
```

**方法 2: 使用 Node.js http-server**
```bash
cd chat-room/frontend
npx http-server -p 8080
```

**方法 3: 直接打开文件**
```bash
# 在浏览器中打开
cd chat-room/frontend
# 双击 index.html 或者在浏览器中打开
```

#### 6. 访问应用

在浏览器中打开: http://localhost:8080

## 使用说明

### 注册新用户

1. 打开应用后，点击"注册"标签
2. 输入用户名 (2-20个字符)
3. 输入密码 (至少6个字符)
4. 确认密码
5. 点击"注册"按钮

### 登录

1. 在"登录"标签输入用户名和密码
2. 点击"登录"按钮
3. 登录成功后会自动进入聊天室

### 发送消息

1. 在底部输入框输入消息
2. 按回车键或点击发送按钮发送
3. 所有在线用户会实时收到消息

### 查看历史消息

- 登录后会自动加载最近100条历史消息
- 消息存储在MongoDB数据库中，重启服务器后依然保留

### 退出登录

点击左侧边栏底部的"退出登录"按钮

## API 接口

### 认证接口

#### POST /api/auth/register
注册新用户

**请求体:**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应:**
```json
{
  "message": "注册成功",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "username"
  }
}
```

#### POST /api/auth/login
用户登录

**请求体:**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应:**
```json
{
  "message": "登录成功",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "username"
  }
}
```

#### GET /api/auth/verify
验证 Token

**请求头:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "user": {
    "id": "user-id",
    "username": "username"
  }
}
```

#### GET /api/messages
获取历史消息

**响应:**
```json
[
  {
    "_id": "message-id",
    "username": "username",
    "message": "message text",
    "timestamp": "2025-12-03T10:00:00.000Z"
  }
]
```

### Socket.io 事件

#### 客户端发送事件

- `send-message` - 发送消息
  ```javascript
  socket.emit('send-message', { message: 'Hello' });
  ```

- `typing` - 开始输入
  ```javascript
  socket.emit('typing');
  ```

- `stop-typing` - 停止输入
  ```javascript
  socket.emit('stop-typing');
  ```

#### 服务器发送事件

- `message-history` - 历史消息列表
- `user-joined` - 用户加入
- `user-left` - 用户离开
- `user-list` - 在线用户列表
- `new-message` - 新消息
- `user-typing` - 用户正在输入
- `user-stop-typing` - 用户停止输入

## 数据库结构

### User 集合
```javascript
{
  username: String,      // 用户名 (唯一)
  password: String,      // 加密后的密码
  createdAt: Date,       // 创建时间
  lastLogin: Date        // 最后登录时间
}
```

### Message 集合
```javascript
{
  username: String,      // 发送者用户名
  message: String,       // 消息内容
  timestamp: Date        // 发送时间
}
```

## 安全特性

- ✅ 密码使用 bcrypt 加密存储
- ✅ JWT Token 认证
- ✅ Socket.io 连接需要 Token 验证
- ✅ 输入验证和错误处理
- ⚠️ CORS 目前设置为允许所有源 (生产环境需要修改)

## 开发建议

### 生产环境部署前需要修改的地方

1. **修改 CORS 设置** (`backend/server.js`)
   ```javascript
   const io = socketIo(server, {
       cors: {
           origin: "https://your-domain.com",  // 修改为你的域名
           methods: ["GET", "POST"]
       }
   });
   ```

2. **设置环境变量**
   - 生产环境必须设置强密码的 `JWT_SECRET`
   - 使用 MongoDB Atlas 或其他云数据库
   - 设置合适的 PORT

3. **修改前端 API URL** (`frontend/app.js`)
   ```javascript
   const API_URL = 'https://your-backend-domain.com';
   ```

## 故障排除

### MongoDB 连接失败

1. 确保 MongoDB 服务正在运行:
   ```bash
   sudo service mongodb status
   ```

2. 如果未运行，启动服务:
   ```bash
   sudo service mongodb start
   ```

3. 检查连接字符串是否正确

### Socket.io 连接失败

1. 确保后端服务器正在运行
2. 检查浏览器控制台是否有 CORS 错误
3. 确认前端 API_URL 配置正确

### Token 认证失败

1. 清除浏览器 localStorage
2. 重新登录
3. 检查 JWT_SECRET 配置

## 项目结构

```
chat-room/
├── backend/
│   ├── config/
│   │   └── database.js       # MongoDB 连接配置
│   ├── models/
│   │   ├── User.js           # 用户模型
│   │   └── Message.js        # 消息模型
│   ├── server.js             # 主服务器文件
│   └── package.json
│
└── frontend/
    ├── index.html            # HTML 页面
    ├── app.js                # Vue 应用逻辑
    └── style.css             # 样式文件
```

## 许可证

MIT License

## 作者

Lumina Chat - 学习项目

## 更新日志

### v1.0.0 (2025-12-03)
- ✅ 实现用户注册和登录
- ✅ 添加 JWT 认证
- ✅ MongoDB 数据持久化
- ✅ 实时消息传输
- ✅ 历史消息加载
- ✅ 响应式 UI 设计
