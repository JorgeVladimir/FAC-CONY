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
    { id: 'profile', icon: 'fa-user-tie', label: 'Cuenta' },
  ];

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    profile: 'Cuenta',
    'ai-chat': 'Asistente IA'
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
      {/* Sidebar */}
      <div className="md:w-64 w-20 bg-slate-900/95 backdrop-blur text-white flex flex-col fixed h-full transition-all duration-300 z-50 border-r border-slate-800/80 shadow-2xl shadow-slate-900/30">
        <div className="p-6 flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40 p-1 border border-white/50">
              <img src="/LOGO%20GRUPO%20LINA.jpeg" alt="Logo Grupo Lina" className="w-full h-full object-contain rounded-md" />
            </div>
            <span className="font-black text-xl hidden md:block tracking-tighter">GRUPO LINA</span>
          </div>
          <span className="text-[10px] text-red-400 font-bold hidden md:block tracking-widest mt-1 uppercase">GRUPO LINA</span>
        </div>

        <nav className="flex-1 mt-6 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' 
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
        <header className="h-16 sm:h-20 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 shadow-sm">
          <h1 className="text-base sm:text-xl font-bold text-slate-800 uppercase tracking-tight">
            {pageTitles[activeTab] || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right hidden sm:block">
              {/* FIX: Using user.fullName instead of non-existent user.name */}
              <p className="text-sm font-bold text-slate-900 leading-none">{user.fullName}</p>
              <p className={`text-[10px] font-black mt-1 uppercase tracking-tighter inline-flex items-center px-2 py-1 rounded-full ${user.fidelizado ? 'text-emerald-700 bg-emerald-100' : 'text-slate-600 bg-slate-200'}`}>
                {user.fidelizado ? 'Fidelizado: SI' : 'Fidelizado: NO'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold border-2 border-white shadow-sm">
              {/* FIX: Using user.fullName instead of non-existent user.name */}
              {user.fullName.charAt(0)}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-8">
          {children}
        </main>

        <button
          onClick={() => setActiveTab(activeTab === 'ai-chat' ? 'dashboard' : 'ai-chat')}
          title={activeTab === 'ai-chat' ? 'Volver al Dashboard' : 'Abrir Asistencia IA'}
          aria-label={activeTab === 'ai-chat' ? 'Volver al Dashboard' : 'Abrir Asistencia IA'}
          className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 text-white shadow-2xl shadow-red-900/40 hover:bg-red-700 transition-all flex items-center justify-center"
        >
          <i className={`fas ${activeTab === 'ai-chat' ? 'fa-xmark' : 'fa-robot'} text-xl sm:text-2xl`}></i>
        </button>
      </div>
    </div>
  );
};

export default Layout;