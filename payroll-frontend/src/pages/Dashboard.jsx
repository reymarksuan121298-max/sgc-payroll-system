import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowPathIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  UserGroupIcon, 
  ClockIcon, 
  ExclamationCircleIcon, 
  ArrowDownCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CalendarDaysIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, lateCount: 0, totalLateHrs: 0, totalUndertime: 0 });

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); 
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = new Date(selectedYear, selectedMonth, 1).toISOString();
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);

      const fetchedLogs = data || [];
      setStats({
        present: fetchedLogs.length,
        lateCount: fetchedLogs.filter(d => parseFloat(d.Late_hrs || 0) > 0).length,
        totalLateHrs: fetchedLogs.reduce((acc, curr) => acc + parseFloat(curr.Late_hrs || 0), 0).toFixed(2),
        totalUndertime: fetchedLogs.reduce((acc, curr) => acc + parseFloat(curr.Undertime_hrs || 0), 0).toFixed(2)
      });
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let result = logs.filter(log => {
      const matchesSearch = !searchQuery || 
        log.Name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.Employee_ID?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesArea = areaFilter === 'All' || log.Area === areaFilter;
      const matchesDate = !dateFilter || log.Date === dateFilter;
      return matchesSearch && matchesArea && matchesDate;
    });
    setFilteredLogs(result);
    setCurrentPage(1);
  }, [searchQuery, areaFilter, dateFilter, logs]);

  const currentRows = filteredLogs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);

  const formatDeduction = (hrs) => {
    const h = parseFloat(hrs || 0);
    return h === 0 ? "0" : h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`;
  };

  const areas = ['All', ...new Set(logs.map(l => l.Area).filter(Boolean))];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto bg-white dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Attendance Logs</h1>
          <div className="flex gap-3 mt-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
            <select className="bg-transparent outline-none cursor-pointer" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => <option key={m} value={i} className="text-black">{m}</option>)}
            </select>
            <select className="bg-transparent outline-none cursor-pointer" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              {[2025, 2024, 2023].map(y => <option key={y} value={y} className="text-black">{y}</option>)}
            </select>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-500 transition-colors">
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        <StatCard label="Total Present" value={stats.present} color="text-slate-900 dark:text-white" />
        <StatCard label="Late Headcount" value={stats.lateCount} color="text-orange-500" />
        <StatCard label="Lost Hrs (Late)" value={stats.totalLateHrs} color="text-rose-500" />
        <StatCard label="Undertime" value={stats.totalUndertime} color="text-blue-600" />
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" placeholder="Search Name or ID..." 
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:border-blue-500 transition-all"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select 
          className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5 text-xs font-bold outline-none cursor-pointer"
          value={areaFilter} onChange={e => setAreaFilter(e.target.value)}
        >
          {areas.map(a => <option key={a} value={a}>{a === 'All' ? 'All Areas' : a}</option>)}
        </select>
        <input 
          type="date" 
          className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5 text-xs font-bold outline-none cursor-pointer dark:[color-scheme:dark]"
          value={dateFilter} onChange={e => setDateFilter(e.target.value)}
        />
      </div>

      {/* COMPLETE TABLE */}
      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase text-slate-400 font-bold tracking-widest">
            <tr>
              <th className="px-8 py-5">Timestamp & ID</th>
              <th className="px-8 py-5">Employee Info</th>
              <th className="px-8 py-5 text-center">Shift Schedule</th>
              <th className="px-8 py-5 text-center">Deduction</th>
              <th className="px-8 py-5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan="5" className="py-20 text-center text-xs font-bold text-blue-500 uppercase tracking-widest animate-pulse">Syncing logs...</td></tr>
            ) : currentRows.length === 0 ? (
              <tr><td colSpan="5" className="py-20 text-center text-slate-400 text-xs italic font-medium">No results found.</td></tr>
            ) : currentRows.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                <td className="px-8 py-5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="text-[9px] font-black text-blue-500 uppercase font-mono mt-0.5">{log.Employee_ID || 'ID-MISSING'}</div>
                </td>
                <td className="px-8 py-5">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{log.Name}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{log.Area || 'OFFICE'}</div>
                </td>
                <td className="px-8 py-5 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold text-emerald-600 font-mono">IN: {log.TimeIn}</span>
                    <span className="text-[11px] font-bold text-slate-300 dark:text-slate-600 font-mono">OUT: {log.TimeOut || '--:--'}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-center">
                  <span className="inline-block font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded text-[11px]">
                    {formatDeduction(parseFloat(log.Late_hrs || 0) + parseFloat(log.Undertime_hrs || 0))}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${parseFloat(log.Late_hrs || 0) > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                    {parseFloat(log.Late_hrs || 0) > 0 ? 'Late' : 'Present'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-between items-center px-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {currentPage} of {totalPages}
          </p>
          <div className="flex gap-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="disabled:opacity-20 hover:text-blue-500 transition-colors">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="disabled:opacity-20 hover:text-blue-500 transition-colors">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="border-l border-slate-100 dark:border-slate-800 pl-6">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</p>
      <p className={`text-3xl font-bold tracking-tighter ${color}`}>{value}</p>
    </div>
  );
}