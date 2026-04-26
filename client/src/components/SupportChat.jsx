import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { IoSend, IoChatbubblesSharp, IoClose, IoRefresh } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';

const SupportChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  // Persistence: threadId
  const [threadId, setThreadId] = useState(() => {
    return localStorage.getItem('rag_thread_id') || `thread_${Math.random().toString(36).substr(2, 9)}`;
  });

  useEffect(() => {
    localStorage.setItem('rag_thread_id', threadId);
  }, [threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/rag/chat', {
        question: input,
        threadId: threadId,
      });

      const aiMsg = { role: 'assistant', content: response.data.answer };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble connecting right now. Please try again later." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = async () => {
    if (window.confirm('Reset this conversation?')) {
      await api.post('/rag/clear-history', { threadId });
      setMessages([]);
      const newThread = `thread_${Math.random().toString(36).substr(2, 9)}`;
      setThreadId(newThread);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-outfit">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[320px] md:w-[360px] h-[480px] md:h-[500px] glass rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/40"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                  <IoChatbubblesSharp className="text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">RideDosthi AI</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider opacity-80">Online Support</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={resetChat} title="Reset Chat" className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <IoRefresh className="text-xl" />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <IoClose className="text-2xl" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center">
                    <IoChatbubblesSharp className="text-3xl text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">👋 Hi! I'm your RideDosthi assistant.</p>
                    <p className="text-slate-400 text-sm mt-1">Ask me about rides, payments, safety, or troubleshooting.</p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-none'
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <span className="text-[9px] opacity-60 mt-1 block text-right">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="How can we help you today?"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <button
                disabled={isLoading || !input.trim()}
                type="submit"
                className="w-11 h-11 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shrink-0"
              >
                <IoSend className="text-xl" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl hover:shadow-indigo-300 transition-shadow relative group"
      >
        <div className="absolute inset-0 rounded-full bg-indigo-600 animate-ping opacity-20 -z-10 group-hover:block" />
        {isOpen ? <IoClose /> : <IoChatbubblesSharp />}
      </motion.button>
    </div>
  );
};

export default SupportChat;
