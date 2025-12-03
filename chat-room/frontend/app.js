const { createApp } = Vue;

const API_URL = 'http://localhost:3000';

createApp({
    data() {
        return {
            // Auth state
            authMode: 'login',
            username: '',
            password: '',
            confirmPassword: '',
            token: null,
            isLoggedIn: false,
            loading: false,
            errorMessage: '',

            // Socket state
            socket: null,
            isConnected: false,

            // Chat state
            newMessage: '',
            messages: [],
            onlineUsers: [],
            typingUser: null,
            typingTimeout: null,
            isTyping: false,
            isSidebarOpen: false,
            avatarColors: {}
        };
    },

    methods: {
        // ============ Auth Methods ============
        async handleLogin() {
            this.loading = true;
            this.errorMessage = '';

            try {
                const response = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: this.username,
                        password: this.password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '登录失败');
                }

                // Store token
                this.token = data.token;
                localStorage.setItem('chat_token', data.token);
                localStorage.setItem('chat_username', data.user.username);

                // Set logged in state
                this.isLoggedIn = true;
                this.username = data.user.username;

                // Connect to socket
                this.connectSocket();
            } catch (error) {
                console.error('Login error:', error);
                this.errorMessage = error.message;
            } finally {
                this.loading = false;
            }
        },

        async handleRegister() {
            this.loading = true;
            this.errorMessage = '';

            // Validate passwords match
            if (this.password !== this.confirmPassword) {
                this.errorMessage = '两次输入的密码不一致';
                this.loading = false;
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: this.username,
                        password: this.password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '注册失败');
                }

                // Store token
                this.token = data.token;
                localStorage.setItem('chat_token', data.token);
                localStorage.setItem('chat_username', data.user.username);

                // Set logged in state
                this.isLoggedIn = true;
                this.username = data.user.username;

                // Connect to socket
                this.connectSocket();
            } catch (error) {
                console.error('Register error:', error);
                this.errorMessage = error.message;
            } finally {
                this.loading = false;
            }
        },

        async verifyToken() {
            const token = localStorage.getItem('chat_token');
            const username = localStorage.getItem('chat_username');

            if (!token || !username) {
                return false;
            }

            try {
                const response = await fetch(`${API_URL}/api/auth/verify`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Token invalid');
                }

                const data = await response.json();

                // Auto login
                this.token = token;
                this.username = data.user.username;
                this.isLoggedIn = true;

                // Connect to socket
                this.connectSocket();

                return true;
            } catch (error) {
                console.error('Token verification failed:', error);
                localStorage.removeItem('chat_token');
                localStorage.removeItem('chat_username');
                return false;
            }
        },

        logout() {
            if (this.socket) {
                this.socket.disconnect();
            }

            this.token = null;
            this.isLoggedIn = false;
            this.messages = [];
            this.onlineUsers = [];
            this.username = '';
            this.password = '';
            this.confirmPassword = '';
            this.isConnected = false;
            this.errorMessage = '';

            localStorage.removeItem('chat_token');
            localStorage.removeItem('chat_username');
        },

        // ============ Socket Methods ============
        connectSocket() {
            if (!this.token) {
                console.error('No token available');
                return;
            }

            // Connect to backend server with auth token
            this.socket = io(API_URL, {
                auth: {
                    token: this.token
                }
            });

            this.socket.on('connect', () => {
                console.log('Socket connected');
                this.isConnected = true;
            });

            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
                this.isConnected = false;
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error.message);
                if (error.message.includes('认证失败')) {
                    this.logout();
                    this.errorMessage = '认证失败，请重新登录';
                }
            });

            // Listen for message history
            this.socket.on('message-history', (history) => {
                this.messages = history.map(msg => ({
                    id: msg._id || msg.id,
                    username: msg.username,
                    message: msg.message,
                    timestamp: msg.timestamp
                }));
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            });

            // Listen for user joined
            this.socket.on('user-joined', (data) => {
                this.messages.push({
                    id: Date.now(),
                    type: 'system',
                    message: `${data.username} 加入了聊天室`,
                    timestamp: new Date().toISOString()
                });
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            });

            // Listen for user list updates
            this.socket.on('user-list', (users) => {
                this.onlineUsers = users;
                // Generate colors for new users
                users.forEach(user => {
                    if (!this.avatarColors[user]) {
                        this.avatarColors[user] = this.generateGradient(user);
                    }
                });
            });

            // Listen for new messages
            this.socket.on('new-message', (messageData) => {
                this.messages.push({
                    id: messageData.id,
                    username: messageData.username,
                    message: messageData.message,
                    timestamp: messageData.timestamp
                });
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            });

            // Listen for user left
            this.socket.on('user-left', (data) => {
                this.messages.push({
                    id: Date.now(),
                    type: 'system',
                    message: `${data.username} 离开了聊天室`,
                    timestamp: new Date().toISOString()
                });
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            });

            // Listen for typing indicator
            this.socket.on('user-typing', (username) => {
                this.typingUser = username;

                // Clear existing timeout
                if (this.typingTimeout) {
                    clearTimeout(this.typingTimeout);
                }

                // Auto-hide after 3 seconds
                this.typingTimeout = setTimeout(() => {
                    this.typingUser = null;
                }, 3000);
            });

            // Listen for stop typing
            this.socket.on('user-stop-typing', () => {
                this.typingUser = null;
            });

            // Listen for errors
            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.errorMessage = error.message || '发生错误';
            });
        },

        // ============ Chat Methods ============
        sendMessage() {
            if (this.newMessage.trim() && this.socket) {
                this.socket.emit('send-message', {
                    message: this.newMessage.trim()
                });

                this.newMessage = '';

                // Stop typing indicator
                if (this.isTyping) {
                    this.socket.emit('stop-typing');
                    this.isTyping = false;
                }
            }
        },

        handleTyping() {
            if (!this.socket) return;

            // Emit typing event if not already typing
            if (!this.isTyping && this.newMessage.trim()) {
                this.socket.emit('typing');
                this.isTyping = true;
            }

            // Clear existing timeout
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }

            // Stop typing after 2 seconds of inactivity
            this.typingTimeout = setTimeout(() => {
                if (this.isTyping) {
                    this.socket.emit('stop-typing');
                    this.isTyping = false;
                }
            }, 2000);

            // If input is cleared, stop typing
            if (!this.newMessage.trim() && this.isTyping) {
                this.socket.emit('stop-typing');
                this.isTyping = false;
            }
        },

        scrollToBottom() {
            const container = this.$refs.messagesContainer;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        },

        formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        },

        toggleSidebar() {
            this.isSidebarOpen = !this.isSidebarOpen;
        },

        generateGradient(username) {
            // Simple hash function to generate consistent colors
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                hash = username.charCodeAt(i) + ((hash << 5) - hash);
            }

            const hue1 = Math.abs(hash % 360);
            const hue2 = (hue1 + 40) % 360;

            return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 60%))`;
        },

        getAvatarColor(username) {
            if (!this.avatarColors[username]) {
                this.avatarColors[username] = this.generateGradient(username);
            }
            return this.avatarColors[username];
        }
    },

    async mounted() {
        // Try to auto-login with stored token
        await this.verifyToken();
    },

    beforeUnmount() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}).mount('#app');
