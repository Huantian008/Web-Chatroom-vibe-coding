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
            avatarColors: {},

            // Channel state
            channels: [],
            currentChannelId: null,
            currentChannelName: '',

            // Admin state
            isAdmin: false,
            showAdminPanel: false,
            wordFilters: [],
            newFilterWord: '',
            globalMuteEnabled: false,
            showCreateChannelModal: false,
            newChannelName: '',
            newChannelDescription: '',
            newChannelIcon: 'ph-hash',

            // User management
            allUsers: [],
            selectedUserForMute: null,
            muteReason: '',
            muteDuration: 0,

            // Mute notification
            isMuted: false,
            muteMessage: '',
            muteNotificationTimeout: null
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
            this.channels = [];
            this.currentChannelId = null;
            this.username = '';
            this.password = '';
            this.confirmPassword = '';
            this.isConnected = false;
            this.isAdmin = false;
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

            // Listen for initial data (channels, admin status)
            this.socket.on('initial-data', (data) => {
                console.log('Received initial data:', data);
                this.channels = data.channels || [];
                this.isAdmin = data.isAdmin || false;

                // Auto-select first channel (default channel)
                if (this.channels.length > 0) {
                    const defaultChannel = this.channels.find(c => c.isDefault) || this.channels[0];
                    this.switchChannel(defaultChannel.id, defaultChannel.name);
                }

                // Load admin data if admin
                if (this.isAdmin) {
                    this.loadWordFilters();
                    this.loadGlobalMuteStatus();
                    this.loadUsers();
                }
            });

            // Listen for channel history
            this.socket.on('channel-history', (history) => {
                this.messages = history.map(msg => ({
                    id: msg._id || msg.id,
                    username: msg.username,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    messageType: msg.messageType || 'user'
                }));
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
                // Only add if it's for current channel
                if (messageData.channelId && messageData.channelId !== this.currentChannelId) {
                    return;
                }

                this.messages.push({
                    id: messageData.id,
                    username: messageData.username,
                    message: messageData.message,
                    timestamp: messageData.timestamp,
                    messageType: messageData.messageType || 'user'
                });
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            });

            // Listen for typing indicator
            this.socket.on('user-typing', (data) => {
                if (data.channelId === this.currentChannelId) {
                    this.typingUser = data.username;

                    // Clear existing timeout
                    if (this.typingTimeout) {
                        clearTimeout(this.typingTimeout);
                    }

                    // Auto-hide after 3 seconds
                    this.typingTimeout = setTimeout(() => {
                        this.typingUser = null;
                    }, 3000);
                }
            });

            // Listen for stop typing
            this.socket.on('user-stop-typing', (data) => {
                if (data.channelId === this.currentChannelId) {
                    this.typingUser = null;
                }
            });

            // Listen for message blocked
            this.socket.on('message-blocked', (data) => {
                this.showMuteNotification(data.reason);
            });

            // Listen for errors
            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.errorMessage = error.message || '发生错误';
                setTimeout(() => {
                    this.errorMessage = '';
                }, 5000);
            });
        },

        // ============ Channel Methods ============
        async loadChannels() {
            try {
                const response = await fetch(`${API_URL}/api/channels`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (!response.ok) throw new Error('Failed to load channels');

                this.channels = await response.json();

                // Auto-select first channel if none selected
                if (this.channels.length > 0 && !this.currentChannelId) {
                    const defaultChannel = this.channels.find(c => c.isDefault) || this.channels[0];
                    this.switchChannel(defaultChannel.id, defaultChannel.name);
                }
            } catch (error) {
                console.error('Load channels error:', error);
            }
        },

        switchChannel(channelId, channelName) {
            this.currentChannelId = channelId;
            this.currentChannelName = channelName;
            this.messages = [];

            if (this.socket) {
                this.socket.emit('switch-channel', { channelId });
            }
        },

        async createChannel() {
            if (!this.isAdmin) return;
            if (!this.newChannelName.trim()) {
                this.errorMessage = '频道名称不能为空';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/channels`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: this.newChannelName,
                        description: this.newChannelDescription,
                        icon: this.newChannelIcon
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '创建频道失败');
                }

                // Reload channels
                await this.loadChannels();

                // Reset form
                this.newChannelName = '';
                this.newChannelDescription = '';
                this.newChannelIcon = 'ph-hash';
                this.showCreateChannelModal = false;

                // Switch to new channel
                if (data.channel) {
                    this.switchChannel(data.channel.id, data.channel.name);
                }
            } catch (error) {
                this.errorMessage = error.message;
                setTimeout(() => {
                    this.errorMessage = '';
                }, 5000);
            }
        },

        // ============ Chat Methods ============
        sendMessage() {
            if (this.newMessage.trim() && this.socket && this.currentChannelId) {
                this.socket.emit('send-message', {
                    message: this.newMessage.trim(),
                    channelId: this.currentChannelId
                });

                this.newMessage = '';

                // Stop typing indicator
                if (this.isTyping) {
                    this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                    this.isTyping = false;
                }
            }
        },

        handleTyping() {
            if (!this.socket || !this.currentChannelId) return;

            // Emit typing event if not already typing
            if (!this.isTyping && this.newMessage.trim()) {
                this.socket.emit('typing', { channelId: this.currentChannelId });
                this.isTyping = true;
            }

            // Clear existing timeout
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }

            // Stop typing after 2 seconds of inactivity
            this.typingTimeout = setTimeout(() => {
                if (this.isTyping) {
                    this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                    this.isTyping = false;
                }
            }, 2000);

            // If input is cleared, stop typing
            if (!this.newMessage.trim() && this.isTyping) {
                this.socket.emit('stop-typing', { channelId: this.currentChannelId });
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
        },

        // ============ Admin Methods ============
        async loadWordFilters() {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/word-filters`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    this.wordFilters = await response.json();
                }
            } catch (error) {
                console.error('Load filters error:', error);
            }
        },

        async addWordFilter() {
            if (!this.isAdmin || !this.newFilterWord.trim()) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/word-filters`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ word: this.newFilterWord.trim() })
                });

                if (response.ok) {
                    await this.loadWordFilters();
                    this.newFilterWord = '';
                }
            } catch (error) {
                console.error('Add filter error:', error);
            }
        },

        async removeWordFilter(filterId) {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/word-filters/${filterId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    await this.loadWordFilters();
                }
            } catch (error) {
                console.error('Remove filter error:', error);
            }
        },

        async loadUsers() {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/users`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    this.allUsers = await response.json();
                }
            } catch (error) {
                console.error('Load users error:', error);
            }
        },

        async muteUser(userId) {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/mute-user`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId,
                        duration: this.muteDuration,
                        reason: this.muteReason || '违反聊天规则'
                    })
                });

                if (response.ok) {
                    await this.loadUsers();
                    this.selectedUserForMute = null;
                    this.muteReason = '';
                    this.muteDuration = 0;
                }
            } catch (error) {
                console.error('Mute user error:', error);
            }
        },

        async unmuteUser(userId) {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/unmute-user`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                });

                if (response.ok) {
                    await this.loadUsers();
                }
            } catch (error) {
                console.error('Unmute user error:', error);
            }
        },

        async loadGlobalMuteStatus() {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/global-mute`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.globalMuteEnabled = data.isEnabled || false;
                }
            } catch (error) {
                console.error('Load global mute error:', error);
            }
        },

        async toggleGlobalMute() {
            if (!this.isAdmin) return;

            const newState = !this.globalMuteEnabled;

            try {
                const response = await fetch(`${API_URL}/api/admin/global-mute`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        enabled: newState,
                        reason: '管理员启用全局禁言'
                    })
                });

                if (response.ok) {
                    this.globalMuteEnabled = newState;
                }
            } catch (error) {
                console.error('Toggle global mute error:', error);
            }
        },

        showMuteNotification(reason) {
            this.isMuted = true;
            this.muteMessage = reason;

            // Clear existing timeout
            if (this.muteNotificationTimeout) {
                clearTimeout(this.muteNotificationTimeout);
            }

            // Auto-hide after 5 seconds
            this.muteNotificationTimeout = setTimeout(() => {
                this.isMuted = false;
                this.muteMessage = '';
            }, 5000);
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
