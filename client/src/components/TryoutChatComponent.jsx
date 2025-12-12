import { useState, useCallback } from 'react';
import { useTryoutChatSocket } from '../hooks/useChatSocket';
import { useAuth } from '../context/AuthContext';

const TryoutChatComponent = ({ chatId }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');

    // ✅ Handle new messages
    const handleNewMessage = useCallback((message) => {
        setMessages(prev => [...prev, message]);
    }, []);

    // ✅ Handle tryout events
    const handleTryoutEvent = useCallback((eventType, data) => {
        console.log('Tryout event:', eventType, data);
        // Update UI based on event
        if (eventType === 'offerSent') {
            // Show offer notification
        } else if (eventType === 'ended') {
            // Show tryout ended message
        }
    }, []);

    // ✅ Initialize socket
    const { sendMessage } = useTryoutChatSocket(
        chatId,
        user?.id,
        handleNewMessage,
        handleTryoutEvent
    );

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;

        sendMessage(inputMessage);
        setInputMessage('');
    };

    return (
        <div>
            {/* Your chat UI */}
            <div>
                {messages.map((msg, idx) => (
                    <div key={idx}>{msg.message}</div>
                ))}
            </div>
            <input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage}>Send</button>
        </div>
    );
};

export default TryoutChatComponent;
