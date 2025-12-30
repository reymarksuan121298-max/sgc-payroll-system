import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowPathIcon, 
  MagnifyingGlassIcon,
  UserGroupIcon,
  BriefcaseIcon,
  MapPinIcon,
  PlusIcon,
  MinusIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanknotesIcon,
  PrinterIcon,
  InformationCircleIcon,
  ScaleIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

// Import existing components
import PayrollActions from './PayrollActions';
import PayrollPrintModal from './PayrollPrintModal';

export default function PayrollReport() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [configs, setConfigs] = useState([]); 

  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const fetchPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, logRes, addRes, loanRes, configRes] = await Promise.all([
        supabase.from('employees').select('*').order('name', { ascending: true }),
        supabase.from('attendance_logs')
          .select('Employee_ID, Late_hrs, Undertime_hrs, Status, Date')
          .gte('Date', fromDate)
          .lte('Date', toDate),

        supabase.from('payroll_additions')
          .select('*')
          .eq('status', 'Approved')
          .or(`is_recurring.eq.true,and(applied_date.gte.${fromDate},applied_date.lte.${toDate})`),

        supabase.from('loan_schedules')
          .select('*')
          .eq('status', 'pending')
          .gte('cutoff_date', fromDate)
          .lte('cutoff_date', toDate),
          
        supabase.from('payroll_configs').select('*')
      ]);

      if (empRes.error) throw empRes.error;
      if (logRes.error) throw logRes.error;
      if (addRes.error) throw addRes.error;
      if (loanRes.error) throw loanRes.error;
      if (configRes.error) throw configRes.error;

      setConfigs(configRes.data);

      const integratedData = empRes.data.map(emp => {
        // MATCHING USING employee_id
        const staffLogs = logRes.data.filter(log => log.Employee_ID === emp.employee_id);
        const staffAdditions = addRes.data.filter(add => add.employee_id === emp.employee_id);
        const staffLoans = loanRes.data.filter(loan => loan.employee_id === emp.employee_id);
        
        const uniqueDates = new Set(
          staffLogs
            .filter(l => l.Status !== 'Absent' && l.Date)
            .map(l => l.Date)
        );

        return {
          ...emp,
          attendance_logs: staffLogs,
          payroll_additions: staffAdditions,
          loan_schedules: staffLoans,
          actualWorkedDays: uniqueDates.size 
        };
      });

      setEmployees(integratedData);
    } catch (error) {
      console.error('Fetch Error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchPayrollData();
  }, [fetchPayrollData]);

 const calculateRow = (emp) => {
  const logs = emp.attendance_logs || [];
  const additions = emp.payroll_additions || [];
  const loans = emp.loan_schedules || [];
  const actualWorked = emp.actualWorkedDays || 0;
  
  // Check if exempted
  const isExempted = emp.is_time_exempted === true || emp.is_time_exempted === 1;

  // 1. CALCULATE CUT-OFF CALENDAR DAYS
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  const totalCutoffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // 2. DYNAMIC DAY OFF COUNTING
  let dayOffCount = 0;
  if (emp.day_off && fromDate && toDate) {
    const dayMap = {
      'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday', 
      'WED': 'Wednesday', 'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday'
    };
    const targetDayName = dayMap[emp.day_off.toUpperCase().trim()] || emp.day_off;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      if (currentDayName.toLowerCase() === targetDayName.toLowerCase()) {
        dayOffCount++;
      }
    }
  }

  // 3. BILLABLE DAYS (Punch + Day Offs)
  const hasAttendance = actualWorked > 0;
  const billableDays = hasAttendance ? (actualWorked + dayOffCount) : 0;
  
  // 4. CONFIGURATION CHECK
  const areaConfig = configs.find(c => c.area === emp.area);
  const isFixed = areaConfig?.is_fixed || false; // Fixed Rate vs Daily Rate

  // 5. BASE RATES
  const dailyRate = (emp.basic_salary || 0) / 30;
  const hourlyRate = dailyRate / 8;

  let grossBasicPay = 0;
  let absenceDeduction = 0;

  // --- CORE PAYROLL LOGIC ---
  if (isExempted) {
    // A. EXEMPTED: Full Semi-Monthly Pay
    grossBasicPay = (emp.basic_salary || 0) / 2;
    absenceDeduction = 0;
  } 
  else if (isFixed) {
    // B. FIXED RATE: (Basic / 2) - Absences
    const semiMonthlyRate = (emp.basic_salary || 0) / 2;
    const missingDays = Math.max(0, totalCutoffDays - billableDays);
    absenceDeduction = missingDays * dailyRate;
    grossBasicPay = hasAttendance ? (semiMonthlyRate - absenceDeduction) : 0;
  } 
  else {
    // C. DAILY RATE: (Daily Rate * Billable Days)
    // Dito automatic ang effect ng absent dahil kung ano lang ang pinasok, yun lang ang babayaran.
    grossBasicPay = Number((dailyRate * billableDays).toFixed(2));
    const missingDays = Math.max(0, totalCutoffDays - billableDays);
    absenceDeduction = missingDays * dailyRate;
  }

  // 6. ADDITIONS (OT & Allowances)
  let totalOTPay = 0;
  let totalOTHours = 0;
  let fixedAdditions = 0;
  additions.forEach(item => {
    if (item.type === 'Overtime') {
      const otAmt = Number((hourlyRate * (item.ot_hours || 0)).toFixed(2));
      totalOTPay += otAmt;
      totalOTHours += (item.ot_hours || 0);
    } else {
      fixedAdditions += Number(item.amount || 0);
    }
  });
  const totalAdditions = Number((totalOTPay + fixedAdditions).toFixed(2));

  // 7. ATTENDANCE DEDUCTIONS (Waived if Exempted)
  let totalLateHrs = 0, totalUTHrs = 0, lateDeduction = 0, utDeduction = 0, attendanceDeduction = 0;
  if (!isExempted) {
    totalLateHrs = logs.reduce((acc, curr) => acc + (curr.Late_hrs || 0), 0);
    totalUTHrs = logs.reduce((acc, curr) => acc + (curr.Undertime_hrs || 0), 0);
    lateDeduction = Number((totalLateHrs * hourlyRate).toFixed(2));
    utDeduction = Number((totalUTHrs * hourlyRate).toFixed(2));
    attendanceDeduction = Number((lateDeduction + utDeduction).toFixed(2));
  }

  // 8. MANDATORY & VOLUNTARY
  const sssAmt = emp.sss_enabled ? Number(emp.sss_fixed_amount || 0) : 0;
  const phicAmt = emp.phic_enabled ? Number(emp.phic_fixed_amount || 0) : 0;
  const hdmfAmt = emp.hdmf_enabled ? Number(emp.hdmf_fixed_amount || 0) : 0;
  const totalMandatoryDed = Number((sssAmt + phicAmt + hdmfAmt).toFixed(2));
  const loanDeductions = loans.reduce((acc, curr) => acc + (curr.deduction_amount || 0), 0);
  const fixedVoluntary = Number(emp.voluntary_deductions || 0);
  const totalVoluntaryDed = Number((loanDeductions + fixedVoluntary).toFixed(2));

  // FINAL CALCULATIONS
  const totalDeductions = attendanceDeduction + totalMandatoryDed + totalVoluntaryDed;
  const netPay = (grossBasicPay + totalAdditions) - totalDeductions;

  return {
    daily: dailyRate,
    hourly: hourlyRate,
    // UI Display Logic: Ipakita ang full cutoff days kung exempted, otherwise ang billable days.
    days: isExempted ? totalCutoffDays : billableDays, 
    cutoffDays: totalCutoffDays,
    actualWorked: actualWorked,
    dayOffs: dayOffCount,
    totalBasic: Math.max(0, grossBasicPay),
    absenceDed: absenceDeduction,
    otPay: totalOTPay,
    otHours: totalOTHours,
    allowance: fixedAdditions,
    additions: totalAdditions,
    lateHrs: totalLateHrs,
    utHrs: totalUTHrs,
    lateDed: lateDeduction,
    utDed: utDeduction,
    attDed: attendanceDeduction,
    sss: sssAmt,
    phic: phicAmt,
    hdmf: hdmfAmt,
    mandatory: totalMandatoryDed,
    loans: loans,
    loanTotal: loanDeductions,
    fixedVol: fixedVoluntary,
    voluntary: totalVoluntaryDed,
    totalDeductions: totalDeductions,
    netPay: Math.max(0, netPay),
    isFixed: isFixed,
    hasAttendance: hasAttendance,
    isTimeExempted: isExempted
  };
};
  const filteredEmployees = employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredEmployees.slice(indexOfFirstRow, indexOfLastRow);

 
return (
  <div className="p-4 space-y-6 bg-[#0B0F1A] min-h-screen text-slate-300 font-sans overflow-visible selection:bg-blue-500/30">
    
    {/* HEADER SECTION */}
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-[#161B2C] p-6 rounded-[24px] border border-white/5 shadow-2xl relative overflow-hidden">
      {/* Decorative Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -z-10" />
      
      <div className="flex items-center gap-4">
        <div className="p-3.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-[20px] text-white shadow-lg shadow-blue-600/20 ring-1 ring-white/10">
          <UserGroupIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">
            Payroll <span className="text-blue-500 font-black">Sync</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] italic">
              Segmented Adjustment System
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        {/* DATE RANGE CONTROLS */}
        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5 shadow-inner">
          <div className="flex items-center gap-2 px-3">
            <CalendarDaysIcon className="w-4 h-4 text-blue-500" />
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-white outline-none uppercase cursor-pointer"
            />
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2 px-3">
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-white outline-none uppercase cursor-pointer"
            />
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative flex-1 lg:w-64 group">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search staff or designation..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 rounded-xl outline-none focus:ring-1 focus:ring-blue-500/30 text-[10px] font-bold uppercase tracking-widest text-white transition-all shadow-inner placeholder:text-slate-600"
          />
        </div>

        {/* ACTIONS & REFRESH */}
        <div className="flex items-center gap-2">
          <PayrollActions data={filteredEmployees} calculateRow={calculateRow} />

          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <PrinterIcon className="w-4 h-4" /> Print
          </button>

          <button 
            onClick={fetchPayrollData}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all shadow-xl group active:rotate-180 duration-500"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`} />
          </button>
        </div>
      </div>
    </div>

    {/* TABLE SECTION */}
    <div className="bg-[#161B2C] rounded-[32px] border border-white/5 shadow-2xl overflow-visible">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              <th className="px-6 py-6 w-72">Employee & Details</th>
              <th className="px-4 py-6 text-center">Duty & Gross</th>
              <th className="px-4 py-6 text-center text-green-500">Additions</th>
              <th className="px-4 py-6 text-center text-orange-500">Attendance Ded.</th>
              <th className="px-4 py-6 text-center text-red-500">Mandatory Ded.</th>
              <th className="px-4 py-6 text-center text-purple-400">Voluntary Ded.</th>
              <th className="px-8 py-6 text-center">Net Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-32 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-blue-500 animate-[loading_1.5s_infinite]" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                      Syncing integrated records...
                    </p>
                  </div>
                </td>
              </tr>
            ) : currentRows.length > 0 ? (
              currentRows.map((emp) => {
                const v = calculateRow(emp);

                return (
                  <tr key={emp.id} className="group hover:bg-white/[0.03] transition-all duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex-shrink-0 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center font-black text-white text-xs border border-white/10 shadow-lg group-hover:border-blue-500/30 transition-colors">
                          {emp.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             <p className="text-[12px] font-black text-white uppercase tracking-tight truncate leading-none group-hover:text-blue-400 transition-colors">{emp.name}</p>
                             {v.isTimeExempted ? (
                                <span className="px-1.5 py-0.5 rounded-md border text-[7px] font-black tracking-widest bg-purple-500/10 border-purple-500/20 text-purple-400">
                                  EXEMPTED
                                </span>
                             ) : v.isFixed && (
                                <span className={`px-1.5 py-0.5 rounded-md border text-[7px] font-black tracking-widest ${v.hasAttendance ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                  {v.hasAttendance ? 'FIXED RATE' : 'NO ATTENDANCE'}
                                </span>
                             )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                              <BriefcaseIcon className="w-3 h-3 text-blue-500/50" /> {emp.designation || 'Staff'}
                            </span>
                            <span className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                              <MapPinIcon className="w-3 h-3 text-slate-600" /> {emp.area || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* DUTY & GROSS COLUMN */}
                    <td className="px-4 py-4 text-center relative group/duty">
                      <div className="flex flex-col items-center cursor-help py-2">
                        <span className={`text-[10px] font-black italic mb-1 whitespace-nowrap ${v.isTimeExempted ? 'text-purple-400' : v.isFixed ? (v.hasAttendance ? 'text-blue-500' : 'text-red-500') : 'text-slate-400'}`}>
                            <span className="flex flex-col items-center leading-tight">
                              {/* Ipinapakita pa rin ang Cutoff Days kahit exempted */}
                              <span>{v.isTimeExempted ? v.cutoffDays : v.days} / {v.cutoffDays} DAYS</span>
                              <span className="text-[7px] text-slate-600 font-bold tracking-tighter uppercase">
                                {v.isTimeExempted ? '(FULL PERIOD)' : `(${v.actualWorked}P + ${v.dayOffs} OFF)`}
                              </span>
                            </span>
                        </span>
                        <span className={`text-xs font-black tracking-tighter uppercase italic whitespace-nowrap ${v.totalBasic === 0 ? 'text-slate-700' : 'text-white'}`}>
                          ₱{v.totalBasic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      {/* DUTY TOOLTIP */}
                      <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1e253a] border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover/duty:opacity-100 group-hover/duty:visible transition-all duration-300 z-[9999] pointer-events-none text-left backdrop-blur-md">
                        <div className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Payroll Computation Logic</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">Monthly Basic</span>
                            <span className="font-black text-white">₱{(emp.basic_salary || 0).toLocaleString()}</span>
                          </div>
                          
                          {v.isTimeExempted ? (
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-purple-400 italic font-bold">Time Exempted (Basic/2)</span>
                              <span className="font-black text-purple-400">₱{((emp.basic_salary || 0)/2).toLocaleString()}</span>
                            </div>
                          ) : (
                            <>
                              {v.isFixed && (
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-blue-400 italic">Semi-Monthly (Basic/2)</span>
                                  <span className="font-black text-blue-400">₱{((emp.basic_salary || 0)/2).toLocaleString()}</span>
                                </div>
                              )}
                              <div className="h-px bg-white/5 my-1" />
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400">Cut-off Calendar Days</span>
                                <span className="font-black text-white">{v.cutoffDays} Days</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 italic">Logs + Paid Day-off</span>
                                <span className="font-black text-green-400">{v.days} Days</span>
                              </div>
                              {v.isFixed && v.absenceDed > 0 && (
                                 <div className="flex justify-between items-center text-[10px]">
                                   <span className="text-red-400 font-bold">Absence Deduction</span>
                                   <span className="font-black text-red-500">- ₱{v.absenceDed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                 </div>
                              )}
                            </>
                          )}
                          
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500 italic">Gross Basic Pay</span>
                            <span className="font-black text-blue-400">₱{v.totalBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1e253a]"></div>
                      </div>
                    </td>

                    {/* ADDITIONS COLUMN */}
                    <td className="px-4 py-4 text-center relative group/add">
                      <div className="flex flex-col items-center cursor-help py-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/5 border border-green-500/10 mb-1">
                          <PlusIcon className="w-2.5 h-2.5 text-green-500" />
                          <span className="text-[11px] font-black text-green-500 italic">
                            ₱{v.additions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {v.otHours > 0 && <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">Inc. {v.otHours}h OT</span>}
                      </div>
                      <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1e253a] border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all duration-300 z-[9999] pointer-events-none text-left backdrop-blur-md">
                        <div className="text-[8px] font-black text-green-500 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Additions Breakdown</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Overtime Pay ({v.otHours}h)</span>
                            <span className="font-black text-white">₱{v.otPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Fixed Allowances</span>
                            <span className="font-black text-white">₱{v.allowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500 italic">Total Extra</span>
                            <span className="font-black text-green-500">₱{v.additions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1e253a]"></div>
                      </div>
                    </td>

                    {/* ATTENDANCE DEDUCTION COLUMN */}
                    <td className="px-4 py-4 text-center relative group/att">
                      <div className="flex flex-col items-center cursor-help py-2">
                        {v.isTimeExempted ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/5 border border-slate-500/10 mb-1 opacity-40">
                            <span className="text-[10px] font-black text-slate-500 italic uppercase">Waived</span>
                          </div>
                        ) : (
                          <>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/5 border border-orange-500/10 mb-1">
                              <MinusIcon className="w-2.5 h-2.5 text-orange-500" />
                              <span className="text-[11px] font-black text-orange-500 italic">
                                ₱{v.attDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.15em]">{v.lateHrs}L • {v.utHrs}U</span>
                          </>
                        )}
                      </div>
                      <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1e253a] border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover/att:opacity-100 group-hover/att:visible transition-all duration-300 z-[9999] pointer-events-none text-left backdrop-blur-md">
                        <div className="text-[8px] font-black text-orange-500 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Attendance Penalty</div>
                        <div className="space-y-2">
                          {v.isTimeExempted ? (
                            <div className="text-[10px] italic text-slate-400 py-2">This employee is time-exempted. Late and undertime penalties are not applied.</div>
                          ) : (
                            <>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400">Late ({v.lateHrs}h)</span>
                                <span className="font-black text-white">₱{v.lateDed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400">Undertime ({v.utHrs}h)</span>
                                <span className="font-black text-white">₱{v.utDed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                                <span className="font-bold text-slate-500 italic">Total Deducted</span>
                                <span className="font-black text-orange-500">₱{v.attDed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1e253a]"></div>
                      </div>
                    </td>

                    {/* MANDATORY DEDUCTION COLUMN */}
                    <td className="px-4 py-4 text-center relative group/mand">
                      <div className="flex flex-col items-center cursor-help py-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/5 border border-red-500/10 mb-1">
                          <ShieldCheckIcon className="w-3 h-3 text-red-500" />
                          <span className="text-[11px] font-black text-red-500 italic">
                            ₱{v.mandatory.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1e253a] border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover/mand:opacity-100 group-hover/mand:visible transition-all duration-300 z-[9999] pointer-events-none text-left backdrop-blur-md">
                        <div className="text-[8px] font-black text-red-500 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Gov't Contributions</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">SSS Contribution</span>
                            <span className="font-black text-white">₱{v.sss.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">PhilHealth</span>
                            <span className="font-black text-white">₱{v.phic.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Pag-IBIG</span>
                            <span className="font-black text-white">₱{v.hdmf.toFixed(2)}</span>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500 italic">Total Mandatory</span>
                            <span className="font-black text-red-500">₱{v.mandatory.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1e253a]"></div>
                      </div>
                    </td>

                    {/* VOLUNTARY DEDUCTION COLUMN */}
                    <td className="px-4 py-4 text-center relative group/vol">
                      <div className="flex flex-col items-center cursor-help py-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/5 border border-purple-500/10 mb-1">
                          <BanknotesIcon className="w-3 h-3 text-purple-400" />
                          <span className="text-[11px] font-black text-purple-400 italic">
                            ₱{v.voluntary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {v.loans.length > 0 && <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">Inc. {v.loans.length} Loan/s</span>}
                      </div>
                      <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-2 w-60 bg-[#1e253a] border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover/vol:opacity-100 group-hover/vol:visible transition-all duration-300 z-[9999] pointer-events-none text-left backdrop-blur-md">
                        <div className="text-[8px] font-black text-purple-400 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Voluntary Breakdown</div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                          {v.loans.map((loan, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-400 truncate max-w-[120px]">{loan.deduction_type}</span>
                              <span className="font-black text-white">₱{(loan.deduction_amount || 0).toFixed(2)}</span>
                            </div>
                          ))}
                          {v.fixedVol > 0 && (
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-400">Other Adjustments</span>
                              <span className="font-black text-white">₱{v.fixedVol.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500 italic">Total Voluntary</span>
                            <span className="font-black text-purple-400">₱{v.voluntary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1e253a]"></div>
                      </div>
                    </td>

                    {/* NET PAY COLUMN */}
                    <td className="px-8 py-4 text-center relative group/net">
                      <div className="cursor-help py-2">
                        <span className={`text-[14px] font-black italic tracking-tighter uppercase underline underline-offset-[6px] decoration-2 whitespace-nowrap transition-all duration-300 ${v.netPay <= 0 ? 'text-red-500 decoration-red-500/20' : 'text-white decoration-blue-500/30 group-hover/net:decoration-blue-500 group-hover/net:text-blue-400'}`}>
                          ₱{v.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="absolute bottom-[85%] right-0 mb-2 w-64 bg-[#1e253a] border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover/net:opacity-100 group-hover/net:visible transition-all duration-300 z-[9999] pointer-events-none text-left backdrop-blur-md">
                        <div className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Final Summary</div>
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Gross Earnings</span>
                            <span className="font-black text-green-500">₱{(v.totalBasic + v.additions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Total Deductions</span>
                            <span className="font-black text-red-500">- ₱{v.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="pt-3 border-t border-white/20 flex justify-between items-center">
                            <span className="text-[10px] font-black text-white uppercase italic">Take Home Pay</span>
                            <span className={`text-[15px] font-black italic ${v.netPay <= 0 ? 'text-red-500' : 'text-blue-400'}`}>₱{v.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="absolute top-full right-10 border-[6px] border-transparent border-t-[#1e253a]"></div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="py-32 text-center">
                  <div className="flex flex-col items-center opacity-20">
                    <MagnifyingGlassIcon className="w-12 h-12 mb-4 text-slate-500" />
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500">No staff records found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="flex items-center justify-between px-8 py-5 bg-white/[0.02] border-t border-white/5 rounded-b-[32px]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-blue-500/50" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-white">{indexOfFirstRow + 1}</span> to <span className="text-white">{Math.min(indexOfLastRow, filteredEmployees.length)}</span> of {filteredEmployees.length} registered staff
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === 1}
            className="p-2.5 bg-white/5 rounded-xl border border-white/10 disabled:opacity-20 transition-all hover:bg-white/10 hover:border-white/20 active:scale-90"
          >
            <ChevronLeftIcon className="w-4 h-4 text-white" />
          </button>
          
          <div className="flex items-center gap-1.5">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all duration-300 ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110' : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === totalPages}
            className="p-2.5 bg-white/5 rounded-xl border border-white/10 disabled:opacity-20 transition-all hover:bg-white/10 hover:border-white/20 active:scale-90"
          >
            <ChevronRightIcon className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>

    {/* FOOTER INFO */}
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] px-6 pb-8">
      <div className="flex items-center gap-4">
        <p>Payroll System • December 2025</p>
        <span className="h-1 w-1 rounded-full bg-slate-800" />
        <p className="text-slate-800">Operational Integrity Verified</p>
      </div>
      <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
        <p className="text-blue-900/40">v4.8.2 • Semi-Monthly Sync Enabled</p>
      </div>
    </div>

    {/* MODALS */}
    <PayrollPrintModal 
      isOpen={isPrintModalOpen} 
      onClose={() => setIsPrintModalOpen(false)} 
      data={filteredEmployees} 
      calculateRow={calculateRow} 
    />
  </div>
);
}