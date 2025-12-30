import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { 
  FiLogOut, FiClock, FiFileText, FiUser, 
  FiCalendar, FiCheckCircle, FiAlertCircle, FiChevronRight 
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

export default function EmployeePortal() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Kunin ang data ng employee na na-save natin sa Login
    const savedEmployee = localStorage.getItem('current_employee');
    if (savedEmployee) {
      setEmployee(JSON.parse(savedEmployee));
    } else {
      navigate('/'); // Balik sa login kung walang session
    }

    // Digital Clock Timer
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4 md:p-8">
      {/* --- TOP NAVIGATION --- */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <FiUser className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter leading-none">Employee Portal</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sync v2.0</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all active:scale-95"
        >
          <FiLogOut /> Logout
        </button>
      </nav>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- LEFT COLUMN: PROFILE & TIME --- */}
        <div className="lg:col-span-4 space-y-6">
          {/* Welcome Card */}
          <Motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20"
          >
            <div className="relative z-10">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Good day,</p>
              <h2 className="text-2xl font-black italic tracking-tighter mb-6 uppercase">
                {employee.first_name} <br/> {employee.last_name}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] border-b border-white/10 pb-2">
                  <span className="text-slate-400 uppercase font-bold">ID Number</span>
                  <span className="font-mono font-bold text-blue-400">{employee.employee_id}</span>
                </div>
                <div className="flex justify-between text-[11px] border-b border-white/10 pb-2">
                  <span className="text-slate-400 uppercase font-bold">Area / Dept</span>
                  <span className="font-bold">{employee.area || 'General'}</span>
                </div>
              </div>
            </div>
            {/* Background Decor */}
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-blue-600/20 blur-[60px] rounded-full"></div>
          </Motion.div>

          {/* Real-time Clock Card */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-8 text-center shadow-sm">
            <FiClock className="mx-auto text-blue-600 mb-4" size={24} />
            <h3 className="text-3xl font-mono font-black tracking-tighter">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* --- RIGHT COLUMN: ACTIONS --- */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* OVERTIME FILING BUTTON */}
            <Motion.button
              whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }}
              className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-600/5 transition-all text-left group"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                <FiClock className="text-blue-600 group-hover:text-white" size={24} />
              </div>
              <h3 className="text-lg font-black uppercase italic tracking-tighter mb-2 italic">File Overtime</h3>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed mb-6 uppercase tracking-tight">
                Submit extra hours for approval. Ensure you have your supervisor's verbal consent.
              </p>
              <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                Get Started <FiChevronRight />
              </div>
            </Motion.button>

            {/* EXCUSE FILING BUTTON */}
            <Motion.button
              whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }}
              className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-600/5 transition-all text-left group"
            >
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
                <FiFileText className="text-indigo-600 group-hover:text-white" size={24} />
              </div>
              <h3 className="text-lg font-black uppercase italic tracking-tighter mb-2 italic">File Excuse</h3>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed mb-6 uppercase tracking-tight">
                Submit reason for late, half-day, or absence. Medical certs may be required.
              </p>
              <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                Get Started <FiChevronRight />
              </div>
            </Motion.button>

          </div>

          {/* --- RECENT FILINGS TABLE (Preview) --- */}
          <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-black uppercase italic tracking-tighter">Recent Requests</h3>
              <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-500 uppercase">Last 30 Days</span>
            </div>
            <div className="p-8">
              {/* Placeholder Empty State */}
              <div className="flex flex-col items-center py-10 opacity-30">
                <FiCheckCircle size={40} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No pending requests found</p>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer Decoration */}
      <footer className="max-w-6xl mx-auto mt-20 pb-10 text-center opacity-20">
         <p className="text-[9px] font-black uppercase tracking-[0.5em]">Internal Personnel System • PayrollSync</p>
      </footer>
    </div>
  );
}