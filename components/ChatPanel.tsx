import React, { useState, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { ChatMessage } from '../types';
import { SendIcon, ChatIcon, SparklesIcon } from './Icons';
import { Loader } from './Loader';

interface ChatPanelProps {
  chat: Chat | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ chat }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !chat || isSending) return;

    const newUserMessage: ChatMessage = { role: 'user', content: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    const currentInput = userInput;
    setUserInput('');
    setIsSending(true);
    setError(null);

    try {
      const response = await chat.sendMessage({ message: currentInput });
      const modelMessage: ChatMessage = { role: 'model', content: response.text };
      setMessages(prev => [...prev, modelMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setError("メッセージの送信中にエラーが発生しました。もう一度お試しください。");
      // Restore user input and remove optimistic message on error
      setUserInput(currentInput);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  if (!chat) {
    return null;
  }
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <div className="p-4 border-b border-gray-700 flex items-center gap-3">
        <ChatIcon className="h-6 w-6 text-cyan-400" />
        <h2 className="text-xl font-bold text-white">AIチャット相談</h2>
      </div>
      <div className="p-4 h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col justify-center items-center text-center text-gray-400">
               <SparklesIcon className="h-12 w-12 text-gray-500 mb-3" />
               <p className="font-semibold">データに関する質問を入力してください</p>
               <p className="text-sm mt-1">例：「一番燃費が良いグレードは？」</p>
               <p className="text-sm">「サンルーフが付けられる車種を教えて」</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-cyan-400" /></div>}
              <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-gray-700' : 'bg-gray-700/50'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
           {isSending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-cyan-400" /></div>
              <div className="max-w-xl p-3 rounded-lg bg-gray-700/50 flex items-center">
                <Loader />
                <span className="text-sm ml-2 text-gray-400">考え中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-3">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isSending}
            className="flex-1 w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-3 disabled:bg-gray-600"
          />
          <button
            type="submit"
            disabled={isSending || !userInput.trim()}
            className="p-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 rounded-lg text-white transition-colors"
            aria-label="送信"
          >
            <SendIcon className="h-6 w-6" />
          </button>
        </form>
      </div>
    </div>
  );
};
