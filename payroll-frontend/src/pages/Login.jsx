import { useState, useEffect, useRef, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiLock, FiEye, FiEyeOff, FiArrowRight, FiShield, FiKey, FiActivity } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

export default function Login({ setSession, userType }) {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [hardcodedPin, setHardcodedPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const usernameRef = useRef(null);
  const pinRef = useRef(null);

  const INTERNAL_UI_REV = "fe0c8d422bce2c84cd181ada081682d975ba30e031310ee338abcdf1186f468a";
  const EMPLOYEE_DEFAULT_PASS = "sgc2025";

  const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setIsError(false);

    try {
      if (userType === 'admin') {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', identifier.trim())
          .eq('password', password)
          .single();

        if (error || !data) throw new Error("Invalid Admin credentials.");
        setStep(2);

      } else {
        if (password !== EMPLOYEE_DEFAULT_PASS) {
          throw new Error("Incorrect Password. Please use the system default.");
        }

        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('employee_id', identifier.trim())
          .single();

        if (error || !data) throw new Error("Employee ID not found.");

        localStorage.setItem('current_employee', JSON.stringify(data));
        setSession(true);
        toast.success(`Welcome back, ${data.first_name || data.name}!`);
        navigate('/portal');
      }
    } catch (err) {
      setIsError(true);
      toast.error(err.message);
      setTimeout(() => setIsError(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (loading || hardcodedPin.length < 6) return;
    setLoading(true);
    try {
      const currentToken = await sha256(hardcodedPin);
      if (currentToken === INTERNAL_UI_REV) {
        sessionStorage.setItem('loggedIn', 'true');
        setSession(true);
        toast.success("Identity Verified. Accessing Admin Panel...");
        navigate('/app/dashboard');
      } else {
        setIsError(true);
        setHardcodedPin('');
        toast.error("Invalid Security PIN");
        setTimeout(() => setIsError(false), 2000);
      }
    } catch {
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [hardcodedPin, loading, setSession, navigate]);

  useEffect(() => {
    if (hardcodedPin.length === 6) {
      const timer = setTimeout(() => handlePinSubmit(), 200);
      return () => clearTimeout(timer);
    }
  }, [hardcodedPin, handlePinSubmit]);

  useEffect(() => {
    const handleKeyPress = () => setIsUnlocked(true);
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    if (isUnlocked && step === 1) setTimeout(() => usernameRef.current?.focus(), 800);
    if (step === 2) setTimeout(() => pinRef.current?.focus(), 400);
  }, [isUnlocked, step]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] relative font-sans overflow-hidden text-slate-900">
      <Toaster position="top-center" />

      {/* BACKGROUND ELEMENTS (Malinis na, wala nang aso dito) */}
      <Motion.div
        animate={{ x: [0, 80, -80, 0], y: [0, -40, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] blur-[100px] rounded-full z-0 ${userType === 'admin' ? 'bg-slate-400/10' : 'bg-blue-400/10'}`}
      />

      <Motion.div
        animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="relative p-[2px] rounded-[42px] overflow-hidden z-10 shadow-2xl"
      >
        <Motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className={`absolute inset-[-100%] ${userType === 'admin' ? 'bg-[conic-gradient(from_0deg,#e2e8f0,#0f172a,#e2e8f0,#334155,#e2e8f0)]' : 'bg-[conic-gradient(from_0deg,#e2e8f0,#3b82f6,#e2e8f0,#6366f1,#e2e8f0)]'}`}
        />

        <div className="relative bg-white rounded-[40px] overflow-hidden min-h-[630px] w-[400px] md:w-[440px] flex flex-col border border-slate-100">

          <AnimatePresence mode="popLayout">
            {!isUnlocked && (
              <Motion.div
                key="lock" exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.6 }}
                onClick={() => setIsUnlocked(true)}
                className="absolute inset-0 z-50 cursor-pointer bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center"
              >
                {/* 🐕 ITO YUNG OVERLAY DOG - Mananatili lang kung Admin */}
                {userType === 'admin' ? (
                  <img src="https://i.pinimg.com/originals/18/f5/66/18f566fa5cf046c1e81fc6c61ce5dc53.gif" alt="Lock Dog" className="w-32 h-auto mb-8" />
                ) : (
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                    <FiLock className="text-slate-300" size={32} />
                  </div>
                )}

                <h1 className="text-slate-900 font-black tracking-tighter text-3xl uppercase mb-2">System Paused</h1>
                <p className="text-slate-400 text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
                  {userType === 'admin' ? 'Secret Admin Access' : 'Personnel Portal'}
                </p>
                <Motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className={`${userType === 'admin' ? 'bg-slate-900' : 'bg-blue-600'} text-white px-8 py-3 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg`}>Click to Proceed</Motion.div>
              </Motion.div>
            )}

            {step === 1 ? (
              <Motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-12 flex-1 flex flex-col justify-center">
                <div className="text-center mb-10">
                  <img src="/logo.png" className="h-20 mx-auto mb-6" alt="Logo" />
                  <h2 className="text-slate-900 text-2xl font-black italic tracking-tighter uppercase leading-none">
                    {userType === 'admin' ? 'Admin' : 'Emp'}<span className="text-blue-600">Portal</span>
                  </h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <FiUser className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      ref={usernameRef} type="text" placeholder={userType === 'admin' ? "USERNAME" : "EMPLOYEE ID"}
                      className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-xs font-bold uppercase tracking-widest"
                      value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
                    />
                  </div>

                  <div className="relative">
                    <FiLock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type={showPassword ? "text" : "password"} placeholder="PASSWORD"
                      className="w-full pl-14 pr-14 py-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-xs font-bold uppercase tracking-widest"
                      value={password} onChange={(e) => setPassword(e.target.value)} required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>

                  <button type="submit" disabled={loading} className={`w-full py-5 ${userType === 'admin' ? 'bg-slate-900' : 'bg-blue-600'} hover:opacity-90 text-white rounded-3xl font-black shadow-lg flex items-center justify-center gap-4 transition-all active:scale-95 uppercase tracking-widest text-xs`}>
                    {loading ? "Authenticating..." : <>Continue <FiArrowRight /></>}
                  </button>
                </form>
              </Motion.div>
            ) : (
              <Motion.div key="s2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-12 flex-1 flex flex-col justify-center">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6"><FiKey className="text-blue-600" size={28} /></div>
                  <h2 className="text-slate-900 text-2xl font-black italic tracking-tighter uppercase leading-none">Security PIN</h2>
                  <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-2">Enter 6-digit code</p>
                </div>

                <form onSubmit={handlePinSubmit} className="space-y-8">
                  <input ref={pinRef} type="password" placeholder="••••••" maxLength={6} className="w-full text-center text-4xl tracking-[0.5em] py-8 bg-slate-50 border border-slate-100 rounded-[30px] outline-none focus:ring-4 focus:ring-blue-500/5 font-mono shadow-inner" value={hardcodedPin} onChange={(e) => setHardcodedPin(e.target.value)} required />
                </form>
              </Motion.div>
            )}
          </AnimatePresence>

          {/* FOOTER */}
          <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 mt-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FiShield className="text-blue-500" size={14} />
                <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Secure Link</span>
              </div>
              <FiActivity className="text-blue-500 animate-pulse" size={12} />
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <Motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-1/3 h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
              />
            </div>
          </div>
        </div>
      </Motion.div>
    </div>
  );
}