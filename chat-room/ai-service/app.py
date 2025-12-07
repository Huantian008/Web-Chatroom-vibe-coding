# ===== 引入所需的 Python 库 =====

# Flask：Python 的 Web 框架，用于创建 API 服务
# request：用于获取客户端发送的请求数据
# jsonify：用于将 Python 对象转换为 JSON 格式返回
from flask import Flask, request, jsonify

# flask_cors：跨域资源共享库，允许 Node.js 后端访问这个 Python 服务
from flask_cors import CORS

# requests：Python 的 HTTP 客户端库，用于向 DeepSeek API 发送请求
import requests

# os：操作系统接口，用于读取环境变量
import os

# datetime：日期和时间处理库
from datetime import datetime

# dotenv：用于加载 .env 文件中的环境变量
from dotenv import load_dotenv

# ===== 加载环境变量 =====
# load_dotenv()：读取 .env 文件，将变量加载到环境中
# 这样就可以用 os.getenv() 读取 DEEPSEEK_API_KEY 等配置
load_dotenv()

# ===== 创建 Flask 应用 =====
# Flask(__name__)：创建一个 Flask 应用实例
# __name__ 是 Python 的特殊变量，表示当前模块的名称
app = Flask(__name__)

# ===== 启用跨域资源共享（CORS） =====
# CORS(app)：允许所有域名访问这个服务
# 为什么需要？因为 Node.js 后端（localhost:3000）需要访问这个 Python 服务（localhost:5000）
CORS(app)

# ===== DeepSeek API 配置 =====

# DEEPSEEK_API_KEY：DeepSeek API 的密钥
# os.getenv('DEEPSEEK_API_KEY', '默认值')：
#   - 优先从环境变量中读取 API 密钥
#   - 如果环境变量不存在，使用默认值
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', 'sk-de5ab2d8fa3642b990a1febc331a6ff1')

# DEEPSEEK_API_URL：DeepSeek API 的地址
# 这是 DeepSeek AI 服务的官方 API 端点
DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

# ===== 对话历史存储 =====
# 为什么需要存储对话历史？
# 因为 AI 需要知道之前的对话内容，才能进行连贯的对话
# 例如：
#   用户："我叫张三"
#   AI："你好，张三！"
#   用户："我叫什么名字？"
#   AI："你叫张三。" <- 这需要记住之前的对话

# conversation_history：字典（Dictionary），按频道存储对话历史
# 数据结构：
# {
#     'channel1': [
#         {'role': 'user', 'content': '你好'},
#         {'role': 'assistant', 'content': '你好！有什么可以帮你的吗？'},
#         ...
#     ],
#     'channel2': [...]
# }
conversation_history = {}

# MAX_HISTORY：每个频道最多保留10轮对话（1轮 = 用户问题 + AI回答）
# 为什么要限制？因为对话历史太长会：
# 1. 占用太多内存
# 2. 让 AI 处理变慢
# 3. 增加 API 调用成本
MAX_HISTORY = 10

# ===== API 端点 1：健康检查 =====
# GET /health
# 这个接口用于检查服务是否正常运行
# Node.js 后端可以调用这个接口来确认 AI 服务是否可用
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    # 健康检查端点的文档字符串

    # jsonify()：将 Python 字典转换为 JSON 格式返回
    return jsonify({
        'status': 'healthy',                          # 状态：健康
        'timestamp': datetime.now().isoformat(),       # 当前时间（ISO 8601 格式）
        'service': 'DeepSeek AI Chat Service'          # 服务名称
    })

# ===== API 端点 2：聊天接口 =====
# POST /chat
# 这是核心接口，处理用户的 AI 对话请求
@app.route('/chat', methods=['POST'])
def chat():
    """
    Handle chat requests from Node.js backend
    处理来自 Node.js 后端的聊天请求

    Expected request body（期望的请求体格式）:
    {
        "message": "User message text",      # 用户的消息内容
        "channelId": "channel_id_string",    # 频道ID
        "username": "username"               # 用户名
    }
    """
    # try-except：错误处理
    try:
        # ===== 获取请求数据 =====
        # request.json：从 POST 请求的 body 中获取 JSON 数据
        data = request.json

        # ===== 验证请求数据 =====
        # 检查数据是否存在，以及是否包含 message 字段
        if not data or 'message' not in data:
            # 返回 400 错误（Bad Request，请求参数错误）
            return jsonify({'error': 'Message is required'}), 400

        # ===== 提取请求参数 =====
        user_message = data['message']                    # 用户的消息内容
        channel_id = data.get('channelId', 'default')    # 频道ID（如果没有就用 'default'）
        username = data.get('username', 'Anonymous')     # 用户名（如果没有就用 'Anonymous'）

        # ===== 初始化频道的对话历史 =====
        # 如果这个频道还没有对话历史，创建一个空列表
        if channel_id not in conversation_history:
            conversation_history[channel_id] = []

        # ===== 将用户消息添加到对话历史 =====
        conversation_history[channel_id].append({
            'role': 'user',           # 角色：用户
            'content': user_message   # 内容：用户的消息
        })

        # ===== 修剪对话历史（防止太长） =====
        # 如果对话历史超过限制（MAX_HISTORY * 2，因为一轮对话有2条消息）
        if len(conversation_history[channel_id]) > MAX_HISTORY * 2:
            # 只保留最后的 MAX_HISTORY * 2 条消息
            # 例如：MAX_HISTORY=10，就保留最后 20 条消息（10轮对话）
            conversation_history[channel_id] = conversation_history[channel_id][-(MAX_HISTORY * 2):]

        # ===== 准备 DeepSeek API 请求 =====

        # 设置请求头（HTTP Headers）
        headers = {
            'Authorization': f'Bearer {DEEPSEEK_API_KEY}',  # 授权：使用 API 密钥
            'Content-Type': 'application/json'              # 内容类型：JSON
        }

        # 构建请求体（Payload）
        payload = {
            'model': 'deepseek-chat',   # 使用的 AI 模型：deepseek-chat

            # messages：发送给 AI 的消息列表
            'messages': [
                {
                    # 第一条：系统消息（System Message）
                    # 这是给 AI 的"指令"，告诉 AI 应该如何表现
                    'role': 'system',
                    'content': 'You are a helpful AI assistant in a Discord-like chat room. Keep responses concise and friendly (max 200 words). Respond in the same language as the user. Be conversational and engaging.'
                    # 翻译：你是一个有帮助的 AI 助手，在类似 Discord 的聊天室中。
                    #      保持回复简洁友好（最多200字）。用用户的语言回复。要有对话性和吸引力。
                },
                # *conversation_history[channel_id]：
                # * 是 Python 的"解包"操作符，将列表中的所有元素展开
                # 例如：[1, 2, 3] -> 1, 2, 3
                # 这里是将对话历史中的所有消息添加到 messages 列表中
                *conversation_history[channel_id]
            ],

            # temperature：温度参数（0-1），控制 AI 回复的随机性
            # 0.7 表示中等随机性（0=完全确定性，1=完全随机）
            'temperature': 0.7,

            # max_tokens：最多生成多少个 token（词）
            # 500 个 token 大约是 200-300 个中文字符或 400 个英文单词
            'max_tokens': 500
        }

        # ===== 调用 DeepSeek API =====
        # requests.post()：发送 POST 请求
        response = requests.post(
            DEEPSEEK_API_URL,    # 请求地址
            headers=headers,     # 请求头
            json=payload,        # 请求体（自动转换为 JSON）
            timeout=30           # 超时时间：30秒
        )

        # ===== 检查 API 响应状态 =====
        # status_code：HTTP 状态码
        # 200 表示成功，其他值表示失败
        if response.status_code != 200:
            # 如果 API 调用失败，记录错误并返回
            error_detail = response.text[:200]  # 只取前200个字符（避免日志太长）
            app.logger.error(f'DeepSeek API error: {response.status_code} - {error_detail}')

            # 返回错误信息
            return jsonify({
                'error': 'DeepSeek API error',
                'details': error_detail
            }), response.status_code

        # ===== 解析 API 响应 =====
        # response.json()：将响应体从 JSON 字符串转换为 Python 字典
        result = response.json()

        # ===== 验证响应数据 =====
        # 检查响应中是否包含 choices 字段（AI 的回复）
        if 'choices' not in result or len(result['choices']) == 0:
            return jsonify({'error': 'No response from DeepSeek API'}), 500

        # ===== 提取 AI 的回复内容 =====
        # result['choices'][0]['message']['content']：从响应中获取 AI 的回复文本
        ai_message = result['choices'][0]['message']['content']

        # ===== 将 AI 回复添加到对话历史 =====
        conversation_history[channel_id].append({
            'role': 'assistant',  # 角色：助手（AI）
            'content': ai_message  # 内容：AI 的回复
        })

        # ===== 记录日志 =====
        app.logger.info(f'✅ AI responded to {username} in channel {channel_id}')

        # ===== 返回成功响应 =====
        return jsonify({
            'response': ai_message,                # AI 的回复内容
            'model': 'deepseek-chat',              # 使用的模型
            'timestamp': datetime.now().isoformat() # 响应时间
        })

    # ===== 异常处理 =====

    # 捕获请求超时异常
    except requests.exceptions.Timeout:
        app.logger.error('DeepSeek API timeout')
        # 返回 504 错误（Gateway Timeout，网关超时）
        return jsonify({'error': 'DeepSeek API timeout'}), 504

    # 捕获其他请求异常（如网络错误、连接失败等）
    except requests.exceptions.RequestException as e:
        app.logger.error(f'Request failed: {str(e)}')
        # 返回 500 错误（Internal Server Error，服务器内部错误）
        return jsonify({'error': f'Request failed: {str(e)}'}), 500

    # 捕获所有其他异常
    except Exception as e:
        app.logger.error(f'Chat error: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

# ===== API 端点 3：清除对话历史 =====
# POST /clear-history/<channel_id>
# 这个接口用于清除某个频道的对话历史
# 例如：POST /clear-history/abc123
@app.route('/clear-history/<channel_id>', methods=['POST'])
def clear_history(channel_id):
    """Clear conversation history for a channel"""
    # 清除指定频道的对话历史

    # 检查这个频道是否有对话历史
    if channel_id in conversation_history:
        # 如果有，清空它（设置为空列表）
        conversation_history[channel_id] = []
        return jsonify({'message': 'History cleared'})

    # 如果这个频道没有对话历史，返回 404 错误（Not Found，未找到）
    return jsonify({'message': 'No history found'}), 404

# ===== API 端点 4：获取对话历史 =====
# GET /history/<channel_id>
# 这个接口用于查看某个频道的对话历史（主要用于调试）
# 例如：GET /history/abc123
@app.route('/history/<channel_id>', methods=['GET'])
def get_history(channel_id):
    """Get conversation history for a channel (for debugging)"""
    # 获取指定频道的对话历史（用于调试）

    # conversation_history.get(channel_id, [])：
    # 获取频道的对话历史，如果不存在就返回空列表
    history = conversation_history.get(channel_id, [])

    # 返回对话历史信息
    return jsonify({
        'channelId': channel_id,         # 频道ID
        'messageCount': len(history),    # 消息数量
        'history': history               # 完整的对话历史
    })

# ===== 启动 Flask 应用 =====
# if __name__ == '__main__'：
# 这是 Python 的特殊写法，只有直接运行这个文件时才会执行下面的代码
# 如果这个文件被其他文件 import，下面的代码不会执行
if __name__ == '__main__':
    # ===== 读取配置 =====

    # 从环境变量读取端口号，默认 5000
    port = int(os.getenv('PORT', 5000))

    # 从环境变量读取运行模式
    # 如果 FLASK_ENV='development'，就启用调试模式
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'

    # ===== 打印启动信息 =====
    print('=' * 50)
    print('🤖 DeepSeek AI Chat Service')
    print('=' * 50)
    print(f'Port: {port}')
    print(f'Debug: {debug_mode}')
    # DEEPSEEK_API_KEY[:10]：只显示 API 密钥的前10个字符（安全考虑）
    print(f'API Key: {DEEPSEEK_API_KEY[:10]}...')
    print('=' * 50)

    # ===== 启动 Flask 服务器 =====
    # app.run()：启动服务器
    # host='0.0.0.0'：监听所有网络接口（允许外部访问）
    #                如果设置为 '127.0.0.1' 或 'localhost'，只能本机访问
    # port=port：监听指定端口
    # debug=debug_mode：是否启用调试模式
    #                   调试模式的好处：
    #                   1. 代码修改后自动重启
    #                   2. 显示详细的错误信息
    #                   3. 提供交互式调试器
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
