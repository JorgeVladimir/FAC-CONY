
import React, { useState } from 'react';
import { Invoice } from '../types';
import { analyzeInvoiceWithAI } from '../services/geminiService';

interface Props {
  invoice: Invoice;
  onBack: () => void;
}

const InvoiceDetail: React.FC<Props> = ({ invoice, onBack }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeInvoiceWithAI(invoice);
    setAnalysis(result || "Error al analizar.");
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-3 text-orange-600 font-black hover:text-orange-800 transition-colors uppercase text-[10px] tracking-[0.2em]"
      >
        <i className="fas fa-arrow-left"></i> Volver al listado
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Mock Physical Receipt View */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl p-8 font-mono text-[11px] text-slate-800 space-y-4">
            <div className="text-center space-y-1">
              <p className="font-bold text-sm uppercase">COMERCIALIZADORA ONI S.A.</p>
              <p className="font-bold">RUC: 1793224843001</p>
              <p className="uppercase">Detalle de Consumo</p>
            </div>

            <div className="border-y border-dashed border-slate-300 py-3 space-y-1">
              <p className="font-bold">FACTURA DE VENTA</p>
              <p className="font-bold text-rose-600">ESTE DOCUMENTO NO TIENE VALIDEZ PARA EL SRI</p>
              <p>Obligado a llevar contabilidad</p>
            </div>

            <div className="space-y-1">
              <p className="font-bold uppercase tracking-widest text-[10px]">Clave de Acceso</p>
              <p className="break-all bg-slate-50 p-2 border border-slate-100">{invoice.accessKey}</p>
            </div>

            <div className="space-y-1 pt-2">
              <p><span className="font-bold uppercase">Cliente:</span> {invoice.clientName}</p>
              <p><span className="font-bold uppercase">Cedula o RUC:</span> {invoice.clientTaxId}</p>
              <p><span className="font-bold uppercase">Fecha:</span> {invoice.date} <span className="ml-4 font-bold uppercase">Hora:</span> {invoice.time}</p>
              <p><span className="font-bold uppercase">Factura N.:</span> {invoice.folio}</p>
              <p><span className="font-bold uppercase text-orange-600">Numero de Sistema:</span> {invoice.systemNumber}</p>
              <p><span className="font-bold uppercase">Vendedor:</span> {invoice.vendor}</p>
            </div>

            <div className="pt-4">
              <div className="flex justify-between border-b border-dashed border-slate-400 pb-1 mb-2 font-bold uppercase">
                <span className="w-16">REF</span>
                <span className="flex-1 px-2">DESCRIPCION</span>
                <span className="w-8 text-center">UND</span>
                <span className="w-16 text-right">PRECIO</span>
                <span className="w-16 text-right">TOTAL</span>
              </div>
              <div className="space-y-2">
                {invoice.items.map(item => (
                  <div key={item.id} className="flex justify-between items-start">
                    <span className="w-16 text-slate-500">{item.ref}</span>
                    <span className="flex-1 px-2 uppercase font-bold">{item.description}</span>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <span className="w-16 text-right">{item.unitPrice.toFixed(2)}</span>
                    <span className="w-16 text-right font-bold">{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL A PAGAR:</span>
                <span>USD {invoice.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center pt-10 opacity-40">
              <p>*** GRACIAS POR SU COMPRA ***</p>
            </div>
          </div>
        </div>

        {/* Action Panel and AI Analysis */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/40">
                <i className="fas fa-microchip text-xl"></i>
              </div>
              <div>
                <h3 className="font-black text-xl tracking-tighter">ONI Intellect</h3>
                <p className="text-[9px] text-orange-400 font-black uppercase tracking-[0.2em]">IA Estratégica</p>
              </div>
            </div>
            
            {!analysis && !isAnalyzing && (
              <div className="space-y-6">
                <p className="text-slate-400 text-xs leading-relaxed">
                  Basado en tu compra de <span className="text-white font-bold">{invoice.items.length} ítems</span> por un valor de <span className="text-white font-bold">${invoice.total}</span>, puedo darte consejos de ahorro o explicarte los impuestos aplicados.
                </p>
                <button 
                  onClick={handleAIAnalysis}
                  className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-xs hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-900/30"
                >
                  Consultar a la IA
                </button>
              </div>
            )}

            {isAnalyzing && (
              <div className="flex flex-col items-center py-10 gap-6">
                <div className="w-10 h-10 border-4 border-orange-600/30 border-t-orange-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Analizando compra...</p>
              </div>
            )}

            {analysis && (
              <div className="bg-slate-800 rounded-2xl p-6 text-sm leading-relaxed border border-slate-700 text-slate-200">
                <div className="prose prose-invert prose-sm">
                   {analysis.split('\n').map((line, i) => <p key={i} className="mb-2 last:mb-0">{line}</p>)}
                </div>
                <button 
                  onClick={() => setAnalysis(null)}
                  className="mt-6 text-[9px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 underline"
                >
                  Nuevo Análisis
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white border-2 border-slate-200 p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-orange-500 transition-all group">
              <i className="fas fa-file-pdf text-2xl text-slate-400 group-hover:text-orange-600"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">RIDE Oficial</span>
            </button>
            <button className="bg-white border-2 border-slate-200 p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-orange-500 transition-all group">
              <i className="fas fa-code text-2xl text-slate-400 group-hover:text-orange-600"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Descargar XML</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
