# Lumina Chat - 多频道实时聊天室

一个带管理员能力的多频道实时聊天室，支持 JWT 登录、MongoDB 持久化、AI 助手（/chat 命令），并提供简洁的桌面/移动端 UI。

## 核心特性
- 多频道：默认频道 + 可加入/创建的频道，频道历史独立加载。
- 认证与权限：注册/登录、JWT 鉴权、管理员账号（`backend/config/admins.json`）。
- 管控：全局/单用户禁言、敏感词过滤、频道成员校验。
- 实时体验：Socket.io 推送、在线用户列表、输入中提示。
- AI 对话：输入 `/chat 你的问题` 触发 DeepSeek AI 回复。
- 技术栈：Express + Socket.io + MongoDB + Mongoose；前端 Vue 3 (CDN) + Socket.io Client；AI 服务 Flask + DeepSeek API。

## 目录结构
```
chat-room/
├── backend/          # Node.js 服务（API + Socket.io）
├── frontend/         # 前端静态页 (Vue 3 + CSS)
└── ai-service/       # Python Flask AI 代理，调用 DeepSeek
```

## 环境要求
- Node.js 16+
- Python 3.10+（运行 ai-service）
- MongoDB 本地实例（默认 `mongodb://localhost:27017/chat-room`）

## 快速开始
### 1) 后端
```bash
cd chat-room/backend
npm install
# 可选：配置 .env
# PORT=3000
# MONGODB_URI=mongodb://localhost:27017/chat-room
# JWT_SECRET=change-me
npm start
# 服务默认 http://localhost:3000
```

### 2) AI 服务
```bash
cd chat-room/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 配置 DeepSeek Key（任选其一）
# 在 ai-service/.env 写入：
# DEEPSEEK_API_KEY=你的key
# 或直接导出环境变量：
# export DEEPSEEK_API_KEY=你的key

python app.py    # 默认端口 5000
```

### 3) 前端
```bash
cd chat-room/frontend
python -m http.server 8080   # 或任意静态服务器
# 浏览器访问 http://localhost:8080
```

## 使用指南
1. 注册/登录后自动进入默认频道。左侧可切换频道；有“可加入的频道”时可点击加入。
2. 发送消息：输入文本回车或点击“发送”。
3. AI 对话：在输入框输入 `/chat 你好`，几秒后会收到“DeepSeek AI”回复。
4. 管理员：在 `backend/config/admins.json` 写入用户名，管理员可创建频道、禁言用户、维护敏感词等。

## 配置说明
- 后端 `.env`（可选）：`PORT`、`MONGODB_URI`、`JWT_SECRET`、`AI_SERVICE_URL`（默认 `http://localhost:5000`）。
- AI 服务 `.env`：`DEEPSEEK_API_KEY` 必填；`PORT` 可选。
- 管理员列表：`backend/config/admins.json`。

## 常见问题
- AI 一直“正在输入”但无回复：检查 `ai-service` 终端是否有 401/429/网络错误；确认 `DEEPSEEK_API_KEY` 生效；确保后端环境变量 `AI_SERVICE_URL` 指向正在运行的 AI 服务。
- MongoDB 连接失败：确认本地 MongoDB 已启动，或在 `.env` 覆盖 `MONGODB_URI`。
- 频道无消息：切换频道会重新拉取该频道历史，确认自己已加入该频道。

## 开发提示
- 避免将虚拟环境 `.venv` 和 `node_modules` 提交，可在根 `.gitignore` 中忽略（已默认忽略后端 node_modules 和 ai-service/.venv）。
- 生产环境请限制 CORS、使用强密码 `JWT_SECRET`，并为 DeepSeek Key 做好密钥管理。

## 许可证
MIT License
