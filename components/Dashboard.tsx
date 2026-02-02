
import React from 'react';
import { Invoice } from '../types';

interface Props {
  invoices: Invoice[];
  onViewInvoice: (id: string) => void;
}

const Dashboard: React.FC<Props> = ({ invoices, onViewInvoice }) => {
  const totalPaid = invoices.filter(i => i.status === 'PAGADA').reduce((acc, curr) => acc + curr.total, 0);
  const totalInvoices = invoices.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm group hover:border-orange-200 transition-all">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
              <i className="fas fa-wallet"></i>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Consumo Total Acumulado</p>
              <h3 className="text-3xl font-black text-slate-900">USD {totalPaid.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm group hover:border-orange-200 transition-all">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
              <i className="fas fa-receipt"></i>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Documentos Sincronizados</p>
              <h3 className="text-3xl font-black text-slate-900">{totalInvoices} Facturas</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-3 uppercase tracking-tighter">
            <i className="fas fa-stream text-orange-500"></i>
            Trazabilidad de Compras (Número de Sistema)
          </h3>
          <button className="text-orange-600 text-xs font-black uppercase tracking-widest hover:text-orange-700 transition-colors">Ver Historial Completo</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50">
                <th className="px-10 py-5">Identificador LADF</th>
                <th className="px-10 py-5">Fecha / Hora</th>
                <th className="px-10 py-5">Monto Final</th>
                <th className="px-10 py-5">Estado</th>
                <th className="px-10 py-5 text-right">Ver Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-orange-50/30 transition-colors group">
                  <td className="px-10 py-6 font-black text-slate-800 tracking-tight">{invoice.systemNumber}</td>
                  <td className="px-10 py-6 text-slate-500 font-bold text-xs">{invoice.date} - {invoice.time}</td>
                  <td className="px-10 py-6 font-black text-slate-900">USD {invoice.total.toLocaleString()}</td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      invoice.status === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' :
                      invoice.status === 'PENDIENTE' ? 'bg-orange-100 text-orange-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button 
                      onClick={() => onViewInvoice(invoice.id)}
                      className="text-orange-600 hover:text-orange-800 font-black text-xs uppercase tracking-widest border-b-2 border-orange-200 hover:border-orange-600 transition-all"
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
