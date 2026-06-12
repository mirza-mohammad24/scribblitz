'use client';

import { useState, useRef, useEffect } from 'react';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { ClientEvents } from '@scribblitz/types';

export const ChatBox = () => {
  const { socket, userId } = useGameSocket();
  const { chatMessages, roundId, currentDrawerId } = useGameStore();

  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Security check: The active drawer is not allowed to use the chat
  const isDrawer = userId === currentDrawerId;

  // Auto-scroll to the bottom whenever a new message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || isDrawer) return;

    // Emit the message to the server, attaching the roundId to prevent cross-round leaks
    socket.emit(ClientEvents.CHAT_MESSAGE, { message: message.trim(), roundId });
    setMessage('');
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-sm bg-white border-2 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white p-3 font-bold text-center border-b">Game Chat</div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2 bg-gray-50">
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-lg max-w-[90%] shadow-sm ${
              msg.isSystem
                ? 'bg-green-100 text-green-900 italic font-bold self-center text-sm w-full text-center border border-green-300'
                : msg.senderId === userId
                  ? 'bg-blue-100 self-end text-right'
                  : 'bg-white border self-start'
            }`}
          >
            {!msg.isSystem && (
              <span className="font-bold text-xs block text-gray-500 mb-1">{msg.senderName}</span>
            )}
            <span className="break-words">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 border-t bg-white flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isDrawer}
          placeholder={isDrawer ? "Drawers can't chat!" : 'Type your guess...'}
          className="flex-1 p-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-200 transition-colors"
        />
        <button
          type="submit"
          disabled={isDrawer || !message.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold disabled:bg-gray-400 hover:bg-blue-700 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};
