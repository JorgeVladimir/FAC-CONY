
import React, { useState, useRef, useEffect } from 'react';
import { Invoice, ChatMessage } from '../types';
import { chatWithAI } from '../services/geminiService';

interface Props {
  invoices: Invoice[];
}

const AIChat: React.FC<Props> = ({ invoices }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: '¡Bienvenido al asistente de Comercializadora Oni S.A.! ¿En qué puedo apoyarte hoy con tus facturas o el estado de tu cuenta?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const response = await chatWithAI(history, userMsg, invoices);
    
    setMessages(prev => [...prev, { role: 'model', content: response }]);
    setIsLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-16rem)] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
      {/* Header Chat */}
      <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/40">
            <i className="fas fa-headset text-white text-xl"></i>
          </div>
          <div>
            <h3 className="font-black tracking-tight">Oni Concierge AI</h3>
            <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Soporte Inteligente</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-300">SISTEMA ACTIVO</span>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30"
      >
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-1 shadow-sm ${
                msg.role === 'user' ? 'bg-white text-slate-400 border border-slate-200' : 'bg-orange-500 text-white'
              }`}>
                <i className={`fas ${msg.role === 'user' ? 'fa-user' : 'fa-robot'} text-sm`}></i>
              </div>
              <div className={`p-5 rounded-3xl text-sm leading-relaxed shadow-sm font-medium ${
                msg.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
              }`}>
                {msg.content.split('\n').map((line, i) => <p key={i} className="mb-2 last:mb-0">{line}</p>)}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="max-w-[85%] flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg animate-pulse">
                <i className="fas fa-robot text-sm"></i>
              </div>
              <div className="bg-white p-5 rounded-3xl flex items-center gap-3 border border-slate-100 shadow-sm">
                <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-white border-t border-slate-100">
        <div className="flex gap-3 p-1.5 border-2 border-slate-100 rounded-2xl focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-100 transition-all bg-slate-50/50">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="¿Cuánto facturé el mes pasado?..."
            className="flex-1 px-5 py-4 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-bold"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-8 py-3 bg-orange-600 text-white rounded-xl font-black hover:bg-orange-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-orange-100"
          >
            <i className="fas fa-paper-plane"></i>
            <span className="hidden sm:inline">ENVIAR</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
