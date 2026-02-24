import React, { useEffect, useRef, useState } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceDetail from './components/InvoiceDetail';
import AIChat from './components/AIChat';
import { Invoice, User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Auth States
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCedulaValidated, setIsCedulaValidated] = useState(false);
  const [isPasswordValidated, setIsPasswordValidated] = useState(false);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [hasStoredPrivacyConsent, setHasStoredPrivacyConsent] = useState(false);
  const [showGenericReset, setShowGenericReset] = useState(false);
  const [genericPasswordInput, setGenericPasswordInput] = useState('');
  const [isResettingGeneric, setIsResettingGeneric] = useState(false);
  const [currentPasswordChange, setCurrentPasswordChange] = useState('');
  const [newPasswordChange, setNewPasswordChange] = useState('');
  const [confirmNewPasswordChange, setConfirmNewPasswordChange] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [postalCodeDraft, setPostalCodeDraft] = useState('');
  const [mapsQuery, setMapsQuery] = useState('Quito, Ecuador');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const maxPasswordAttempts = 5;
  const remainingPasswordAttempts = Math.max(0, maxPasswordAttempts - passwordAttempts);
  const addressTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addressInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const closeAddressModal = () => {
    setIsAddressModalOpen(false);
  };

  const resetGenericResetState = () => {
    setShowGenericReset(false);
    setGenericPasswordInput('');
  };

  const getPrivacyConsentStorageKey = (taxId: string) => `privacy-consent:${taxId}`;

  const getStoredPrivacyConsent = (taxId: string): { accepted: boolean; timestamp: string } | null => {
    try {
      const raw = localStorage.getItem(getPrivacyConsentStorageKey(taxId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed?.accepted === true && typeof parsed?.timestamp === 'string') {
        return { accepted: true, timestamp: parsed.timestamp };
      }
    } catch {
      // ignore malformed localStorage data
    }

    return null;
  };

  const savePrivacyConsent = (taxId: string, timestamp: string) => {
    const payload = JSON.stringify({ accepted: true, timestamp });
    localStorage.setItem(getPrivacyConsentStorageKey(taxId), payload);
  };

  const splitFullName = (fullName: string) => {
    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    const parts = cleanName.length > 0 ? cleanName.split(' ') : [];

    if (parts.length === 0) {
      return { firstName: 'CLIENTE', secondName: '', lastName: '' };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], secondName: '', lastName: '' };
    }

    if (parts.length === 2) {
      return { firstName: parts[0], secondName: '', lastName: parts[1] };
    }

    return {
      firstName: parts[0],
      secondName: parts[1],
      lastName: parts.slice(2).join(' ')
    };
  };

  const hydrateUserFromClientProfile = async (taxId: string) => {
    try {
      setIsLoadingProfile(true);
      setProfileError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`/api/client-profile?taxId=${encodeURIComponent(taxId)}&cif=${encodeURIComponent(taxId)}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await response.json();

      if (!response.ok || !data.client) {
        setProfileError(data.message || 'No se pudo recuperar el perfil del cliente.');
        return;
      }

      const fullName = String(data.client.fullName || '').toUpperCase();
      const { firstName, secondName, lastName } = splitFullName(fullName);

      setUser((prevUser) => {
        if (!prevUser) return prevUser;

        const nextUser: User = {
          ...prevUser,
          fullName: fullName || prevUser.fullName,
          firstName: firstName || prevUser.firstName,
          secondName: secondName || prevUser.secondName,
          lastName: lastName || prevUser.lastName,
          taxId: String(data.client.taxId || prevUser.taxId),
          email: String(data.client.email || prevUser.email),
          address: String(data.client.address || ''),
          postalCode: String(data.client.postalCode || '')
        };

        const hasChanges =
          prevUser.fullName !== nextUser.fullName ||
          prevUser.firstName !== nextUser.firstName ||
          prevUser.secondName !== nextUser.secondName ||
          prevUser.lastName !== nextUser.lastName ||
          prevUser.taxId !== nextUser.taxId ||
          prevUser.email !== nextUser.email ||
          prevUser.address !== nextUser.address ||
          prevUser.postalCode !== nextUser.postalCode;

        if (!hasChanges) {
          return prevUser;
        }

        localStorage.setItem('user', JSON.stringify(nextUser));
        return nextUser;
      });
    } catch {
      setProfileError('Error de conexión consultando perfil del cliente.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!user?.taxId) return;

    const address = addressDraft.trim();
    const postalCode = postalCodeDraft.trim();

    if (!address) {
      setProfileError('La dirección es obligatoria.');
      return;
    }

    if (!postalCode) {
      setProfileError('El código postal es obligatorio.');
      return;
    }

    try {
      setIsSavingAddress(true);
      setProfileError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/client-profile/address', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          taxId: user.taxId,
          cif: user.taxId,
          address,
          postalCode
        })
      });
      clearTimeout(timeout);

      const data = await response.json();

      if (!response.ok) {
        setProfileError(data.message || 'No se pudo actualizar la dirección del cliente.');
        return;
      }

      setUser((prevUser) => {
        if (!prevUser) return prevUser;
        const updatedUser: User = {
          ...prevUser,
          address,
          postalCode
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      });

      closeAddressModal();
      void hydrateUserFromClientProfile(user.taxId);
    } catch {
      setProfileError('Error de conexión actualizando dirección.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const sanitizeTaxId = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const validateIdentification = (id: string): boolean => {
    return /^[A-Z0-9]{3,20}$/.test(id);
  };

  const handleValidateCedula = async (): Promise<boolean> => {
    setError(null);

    if (!validateIdentification(cedula)) {
      setError('La CÉDULA/RUC/PASAPORTE no tiene formato válido.');
      return false;
    }

    try {
      setIsLoading(true);
      let response = await fetch('/api/auth/validate-tax-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxId: cedula, cif: cedula })
      });

      if (response.status === 404) {
        response = await fetch('/api/auth/validate-cif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taxId: cedula, cif: cedula })
        });
      }

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.exists) {
        setError(data.message || 'La identificación no existe en CLIENTES.');
        return false;
      }

      setIsCedulaValidated(true);
      const storedConsent = getStoredPrivacyConsent(cedula);
      const alreadyAccepted = Boolean(storedConsent?.accepted);
      setHasStoredPrivacyConsent(alreadyAccepted);
      setPrivacyAccepted(alreadyAccepted);
      return true;
    } catch {
      setError('No se pudo validar la identificación. Verifica conexión con el backend.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidatePassword = async (): Promise<boolean> => {
    setError(null);

    if (passwordAttempts >= maxPasswordAttempts) {
      setError('Ha excedido el máximo de 5 intentos de contraseña.');
      return false;
    }

    if (!/^\d{7}$/.test(password)) {
      setError('La contraseña genérica debe tener exactamente 7 dígitos.');
      return false;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/validate-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxId: cedula, cif: cedula, password })
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        if (typeof data.remainingAttempts === 'number') {
          setPasswordAttempts(maxPasswordAttempts - data.remainingAttempts);
        } else {
          setPasswordAttempts((prev) => Math.min(maxPasswordAttempts, prev + 1));
        }
        setError(data.message || 'Contraseña incorrecta.');
        return false;
      }

      setIsPasswordValidated(true);
      setPasswordAttempts(0);
      if (hasStoredPrivacyConsent) {
        setPrivacyAccepted(true);
      }
      return true;
    } catch {
      setError('No se pudo validar la contraseña. Verifica conexión con el backend.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    setError(null);

    if (!privacyAccepted) {
      setError('Debe autorizar el tratamiento de datos personales.');
      return;
    }

    const existingConsent = getStoredPrivacyConsent(cedula);
    const privacyTimestamp = existingConsent?.timestamp || new Date().toISOString();

    if (!existingConsent?.accepted) {
      savePrivacyConsent(cedula, privacyTimestamp);
      setHasStoredPrivacyConsent(true);
    }

    const authenticatedUser: User = {
      id: `usr-${Date.now()}`,
      email: `${cedula}@cony.local`,
      firstName: 'CLIENTE',
      secondName: '',
      lastName: cedula,
      fullName: `CLIENTE ${cedula}`,
      taxId: cedula,
      companyName: 'GRUPO LINA',
      privacyAccepted: Boolean(existingConsent?.accepted || privacyAccepted),
      privacyTimestamp
    };

    setUser(authenticatedUser);
    localStorage.setItem('user', JSON.stringify(authenticatedUser));
  };

  const handleResetToGenericPassword = async () => {
    setError(null);

    if (!/^\d{7}$/.test(genericPasswordInput)) {
      setError('La clave genérica debe tener exactamente 7 dígitos.');
      return;
    }

    try {
      setIsResettingGeneric(true);
      const response = await fetch('/api/auth/reset-to-generic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxId: cedula,
          cif: cedula,
          genericPassword: genericPasswordInput
        })
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || 'No se pudo restablecer con clave genérica.');
        return;
      }

      setPassword('');
      setIsPasswordValidated(false);
      setPasswordAttempts(0);
      setPrivacyAccepted(false);
      resetGenericResetState();
      setError('Clave restablecida a la contraseña genérica. Ingresa con ella para continuar.');
    } catch {
      setError('Error de conexión al restablecer con clave genérica.');
    } finally {
      setIsResettingGeneric(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.taxId) return;

    setPasswordChangeError(null);
    setPasswordChangeMessage(null);

    if (!/^\d{7}$/.test(currentPasswordChange)) {
      setPasswordChangeError('La contraseña actual debe tener 7 dígitos.');
      return;
    }

    if (!/^\d{7}$/.test(newPasswordChange)) {
      setPasswordChangeError('La nueva contraseña debe tener 7 dígitos.');
      return;
    }

    if (newPasswordChange !== confirmNewPasswordChange) {
      setPasswordChangeError('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxId: user.taxId,
          cif: user.taxId,
          currentPassword: currentPasswordChange,
          newPassword: newPasswordChange
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        setPasswordChangeError(data.message || 'No se pudo actualizar la contraseña.');
        return;
      }

      setCurrentPasswordChange('');
      setNewPasswordChange('');
      setConfirmNewPasswordChange('');
      setPasswordChangeMessage(data.message || 'Contraseña actualizada correctamente.');
    } catch {
      setPasswordChangeError('Error de conexión al cambiar la contraseña.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCedulaValidated) {
      await handleValidateCedula();
      return;
    }

    if (!isPasswordValidated) {
      await handleValidatePassword();
      return;
    }

    handleLogin();
  };

  // FIX: Added handleLogout function to handle user logout
  const handleLogout = () => {
    setUser(null);
    setInvoices([]);
    setIsLoadingInvoices(false);
    setInvoiceError(null);
    setIsLoadingProfile(false);
    setProfileError(null);
    setIsAddressModalOpen(false);
    setAddressDraft('');
    setPostalCodeDraft('');
    setMapsQuery('Quito, Ecuador');
    setIsSavingAddress(false);
    localStorage.removeItem('user');
    setActiveTab('dashboard');
    setSelectedInvoiceId(null);
    setCedula('');
    setPassword('');
    setShowPassword(false);
    setIsCedulaValidated(false);
    setIsPasswordValidated(false);
    setPasswordAttempts(0);
    setPrivacyAccepted(false);
    setHasStoredPrivacyConsent(false);
    resetGenericResetState();
    setCurrentPasswordChange('');
    setNewPasswordChange('');
    setConfirmNewPasswordChange('');
    setPasswordChangeMessage(null);
    setPasswordChangeError(null);
    setError(null);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user?.taxId) {
        setInvoices([]);
        return;
      }

      try {
        setIsLoadingInvoices(true);
        setInvoiceError(null);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`/api/invoices?taxId=${encodeURIComponent(user.taxId)}&cif=${encodeURIComponent(user.taxId)}`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await response.json();

        if (!response.ok) {
          setInvoiceError(data.message || 'No se pudieron cargar las facturas del cliente.');
          setInvoices([]);
          return;
        }

        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      } catch {
        setInvoiceError('Error de conexión consultando facturas.');
        setInvoices([]);
      } finally {
        setIsLoadingInvoices(false);
      }
    };

    fetchInvoices();
  }, [user?.taxId]);

  useEffect(() => {
    if (!user?.taxId) return;
    hydrateUserFromClientProfile(user.taxId);
  }, [user?.taxId]);

  useEffect(() => {
    if (activeTab === 'invoices') {
      setActiveTab('dashboard');
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAddressModalOpen) {
      lastFocusedElementRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      const focusTimer = window.setTimeout(() => {
        addressInputRef.current?.focus();
      }, 0);
      return () => {
        window.clearTimeout(focusTimer);
      };
    }

    document.body.style.overflow = '';
    const restoreTimer = window.setTimeout(() => {
      if (addressTriggerRef.current) {
        addressTriggerRef.current.focus();
      } else if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(restoreTimer);
    };
  }, [isAddressModalOpen]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-800/80"></div>
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-red-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-orange-400/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-xl w-full bg-white/95 backdrop-blur rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-500 border border-white/30">
          <div className="p-8 sm:p-10">
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="w-[260px] h-[260px] bg-white rounded-3xl flex items-center justify-center mb-5 shadow-2xl border border-slate-100 p-2 overflow-hidden mx-auto">
                <img src="/LOGO%20GRUPO%20LINA.jpeg" alt="Logo Grupo Lina" className="w-full h-full object-contain scale-[1.4]" />
              </div>
              <h2
                className="mt-2 text-2xl sm:text-3xl font-black italic text-red-700 uppercase tracking-tight leading-tight [-webkit-text-stroke:1.5px_#000000] [text-shadow:0_1px_0_rgba(0,0,0,0.45)]"
              >
                Facturación Grupo Lina
              </h2>
              <div className="h-1 w-20 bg-red-600 rounded-full mt-4"></div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs font-bold rounded-r-xl animate-bounce">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <p className="text-[11px] text-slate-500 font-semibold text-center mb-1">
                Ingresa tu identificación para acceder a tus facturas y estado de cuenta.
              </p>
              <div className="relative">
                <i className="fas fa-id-card absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  required
                  value={cedula}
                  onChange={(e) => {
                    const normalizedId = sanitizeTaxId(e.target.value);
                    setCedula(normalizedId);
                    setIsCedulaValidated(false);
                    setIsPasswordValidated(false);
                    setPasswordAttempts(0);
                    setPrivacyAccepted(false);
                    setHasStoredPrivacyConsent(false);
                    resetGenericResetState();
                  }}
                  maxLength={20}
                  placeholder="CÉDULA / RUC / PASAPORTE"
                  className="w-full pl-14 pr-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 transition-all text-slate-800 font-bold text-sm"
                />
              </div>

              {isCedulaValidated && (
                <div className="relative">
                  <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value.replace(/\D/g, ''));
                      setIsPasswordValidated(false);
                      setPrivacyAccepted(false);
                    }}
                    maxLength={7}
                    placeholder="CONTRASEÑA GENÉRICA (7 DÍGITOS)"
                    className="w-full pl-14 pr-14 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 transition-all text-slate-800 font-bold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title="Mostrar u ocultar contraseña"
                    aria-label="Mostrar u ocultar contraseña"
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                  <p className="mt-3 text-[11px] font-semibold text-slate-500 text-center">
                    La contraseña es sus primeros 7 dígitos.
                  </p>
                </div>
              )}

              {isCedulaValidated && !isPasswordValidated && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Intentos de contraseña restantes: <span className="text-red-600">{remainingPasswordAttempts}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowGenericReset((prev) => !prev)}
                    className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-700"
                  >
                    Restablecer con clave genérica
                  </button>

                  {showGenericReset && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="password"
                        value={genericPasswordInput}
                        onChange={(e) => setGenericPasswordInput(e.target.value.replace(/\D/g, ''))}
                        maxLength={7}
                        placeholder="Clave genérica"
                        className="sm:col-span-2 w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-black text-sm tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handleResetToGenericPassword}
                        disabled={isResettingGeneric}
                        className="w-full bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-60"
                      >
                        {isResettingGeneric ? 'Aplicando...' : 'Aplicar'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isPasswordValidated && !hasStoredPrivacyConsent && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${privacyAccepted ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                  <input
                    type="checkbox"
                    id="privacy"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-red-600 cursor-pointer"
                  />
                  <label htmlFor="privacy" className="text-[10px] leading-relaxed text-slate-600 cursor-pointer font-bold uppercase tracking-tight">
                    En cumplimiento de la Ley Orgánica de Protección de Datos Personales, el cliente autoriza de manera libre, específica, informada e inequívoca el tratamiento de sus datos personales proporcionados en los locales del grupo Lina, los cuales serán utilizados únicamente para fines comerciales, contables, tributarios, administrativos y de contacto relacionados con la relación contractual.<br />
                    La información será tratada con confidencialidad y no será compartida con terceros, salvo obligación legal. El titular podrá ejercer sus derechos de acceso, rectificación, actualización, eliminación, oposición y portabilidad mediante solicitud escrita al correo: analista.desarrollo@grupolina.com
                  </label>
                </div>
              )}

              {isPasswordValidated && hasStoredPrivacyConsent && (
                <div className="flex items-center justify-center p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                  <i className="fas fa-circle-check mr-2"></i>
                  Fidelizado: SI
                </div>
              )}

              <button
                disabled={isLoading || (isPasswordValidated && !privacyAccepted) || (!isPasswordValidated && isCedulaValidated && remainingPasswordAttempts === 0)}
                className="w-full bg-red-700 text-white py-4.5 rounded-2xl font-black text-sm hover:bg-red-800 shadow-2xl shadow-red-900/20 transition-all active:scale-[0.98] mt-4 uppercase tracking-[0.2em] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? 'Validando...'
                  : !isCedulaValidated
                    ? 'Validar Identificación'
                    : !isPasswordValidated
                      ? 'Validar Contraseña'
                      : 'Ingresar al Sistema'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (selectedInvoiceId) {
      const invoice = invoices.find(i => i.id === selectedInvoiceId);
      return invoice ? <InvoiceDetail invoice={invoice} onBack={() => setSelectedInvoiceId(null)} /> : null;
    }

    const invoicesTabDependsOnData = activeTab === 'dashboard' || activeTab === 'ai-chat';

    if (invoicesTabDependsOnData && isLoadingInvoices) {
      return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10 text-center">
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Cargando facturas del cliente...</p>
        </div>
      );
    }

    if (invoicesTabDependsOnData && invoiceError) {
      return (
        <div className="bg-rose-50 rounded-[2.5rem] border border-rose-200 shadow-sm p-10 text-center">
          <p className="text-rose-600 font-black uppercase tracking-widest text-xs">{invoiceError}</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard invoices={invoices} onViewInvoice={setSelectedInvoiceId} />;
      case 'ai-chat':
        return <AIChat invoices={invoices} />;
      case 'profile':
        return (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-white rounded-[3rem] border border-slate-200 p-14 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-80 h-80 bg-red-50 rounded-full -mr-40 -mt-40 opacity-40"></div>

              <div className="flex flex-col items-center mb-14 relative z-10">
                <div className="w-36 h-36 rounded-[2.5rem] bg-slate-900 flex items-center justify-center text-white text-5xl font-black mb-8 border-8 border-white shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-red-700 opacity-10"></div>
                  {user.firstName.charAt(0)}
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight text-center uppercase">{user.fullName}</h3>
                <div className="mt-4 flex gap-3">
                  <span className="px-4 py-1.5 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    CÉDULA/RUC/PASAPORTE: {user.taxId}
                  </span>
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    LOPDP: ACEPTADA
                  </span>
                </div>
              </div>

              {profileError && (
                <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-black uppercase tracking-wider relative z-10">
                  {profileError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10 bg-slate-50/50 p-10 rounded-[2rem] border border-slate-100">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Nombre y Apellidos</p>
                  <p className="text-slate-800 font-black text-lg tracking-tight uppercase">{user.fullName}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Cédula/RUC/Pasaporte</p>
                  <p className="text-slate-800 font-black text-lg tracking-tight">{user.taxId}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Correo</p>
                  <p className="text-slate-800 font-black text-lg tracking-tight">{user.email || 'NO REGISTRADO'}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Consentimiento LOPDP</p>
                  <p className="text-slate-600 font-bold text-xs bg-white px-4 py-2 rounded-xl shadow-sm inline-block border border-slate-100">
                    {new Date(user.privacyTimestamp).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Dirección</p>
                  <p className="text-slate-800 font-black text-base tracking-tight uppercase">{user.address || 'NO REGISTRADA'}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Código Postal</p>
                  <p className="text-slate-800 font-black text-lg tracking-tight">{user.postalCode || 'NO REGISTRADO'}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Estado de Carga</p>
                  <p className="text-red-600 font-black text-xs uppercase tracking-widest bg-red-50 px-4 py-2 rounded-xl border border-red-100 inline-block">
                    {isLoadingProfile ? 'ACTUALIZANDO PERFIL...' : 'DATOS SINCRONIZADOS'}
                  </p>
                </div>
              </div>

              <div className="mt-10 relative z-10 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-slate-900 font-black text-sm uppercase tracking-widest">Cambiar Contraseña</h4>

                {passwordChangeMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">
                    {passwordChangeMessage}
                  </div>
                )}

                {passwordChangeError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
                    {passwordChangeError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="password"
                    value={currentPasswordChange}
                    onChange={(e) => setCurrentPasswordChange(e.target.value.replace(/\D/g, ''))}
                    maxLength={7}
                    placeholder="Contraseña actual"
                    className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-black text-sm tracking-widest"
                  />
                  <input
                    type="password"
                    value={newPasswordChange}
                    onChange={(e) => setNewPasswordChange(e.target.value.replace(/\D/g, ''))}
                    maxLength={7}
                    placeholder="Nueva contraseña"
                    className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-black text-sm tracking-widest"
                  />
                  <input
                    type="password"
                    value={confirmNewPasswordChange}
                    onChange={(e) => setConfirmNewPasswordChange(e.target.value.replace(/\D/g, ''))}
                    maxLength={7}
                    placeholder="Confirmar contraseña"
                    className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-black text-sm tracking-widest"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="px-8 py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-60"
                  >
                    {isChangingPassword ? 'Guardando...' : 'Actualizar contraseña'}
                  </button>
                </div>
              </div>

              <div className="mt-14 flex justify-center relative z-10">
                <button
                  ref={addressTriggerRef}
                  onClick={() => {
                    setAddressDraft(user.address || '');
                    setPostalCodeDraft(user.postalCode || '');
                    setMapsQuery(user.address || 'Quito, Ecuador');
                    setIsAddressModalOpen(true);
                  }}
                  className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-2xl active:scale-95"
                >
                  Actualizar Dirección
                </button>
              </div>
            </div>

            {isAddressModalOpen && (
              <div
                className="fixed inset-0 z-[90] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    closeAddressModal();
                  }
                }}
              >
                <div className="w-full max-w-4xl bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-slate-900 font-black text-lg uppercase tracking-tight">Seleccionar Dirección (Google Maps)</h4>
                    <button
                      onClick={closeAddressModal}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                      title="Cerrar"
                    >
                      <i className="fas fa-xmark"></i>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    <div className="p-6 border-r border-slate-100 space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Buscar en Google Maps</label>
                      <input
                        value={mapsQuery}
                        onChange={(e) => setMapsQuery(e.target.value)}
                        placeholder="Ej: Av. Amazonas y Naciones Unidas, Quito"
                        className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-bold text-sm"
                      />

                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-4">Dirección (DIRECCION1)</label>
                      <textarea
                        ref={addressInputRef}
                        rows={4}
                        value={addressDraft}
                        onChange={(e) => setAddressDraft(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-bold text-sm"
                        placeholder="Dirección seleccionada"
                      />

                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Código Postal (CODPOSTAL)</label>
                      <input
                        value={postalCodeDraft}
                        onChange={(e) => setPostalCodeDraft(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-black text-sm tracking-widest"
                        placeholder="Ej: 170102"
                      />

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={closeAddressModal}
                          className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveAddress}
                          disabled={isSavingAddress}
                          className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
                        >
                          {isSavingAddress ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>

                    <div className="h-[520px] bg-slate-100">
                      <iframe
                        title="Google Maps Address Picker"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(mapsQuery || 'Quito, Ecuador')}&output=embed`}
                        className="w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <Dashboard invoices={invoices} onViewInvoice={setSelectedInvoiceId} />;
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