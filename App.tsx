import React, { useState, useEffect } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceDetail from './components/InvoiceDetail';
import AIChat from './components/AIChat';
import { User, Invoice } from './types';
import { MOCK_INVOICES } from './constants';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration States
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [lastName, setLastName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ecuador Identity Validation Logic
  const validateEcuadorId = (id: string): boolean => {
    if (!/^\d+$/.test(id)) return false;
    
    // Check length: Cedula (10) or RUC (13)
    if (id.length !== 10 && id.length !== 13) return false;

    // RUC basic check: must end in 001
    if (id.length === 13 && !id.endsWith('001')) return false;

    const mainId = id.substring(0, 10);
    const province = parseInt(mainId.substring(0, 2));
    if (province < 1 || province > 24) return false;

    const thirdDigit = parseInt(mainId[2]);
    if (thirdDigit > 6) return false;

    // Modulo 10 Algorithm for Cedula/Main Part
    const digits = mainId.split('').map(Number);
    const checkDigit = digits.pop()!;
    let sum = 0;
    
    digits.forEach((d, i) => {
      let val = (i % 2 === 0) ? d * 2 : d;
      if (val > 9) val -= 9;
      sum += val;
    });

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Simulación de login
    const mockUser: User = {
      id: 'usr-oni-1',
      email: email || 'jaqueline@gmail.com',
      firstName: 'JAQUELINE',
      secondName: 'ESTEFANIA',
      lastName: 'JATIVA',
      fullName: 'JAQUELINE ESTEFANIA JATIVA',
      taxId: '1705821328',
      companyName: 'JAQUELINE JATIVA S.A.',
      privacyAccepted: true,
      privacyTimestamp: new Date().toISOString()
    };
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName || !lastName || !taxId || !email || !password) {
      setError("Todos los campos obligatorios deben estar llenos.");
      return;
    }

    if (!validateEcuadorId(taxId)) {
      setError("La identificación (Cédula/RUC) no es válida para el Registro Civil de Ecuador.");
      return;
    }

    if (!privacyAccepted) {
      setError("Debe aceptar el tratamiento de sus datos personales.");
      return;
    }

    // Auto-formatting to Uppercase is handled in state updates or here
    const newUser: User = {
      id: `usr-${Date.now()}`,
      email,
      firstName: firstName.toUpperCase(),
      secondName: secondName.toUpperCase(),
      lastName: lastName.toUpperCase(),
      fullName: `${firstName} ${secondName} ${lastName}`.toUpperCase().replace(/\s+/g, ' ').trim(),
      taxId,
      privacyAccepted: true,
      privacyTimestamp: new Date().toISOString()
    };

    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  // FIX: Added handleLogout function to handle user logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setActiveTab('dashboard');
    setSelectedInvoiceId(null);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"></div>
        
        <div className="max-w-lg w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-500 border border-white/10">
          <div className="p-10">
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center text-white text-4xl mb-6 shadow-2xl shadow-orange-900/40 transform -rotate-3">
                <i className="fas fa-ship"></i>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight">
                CONY<br/>
                <span className="text-orange-600 text-sm tracking-[0.3em] font-black uppercase">Comercializadora Oni S.A.</span>
              </h2>
              <div className="h-1 w-16 bg-orange-600 rounded-full mt-4"></div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs font-bold rounded-r-xl animate-bounce">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                {error}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      required 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                      placeholder="PRIMER NOMBRE"
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 transition-all text-slate-800 font-bold placeholder:font-normal placeholder:text-slate-400 text-sm"
                    />
                    <input 
                      type="text" 
                      value={secondName}
                      onChange={(e) => setSecondName(e.target.value.toUpperCase())}
                      placeholder="SEGUNDO NOMBRE"
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 transition-all text-slate-800 font-bold placeholder:font-normal placeholder:text-slate-400 text-sm"
                    />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.toUpperCase())}
                    placeholder="APELLIDOS COMPLETOS"
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 transition-all text-slate-800 font-bold placeholder:font-normal placeholder:text-slate-400 text-sm"
                  />
                  <input 
                    type="text" 
                    required 
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))}
                    maxLength={13}
                    placeholder="IDENTIFICACIÓN (CÉDULA / RUC)"
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 transition-all text-slate-800 font-black tracking-widest text-sm"
                  />
                </div>
              )}

              <div className="relative">
                <i className="fas fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="CORREO ELECTRÓNICO"
                  className="w-full pl-14 pr-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 transition-all text-slate-800 font-bold text-sm"
                />
              </div>

              <div className="relative">
                <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input 
                  type={showPassword ? "text" : "password"}
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="CONTRASEÑA"
                  className="w-full pl-14 pr-14 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 transition-all text-slate-800 font-bold text-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              {!isLogin && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${privacyAccepted ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-100'}`}>
                  <input 
                    type="checkbox" 
                    id="privacy"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-orange-600 cursor-pointer"
                  />
                  <label htmlFor="privacy" className="text-[10px] leading-relaxed text-slate-600 cursor-pointer font-bold uppercase tracking-tight">
                    Acepto el tratamiento de mis datos personales conforme a la normativa vigente de protección de datos (Ecuador).
                  </label>
                </div>
              )}

              <button className="w-full bg-orange-600 text-white py-4.5 rounded-2xl font-black text-sm hover:bg-orange-700 shadow-2xl shadow-orange-900/20 transition-all active:scale-[0.98] mt-4 uppercase tracking-[0.2em]">
                {isLogin ? 'Ingresar al Sistema' : 'Crear Registro de Cliente'}
              </button>
            </form>

            <div className="mt-10 text-center">
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="text-slate-400 font-black hover:text-orange-600 transition-colors uppercase text-[10px] tracking-widest"
              >
                {isLogin ? '¿Es cliente nuevo? Solicitar Acceso' : '¿Ya tiene cuenta? Iniciar Sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (selectedInvoiceId) {
      const invoice = MOCK_INVOICES.find(i => i.id === selectedInvoiceId);
      return invoice ? <InvoiceDetail invoice={invoice} onBack={() => setSelectedInvoiceId(null)} /> : null;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard invoices={MOCK_INVOICES} onViewInvoice={setSelectedInvoiceId} />;
      case 'invoices':
        return (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
            <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div className="relative flex-1 max-w-lg">
                <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input 
                  type="text" 
                  placeholder="Localizar por LADF o Clave SRI..."
                  className="w-full pl-16 pr-8 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-orange-500 transition-all font-black text-sm"
                />
              </div>
              <div className="flex gap-4">
                <button className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-black text-xs hover:bg-orange-700 transition-all flex items-center gap-3 uppercase tracking-widest shadow-xl shadow-orange-100">
                  <i className="fas fa-sync-alt"></i> Sincronizar ICG
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 bg-slate-50/20">
                    <th className="px-12 py-8">Ref. Sistema</th>
                    <th className="px-12 py-8">Emisión</th>
                    <th className="px-12 py-8">Monto USD</th>
                    <th className="px-12 py-8">Estatus Fiscal</th>
                    <th className="px-12 py-8 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_INVOICES.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-orange-50/30 transition-colors group">
                      <td className="px-12 py-8 font-black text-slate-900 tracking-tight text-sm">{invoice.systemNumber}</td>
                      <td className="px-12 py-8 text-slate-500 font-bold text-xs">{invoice.date} {invoice.time}</td>
                      <td className="px-12 py-8 font-black text-slate-900 text-base">{invoice.currency} {invoice.total.toLocaleString()}</td>
                      <td className="px-12 py-8">
                        <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                          invoice.status === 'PAGADA' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          invoice.status === 'PENDIENTE' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          'bg-rose-100 text-rose-700 border border-rose-200'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-12 py-8 text-center">
                        <button 
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:bg-orange-600 transition-all shadow-xl shadow-slate-200 group-hover:scale-110"
                        >
                          <i className="fas fa-search-plus"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'ai-chat':
        return <AIChat invoices={MOCK_INVOICES} />;
      case 'profile':
        return (
          <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-white rounded-[3rem] border border-slate-200 p-14 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-80 h-80 bg-orange-50 rounded-full -mr-40 -mt-40 opacity-40"></div>
              
              <div className="flex flex-col items-center mb-14 relative z-10">
                <div className="w-36 h-36 rounded-[2.5rem] bg-slate-900 flex items-center justify-center text-white text-5xl font-black mb-8 border-8 border-white shadow-2xl relative overflow-hidden">
                   <div className="absolute inset-0 bg-orange-600 opacity-10"></div>
                  {user.firstName.charAt(0)}
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight text-center uppercase">{user.fullName}</h3>
                <div className="mt-4 flex gap-3">
                  <span className="px-4 py-1.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    ID: {user.taxId}
                  </span>
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    LOPDP: ACEPTADA
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10 bg-slate-50/50 p-10 rounded-[2rem] border border-slate-100">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Registro Civil ID</p>
                  <p className="text-slate-800 font-black text-lg tracking-tight">{user.taxId}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Correo de Enlace</p>
                  <p className="text-slate-800 font-black text-lg tracking-tight">{user.email}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Consentimiento LOPDP</p>
                  <p className="text-slate-600 font-bold text-xs bg-white px-4 py-2 rounded-xl shadow-sm inline-block border border-slate-100">
                    {new Date(user.privacyTimestamp).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Categoría ICG</p>
                  <p className="text-orange-600 font-black text-xs uppercase tracking-widest bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 inline-block">
                    CLIENTE PREFERENCIAL
                  </p>
                </div>
              </div>

              <div className="mt-14 flex justify-center relative z-10">
                 <button className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-600 transition-all shadow-2xl active:scale-95">
                  Actualizar Datos Registrados
                 </button>
              </div>
            </div>
          </div>
        );
      default:
        return <Dashboard invoices={MOCK_INVOICES} onViewInvoice={setSelectedInvoiceId} />;
    }
  };

  return (
    <Router>
      <Layout 
        user={user} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedInvoiceId(null);
        }}
      >
        {renderContent()}
      </Layout>
    </Router>
  );
};

export default App;