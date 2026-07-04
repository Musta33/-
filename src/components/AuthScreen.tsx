
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Building, Key, Phone, Loader, Clock } from 'lucide-react';
import { FullScreenModal } from './FullScreenModal';
import { api } from '../lib/api';
import { translations } from '../lib/locales';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void; }) {
  const lang = (() => {
    const stored = localStorage.getItem('lang');
    return (stored === 'ar' || stored === 'en') ? stored : 'ar';
  })();
  const t = translations[lang] || translations.ar;
  const isRtl = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_me') === 'true';
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('remember_email') || '';
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('remember_password') || '';
  });
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyHandle, setCompanyHandle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [view, setView] = useState<'email' | 'register' | 'reset'>('email');
  const [resetPassword, setResetPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");

  React.useEffect(() => {
    setLockUntil(null);
    setCountdown("");
  }, [view]);

  React.useEffect(() => {
    if (!lockUntil) return;

    const updateTimer = () => {
      const remaining = new Date(lockUntil).getTime() - new Date().getTime();
      if (remaining <= 0) {
        setLockUntil(null);
        setCountdown("");
        return false; // stop timer
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      
      let msg = "";
      if (mins > 0) {
        msg += `${mins} دقيقة و `;
      }
      msg += `${secs} ثانية`;
      setCountdown(msg);
      return true; // continue timer
    };

    // Run once immediately
    const shouldContinue = updateTimer();
    if (!shouldContinue) return;

    const timer = setInterval(() => {
      const ok = updateTimer();
      if (!ok) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [lockUntil]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !resetPassword.trim()) {
      toast.error(t.errorFieldsRequired);
      return;
    }
    const toastId = toast.loading(t.updatePasswordButton);
    setLoading(true);
    try {
      const response = await fetch('/api/force-update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), newPassword: resetPassword })
      });
      const data = await response.json().catch(() => ({ message: t.errorApprovalProcess }));
      if (!response.ok) {
        throw new Error(data.message || t.errorApprovalProcess);
      }

      toast.dismiss(toastId);
      setResetSuccess(true);
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t.errorApprovalProcess, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockUntil) {
      toast.error(`${t.accountBlocked}. ${t.tryAfter} ${countdown}`);
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error(t.errorFieldsRequired);
      return;
    }
    const toastId = toast.loading(t.loginButton + '...');
    setLoading(true);
    try {
      const data = await api.login({ email: email.trim(), password });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
        localStorage.setItem('remember_email', email.trim());
        localStorage.setItem('remember_password', password);
      } else {
        localStorage.removeItem('remember_me');
        localStorage.removeItem('remember_email');
        localStorage.removeItem('remember_password');
      }
      
      onLoginSuccess(data.user);
      const companyGreeting = data.user.companyName ? ` - ${data.user.companyName}` : '';
      toast.success(`${t.loginSuccess || 'Logged in'}${companyGreeting}`, { id: toastId });
    } catch (error: any) {
      console.error(error);
      if (error.lockUntil) {
        setLockUntil(error.lockUntil);
      }
      const errorMessage = error.message;
      localStorage.removeItem('remember_password');
      setPassword('');
      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim() || !companyName.trim() || !companyHandle.trim() || !phoneNumber.trim()) {
      toast.error(t.errorFieldsRequired);
      return;
    }
    if (password.length < 6) {
      toast.error(t.errorPasswordShort || 'Password too short');
      return;
    }
    const toastId = toast.loading(t.registerButton + '...');
    setLoading(true);
    try {
      const data = await api.register({ email: email.trim(), password, fullName, companyName, companyHandle, phoneNumber });
      toast.success(t.awaitingApproval, { id: toastId });
      setView('email');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t.errorApprovalProcess, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-neutral-950 flex flex-col items-center justify-center relative font-sans transition-colors duration-300 overflow-hidden ${isRtl ? 'text-right' : 'text-left'}`} id="auth-root" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Language Switcher Overlay */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Background Image Layer - Visible everywhere */}
      <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1520050206274-a1ae446cb3cc?q=80&w=1600" 
          alt="Mercedes G-Class" 
          className="w-full h-full object-cover opacity-100 transition-opacity duration-1000"
          referrerPolicy="no-referrer"
        />
        {/* Deep Overlay for Contrast */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-none" />
      </div>

      {/* Main Content - Floating Glass Login */}
      <div className="w-full max-w-lg px-6 relative z-30 flex flex-col items-center">
        
        <div className="w-full flex justify-center items-center mb-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black text-white/90 tracking-widest uppercase drop-shadow-lg">{t.unifiedGate}</span>
          </div>
        </div>

        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex w-16 h-16 bg-amber-500 rounded-2xl items-center justify-center text-white shadow-2xl shadow-amber-500/40 mb-2 animate-bounce">
              <span className="font-serif font-black text-3xl">ع</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              {t.unifiedSystem}
            </h2>
            <p className="text-white/90 text-sm font-bold drop-shadow-lg">{t.unifiedGatePortal}</p>
          </div>

          <div className="bg-black/40 backdrop-blur-3xl p-6 md:p-10 rounded-[2.5rem] border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)] space-y-8">
            <div className="flex bg-white/10 backdrop-blur-md rounded-2xl p-1.5 gap-1">
              <button 
                onClick={() => setView('email')}
                type="button"
                className={`flex-1 py-3 text-xs font-black rounded-xl transition ${view === 'email' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                {t.login}
              </button>
              <button 
                onClick={() => setView('register')}
                type="button"
                className={`flex-1 py-3 text-xs font-black rounded-xl transition ${view === 'register' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                {t.newCompany}
              </button>
              <button 
                onClick={() => setView('reset')}
                type="button"
                className={`flex-1 py-3 text-xs font-black rounded-xl transition ${view === 'reset' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                {t.resetPassword}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {view === 'email' && (
                <motion.form 
                  key="login-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleEmailLogin} 
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.emailLabel}</label>
                    <div className="relative">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right font-sans dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.passwordLabel}</label>
                    <div className="relative">
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right font-sans dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between flex-row-reverse py-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-amber-500 focus:ring-amber-500 bg-white dark:bg-neutral-900" 
                      />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">{t.rememberMe}</span>
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setView('reset')}
                      className="text-xs text-amber-600 dark:text-amber-500 hover:underline font-bold"
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                  {lockUntil && countdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-center my-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={16} className="animate-pulse" />
                        <span className="font-black text-xs uppercase tracking-tighter">{t.accountBlocked}</span>
                      </div>
                      <div className="text-2xl font-black font-mono tracking-widest">
                        {countdown}
                      </div>
                      <p className="text-[10px] font-bold opacity-70">{t.tryAfter}</p>
                    </motion.div>
                  )}

                  <button 
                    type="submit" 
                    disabled={loading || !!lockUntil}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl shadow-lg shadow-amber-500/10 transition flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : t.loginButton}
                  </button>
                </motion.form>
              )}
              {view === 'register' && (
                <motion.form 
                  key="register-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleRegister} 
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.fullNameLabel}</label>
                    <div className="relative">
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.emailLabel}</label>
                    <div className="relative">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right font-sans dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.phoneNumberLabel}</label>
                    <div className="relative">
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        type="text" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+964..."
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.passwordLabel}</label>
                    <div className="relative">
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right font-sans dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.companyNameLabel}</label>
                      <div className="relative">
                        <Building className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                        <input 
                          type="text" 
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Company Name"
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-10 pl-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 text-right dark:text-white"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.companyHandleLabel}</label>
                      <div className="relative">
                        <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                        <input 
                          type="text" 
                          value={companyHandle}
                          onChange={(e) => setCompanyHandle(e.target.value)}
                          placeholder="baghdad_rent"
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-10 pl-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 text-right font-mono dark:text-white"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-amber-500/10 transition flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : t.registerButton}
                  </button>
                </motion.form>
              )}
              {view === 'reset' && (
                <motion.div 
                  key="reset-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {resetSuccess ? (
                    <div className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                        <Clock className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-neutral-900 dark:text-white">{t.awaitingApproval}</h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-bold leading-relaxed">
                          {t.resetAwaitingApproval}
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setResetSuccess(false);
                          setView('email');
                        }}
                        className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-black text-xs rounded-xl"
                      >
                        {t.backToLogin}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-amber-800 dark:text-amber-400 text-[11px] leading-relaxed font-bold">
                        {t.resetInstructions}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.emailLabel}</label>
                        <div className="relative">
                          <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                          <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right font-sans dark:text-white"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 block text-right">{t.newPasswordLabel}</label>
                        <div className="relative">
                          <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                          <input 
                            type="password" 
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-3 pr-11 pl-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right font-sans dark:text-white"
                            required
                          />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-amber-500/10 transition flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader className="animate-spin" size={18} /> : t.updatePasswordButton}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="text-center text-xs text-neutral-400 dark:text-neutral-500">
            {t.technicalSupport}
          </div>
        </div>
        <FullScreenModal imageUrl={modalImageUrl} onClose={() => setModalImageUrl(null)} />
      </div>
    </div>
  );
}
