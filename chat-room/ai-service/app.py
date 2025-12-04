from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# DeepSeek API Configuration
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', 'sk-de5ab2d8fa3642b990a1febc331a6ff1')
DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

# Conversation history (in-memory, per channel)
# Structure: { channelId: [ {role: "user/assistant", content: "..."}, ... ] }
conversation_history = {}
MAX_HISTORY = 10  # Keep last 10 messages per channel

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'DeepSeek AI Chat Service'
    })

@app.route('/chat', methods=['POST'])
def chat():
    """
    Handle chat requests from Node.js backend

    Expected request body:
    {
        "message": "User message text",
        "channelId": "channel_id_string",
        "username": "username"
    }
    """
    try:
        data = request.json

        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400

        user_message = data['message']
        channel_id = data.get('channelId', 'default')
        username = data.get('username', 'Anonymous')

        # Initialize history for channel if not exists
        if channel_id not in conversation_history:
            conversation_history[channel_id] = []

        # Add user message to history
        conversation_history[channel_id].append({
            'role': 'user',
            'content': user_message
        })

        # Trim history if too long
        if len(conversation_history[channel_id]) > MAX_HISTORY * 2:
            conversation_history[channel_id] = conversation_history[channel_id][-(MAX_HISTORY * 2):]

        # Prepare request to DeepSeek
        headers = {
            'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': 'deepseek-chat',
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are a helpful AI assistant in a Discord-like chat room. Keep responses concise and friendly (max 200 words). Respond in the same language as the user. Be conversational and engaging.'
                },
                *conversation_history[channel_id]
            ],
            'temperature': 0.7,
            'max_tokens': 500
        }

        # Call DeepSeek API
        response = requests.post(
            DEEPSEEK_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )

        if response.status_code != 200:
            error_detail = response.text[:200]  # Limit error message
            app.logger.error(f'DeepSeek API error: {response.status_code} - {error_detail}')
            return jsonify({
                'error': 'DeepSeek API error',
                'details': error_detail
            }), response.status_code

        result = response.json()

        if 'choices' not in result or len(result['choices']) == 0:
            return jsonify({'error': 'No response from DeepSeek API'}), 500

        ai_message = result['choices'][0]['message']['content']

        # Add AI response to history
        conversation_history[channel_id].append({
            'role': 'assistant',
            'content': ai_message
        })

        app.logger.info(f'✅ AI responded to {username} in channel {channel_id}')

        return jsonify({
            'response': ai_message,
            'model': 'deepseek-chat',
            'timestamp': datetime.now().isoformat()
        })

    except requests.exceptions.Timeout:
        app.logger.error('DeepSeek API timeout')
        return jsonify({'error': 'DeepSeek API timeout'}), 504
    except requests.exceptions.RequestException as e:
        app.logger.error(f'Request failed: {str(e)}')
        return jsonify({'error': f'Request failed: {str(e)}'}), 500
    except Exception as e:
        app.logger.error(f'Chat error: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/clear-history/<channel_id>', methods=['POST'])
def clear_history(channel_id):
    """Clear conversation history for a channel"""
    if channel_id in conversation_history:
        conversation_history[channel_id] = []
        return jsonify({'message': 'History cleared'})
    return jsonify({'message': 'No history found'}), 404

@app.route('/history/<channel_id>', methods=['GET'])
def get_history(channel_id):
    """Get conversation history for a channel (for debugging)"""
    history = conversation_history.get(channel_id, [])
    return jsonify({
        'channelId': channel_id,
        'messageCount': len(history),
        'history': history
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'

    print('=' * 50)
    print('🤖 DeepSeek AI Chat Service')
    print('=' * 50)
    print(f'Port: {port}')
    print(f'Debug: {debug_mode}')
    print(f'API Key: {DEEPSEEK_API_KEY[:10]}...')
    print('=' * 50)

    app.run(host='0.0.0.0', port=port, debug=debug_mode)
