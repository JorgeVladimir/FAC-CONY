import React from 'react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab }) => {
  if (!user) return <>{children}</>;

  const menuItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
    { id: 'invoices', icon: 'fa-file-invoice-dollar', label: 'Mis Facturas' },
    { id: 'ai-chat', icon: 'fa-robot', label: 'Asistente IA' },
    { id: 'profile', icon: 'fa-user-tie', label: 'Cuenta' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="md:w-64 w-20 bg-slate-900 text-white flex flex-col fixed h-full transition-all duration-300 z-50">
        <div className="p-6 flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/40">
              <i className="fas fa-box-open text-white"></i>
            </div>
            <span className="font-black text-xl hidden md:block tracking-tighter">ONI S.A.</span>
          </div>
          <span className="text-[10px] text-orange-400 font-bold hidden md:block tracking-widest mt-1 uppercase">Comercializadora</span>
        </div>

        <nav className="flex-1 mt-6 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon} w-6`}></i>
              <span className="font-medium hidden md:block">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-all"
          >
            <i className="fas fa-sign-out-alt w-6"></i>
            <span className="font-medium hidden md:block">Salir</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 ml-20 flex flex-col">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
            {menuItems.find(m => m.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              {/* FIX: Using user.fullName instead of non-existent user.name */}
              <p className="text-sm font-bold text-slate-900 leading-none">{user.fullName}</p>
              <p className="text-[10px] text-orange-600 font-bold mt-1 uppercase tracking-tighter">{user.taxId}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold border-2 border-white shadow-sm">
              {/* FIX: Using user.fullName instead of non-existent user.name */}
              {user.fullName.charAt(0)}
            </div>
          </div>
        </header>

        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;