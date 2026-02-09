# Backend API Documentation

## Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require JWT authentication. Include token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "string (2-20 chars)",
  "password": "string (min 6 chars)"
}
```

**Response (201)**:
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

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response (200)**:
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

### Verify Token
```http
GET /auth/verify
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "user": {
    "id": "user-id",
    "username": "username"
  }
}
```

---

## Channel Endpoints

### Get User Channels
```http
GET /channels
Authorization: Bearer <token>
```

**Response (200)**:
```json
[
  {
    "id": "channel-id",
    "name": "string",
    "description": "string",
    "isDefault": true,
    "icon": "string",
    "joinedAt": "datetime"
  }
]
```

### Get Available Channels
```http
GET /channels/available
Authorization: Bearer <token>
```

**Response (200)**:
```json
[
  {
    "id": "channel-id",
    "name": "string",
    "description": "string",
    "icon": "string",
    "isDefault": false
  }
]
```

### Create Channel (Admin Only)
```http
POST /channels
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "string (min 2 chars)",
  "description": "string (optional)",
  "icon": "string (optional)"
}
```

**Response (201)**:
```json
{
  "message": "频道创建成功",
  "channel": {
    "id": "channel-id",
    "name": "string",
    "description": "string",
    "icon": "string",
    "isDefault": false
  }
}
```

### Join Channel
```http
POST /channels/:channelId/join
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "message": "加入频道成功"
}
```

### Leave Channel
```http
POST /channels/:channelId/leave
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "message": "离开频道成功"
}
```

### Get Channel Messages
```http
GET /channels/:channelId/messages?limit=100
Authorization: Bearer <token>
```

**Response (200)**:
```json
[
  {
    "id": "message-id",
    "username": "string",
    "userId": "user-id",
    "message": "string",
    "timestamp": "datetime",
    "messageType": "user|ai",
    "channelId": "channel-id"
  }
]
```

---

## Admin Endpoints (Admin Only)

### Get All Users
```http
GET /admin/users
Authorization: Bearer <admin-token>
```

**Response (200)**:
```json
[
  {
    "id": "user-id",
    "username": "string",
    "role": "user|admin",
    "isMuted": false,
    "mutedUntil": "datetime|null",
    "mutedReason": "string|null",
    "createdAt": "datetime"
  }
]
```

### Mute User
```http
POST /admin/mute-user
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-id",
  "duration": 30,
  "reason": "reason for mute"
}
```

**Response (200)**:
```json
{
  "message": "用户已被禁言",
  "mutedUntil": "datetime|null"
}
```

### Unmute User
```http
POST /admin/unmute-user
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-id"
}
```

**Response (200)**:
```json
{
  "message": "用户已解除禁言"
}
```

### Toggle Global Mute
```http
POST /admin/global-mute
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enabled": true,
  "reason": "reason for global mute"
}
```

**Response (200)**:
```json
{
  "message": "全局禁言已启用",
  "status": {
    "isEnabled": true,
    "reason": "string"
  }
}
```

### Get Global Mute Status
```http
GET /admin/global-mute
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "isEnabled": true,
  "reason": "string"
}
```

### Get Word Filters
```http
GET /admin/word-filters
Authorization: Bearer <admin-token>
```

**Response (200)**:
```json
[
  {
    "id": "filter-id",
    "word": "string",
    "isActive": true,
    "addedBy": {
      "username": "admin-name"
    },
    "addedAt": "datetime"
  }
]
```

### Add Word Filter
```http
POST /admin/word-filters
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "word": "filtered-word"
}
```

**Response (201)**:
```json
{
  "message": "过滤词添加成功",
  "filter": {
    "id": "filter-id",
    "word": "string",
    "addedAt": "datetime"
  }
}
```

### Remove Word Filter
```http
DELETE /admin/word-filters/:filterId
Authorization: Bearer <admin-token>
```

**Response (200)**:
```json
{
  "message": "过滤词已移除"
}
```

---

## Socket.io Events

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

### Client → Server Events

#### Switch Channel
```javascript
socket.emit('switch-channel', { channelId: 'channel-id' });
```

#### Send Message
```javascript
socket.emit('send-message', {
  message: 'Hello, world!',
  channelId: 'channel-id'
});
```

#### Typing Indicator
```javascript
socket.emit('typing', { channelId: 'channel-id' });
socket.emit('stop-typing', { channelId: 'channel-id' });
```

### Server → Client Events

#### Initial Data
```javascript
socket.on('initial-data', (data) => {
  // data.channels, data.availableChannels, etc.
});
```

#### New Message
```javascript
socket.on('new-message', (message) => {
  // message: { id, username, message, timestamp, etc. }
});
```

#### Channel History
```javascript
socket.on('channel-history', (messages) => {
  // Array of historical messages
});
```

#### User List
```javascript
socket.on('user-list', (users) => {
  // Array of online usernames
});
```

#### User Joined Channel
```javascript
socket.on('user-joined-channel', (data) => {
  // data: { username, channelId }
});
```

#### User Typing
```javascript
socket.on('user-typing', (data) => {
  // data: { username, channelId }
});
```

#### User Stop Typing
```javascript
socket.on('user-stop-typing', (data) => {
  // data: { username, channelId }
});
```

#### Error
```javascript
socket.on('error', (error) => {
  // error: { message: 'error description' }
});
```

#### Message Blocked
```javascript
socket.on('message-blocked', (data) => {
  // data: { reason, isGlobal }
});
```

---

## AI Service Endpoints

### Health Check
```http
GET /health
```

**Response (200)**:
```json
{
  "status": "healthy",
  "timestamp": "datetime",
  "service": "DeepSeek AI Chat Service"
}
```

### Chat
```http
POST /chat
Content-Type: application/json

{
  "message": "your question",
  "channelId": "channel-id",
  "username": "username"
}
```

**Response (200)**:
```json
{
  "response": "AI response text",
  "model": "deepseek-chat",
  "timestamp": "datetime"
}
```

### Get Conversation History
```http
GET /history/:channelId
```

**Response (200)**:
```json
{
  "channelId": "channel-id",
  "messageCount": 10,
  "history": [
    {
      "role": "user|assistant",
      "content": "message content"
    }
  ]
}
```

### Clear Conversation History
```http
POST /clear-history/:channelId
```

**Response (200)**:
```json
{
  "message": "History cleared"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "错误描述"
}
```

### 401 Unauthorized
```json
{
  "error": "未提供认证令牌"
}
```

### 403 Forbidden
```json
{
  "error": "您不是该频道成员"
}
```

### 404 Not Found
```json
{
  "error": "资源不存在"
}
```

### 409 Conflict
```json
{
  "error": "资源已存在"
}
```

### 500 Internal Server Error
```json
{
  "error": "服务器错误"
}
```

---

## Rate Limiting

- Authentication endpoints: 10 requests per minute
- Channel endpoints: 100 requests per minute
- Admin endpoints: 50 requests per minute
- Socket.io: 100 messages per minute

## WebSocket Limits

- Max message size: 10KB
- Reconnection attempts: 5
- Reconnection delay: 1000-5000ms
