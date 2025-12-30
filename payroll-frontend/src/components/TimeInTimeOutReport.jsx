import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ClockIcon, 
  ArrowDownTrayIcon, 
  UserGroupIcon,
  CalendarIcon,
  MapPinIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

// --- ADDED: PDF LIBRARIES ---
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TimeInTimeOutReport() {
  const [employees, setEmployees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false); // New state for loading PDF
  
  // Dynamic Default Date: Current Month
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Helper Function para sa 12-Hour Format (AM/PM)
  const formatTime12H = (timeString) => {
    if (!timeString || timeString === 'NULL' || timeString === '—') return '—';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    } catch { 
      return timeString + '\n ';
    }
  };

  const dateRange = useMemo(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    let dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    return dates;
  }, [fromDate, toDate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [empRes, logRes] = await Promise.all([
          supabase.from('employees').select('*').order('name'),
          supabase.from('attendance_logs')
            .select('"Employee_ID", "Date", "TimeIn", "TimeOut"') 
            .gte('Date', fromDate)
            .lte('Date', toDate)
        ]);
        setEmployees(empRes.data || []);
        setLogs(logRes.data || []);
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setTimeout(() => setLoading(false), 1000);
      }
    };
    fetchData();
  }, [fromDate, toDate]);

  const groupedData = employees.reduce((acc, emp) => {
    const area = emp.area || 'UNASSIGNED';
    if (!acc[area]) acc[area] = [];
    acc[area].push(emp);
    return acc;
  }, {});

  // --- UPDATED: PDF DOWNLOADER (LEGAL/LONG BOND PAPER SIZE) ---
  const downloadPDF = () => {
    setIsGenerating(true);
    
    // Custom dimensions for Long Bond Paper (Legal Size) in Landscape
    // 8.5" x 13" -> 215.9mm x 330.2mm
    const doc = new jsPDF({ 
      orientation: 'landscape', 
      unit: 'mm', 
      format: [215.9, 330.2] 
    });

    // Header Design sa PDF
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("ATTENDANCE MATRIX REPORT", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Covered Period: ${fromDate} to ${toDate} (Long Bond Paper)`, 14, 22);
    doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 27);

    // Prepare Headers
    const tableHeaders = [['Personnel Info', ...dateRange.flatMap(d => [`${d} (In)`, `(Out)`])]];
    
    // Prepare Rows
    const tableRows = [];
    Object.entries(groupedData).forEach(([area, areaEmployees]) => {
      // Area Sub-header sa PDF
      tableRows.push([{ 
        content: `AREA: ${area.toUpperCase()}`, 
        colSpan: (dateRange.length * 2) + 1, 
        styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [79, 70, 229], halign: 'left' } 
      }]);
      
      areaEmployees.forEach(emp => {
        const row = [`${emp.name}\nID: ${emp.employee_id}`];
        dateRange.forEach(date => {
          const log = logs.find(l => String(l.Employee_ID).trim() === String(emp.employee_id).trim() && l.Date === date);
          row.push(formatTime12H(log?.TimeIn));
          row.push(formatTime12H(log?.TimeOut));
        });
        tableRows.push(row);
      });
    });

    // Generate Table
    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 35,
      theme: 'grid',
      // Font size adjusted for Long Bond Paper to fit more dates
      styles: { fontSize: 5.5, cellPadding: 1.2, valign: 'middle', halign: 'center', overflow: 'linebreak' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', minCellWidth: 35 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          if (data.cell.text[0] === '—') {
            data.cell.styles.textColor = [200, 200, 200];
          } else if (data.column.index % 2 !== 0) {
            data.cell.styles.textColor = [79, 70, 229]; // Indigo for In
          } else {
            data.cell.styles.textColor = [225, 29, 72]; // Rose for Out
          }
        }
      },
      margin: { left: 10, right: 10 }
    });

    doc.save(`Attendance_Report_Long_${fromDate}.pdf`);
    setIsGenerating(false);
  };

  // --- PREMIUM LOADING ANIMATION ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-slate-900 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute w-14 h-14 border-4 border-rose-500/20 border-b-rose-500 rounded-full animate-spin-slow"></div>
          <SparklesIcon className="w-6 h-6 text-indigo-500 animate-pulse" />
        </div>
        <div className="mt-12 text-center">
          <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.3em] mb-2">Generating Matrix</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organizing enterprise data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-slate-900 p-4 lg:p-6 transition-colors duration-300">
      
      {/* --- TOP ACTION BAR --- */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-5 rounded-[2.5rem] border border-gray-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none no-print">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <ClockIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Time Matrix</h1>
            <div className="flex items-center gap-2">
               <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Enterprise System v5.0</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-slate-700 p-2 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-inner">
            <div className="flex items-center px-3 border-r border-gray-300 dark:border-slate-500">
              <CalendarIcon className="w-4 h-4 text-indigo-500 mr-2" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none" />
            </div>
            <div className="flex items-center px-3">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none" />
            </div>
          </div>
          
          <button 
            onClick={downloadPDF} 
            disabled={isGenerating}
            className="flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.15em] hover:scale-105 active:scale-95 transition-all shadow-xl disabled:bg-slate-500"
          >
            {isGenerating ? (
               <span className="animate-pulse">Processing PDF...</span>
            ) : (
              <><ArrowDownTrayIcon className="w-4 h-4" /> Download Report</>
            )}
          </button>
        </div>
      </div>

      {/* --- MAIN MATRIX TABLE --- */}
      <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh] custom-scrollbar">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="sticky top-0 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md">
                <th className="sticky left-0 z-40 bg-white dark:bg-slate-800 p-7 border-b-2 border-r border-gray-100 dark:border-slate-700 text-left min-w-[300px]">
                  <div className="flex items-center gap-3 text-indigo-600">
                    <UserGroupIcon className="w-6 h-6" />
                    <span className="text-[12px] font-black uppercase tracking-[0.2em]">Personnel Info</span>
                  </div>
                </th>
                {dateRange.map(date => (
                  <th key={date} colSpan="2" className="p-4 border-b-2 border-r border-gray-100 dark:border-slate-700 text-center min-w-[160px] bg-slate-50/50 dark:bg-slate-900/50">
                    <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">
                      {new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                    </span>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{date}</p>
                  </th>
                ))}
              </tr>
              <tr className="sticky top-[89px] z-30 bg-slate-50 dark:bg-slate-900">
                <th className="sticky left-0 z-40 bg-slate-50 dark:bg-slate-900 border-b border-r border-gray-200 dark:border-slate-700 p-3 italic text-[10px] text-slate-400 font-black uppercase text-center">Grouped Area</th>
                {dateRange.map(date => (
                  <React.Fragment key={`sub-${date}`}>
                    <th className="p-2 border-b border-r border-gray-100 dark:border-slate-700 text-[10px] font-black text-indigo-500 uppercase text-center bg-indigo-50/30 dark:bg-indigo-900/20 w-1/2">In</th>
                    <th className="p-2 border-b border-r border-gray-100 dark:border-slate-700 text-[10px] font-black text-rose-500 uppercase text-center bg-rose-50/30 dark:bg-rose-900/20 w-1/2">Out</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedData).map(([area, areaEmployees]) => (
                <React.Fragment key={area}>
                  <tr className="area-header">
                    <td colSpan={dateRange.length * 2 + 1} className="sticky left-0 bg-slate-100/90 dark:bg-slate-700/80 backdrop-blur-sm px-7 py-4 border-y border-gray-200 dark:border-slate-600">
                      <div className="flex items-center gap-3">
                        <MapPinIcon className="w-5 h-5 text-indigo-500" />
                        <span className="text-[13px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.25em]">Area: {area}</span>
                        <div className="ml-auto bg-white/80 dark:bg-slate-800 px-4 py-1.5 rounded-xl text-[10px] font-black text-indigo-600 shadow-sm">
                          {areaEmployees.length} PERSONNEL
                        </div>
                      </div>
                    </td>
                  </tr>

                  {areaEmployees.map((emp) => (
                    <tr key={emp.employee_id} className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors">
                      <td className="sticky left-0 z-20 bg-white dark:bg-slate-800 p-6 border-r border-b border-gray-100 dark:border-slate-700 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center gap-5">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-[12px] font-black text-indigo-600 shadow-inner">
                            {emp.name.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[13px] font-black text-slate-800 dark:text-white uppercase leading-none mb-1 truncate">{emp.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase italic tracking-tighter">{emp.employee_id}</p>
                          </div>
                        </div>
                      </td>

                      {dateRange.map(date => {
                        const log = logs.find(l => 
                          String(l.Employee_ID).trim() === String(emp.employee_id).trim() && 
                          l.Date === date
                        );
                        
                        return (
                          <React.Fragment key={`${emp.employee_id}-${date}`}>
                            <td className={`p-4 border-r border-b border-gray-50 dark:border-slate-700 text-center font-mono text-[11px] transition-all ${log?.TimeIn ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-300 dark:text-slate-600'}`}>
                              {formatTime12H(log?.TimeIn)}
                            </td>
                            <td className={`p-4 border-r border-b border-gray-100 dark:border-slate-700 text-center font-mono text-[11px] transition-all ${log?.TimeOut ? 'text-rose-500 font-black' : 'text-slate-300 dark:text-slate-600'}`}>
                              {formatTime12H(log?.TimeOut)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- FOOTER STATUS --- */}
      <div className="mt-8 flex flex-col md:flex-row justify-between items-center px-6 gap-6 no-print">
        <div className="flex items-center gap-8 bg-white dark:bg-slate-800 px-8 py-4 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-lg bg-indigo-500 shadow-lg shadow-indigo-200"></div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Time In</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-lg bg-rose-500 shadow-lg shadow-rose-200"></div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Time Out</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Simpal ERP Matrix v5.0 Platinum</p>
          <p className="text-[10px] font-bold text-indigo-500 uppercase italic">Confidential Enterprise Report</p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        
        .animate-spin-slow { animation: spin 3s linear infinite; }

        @media print {
          .no-print { display: none !important; }
          .custom-scrollbar { overflow: visible !important; max-height: none !important; }
          .sticky { position: static !important; }
          .bg-[#F2F2F7] { background: white !important; }
          .shadow-2xl, .shadow-xl { shadow: none !important; }
          @page { size: landscape; margin: 10mm; }
          .rounded-[3rem] { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}