import pytest
import json
from app import app, conversation_history, MAX_HISTORY


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get('/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['service'] == 'DeepSeek AI Chat Service'


class TestChatEndpoint:
    def setup_method(self):
        conversation_history.clear()

    def test_chat_requires_message(self, client):
        response = client.post('/chat',
                                json={},
                                content_type='application/json')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_chat_empty_body(self, client):
        response = client.post('/chat',
                                content_type='application/json',
                                data=json.dumps({}))
        assert response.status_code == 400

    def test_chat_missing_message_field(self, client):
        response = client.post('/chat',
                                json={'channelId': 'test'},
                                content_type='application/json')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Message is required' in data['error']

    def test_chat_with_message_only(self, client):
        response = client.post('/chat',
                                json={'message': 'Hello'},
                                content_type='application/json')

        data = json.loads(response.data)

        if response.status_code == 200:
            assert 'response' in data
            assert 'model' in data
            assert data['model'] == 'deepseek-chat'
        elif response.status_code in [401, 429, 500]:
            assert 'error' in data

    def test_chat_with_channel_and_username(self, client):
        response = client.post('/chat',
                                json={
                                    'message': 'Test message',
                                    'channelId': 'test-channel',
                                    'username': 'testuser'
                                },
                                content_type='application/json')

        data = json.loads(response.data)

        if response.status_code == 200:
            assert 'response' in data
            assert 'test-channel' in conversation_history
        elif response.status_code in [401, 429, 500]:
            assert 'error' in data

    def test_chat_conversation_history(self, client):
        channel_id = 'history-test'

        client.post('/chat',
                    json={
                        'message': 'First message',
                        'channelId': channel_id,
                        'username': 'testuser'
                    },
                    content_type='application/json')

        assert channel_id in conversation_history
        assert len(conversation_history[channel_id]) >= 1

        if len(conversation_history[channel_id]) >= 1:
            assert conversation_history[channel_id][0]['role'] == 'user'
            assert conversation_history[channel_id][0]['content'] == 'First message'

    def test_chat_history_limit(self, client):
        channel_id = 'limit-test'

        for i in range(MAX_HISTORY * 2 + 5):
            client.post('/chat',
                        json={
                            'message': f'Message {i}',
                            'channelId': channel_id,
                            'username': 'testuser'
                        },
                        content_type='application/json')

        assert len(conversation_history[channel_id]) <= MAX_HISTORY * 2


class TestHistoryEndpoints:
    def setup_method(self):
        conversation_history.clear()

    def test_get_empty_history(self, client):
        response = client.get('/history/test-channel')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['channelId'] == 'test-channel'
        assert data['messageCount'] == 0
        assert data['history'] == []

    def test_get_history_with_messages(self, client):
        channel_id = 'test-channel'
        conversation_history[channel_id] = [
            {'role': 'user', 'content': 'Hello'},
            {'role': 'assistant', 'content': 'Hi there!'}
        ]

        response = client.get(f'/history/{channel_id}')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['messageCount'] == 2
        assert len(data['history']) == 2

    def test_clear_history(self, client):
        channel_id = 'test-channel'
        conversation_history[channel_id] = [
            {'role': 'user', 'content': 'Hello'}
        ]

        response = client.post(f'/clear-history/{channel_id}')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'cleared' in data['message'].lower()
        assert len(conversation_history[channel_id]) == 0

    def test_clear_nonexistent_history(self, client):
        response = client.post('/clear-history/nonexistent')
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'no history' in data['message'].lower() or 'not found' in data['message'].lower()


class TestIntegration:
    def setup_method(self):
        conversation_history.clear()

    def test_conversation_flow(self, client):
        channel_id = 'flow-test'

        response1 = client.post('/chat',
                                 json={
                                     'message': 'Hello',
                                     'channelId': channel_id,
                                     'username': 'testuser'
                                 },
                                 content_type='application/json')

        if response1.status_code != 200:
            pytest.skip("API call failed")

        get_response = client.get(f'/history/{channel_id}')
        assert get_response.status_code == 200
        data = json.loads(get_response.data)
        assert data['messageCount'] >= 1

        clear_response = client.post(f'/clear-history/{channel_id}')
        assert clear_response.status_code == 200

        final_response = client.get(f'/history/{channel_id}')
        final_data = json.loads(final_response.data)
        assert final_data['messageCount'] == 0
