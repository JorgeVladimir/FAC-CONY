
import React, { useState, useRef, useEffect } from 'react';
import { Invoice, ChatMessage } from '../types';
import { chatWithAI } from '../services/geminiService';

interface Props {
  invoices: Invoice[];
}

const AIChat: React.FC<Props> = ({ invoices }) => {
  const ADMIN_PHONE_E164 = '593984132326';
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: '¡Bienvenido al asistente de GRUPO LINA! ¿En qué puedo apoyarte hoy con tus facturas o el estado de tu cuenta?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [missingInvoiceSerie, setMissingInvoiceSerie] = useState('');
  const [missingInvoiceNumber, setMissingInvoiceNumber] = useState('');
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

  const handleQuickQuestion = (question: string) => {
    if (isLoading) return;
    setInput(question);
  };

  const handleMissingInvoiceRequest = () => {
    const serie = missingInvoiceSerie.trim().toUpperCase();
    const number = missingInvoiceNumber.trim();

    if (!serie || !number) {
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: 'Para solicitar apoyo del administrador, ingresa la serie y el número de factura.'
        }
      ]);
      return;
    }

    const text = [
      'Hola, administrador de GRUPO LINA.',
      'No me aparece una factura en el portal.',
      `Serie: ${serie}`,
      `Número: ${number}`,
      'Por favor enviarla a mi WhatsApp registrado.'
    ].join('\n');

    const waUrl = `https://wa.me/${ADMIN_PHONE_E164}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    setMessages(prev => [
      ...prev,
      {
        role: 'model',
        content: `Solicitud enviada por WhatsApp al administrador (0984132326) con la serie ${serie} y número ${number}.`
      }
    ]);

    setMissingInvoiceSerie('');
    setMissingInvoiceNumber('');
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] sm:h-[calc(100vh-16rem)] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
      {/* Header Chat */}
      <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/40">
            <i className="fas fa-headset text-white text-xl"></i>
          </div>
          <div>
            <h3 className="font-black tracking-tight text-sm sm:text-base">Oni Concierge AI</h3>
            <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">Soporte Inteligente</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-300">SISTEMA ACTIVO</span>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-8 bg-slate-50/30"
      >
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preguntas Frecuentes</p>
            <p className="text-xs text-slate-600 font-bold mt-1">Selecciona una opción rápida o reporta una factura que no aparece.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickQuestion('¿Cómo descargo el PDF y XML de una factura?')}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700"
            >
              ¿Cómo descargo el PDF y XML de una factura?
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuestion('¿Qué significa el estado de mi factura en el sistema?')}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700"
            >
              ¿Qué significa el estado de mi factura?
            </button>
          </div>

          <div className="border border-red-200 bg-red-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-black text-red-700 uppercase tracking-wide">
              ¿No te aparece alguna factura? Coloca aquí la serie y el número.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={missingInvoiceSerie}
                onChange={(e) => setMissingInvoiceSerie(e.target.value.toUpperCase())}
                placeholder="Serie"
                className="w-full px-3 py-2 rounded-xl border border-red-200 bg-white outline-none focus:border-red-500 text-xs font-bold"
              />
              <input
                type="text"
                value={missingInvoiceNumber}
                onChange={(e) => setMissingInvoiceNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Número"
                className="w-full px-3 py-2 rounded-xl border border-red-200 bg-white outline-none focus:border-red-500 text-xs font-bold"
              />
              <button
                type="button"
                onClick={handleMissingInvoiceRequest}
                className="w-full px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider"
              >
                Enviar a WhatsApp
              </button>
            </div>
            <p className="text-[10px] text-red-700 font-bold">
              Esta solicitud se envía al administrador: 0984132326.
            </p>
          </div>
        </div>

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-1 shadow-sm ${
                msg.role === 'user' ? 'bg-white text-slate-400 border border-slate-200' : 'bg-red-600 text-white'
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
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg animate-pulse">
                <i className="fas fa-robot text-sm"></i>
              </div>
              <div className="bg-white p-5 rounded-3xl flex items-center gap-3 border border-slate-100 shadow-sm">
                <div className="w-2 h-2 bg-red-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-red-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-red-300 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 sm:p-6 bg-white border-t border-slate-100">
        <div className="flex gap-3 p-1.5 border-2 border-slate-100 rounded-2xl focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100 transition-all bg-slate-50/50">
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
            className="px-4 sm:px-8 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
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
