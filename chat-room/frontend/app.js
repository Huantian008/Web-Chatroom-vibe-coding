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
            typingIndicatorTimeout: null,
            stopTypingTimeout: null,
            isTyping: false,
            avatarColors: {},

            // Channel state
            channels: [],
            availableChannels: [],
            currentChannelId: null,
            currentChannelName: '',
            currentChannelDescription: '',

            // Admin state
            isAdmin: false,
            wordFilters: [],
            newFilterWord: '',
            globalMuteEnabled: false,
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
        // ============ Auth ============
        async handleLogin() {
            this.loading = true;
            this.errorMessage = '';

            try {
                const response = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: this.username, password: this.password })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '登录失败');
                }

                this.token = data.token;
                localStorage.setItem('chat_token', data.token);
                localStorage.setItem('chat_username', data.user.username);

                this.isLoggedIn = true;
                this.username = data.user.username;
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

            if (this.password !== this.confirmPassword) {
                this.errorMessage = '两次输入的密码不一致';
                this.loading = false;
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: this.username, password: this.password })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '注册失败');
                }

                this.token = data.token;
                localStorage.setItem('chat_token', data.token);
                localStorage.setItem('chat_username', data.user.username);

                this.isLoggedIn = true;
                this.username = data.user.username;
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
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error('Token invalid');
                }

                const data = await response.json();
                this.token = token;
                this.username = data.user.username;
                this.isLoggedIn = true;
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
            this.availableChannels = [];
            this.currentChannelId = null;
            this.currentChannelName = '';
            this.currentChannelDescription = '';
            this.username = '';
            this.password = '';
            this.confirmPassword = '';
            this.isConnected = false;
            this.isAdmin = false;
            this.errorMessage = '';

            localStorage.removeItem('chat_token');
            localStorage.removeItem('chat_username');
        },

        // ============ Socket ============
        connectSocket() {
            if (!this.token) return;

            this.socket = io(API_URL, {
                auth: { token: this.token }
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error.message);
                if (error.message.includes('认证失败')) {
                    this.logout();
                    this.errorMessage = '认证失败，请重新登录';
                }
            });

            this.socket.on('initial-data', (data) => {
                this.channels = data.channels || [];
                this.availableChannels = data.availableChannels || [];
                this.isAdmin = data.isAdmin || false;

                if (this.channels.length > 0) {
                    const defaultChannel = this.channels.find(c => c.isDefault) || this.channels[0];
                    this.switchChannel(defaultChannel.id, defaultChannel.name, defaultChannel.description);
                }

                if (this.isAdmin) {
                    this.loadWordFilters();
                    this.loadGlobalMuteStatus();
                    this.loadUsers();
                }
            });

            this.socket.on('channel-history', (history) => {
                this.messages = history.map(msg => ({
                    id: msg._id || msg.id,
                    username: msg.username,
                    userId: msg.userId,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    messageType: msg.messageType || 'user',
                    channelId: msg.channelId || this.currentChannelId
                }));
                this.$nextTick(this.scrollToBottom);
            });

            this.socket.on('user-list', (users) => {
                this.onlineUsers = users;
                users.forEach(user => {
                    if (!this.avatarColors[user]) {
                        this.avatarColors[user] = this.generateGradient(user);
                    }
                });
            });

            this.socket.on('new-message', (messageData) => {
                if (messageData.channelId && messageData.channelId !== this.currentChannelId) {
                    return;
                }

                this.messages.push({
                    id: messageData.id,
                    username: messageData.username,
                    userId: messageData.userId,
                    message: messageData.message,
                    timestamp: messageData.timestamp,
                    messageType: messageData.messageType || 'user',
                    channelId: messageData.channelId || this.currentChannelId
                });

                this.$nextTick(this.scrollToBottom);
            });

            this.socket.on('user-typing', (data) => {
                if (data.channelId === this.currentChannelId) {
                    this.typingUser = data.username;
                    if (this.typingIndicatorTimeout) {
                        clearTimeout(this.typingIndicatorTimeout);
                    }
                    this.typingIndicatorTimeout = setTimeout(() => {
                        this.typingUser = null;
                    }, 2500);
                }
            });

            this.socket.on('user-stop-typing', (data) => {
                if (data.channelId === this.currentChannelId) {
                    this.typingUser = null;
                }
            });

            this.socket.on('message-blocked', (data) => {
                this.showMuteNotification(data.reason);
            });

            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.errorMessage = error.message || '发生错误';
                setTimeout(() => {
                    this.errorMessage = '';
                }, 4000);
            });
        },

        // ============ Channel ============
        async loadChannels() {
            try {
                const response = await fetch(`${API_URL}/api/channels`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (!response.ok) throw new Error('Failed to load channels');

                this.channels = await response.json();
                await this.loadAvailableChannels();

                if (this.channels.length > 0 && !this.currentChannelId) {
                    const defaultChannel = this.channels.find(c => c.isDefault) || this.channels[0];
                    this.switchChannel(defaultChannel.id, defaultChannel.name, defaultChannel.description);
                }
            } catch (error) {
                console.error('Load channels error:', error);
            }
        },

        async loadAvailableChannels() {
            try {
                const response = await fetch(`${API_URL}/api/channels/available`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (!response.ok) throw new Error('Failed to load available channels');

                this.availableChannels = await response.json();
            } catch (error) {
                console.error('Load available channels error:', error);
            }
        },

        switchChannel(channelId, channelName, description = '') {
            if (!channelId || channelId === this.currentChannelId) return;

            this.currentChannelId = channelId;
            this.currentChannelName = channelName;
            this.currentChannelDescription = description || '';
            this.messages = [];
            this.typingUser = null;
            this.newMessage = '';

            if (this.socket) {
                this.socket.emit('switch-channel', { channelId });
            }
        },

        async joinChannel(channel) {
            if (!channel?.id) return;

            try {
                const response = await fetch(`${API_URL}/api/channels/${channel.id}/join`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '加入频道失败');
                }

                await this.loadChannels();
                await this.loadAvailableChannels();

                const joined = this.channels.find(c => c.id === channel.id);
                if (joined) {
                    this.switchChannel(joined.id, joined.name, joined.description);
                }
            } catch (error) {
                this.errorMessage = error.message;
                setTimeout(() => { this.errorMessage = ''; }, 4000);
            }
        },

        // ============ Chat ============
        sendMessage() {
            if (!this.newMessage.trim() || !this.socket || !this.currentChannelId) return;

            this.socket.emit('send-message', {
                message: this.newMessage.trim(),
                channelId: this.currentChannelId
            });

            this.newMessage = '';

            if (this.isTyping) {
                this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                this.isTyping = false;
            }
        },

        handleTyping() {
            if (!this.socket || !this.currentChannelId) return;

            if (!this.isTyping && this.newMessage.trim()) {
                this.socket.emit('typing', { channelId: this.currentChannelId });
                this.isTyping = true;
            }

            if (this.stopTypingTimeout) {
                clearTimeout(this.stopTypingTimeout);
            }

            this.stopTypingTimeout = setTimeout(() => {
                if (this.isTyping) {
                    this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                    this.isTyping = false;
                }
            }, 1800);

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

        generateGradient(username) {
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                hash = username.charCodeAt(i) + ((hash << 5) - hash);
            }

            const hue = Math.abs(hash % 360);
            const hue2 = (hue + 35) % 360;

            return `linear-gradient(135deg, hsl(${hue}, 75%, 60%), hsl(${hue2}, 70%, 55%))`;
        },

        getAvatarColor(username) {
            if (!username) return 'linear-gradient(135deg, #2563eb, #7c3aed)';
            if (!this.avatarColors[username]) {
                this.avatarColors[username] = this.generateGradient(username);
            }
            return this.avatarColors[username];
        },

        initials(name) {
            if (!name) return '?';
            return name.slice(0, 1).toUpperCase();
        },

        formatTimestamp(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        // ============ Admin ============
        async loadWordFilters() {
            if (!this.isAdmin) return;

            try {
                const response = await fetch(`${API_URL}/api/admin/word-filters`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
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
                    headers: { 'Authorization': `Bearer ${this.token}` }
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
                    headers: { 'Authorization': `Bearer ${this.token}` }
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
                    headers: { 'Authorization': `Bearer ${this.token}` }
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

            if (this.muteNotificationTimeout) {
                clearTimeout(this.muteNotificationTimeout);
            }

            this.muteNotificationTimeout = setTimeout(() => {
                this.isMuted = false;
                this.muteMessage = '';
            }, 5000);
        }
    },

    async mounted() {
        await this.verifyToken();
    },

    beforeUnmount() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}).mount('#app');
