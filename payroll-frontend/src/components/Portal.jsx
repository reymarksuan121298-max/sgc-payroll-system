import { useState, useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { FiMaximize, FiCheckCircle, FiLogOut, FiActivity, FiClock, FiAlertCircle, FiUsers, FiArrowRight, FiShield } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

export default function Portal() {
  const [scanValue, setScanValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEntry, setLastEntry] = useState(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [greeting, setGreeting] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // --- CONFIGURATION PARA SA ATTENDANCE LOGIC ---
  const SHIFT_START = "08:00 AM";
  const SHIFT_END = "05:00 PM";

  const getTotalMinutes = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    return (hours * 60) + minutes;
  };

  const fetchTodayLogs = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('Date', today)
      .order('created_at', { ascending: false });
    
    if (!error) setTodayLogs(data);
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    fetchTodayLogs();

    // REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('realtime_attendance')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'attendance_logs' }, 
        () => {
          fetchTodayLogs(); 
        }
      )
      .subscribe();

    const focusInput = () => inputRef.current?.focus();
    focusInput();
    const interval = setInterval(focusInput, 1000);
    window.addEventListener('click', focusInput);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', focusInput);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleScan = async (e) => {
    if (e) e.preventDefault();
    if (!scanValue.trim() || isProcessing) return;

    setIsProcessing(true);
    const rawData = scanValue.trim();
    setScanValue('');

    try {
      let qrData;
      try {
        qrData = JSON.parse(rawData);
      } catch {
        throw new Error("Invalid QR Format. Please check your QR code.");
      }

      const empId = qrData.id || qrData.employee_id || qrData.Employee_ID;
      if (!empId) throw new Error("QR code contains no valid Employee ID.");

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('name, area')
        .eq('employee_id', empId)
        .single();

      if (empError || !employee) {
        throw new Error(`ID (${empId}) is not registered in the system.`);
      }

      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const { data: existingLog, error: logError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('Employee_ID', empId)
        .eq('Date', today)
        .maybeSingle();

      if (logError) throw new Error("Database connection error.");

      const nowMin = getTotalMinutes(currentTime);
      const startMin = getTotalMinutes(SHIFT_START);
      const endMin = getTotalMinutes(SHIFT_END);

      if (!existingLog) {
        const lateDiff = nowMin - startMin;
        const lateHrs = lateDiff > 0 ? lateDiff / 60 : 0;

        const { error: insertError } = await supabase
          .from('attendance_logs')
          .insert([{
            Employee_ID: empId,
            Name: employee.name,
            Area: employee.area || 'N/A',
            TimeIn: currentTime,
            Date: today,
            Late_hrs: lateHrs,
            Status: lateHrs > 0 ? 'Late' : 'Present'
          }]);

        if (insertError) throw insertError;
        showSuccess(employee.name, 'TIME IN', currentTime, lateHrs > 0 ? `Late: ${Math.round(lateDiff)} mins` : null);

      } else if (existingLog && !existingLog.TimeOut) {
        const utDiff = endMin - nowMin;
        const utHrs = utDiff > 0 ? utDiff / 60 : 0;
        const otDiff = nowMin - endMin;
        const otHrs = otDiff > 0 ? otDiff / 60 : 0;

        const { error: updateError } = await supabase
          .from('attendance_logs')
          .update({ 
            TimeOut: currentTime,
            Undertime_hrs: utHrs,
            OT_hrs: otHrs
          })
          .eq('id', existingLog.id);

        if (updateError) throw updateError;
        
        let remark = null;
        if (utHrs > 0) remark = `Undertime: ${Math.round(utDiff)} mins`;
        else if (otHrs > 0) remark = `OT: ${Math.round(otDiff)} mins`;
        
        showSuccess(employee.name, 'TIME OUT', currentTime, remark);
      } else {
        throw new Error("Daily attendance already completed.");
      }

      fetchTodayLogs();

    } catch (err) {
      toast.error(err.message, { 
        style: { borderRadius: '12px', background: '#0f172a', color: '#fff' },
        icon: <FiAlertCircle className="text-red-500" />
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const showSuccess = (displayName, type, time, remark) => {
    setLastEntry({ name: displayName, type: type, time: time, remark: remark });
    toast.success(`${type} Recorded!`, { 
        duration: 4000,
        style: { borderRadius: '12px', fontWeight: 'bold' } 
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#fdfdfe] flex flex-col p-4 md:p-8 font-sans selection:bg-blue-100 text-slate-900">
      <Toaster position="top-right" />

      <form onSubmit={handleScan} className="absolute opacity-0 pointer-events-none w-0 h-0">
        <input ref={inputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} autoFocus />
      </form>

      <header className="max-w-7xl w-full mx-auto flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="h-12 w-1.5 bg-blue-600 rounded-full hidden md:block" />
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-slate-900">
              SGC<span className="text-blue-600">Scan</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.3em] uppercase">Live Terminal v1.0</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/admin')} 
          className="group flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-blue-600 transition-all px-4 py-2 rounded-full hover:bg-blue-50"
        >
          EXIT SYSTEM <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-7xl w-full mx-auto">
        
        <section className="lg:col-span-7 flex flex-col justify-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-none">
              {greeting},<br />
              <span className="text-blue-600">Scan to log.</span>
            </h2>
            <p className="text-slate-500 font-medium max-w-md pt-4">
              Place your Employee ID QR code in front of the scanner. The system will automatically detect your shift logs.
            </p>
          </div>

          <Motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-[40px] p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-200">
                <FiMaximize size={32} className="animate-pulse" />
              </div>
              
              <div className="text-center mb-8">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-2 block">Terminal Status</span>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                  <p className="font-bold text-slate-400">READY FOR SCANNING</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {lastEntry ? (
                  <Motion.div 
                    key={lastEntry.name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className={`w-full ${lastEntry.type === 'TIME IN' ? 'bg-slate-900' : 'bg-blue-600'} rounded-[32px] p-6 text-white shadow-2xl flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                        <FiCheckCircle size={28} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">{lastEntry.type} SUCCESSFUL</p>
                        <h3 className="font-black text-xl uppercase tracking-tight leading-none">{lastEntry.name}</h3>
                        {lastEntry.remark && <p className="text-[10px] font-medium text-white/70 mt-1 uppercase tracking-tighter">{lastEntry.remark}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <FiClock className="ml-auto mb-1 opacity-40" />
                      <p className="font-mono font-black text-2xl leading-none">{lastEntry.time}</p>
                    </div>
                  </Motion.div>
                ) : (
                  <div className="w-full h-24 border-2 border-dashed border-slate-100 rounded-[32px] flex items-center justify-center text-slate-300 font-bold italic text-sm">
                    Waiting for input...
                  </div>
                )}
              </AnimatePresence>
            </div>
          </Motion.div>
        </section>

        <section className="lg:col-span-5 flex flex-col max-h-[650px]">
          {/* --- CONCISE ENGLISH MONITORING NOTE --- */}
          <div className="mb-4 p-4 bg-blue-50/50 border border-blue-100 rounded-[24px] flex items-start gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <FiShield size={16} />
            </div>
            <div>
              <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-wider">Live Monitoring Active</h4>
              <p className="text-[10px] font-bold text-blue-600/70 leading-relaxed uppercase">
                Logs are synced across all areas. This feed resets daily at midnight.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900 uppercase text-sm tracking-tighter flex items-center gap-2">
              <FiUsers className="text-blue-600" /> Recent Activity
            </h3>
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">
              {todayLogs.length} Scans Today
            </span>
          </div>

          <div className="flex-1 bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {todayLogs.map((log) => (
                <Motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={log.id} 
                  className="p-4 rounded-3xl border border-transparent hover:border-slate-50 hover:bg-slate-50/50 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center font-black text-slate-400 text-xs">
                      {log.Name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-xs uppercase leading-none mb-1">{log.Name}</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                        {log.Area} • <span className={log.Status === 'Late' ? 'text-orange-500' : 'text-green-500'}>{log.Status}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-900 font-mono italic">{log.TimeIn}</div>
                    {log.TimeOut && <div className="text-[10px] font-black text-blue-500 font-mono italic">{log.TimeOut}</div>}
                  </div>
                </Motion.div>
              ))}
              
              {todayLogs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 italic text-slate-400 py-20">
                  <FiActivity size={40} className="mb-2" />
                  <p className="text-sm font-bold uppercase">No records found</p>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">End of daily logs</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-7xl w-full mx-auto mt-10 pt-6 border-t border-slate-50 flex justify-between items-center text-slate-300">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
            <span className="text-[10px] font-black uppercase tracking-widest">Real-time Sync Active</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest italic font-mono">SGC Systems © 2025</p>
        </div>
        <div className="flex gap-4">
          <span className="text-[9px] font-bold uppercase border border-slate-100 px-3 py-1 rounded-full">Secure Terminal</span>
        </div>
      </footer>
    </div>
  );
}