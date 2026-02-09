# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a learning/exercise repository containing three distinct projects:

1. **vue-project/** - Vue 3 + Vite starter project
2. **chat-room/** - Real-time chat application (Vue 3 + Socket.io + Node.js/Express)
3. **Project js/** - JavaScript learning exercises

## Project-Specific Commands

### vue-project (Vue 3 + Vite)

Located in `vue-project/` directory.

**Development:**
```bash
cd vue-project
npm install
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run preview      # Preview production build
```

**Linting:**
```bash
npm run lint         # Run all linters (oxlint + eslint)
npm run lint:oxlint  # Run oxlint only
npm run lint:eslint  # Run eslint only
```

**Tech Stack:**
- Vue 3.5+ (Composition API available)
- Vite (using rolldown-vite variant)
- ESLint + oxlint for linting
- Path alias: `@/` maps to `src/`

**Node Requirements:** Node.js ^20.19.0 || >=22.12.0

**Structure:**
- Entry point: `src/main.js`
- Root component: `src/App.vue`
- Components in `src/components/`
- Vite config in `vite.config.js`

### chat-room (Real-time Chat Application)

A Socket.io-based chat application with separate frontend and backend.

**Backend (Node.js + Express + Socket.io):**
```bash
cd chat-room/backend
npm install
npm start           # Start server on port 3000
npm run dev         # Same as start
```

**Frontend (Vanilla Vue 3 via CDN):**
The frontend uses CDN-loaded Vue 3 and Socket.io Client. No build step required.

To run frontend:
```bash
cd chat-room/frontend
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js http-server
npx http-server -p 8080
```

Or simply open `frontend/index.html` in a browser (though WebSocket connection requires backend running).

**Backend Architecture:**
- Server: `backend/server.js` - Express server with Socket.io
- Port: 3000 (configurable via PORT env var)
- CORS: Wide open (`origin: "*"`) - development only
- In-memory storage: Users stored in `Map`, messages in array (last 100)
- Socket events:
  - `user-join` - User joins with username
  - `send-message` - Send chat message
  - `typing` / `stop-typing` - Typing indicators
  - `disconnect` - User leaves

**Frontend Architecture:**
- Single file: `frontend/index.html` with inline Vue app
- Script: `frontend/app.js` - Vue 3 Options API application
- Styles: `frontend/style.css` - Glassmorphism design
- Socket connection: Connects to `http://localhost:3000` (hardcoded in app.js)
- Features: Real-time messaging, typing indicators, user list, message history

**Important Notes:**
- Frontend socket server URL is hardcoded in `app.js` line 31
- Backend allows all CORS origins - not production-ready
- No database - all state in memory (resets on server restart)
- Messages limited to last 100

### Project js

JavaScript learning exercises. No build process - standalone HTML/JS files.

Files:
- `Event System.js` - Event handling exercises
- `leixing.js` - Type system learning
- `index.html` - HTML interface for exercises

## Architecture Notes

### chat-room Communication Flow

1. User opens frontend → enters username
2. Socket connects to backend on port 3000
3. Frontend emits `user-join` event with username
4. Backend stores user in Map, sends message history
5. Backend broadcasts `user-joined` and `user-list` to all clients
6. Messages sent via `send-message` event → broadcast to all as `new-message`
7. Typing indicators use `typing`/`stop-typing` events (broadcast only)
8. Disconnect automatically removes user and broadcasts `user-left`

### vue-project Conventions

- Uses Vue 3 Composition API and Options API
- Component structure follows Vue 3 best practices
- Icons components in `src/components/icons/`
- Main styles in `src/assets/main.css`
- Vite dev server typically runs on port 5173

## Development Workflow

When working on **chat-room**, always run backend first:
```bash
cd chat-room/backend && npm start
```

Then serve frontend:
```bash
cd chat-room/frontend && npx http-server -p 8080
```

When working on **vue-project**:
```bash
cd vue-project && npm run dev
```

## Testing Multi-User Chat

To test chat-room with multiple users, open multiple browser tabs/windows and connect with different usernames. All should see each other's messages in real-time.
