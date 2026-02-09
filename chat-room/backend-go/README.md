# Chat Room Backend (Go)

Go 语言实现的高性能聊天室后端，完全兼容现有 Vue 前端。

## 🚀 快速开始

### 前置要求

- Go 1.21 或更高版本
- MongoDB 4.4 或更高版本
- (可选) AI 服务 (Python Flask)

### 安装依赖

```bash
cd backend-go
go mod download
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 运行服务器

```bash
# 开发模式
go run ./cmd/server

# 或构建后运行
go build -o server ./cmd/server
./server
```

服务器将在 `http://localhost:3000` 启动。

## 📁 项目结构

```
backend-go/
├── cmd/server/          # 程序入口
├── internal/            # 私有代码
│   ├── config/         # 配置管理
│   ├── models/         # 数据模型
│   ├── repository/     # 数据访问层
│   ├── service/        # 业务逻辑层
│   ├── handler/        # HTTP/WebSocket 处理器
│   ├── middleware/     # 中间件
│   ├── websocket/      # WebSocket 管理
│   └── utils/          # 工具函数
├── pkg/database/       # MongoDB 连接
├── api/                # 路由定义
├── go.mod              # Go 模块定义
└── Dockerfile          # Docker 镜像
```

## 🔌 API 端点

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify` - 验证 Token

### 频道
- `GET /api/channels` - 获取已加入频道
- `GET /api/channels/available` - 获取可加入频道
- `POST /api/channels` - 创建频道（管理员）
- `POST /api/channels/:id/join` - 加入频道
- `POST /api/channels/:id/leave` - 离开频道
- `GET /api/channels/:id/messages` - 获取历史消息

### 管理员
- `GET /api/admin/word-filters` - 敏感词列表
- `POST /api/admin/word-filters` - 添加敏感词
- `DELETE /api/admin/word-filters/:id` - 删除敏感词
- `GET /api/admin/users` - 获取所有用户
- `POST /api/admin/mute-user` - 禁言用户
- `POST /api/admin/unmute-user` - 解除禁言
- `GET /api/admin/global-mute` - 全局禁言状态
- `POST /api/admin/global-mute` - 切换全局禁言

### WebSocket
- `GET /ws?token=<JWT>` - WebSocket 连接

## 🐳 Docker 部署

### 构建镜像

```bash
# 生产镜像
docker build -t chat-room-backend:latest .

# 开发镜像
docker build -f Dockerfile.dev -t chat-room-backend:dev .
```

### 使用 Docker Compose

参考 `chat-room/docker-compose.yml`。

## 🧪 测试

```bash
# 运行所有测试
go test ./...

# 测试覆盖率
go test -cover ./...

# 竞态检测
go test -race ./...
```

## 🔧 配置管理员

编辑 `internal/config/admins.json`：

```json
{
  "admins": ["admin", "your-username"]
}
```

文件修改后会自动热加载，无需重启服务器。

## 📝 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务器端口 |
| `MONGODB_URI` | mongodb://localhost:27017/chat-room | MongoDB 连接字符串 |
| `JWT_SECRET` | (必填) | JWT 密钥 |
| `CORS_ORIGIN` | * | CORS 允许的源 |
| `AI_SERVICE_URL` | http://localhost:5000 | AI 服务地址 |
| `GIN_MODE` | debug | Gin 模式 (debug/release) |

## 🎯 特性

- ✅ JWT 认证
- ✅ 多频道聊天
- ✅ 实时 WebSocket 通信
- ✅ 敏感词过滤（内存缓存）
- ✅ 用户禁言（个人/全局）
- ✅ 管理员热加载
- ✅ AI 服务集成
- ✅ 输入状态提示
- ✅ 在线用户列表
- ✅ 消息历史记录
- ✅ Graceful shutdown

## 📊 性能

- 支持 1000+ 并发 WebSocket 连接
- 消息延迟 < 100ms
- 内存占用 < 100MB（空载）

## 🛠️ 开发

### 代码风格

```bash
# 格式化代码
go fmt ./...

# 静态分析
go vet ./...

# Lint
golangci-lint run
```

### 依赖管理

```bash
# 添加依赖
go get package-name

# 更新依赖
go get -u ./...

# 清理依赖
go mod tidy
```

## 📄 许可证

MIT License
