
import React from 'react';
import { Invoice } from '../types';

interface Props {
  invoices: Invoice[];
  onViewInvoice: (id: string) => void;
}

const Dashboard: React.FC<Props> = ({ invoices, onViewInvoice }) => {
  const totalPaid = invoices.reduce((acc, curr) => acc + curr.total, 0);
  const totalInvoices = invoices.length;
  const accumulatedPoints = Math.floor(totalPaid / 20) * 10;
  const getSerie = (invoice: Invoice) => {
    const serieFromFolio = invoice.folio?.split('-')?.[0]?.trim();
    return serieFromFolio || invoice.systemNumber;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm group hover:border-red-200 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-inner">
              <i className="fas fa-wallet"></i>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Consumo Total Acumulado</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">USD {totalPaid.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm group hover:border-red-200 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-inner">
              <i className="fas fa-star"></i>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Puntos Acumulados</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{accumulatedPoints} Puntos</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm group hover:border-red-200 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-inner">
              <i className="fas fa-receipt"></i>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Documentos Sincronizados</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{totalInvoices} Facturas</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white gap-3">
          <h3 className="font-black text-slate-800 text-sm sm:text-lg flex items-center gap-2 sm:gap-3 uppercase tracking-tighter">
            <i className="fas fa-stream text-red-500"></i>
            Trazabilidad de Compras (Número de Serie)
          </h3>
          <button className="hidden sm:block text-red-600 text-xs font-black uppercase tracking-widest hover:text-red-700 transition-colors">Ver Historial Completo</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50">
                <th className="px-4 sm:px-10 py-4 sm:py-5">Numero de Serie</th>
                <th className="px-4 sm:px-10 py-4 sm:py-5">Fecha / Hora</th>
                <th className="px-4 sm:px-10 py-4 sm:py-5">Monto Final</th>
                <th className="px-4 sm:px-10 py-4 sm:py-5 text-right">Ver Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-red-50/40 transition-colors group">
                  <td className="px-4 sm:px-10 py-5 sm:py-6 font-black text-slate-800 tracking-tight text-xs sm:text-sm">{getSerie(invoice)}</td>
                  <td className="px-4 sm:px-10 py-5 sm:py-6 text-slate-500 font-bold text-[10px] sm:text-xs">{invoice.date} - {invoice.time}</td>
                  <td className="px-4 sm:px-10 py-5 sm:py-6 font-black text-slate-900 text-xs sm:text-sm">USD {invoice.total.toLocaleString()}</td>
                  <td className="px-4 sm:px-10 py-5 sm:py-6 text-right">
                    <button 
                      onClick={() => {
                        const downloadUrl = invoice.pdfUrl || invoice.xmlUrl;
                        if (downloadUrl) {
                          window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                          return;
                        }

                        onViewInvoice(invoice.id);
                      }}
                      className="text-red-600 hover:text-red-800 font-black text-[10px] sm:text-xs uppercase tracking-widest border-b-2 border-red-200 hover:border-red-600 transition-all"
                    >
                      Consultar Compra
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
