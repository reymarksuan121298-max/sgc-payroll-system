import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

const PayrollSettingsModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: employeeData, error: empError } = await supabase.from('employees').select('area');
      if (empError) throw empError;

      const uniqueAreas = [...new Set(employeeData.map(emp => emp.area))].filter(Boolean);
      const { data: configData, error: configError } = await supabase.from('payroll_configs').select('*');
      if (configError) throw configError;

      const mergedSettings = uniqueAreas.map(areaName => {
        const existing = configData.find(c => c.area === areaName);
        return existing || { area: areaName, is_fixed: false, is_daily: true, is_monthly: false, is_semi: true, value_amount: 0 };
      });

      setSettings(mergedSettings);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) fetchSettings(); }, [isOpen, fetchSettings]);

  const handleToggle = (area, field) => {
    setSettings(prev => prev.map(row => {
      if (row.area === area) {
        switch (field) {
          case 'is_fixed': return { ...row, is_fixed: true, is_daily: false };
          case 'is_daily': return { ...row, is_fixed: false, is_daily: true };
          case 'is_monthly': return { ...row, is_monthly: true, is_semi: false };
          case 'is_semi': return { ...row, is_monthly: false, is_semi: true };
          default: return row;
        }
      }
      return row;
    }));
  };

  const executeSave = async () => {
    const saveToast = toast.loading("Processing...");
    setLoading(true);
    try {
      const { data: dbConfigs } = await supabase.from('payroll_configs').select('id, area');
      const settingsToSave = settings.map(row => {
        const dbMatch = dbConfigs?.find(c => c.area === row.area);
        return {
          ...row,
          id: dbMatch ? dbMatch.id : crypto.randomUUID(),
          updated_at: new Date().toISOString()
        };
      });

      const { error: upsertError } = await supabase.from('payroll_configs').upsert(settingsToSave, { onConflict: 'area' });
      if (upsertError) throw upsertError;
      
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-in zoom-in slide-in-from-right-10' : 'animate-out zoom-out fade-out'} max-w-md w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-[0_20px_40px_rgba(16,185,129,0.2)] p-4 flex items-center gap-4`}>
          <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex flex-col">
            <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Update Successful</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-300 font-bold italic">Configurations are now live.</p>
          </div>
        </div>
      ), { id: saveToast, duration: 3000 });
      
      setTimeout(() => { onClose(); window.location.reload(); }, 1500);
    } catch (error) {
      toast.error("Error: " + error.message, { id: saveToast });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-in fade-in slide-in-from-top-4' : 'animate-out fade-out slide-out-to-top-2'} max-w-md w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[24px] pointer-events-auto flex flex-col border border-white dark:border-slate-700 overflow-hidden`}>
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400"></div>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-slate-800 dark:text-white font-black italic text-base tracking-tight leading-tight uppercase">Confirm <span className="text-blue-600">Payroll</span> Update?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed mt-1">This will synchronize the rate logic and schedules across all departments.</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            <button onClick={() => toast.dismiss(t.id)} className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all">Cancel</button>
            <button onClick={() => { toast.dismiss(t.id); executeSave(); }} className="px-6 py-2.5 bg-slate-900 dark:bg-blue-600 text-white text-[10px] font-black rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all">Yes, Sync Changes</button>
          </div>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 text-slate-900 font-sans animate-in fade-in duration-300">
      <Toaster position="top-right" />
      
      <div className="bg-[#f8fafc] dark:bg-slate-900 w-full max-w-4xl rounded-[40px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-white dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="p-10">
          
          {/* Header Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="bg-blue-600/10 text-blue-600 px-4 py-1 rounded-full text-[9px] font-black tracking-[0.3em] uppercase mb-3">
              Admin Configuration
            </div>
            <h2 className="text-slate-800 dark:text-white text-3xl font-black uppercase tracking-tighter italic">
              Payroll <span className="text-blue-600">Settings</span>
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-[11px] font-bold mt-2 tracking-wide uppercase">
              Manage wage types and distribution schedules per area
            </p>
          </div>
          
          {/* Table Container with Custom Scrollbar */}
          <div className="relative rounded-[24px] bg-white dark:bg-slate-800/50 p-2 shadow-inner border border-slate-200 dark:border-slate-800 max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
              <thead className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20">
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[9px] text-slate-400">
                  <th className="py-5 text-left px-8 font-black">Area / Department</th>
                  <th colSpan="2" className="py-2 text-center border-x border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5 uppercase tracking-widest">Rate Type Selection</th>
                  <th colSpan="2" className="py-2 text-center bg-slate-50/50 dark:bg-white/5 uppercase tracking-widest">Payout Schedule</th>
                  <th className="px-4 text-center">Status</th>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-8"></th>
                  <th className="py-3 text-center text-blue-600">Fixed</th>
                  <th className="py-3 text-center text-blue-600">Daily</th>
                  <th className="py-3 text-center text-indigo-600">Monthly</th>
                  <th className="py-3 text-center text-indigo-600">Semi-M</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {settings.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all group">
                    <td className="py-5 px-8 font-black text-slate-800 dark:text-slate-200 text-sm tracking-tight">{row.area}</td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={row.is_fixed} onChange={() => handleToggle(row.area, 'is_fixed')} className="w-5 h-5 accent-blue-600 cursor-pointer hover:scale-110 transition-transform" />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={row.is_daily} onChange={() => handleToggle(row.area, 'is_daily')} className="w-5 h-5 accent-blue-600 cursor-pointer hover:scale-110 transition-transform" />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={row.is_monthly} onChange={() => handleToggle(row.area, 'is_monthly')} className="w-5 h-5 accent-indigo-600 cursor-pointer hover:scale-110 transition-transform" />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={row.is_semi} onChange={() => handleToggle(row.area, 'is_semi')} className="w-5 h-5 accent-indigo-600 cursor-pointer hover:scale-110 transition-transform" />
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                       <div className={`inline-flex px-4 py-1.5 rounded-full border shadow-sm italic font-black text-[9px] transition-all duration-500 ${row.is_fixed ? 'bg-blue-600 text-white border-blue-600 shadow-blue-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                         {row.is_fixed ? 'FIXED' : 'DAILY'}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center mt-10 px-2">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 italic text-[10px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
              All changes are logged for security
            </div>
            
            <div className="flex items-center gap-8">
              <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-white font-black uppercase text-[11px] tracking-[0.2em] transition-all">
                Close Window
              </button>
              <button 
                onClick={handleSaveClick} 
                disabled={loading} 
                className="group relative px-12 py-4 bg-slate-900 dark:bg-blue-600 overflow-hidden rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] text-white transition-all shadow-[0_20px_40px_-12px_rgba(37,99,235,0.4)] active:scale-95 disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10">{loading ? 'Processing...' : 'Sync Configuration'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PayrollSettingsModal;