import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowPathIcon, 
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
  GlobeAsiaAustraliaIcon,
  CheckBadgeIcon,
  BriefcaseIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

export default function CalendarDayOff() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverDate, setServerDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  
  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const dayNameMapping = {
    'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday',
    'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday', 'SUN': 'Sunday'
  };

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: timeData, error: timeError } = await supabase.rpc('get_server_time');
      if (timeError) throw timeError;

      const officialNow = new Date(timeData.server_date);
      setServerDate(officialNow);
      setSelectedDate(officialNow);

      const { data, error } = await supabase.from('employees').select('*').order('name');
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error("Sync Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Reset page kapag nag-filter o nag-search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, selectedDate]);

  const getCutoffRange = (date) => {
    if (!date) return { start: new Date(), end: new Date() };
    const d = new Date(date);
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    if (day >= 11 && day <= 25) {
      return { start: new Date(year, month, 11), end: new Date(year, month, 25) };
    } else {
      if (day > 25) return { start: new Date(year, month, 26), end: new Date(year, month + 1, 10) };
      return { start: new Date(year, month - 1, 26), end: new Date(year, month, 10) };
    }
  };

  const activeBaseDate = selectedDate || serverDate;
  const { start, end } = getCutoffRange(activeBaseDate);

  const calendarDates = [];
  let curr = new Date(start);
  while (curr <= end) {
    calendarDates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const getDayOffCount = (dbDayOff) => {
    if (!dbDayOff || dbDayOff === '-' || dbDayOff === 'EMPTY') return 0;
    const targetDay = dayNameMapping[dbDayOff];
    let count = 0;
    let temp = new Date(start);
    while (temp <= end) {
      if (temp.toLocaleString('en-US', { weekday: 'long' }) === targetDay) count++;
      temp.setDate(temp.getDate() + 1);
    }
    return count;
  };

  const currentDayName = selectedDate?.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
  const offTodayCount = employees.filter(emp => emp.day_off === currentDayName).length;
  const dutyTodayCount = employees.length - offTodayCount;

  // LOGIC PARA SA FILTERING
  const allFiltered = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employee_id.includes(searchTerm);
    const isOff = emp.day_off === currentDayName;
    if (filterStatus === "OFF") return matchesSearch && isOff;
    if (filterStatus === "DUTY") return matchesSearch && !isOff;
    return matchesSearch;
  });

  // LOGIC PARA SA PAGINATION
  const totalPages = Math.ceil(allFiltered.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEmployees = allFiltered.slice(indexOfFirstItem, indexOfLastItem);

  if (loading || !serverDate) return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950">
      <div className="text-center">
        <ArrowPathIcon className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Syncing Server Roster...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none !important; }
        .hide-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
      `}</style>
      
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
            DUTY ROSTER
            <GlobeAsiaAustraliaIcon className="w-5 h-5 text-green-500" />
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic tracking-tighter">Verified Server Time (PHT)</p>
        </div>
        <div className="text-right">
           <p className="text-xs font-black text-blue-600 uppercase italic">
             {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
           </p>
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Current Cutoff Period</p>
        </div>
      </div>

      {/* 2. FILTER CARDS */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setFilterStatus(filterStatus === "OFF" ? "ALL" : "OFF")}
          className={`p-5 rounded-[2.5rem] border transition-all text-left ${filterStatus === "OFF" ? 'bg-blue-600 border-blue-600 shadow-xl' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm'}`}
        >
          <div className={`p-2 rounded-xl w-fit mb-3 ${filterStatus === "OFF" ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
            <CheckBadgeIcon className="w-6 h-6" />
          </div>
          <p className={`text-3xl font-black ${filterStatus === "OFF" ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{offTodayCount}</p>
          <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === "OFF" ? 'text-blue-100' : 'text-slate-400'}`}>Day Off Today</p>
        </button>

        <button 
          onClick={() => setFilterStatus(filterStatus === "DUTY" ? "ALL" : "DUTY")}
          className={`p-5 rounded-[2.5rem] border transition-all text-left ${filterStatus === "DUTY" ? 'bg-slate-800 border-slate-800 shadow-xl' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm'}`}
        >
          <div className={`p-2 rounded-xl w-fit mb-3 ${filterStatus === "DUTY" ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
            <BriefcaseIcon className="w-6 h-6" />
          </div>
          <p className={`text-3xl font-black ${filterStatus === "DUTY" ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{dutyTodayCount}</p>
          <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === "DUTY" ? 'text-slate-400' : 'text-slate-400'}`}>On Duty Today</p>
        </button>
      </div>

      {/* 3. DATE SELECTOR & SEARCH */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar scroll-smooth px-1">
          {calendarDates.map((d, i) => {
            const isSelected = d.toDateString() === selectedDate?.toDateString();
            const isToday = d.toDateString() === serverDate.toDateString();
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 w-12 h-16 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isSelected 
                  ? 'bg-blue-600 text-white shadow-lg scale-110' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <span className="text-[9px] font-bold uppercase">{d.toLocaleString('en-US', { weekday: 'short' })}</span>
                <span className="text-base font-black">{d.getDate()}</span>
                {isToday && !isSelected && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1" />}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text"
            placeholder="Search employee name or ID..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* 4. LIST SECTION */}
      <div className="space-y-3 pb-4">
        <div className="flex justify-between items-center px-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Staff List ({allFiltered.length}) • Page {currentPage} of {totalPages || 1}
          </h2>
          {filterStatus !== "ALL" && (
            <button onClick={() => setFilterStatus("ALL")} className="text-[10px] font-black text-blue-600 uppercase underline decoration-2 underline-offset-4">Show All</button>
          )}
        </div>

        {currentEmployees.map((emp) => {
          const offCount = getDayOffCount(emp.day_off);
          const isOff = emp.day_off === currentDayName;
          const isSet = emp.day_off && emp.day_off !== '-' && emp.day_off !== 'EMPTY';

          return (
            <div 
              key={emp.id} 
              className={`flex items-center justify-between p-4 rounded-[2rem] border transition-all ${
                isOff 
                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 shadow-md shadow-blue-500/5' 
                : 'bg-white dark:bg-slate-900 border-white dark:border-slate-800 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${
                  isOff ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {emp.name.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{emp.name}</h3>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">ID: {emp.employee_id}</p>
                    <p className={`text-[10px] font-black uppercase ${isSet ? 'text-blue-500' : 'text-red-400'}`}>
                      {isSet ? `${dayNameMapping[emp.day_off]}s OFF • (${offCount} this cutoff)` : "No Schedule Set"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {isOff ? (
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter bg-blue-100 dark:bg-blue-900/50 px-3 py-1 rounded-full border border-blue-200">Rest Day</span>
                ) : (
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100">On Duty</span>
                )}
              </div>
            </div>
          );
        })}
        
        {currentEmployees.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
             <ExclamationCircleIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Staff Found</p>
          </div>
        )}
      </div>

      {/* 5. PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pb-10">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`p-3 rounded-2xl border transition-all ${
              currentPage === 1 
              ? 'text-slate-300 border-slate-100 dark:border-slate-800 cursor-not-allowed' 
              : 'text-blue-600 border-blue-100 bg-white dark:bg-slate-900 shadow-sm hover:bg-blue-50'
            }`}
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                  currentPage === i + 1
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`p-3 rounded-2xl border transition-all ${
              currentPage === totalPages 
              ? 'text-slate-300 border-slate-100 dark:border-slate-800 cursor-not-allowed' 
              : 'text-blue-600 border-blue-100 bg-white dark:bg-slate-900 shadow-sm hover:bg-blue-50'
            }`}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}