// ===== 引入 Vue 3 核心函数 =====
// Vue 3 使用 CDN 方式加载（在 index.html 中引入）
// createApp：Vue 3 用于创建应用实例的函数
// 解构语法：从 Vue 对象中提取 createApp 函数
const { createApp } = Vue;

// ===== 定义后端 API 的基础地址 =====
// 所有的 HTTP 请求都会使用这个地址作为前缀
// 例如：登录接口 = http://localhost:3000/api/auth/login
const API_URL = 'http://localhost:3000';

// ===== 创建 Vue 应用 =====
// createApp()：创建一个新的 Vue 应用实例
// 参数是一个配置对象，包含 data、methods、mounted 等选项
createApp({
    // ===== data() 函数 =====
    // 这个函数返回组件的响应式数据
    // Vue 会追踪这些数据的变化，当数据改变时自动更新页面
    data() {
        // 返回一个对象，包含所有组件的状态数据
        return {
            // ===== 认证状态（Auth state） =====
            // 用于管理用户登录、注册相关的数据

            authMode: 'login',              // 当前认证模式：'login'（登录）或 'register'（注册）
            username: '',                   // 用户名输入框的值
            password: '',                   // 密码输入框的值
            confirmPassword: '',            // 确认密码输入框的值（注册时使用）
            token: null,                    // JWT 令牌（登录成功后从后端获取）
            isLoggedIn: false,              // 是否已登录（控制显示登录界面还是聊天界面）
            loading: false,                 // 是否正在加载（防止重复提交）
            errorMessage: '',               // 错误消息（显示登录/注册失败的原因）

            // ===== Socket 状态（Socket state） =====
            // 用于管理 WebSocket 连接

            socket: null,                   // Socket.io 客户端实例（用于实时通信）
            isConnected: false,             // WebSocket 是否已连接

            // ===== 聊天状态（Chat state） =====
            // 用于管理聊天消息相关的数据

            newMessage: '',                 // 新消息输入框的值
            messages: [],                   // 当前频道的消息列表
                                           // 数组格式：[{id, username, message, timestamp, messageType, channelId}, ...]
            onlineUsers: [],               // 在线用户列表（从服务器接收）
            typingUser: null,              // 当前正在输入的用户名（显示"xxx 正在输入..."）
            typingIndicatorTimeout: null,  // 输入指示器的定时器（2.5秒后自动隐藏）
            stopTypingTimeout: null,       // 停止输入的定时器（1.8秒无输入后发送停止事件）
            isTyping: false,               // 当前用户是否正在输入
            avatarColors: {},              // 用户头像颜色缓存
                                           // 格式：{ 'username': 'linear-gradient(...)' }
                                           // 为什么要缓存？避免每次渲染都重新生成渐变色

            // ===== 频道状态（Channel state） =====
            // 用于管理频道相关的数据

            channels: [],                  // 用户已加入的频道列表
            availableChannels: [],         // 可加入的频道列表（还未加入的频道）
            currentChannelId: null,        // 当前选中的频道ID
            currentChannelName: '',        // 当前频道名称（显示在页面顶部）
            currentChannelDescription: '', // 当前频道描述

            // ===== 管理员状态（Admin state） =====
            // 用于管理员功能（敏感词过滤、用户禁言等）

            isAdmin: false,                // 当前用户是否是管理员
            wordFilters: [],               // 敏感词列表（只有管理员可以看到和管理）
            newFilterWord: '',             // 新增敏感词的输入框值
            globalMuteEnabled: false,      // 是否开启全局禁言
            allUsers: [],                  // 所有用户列表（用于管理员查看和禁言）
            selectedUserForMute: null,     // 选中要禁言的用户
            muteReason: '',                // 禁言原因
            muteDuration: 0,               // 禁言时长（分钟），0表示永久禁言

            // ===== 禁言通知状态（Mute notification） =====
            // 用于显示消息被拦截的通知

            isMuted: false,                // 是否显示禁言通知
            muteMessage: '',               // 禁言通知的内容
            muteNotificationTimeout: null  // 通知的定时器（5秒后自动关闭）
        };
    },

    // ===== methods 对象 =====
    // 包含所有组件的方法（函数）
    // 这些方法可以在模板中调用，也可以在其他方法中调用
    methods: {
        // ============================================================
        // ===== 认证相关方法（Auth methods） =====
        // ============================================================

        // ===== 登录方法 =====
        // async 表示这是异步函数，可以使用 await
        async handleLogin() {
            // 设置加载状态，防止重复提交
            this.loading = true;
            // 清空之前的错误消息
            this.errorMessage = '';

            // try-catch：错误处理
            try {
                // ===== 发送登录请求到后端 =====
                // fetch()：浏览器内置的 HTTP 请求函数
                // await：等待请求完成
                const response = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',              // HTTP 方法：POST
                    headers: { 'Content-Type': 'application/json' },  // 请求头：JSON 格式
                    // body：请求体，将用户名和密码转换为 JSON 字符串
                    body: JSON.stringify({ username: this.username, password: this.password })
                });

                // ===== 解析响应数据 =====
                // .json()：将响应体从 JSON 字符串转换为 JavaScript 对象
                const data = await response.json();

                // ===== 检查响应状态 =====
                // response.ok：HTTP 状态码是否在 200-299 范围内
                if (!response.ok) {
                    // 如果失败，抛出错误
                    throw new Error(data.error || '登录失败');
                }

                // ===== 登录成功，保存令牌 =====
                this.token = data.token;
                // localStorage：浏览器本地存储，刷新页面后数据不会丢失
                // 保存令牌和用户名，下次打开页面时可以自动登录
                localStorage.setItem('chat_token', data.token);
                localStorage.setItem('chat_username', data.user.username);

                // ===== 更新登录状态 =====
                this.isLoggedIn = true;
                this.username = data.user.username;

                // ===== 建立 WebSocket 连接 =====
                this.connectSocket();

            } catch (error) {
                // ===== 如果发生错误，显示错误消息 =====
                console.error('Login error:', error);
                this.errorMessage = error.message;

            } finally {
                // ===== finally 块总是会执行 =====
                // 无论成功还是失败，都要取消加载状态
                this.loading = false;
            }
        },

        // ===== 注册方法 =====
        async handleRegister() {
            this.loading = true;
            this.errorMessage = '';

            // ===== 验证两次密码是否一致 =====
            if (this.password !== this.confirmPassword) {
                this.errorMessage = '两次输入的密码不一致';
                this.loading = false;
                return;  // 提前返回，不继续执行
            }

            try {
                // ===== 发送注册请求到后端 =====
                const response = await fetch(`${API_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: this.username, password: this.password })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '注册失败');
                }

                // ===== 注册成功，保存令牌并自动登录 =====
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

        // ===== 验证令牌方法 =====
        // 这个方法在页面加载时自动调用
        // 如果本地存储中有令牌，就验证令牌是否有效
        // 如果有效，就自动登录
        async verifyToken() {
            // ===== 从本地存储中获取令牌和用户名 =====
            const token = localStorage.getItem('chat_token');
            const username = localStorage.getItem('chat_username');

            // ===== 如果没有令牌或用户名，返回 false =====
            if (!token || !username) {
                return false;
            }

            try {
                // ===== 发送验证请求到后端 =====
                const response = await fetch(`${API_URL}/api/auth/verify`, {
                    // Authorization 头：Bearer + 令牌
                    // Bearer 是一种身份认证方式
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // ===== 如果令牌无效，抛出错误 =====
                if (!response.ok) {
                    throw new Error('Token invalid');
                }

                // ===== 令牌有效，自动登录 =====
                const data = await response.json();
                this.token = token;
                this.username = data.user.username;
                this.isLoggedIn = true;
                this.connectSocket();
                return true;

            } catch (error) {
                // ===== 如果验证失败，清除本地存储 =====
                console.error('Token verification failed:', error);
                localStorage.removeItem('chat_token');
                localStorage.removeItem('chat_username');
                return false;
            }
        },

        // ===== 退出登录方法 =====
        logout() {
            // ===== 断开 WebSocket 连接 =====
            if (this.socket) {
                this.socket.disconnect();
            }

            // ===== 清空所有状态 =====
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

            // ===== 清除本地存储 =====
            localStorage.removeItem('chat_token');
            localStorage.removeItem('chat_username');
        },

        // ============================================================
        // ===== Socket.io 相关方法（Socket methods） =====
        // ============================================================

        // ===== 建立 WebSocket 连接方法 =====
        connectSocket() {
            // ===== 如果没有令牌，直接返回 =====
            if (!this.token) return;

            // ===== 创建 Socket.io 客户端实例 =====
            // io()：Socket.io 客户端函数（从 CDN 加载）
            // 参数1：服务器地址
            // 参数2：配置对象
            this.socket = io(API_URL, {
                // auth：认证信息，会在建立连接时发送给服务器
                auth: { token: this.token }
            });

            // ===== 监听连接成功事件 =====
            // socket.on()：监听服务器发送的事件
            this.socket.on('connect', () => {
                // 连接成功，更新状态
                this.isConnected = true;
            });

            // ===== 监听断开连接事件 =====
            this.socket.on('disconnect', () => {
                // 断开连接，更新状态
                this.isConnected = false;
            });

            // ===== 监听连接错误事件 =====
            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error.message);

                // ===== 如果是认证失败，自动退出登录 =====
                // includes()：检查字符串是否包含某个子串
                if (error.message.includes('认证失败')) {
                    this.logout();
                    this.errorMessage = '认证失败，请重新登录';
                }
            });

            // ===== 监听初始数据事件 =====
            // 服务器在连接成功后会发送这个事件
            // 包含：频道列表、可加入的频道、是否是管理员等
            this.socket.on('initial-data', (data) => {
                // ===== 保存频道数据 =====
                // || []：如果 data.channels 不存在，使用空数组
                this.channels = data.channels || [];
                this.availableChannels = data.availableChannels || [];
                this.isAdmin = data.isAdmin || false;

                // ===== 自动切换到默认频道 =====
                if (this.channels.length > 0) {
                    // .find()：查找数组中第一个满足条件的元素
                    const defaultChannel = this.channels.find(c => c.isDefault) || this.channels[0];
                    this.switchChannel(defaultChannel.id, defaultChannel.name, defaultChannel.description);
                }

                // ===== 如果是管理员，加载管理员数据 =====
                if (this.isAdmin) {
                    this.loadWordFilters();        // 加载敏感词列表
                    this.loadGlobalMuteStatus();   // 加载全局禁言状态
                    this.loadUsers();              // 加载所有用户列表
                }
            });

            // ===== 监听频道历史消息事件 =====
            // 切换频道时，服务器会发送该频道的历史消息
            this.socket.on('channel-history', (history) => {
                // ===== 将历史消息转换为统一格式 =====
                // .map()：遍历数组，将每个元素转换为新的格式
                this.messages = history.map(msg => ({
                    id: msg._id || msg.id,                       // 消息ID（兼容不同的字段名）
                    username: msg.username,                      // 用户名
                    userId: msg.userId,                          // 用户ID
                    message: msg.message,                        // 消息内容
                    timestamp: msg.timestamp,                    // 时间戳
                    messageType: msg.messageType || 'user',      // 消息类型（user/system/ai）
                    channelId: msg.channelId || this.currentChannelId  // 频道ID
                }));

                // ===== 滚动到底部 =====
                // this.$nextTick()：等待 Vue 更新 DOM 后再执行
                // 为什么要等待？因为消息列表更新后，DOM 才会更新
                this.$nextTick(this.scrollToBottom);
            });

            // ===== 监听在线用户列表事件 =====
            this.socket.on('user-list', (users) => {
                // ===== 更新在线用户列表 =====
                this.onlineUsers = users;

                // ===== 为新用户生成头像颜色 =====
                // .forEach()：遍历数组
                users.forEach(user => {
                    // 如果这个用户还没有颜色，生成一个
                    if (!this.avatarColors[user]) {
                        this.avatarColors[user] = this.generateGradient(user);
                    }
                });
            });

            // ===== 监听新消息事件 =====
            this.socket.on('new-message', (messageData) => {
                // ===== 检查消息是否属于当前频道 =====
                // 如果不是当前频道的消息，忽略
                if (messageData.channelId && messageData.channelId !== this.currentChannelId) {
                    return;
                }

                // ===== 将新消息添加到消息列表 =====
                this.messages.push({
                    id: messageData.id,
                    username: messageData.username,
                    userId: messageData.userId,
                    message: messageData.message,
                    timestamp: messageData.timestamp,
                    messageType: messageData.messageType || 'user',
                    channelId: messageData.channelId || this.currentChannelId
                });

                // ===== 滚动到底部 =====
                this.$nextTick(this.scrollToBottom);
            });

            // ===== 监听用户正在输入事件 =====
            this.socket.on('user-typing', (data) => {
                // ===== 只显示当前频道的输入指示器 =====
                if (data.channelId === this.currentChannelId) {
                    this.typingUser = data.username;

                    // ===== 清除之前的定时器 =====
                    if (this.typingIndicatorTimeout) {
                        clearTimeout(this.typingIndicatorTimeout);
                    }

                    // ===== 2.5秒后自动隐藏输入指示器 =====
                    // 为什么要自动隐藏？防止用户一直输入但不发送
                    this.typingIndicatorTimeout = setTimeout(() => {
                        this.typingUser = null;
                    }, 2500);
                }
            });

            // ===== 监听用户停止输入事件 =====
            this.socket.on('user-stop-typing', (data) => {
                // ===== 隐藏当前频道的输入指示器 =====
                if (data.channelId === this.currentChannelId) {
                    this.typingUser = null;
                }
            });

            // ===== 监听消息被拦截事件 =====
            // 当用户被禁言或消息包含敏感词时触发
            this.socket.on('message-blocked', (data) => {
                // 显示禁言通知
                this.showMuteNotification(data.reason);
            });

            // ===== 监听错误事件 =====
            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.errorMessage = error.message || '发生错误';

                // ===== 4秒后自动隐藏错误消息 =====
                setTimeout(() => {
                    this.errorMessage = '';
                }, 4000);
            });
        },

        // ============================================================
        // ===== 频道相关方法（Channel methods） =====
        // ============================================================

        // ===== 加载频道列表方法 =====
        async loadChannels() {
            try {
                // ===== 发送请求获取已加入的频道 =====
                const response = await fetch(`${API_URL}/api/channels`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (!response.ok) throw new Error('Failed to load channels');

                // ===== 更新频道列表 =====
                this.channels = await response.json();

                // ===== 同时加载可加入的频道 =====
                await this.loadAvailableChannels();

                // ===== 如果当前没有选中频道，自动选中第一个 =====
                if (this.channels.length > 0 && !this.currentChannelId) {
                    const defaultChannel = this.channels.find(c => c.isDefault) || this.channels[0];
                    this.switchChannel(defaultChannel.id, defaultChannel.name, defaultChannel.description);
                }

            } catch (error) {
                console.error('Load channels error:', error);
            }
        },

        // ===== 加载可加入的频道列表方法 =====
        async loadAvailableChannels() {
            try {
                // ===== 发送请求获取可加入的频道 =====
                const response = await fetch(`${API_URL}/api/channels/available`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (!response.ok) throw new Error('Failed to load available channels');

                // ===== 更新可加入频道列表 =====
                this.availableChannels = await response.json();

            } catch (error) {
                console.error('Load available channels error:', error);
            }
        },

        // ===== 切换频道方法 =====
        // 参数：
        // - channelId：频道ID
        // - channelName：频道名称
        // - description：频道描述（可选）
        switchChannel(channelId, channelName, description = '') {
            // ===== 如果频道ID为空或已经是当前频道，直接返回 =====
            if (!channelId || channelId === this.currentChannelId) return;

            // ===== 更新当前频道信息 =====
            this.currentChannelId = channelId;
            this.currentChannelName = channelName;
            this.currentChannelDescription = description || '';

            // ===== 清空消息列表和输入状态 =====
            this.messages = [];           // 清空消息（新频道的消息会从服务器加载）
            this.typingUser = null;       // 清空输入指示器
            this.newMessage = '';         // 清空输入框

            // ===== 通知服务器切换频道 =====
            // 服务器会返回该频道的历史消息
            if (this.socket) {
                this.socket.emit('switch-channel', { channelId });
            }
        },

        // ===== 加入频道方法 =====
        async joinChannel(channel) {
            // ===== 验证频道对象 =====
            // ?.：可选链操作符，如果 channel 为 null/undefined，表达式返回 undefined
            if (!channel?.id) return;

            try {
                // ===== 发送加入频道请求 =====
                const response = await fetch(`${API_URL}/api/channels/${channel.id}/join`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '加入频道失败');
                }

                // ===== 重新加载频道列表 =====
                await this.loadChannels();
                await this.loadAvailableChannels();

                // ===== 自动切换到刚加入的频道 =====
                const joined = this.channels.find(c => c.id === channel.id);
                if (joined) {
                    this.switchChannel(joined.id, joined.name, joined.description);
                }

            } catch (error) {
                // ===== 显示错误消息 =====
                this.errorMessage = error.message;
                setTimeout(() => { this.errorMessage = ''; }, 4000);
            }
        },

        // ============================================================
        // ===== 聊天相关方法（Chat methods） =====
        // ============================================================

        // ===== 发送消息方法 =====
        sendMessage() {
            // ===== 验证消息不能为空 =====
            // .trim()：去掉字符串前后的空格
            if (!this.newMessage.trim() || !this.socket || !this.currentChannelId) return;

            // ===== 通过 Socket 发送消息到服务器 =====
            // socket.emit()：发送事件到服务器
            this.socket.emit('send-message', {
                message: this.newMessage.trim(),  // 去掉前后空格
                channelId: this.currentChannelId
            });

            // ===== 清空输入框 =====
            this.newMessage = '';

            // ===== 如果正在输入，发送停止输入事件 =====
            if (this.isTyping) {
                this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                this.isTyping = false;
            }
        },

        // ===== 处理输入事件方法 =====
        // 当用户在输入框中输入时调用
        handleTyping() {
            // ===== 验证 Socket 和频道 =====
            if (!this.socket || !this.currentChannelId) return;

            // ===== 如果还没有发送"正在输入"事件，发送一次 =====
            if (!this.isTyping && this.newMessage.trim()) {
                this.socket.emit('typing', { channelId: this.currentChannelId });
                this.isTyping = true;
            }

            // ===== 清除之前的停止输入定时器 =====
            if (this.stopTypingTimeout) {
                clearTimeout(this.stopTypingTimeout);
            }

            // ===== 1.8秒后自动发送停止输入事件 =====
            // 为什么1.8秒？如果用户停止输入1.8秒，说明可能不再输入了
            this.stopTypingTimeout = setTimeout(() => {
                if (this.isTyping) {
                    this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                    this.isTyping = false;
                }
            }, 1800);

            // ===== 如果输入框为空，立即发送停止输入事件 =====
            if (!this.newMessage.trim() && this.isTyping) {
                this.socket.emit('stop-typing', { channelId: this.currentChannelId });
                this.isTyping = false;
            }
        },

        // ===== 滚动到底部方法 =====
        // 在收到新消息时调用，确保用户能看到最新的消息
        scrollToBottom() {
            // ===== 获取消息容器的 DOM 元素 =====
            // this.$refs：Vue 的引用对象，用于访问模板中的元素
            // messagesContainer：在模板中定义的 ref="messagesContainer"
            const container = this.$refs.messagesContainer;

            // ===== 如果容器存在，滚动到底部 =====
            if (container) {
                // scrollTop：滚动条的位置
                // scrollHeight：内容的总高度
                // 将滚动条设置为内容的总高度，就是滚动到底部
                container.scrollTop = container.scrollHeight;
            }
        },

        // ===== 生成渐变色方法 =====
        // 根据用户名生成唯一的渐变色
        // 参数：username（用户名）
        // 返回：CSS 渐变色字符串
        generateGradient(username) {
            // ===== 计算用户名的哈希值 =====
            // 哈希算法：将字符串转换为数字
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                // username.charCodeAt(i)：获取字符的 Unicode 编码
                // << 5：左移5位（相当于乘以32）
                // 这是一个简单的哈希算法
                hash = username.charCodeAt(i) + ((hash << 5) - hash);
            }

            // ===== 根据哈希值生成色相（Hue） =====
            // Math.abs()：取绝对值
            // % 360：色相的范围是 0-360 度
            const hue = Math.abs(hash % 360);

            // ===== 生成第二个色相（偏移35度） =====
            // 这样可以得到相近但不同的两个颜色
            const hue2 = (hue + 35) % 360;

            // ===== 返回 CSS 渐变色 =====
            // linear-gradient：线性渐变
            // 135deg：渐变角度（从左上到右下）
            // hsl()：色相-饱和度-亮度颜色模型
            return `linear-gradient(135deg, hsl(${hue}, 75%, 60%), hsl(${hue2}, 70%, 55%))`;
        },

        // ===== 获取头像颜色方法 =====
        // 参数：username（用户名）
        // 返回：CSS 渐变色字符串
        getAvatarColor(username) {
            // ===== 如果用户名为空，返回默认颜色 =====
            if (!username) return 'linear-gradient(135deg, #2563eb, #7c3aed)';

            // ===== 如果缓存中没有这个用户的颜色，生成一个 =====
            if (!this.avatarColors[username]) {
                this.avatarColors[username] = this.generateGradient(username);
            }

            // ===== 返回缓存的颜色 =====
            return this.avatarColors[username];
        },

        // ===== 获取用户名首字母方法 =====
        // 用于显示在头像中
        // 参数：name（用户名）
        // 返回：大写的首字母
        initials(name) {
            // ===== 如果名字为空，返回问号 =====
            if (!name) return '?';

            // ===== 返回第一个字符的大写形式 =====
            // .slice(0, 1)：获取第一个字符
            // .toUpperCase()：转换为大写
            return name.slice(0, 1).toUpperCase();
        },

        // ===== 格式化时间戳方法 =====
        // 参数：timestamp（时间戳）
        // 返回：格式化的时间字符串（例如：12/07 14:30）
        formatTimestamp(timestamp) {
            // ===== 如果时间戳为空，返回空字符串 =====
            if (!timestamp) return '';

            // ===== 创建 Date 对象 =====
            const date = new Date(timestamp);

            // ===== 格式化为本地时间 =====
            // toLocaleString()：将日期转换为本地格式的字符串
            // 'zh-CN'：中文（中国）格式
            // 配置对象：指定显示的部分
            return date.toLocaleString('zh-CN', {
                month: '2-digit',    // 月份：2位数字（01-12）
                day: '2-digit',      // 日期：2位数字（01-31）
                hour: '2-digit',     // 小时：2位数字（00-23）
                minute: '2-digit'    // 分钟：2位数字（00-59）
            });
        },

        // ============================================================
        // ===== 管理员相关方法（Admin methods） =====
        // ============================================================

        // ===== 加载敏感词列表方法 =====
        async loadWordFilters() {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            try {
                // ===== 发送请求获取敏感词列表 =====
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

        // ===== 添加敏感词方法 =====
        async addWordFilter() {
            // ===== 验证输入 =====
            if (!this.isAdmin || !this.newFilterWord.trim()) return;

            try {
                // ===== 发送添加敏感词请求 =====
                const response = await fetch(`${API_URL}/api/admin/word-filters`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ word: this.newFilterWord.trim() })
                });

                if (response.ok) {
                    // ===== 重新加载敏感词列表 =====
                    await this.loadWordFilters();
                    // ===== 清空输入框 =====
                    this.newFilterWord = '';
                }
            } catch (error) {
                console.error('Add filter error:', error);
            }
        },

        // ===== 删除敏感词方法 =====
        // 参数：filterId（敏感词ID）
        async removeWordFilter(filterId) {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            try {
                // ===== 发送删除敏感词请求 =====
                const response = await fetch(`${API_URL}/api/admin/word-filters/${filterId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (response.ok) {
                    // ===== 重新加载敏感词列表 =====
                    await this.loadWordFilters();
                }
            } catch (error) {
                console.error('Remove filter error:', error);
            }
        },

        // ===== 加载所有用户列表方法 =====
        async loadUsers() {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            try {
                // ===== 发送请求获取所有用户 =====
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

        // ===== 禁言用户方法 =====
        // 参数：userId（用户ID）
        async muteUser(userId) {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            try {
                // ===== 发送禁言用户请求 =====
                const response = await fetch(`${API_URL}/api/admin/mute-user`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId,                                    // 用户ID
                        duration: this.muteDuration,               // 禁言时长（分钟）
                        reason: this.muteReason || '违反聊天规则'   // 禁言原因
                    })
                });

                if (response.ok) {
                    // ===== 重新加载用户列表 =====
                    await this.loadUsers();

                    // ===== 清空禁言表单 =====
                    this.selectedUserForMute = null;
                    this.muteReason = '';
                    this.muteDuration = 0;
                }
            } catch (error) {
                console.error('Mute user error:', error);
            }
        },

        // ===== 解除禁言方法 =====
        // 参数：userId（用户ID）
        async unmuteUser(userId) {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            try {
                // ===== 发送解除禁言请求 =====
                const response = await fetch(`${API_URL}/api/admin/unmute-user`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                });

                if (response.ok) {
                    // ===== 重新加载用户列表 =====
                    await this.loadUsers();
                }
            } catch (error) {
                console.error('Unmute user error:', error);
            }
        },

        // ===== 加载全局禁言状态方法 =====
        async loadGlobalMuteStatus() {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            try {
                // ===== 发送请求获取全局禁言状态 =====
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

        // ===== 切换全局禁言方法 =====
        async toggleGlobalMute() {
            // ===== 如果不是管理员，直接返回 =====
            if (!this.isAdmin) return;

            // ===== 计算新的状态（取反） =====
            // !：逻辑非操作符
            const newState = !this.globalMuteEnabled;

            try {
                // ===== 发送切换全局禁言请求 =====
                const response = await fetch(`${API_URL}/api/admin/global-mute`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        enabled: newState,             // 新的状态
                        reason: '管理员启用全局禁言'    // 原因
                    })
                });

                if (response.ok) {
                    // ===== 更新本地状态 =====
                    this.globalMuteEnabled = newState;
                }
            } catch (error) {
                console.error('Toggle global mute error:', error);
            }
        },

        // ===== 显示禁言通知方法 =====
        // 参数：reason（禁言原因）
        showMuteNotification(reason) {
            // ===== 显示通知 =====
            this.isMuted = true;
            this.muteMessage = reason;

            // ===== 清除之前的定时器 =====
            if (this.muteNotificationTimeout) {
                clearTimeout(this.muteNotificationTimeout);
            }

            // ===== 5秒后自动隐藏通知 =====
            this.muteNotificationTimeout = setTimeout(() => {
                this.isMuted = false;
                this.muteMessage = '';
            }, 5000);
        }
    },

    // ===== mounted 生命周期钩子 =====
    // 这个函数在 Vue 组件挂载到 DOM 后自动执行
    // 相当于页面加载完成后执行
    async mounted() {
        // ===== 验证本地存储中的令牌 =====
        // 如果有有效的令牌，自动登录
        await this.verifyToken();
    },

    // ===== beforeUnmount 生命周期钩子 =====
    // 这个函数在 Vue 组件卸载前自动执行
    // 用于清理资源（如关闭 WebSocket 连接）
    beforeUnmount() {
        // ===== 断开 WebSocket 连接 =====
        if (this.socket) {
            this.socket.disconnect();
        }
    }
// ===== 挂载 Vue 应用到 DOM =====
// .mount('#app')：将 Vue 应用挂载到 id="app" 的元素上
// 挂载后，Vue 会接管这个元素及其子元素，开始响应式更新
}).mount('#app');
