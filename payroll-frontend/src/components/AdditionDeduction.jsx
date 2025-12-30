import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'react-hot-toast';
import { 
  ArrowPathIcon, MagnifyingGlassIcon, WalletIcon, 
  ShieldCheckIcon, XMarkIcon, BanknotesIcon, ClockIcon,
  CheckCircleIcon, LockClosedIcon, InformationCircleIcon,
  CalculatorIcon, ExclamationCircleIcon, PlusCircleIcon, MinusCircleIcon, TrashIcon,
  ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/react/24/outline';

export default function AdditionDeduction() {
  // --- STATES ---
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('mandatory'); 
  const [modalMode, setModalMode] = useState('deduction');

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [existingLoans, setExistingLoans] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [attendanceMetrics, setAttendanceMetrics] = useState({
    totalLateHours: 0, totalUndertimeHours: 0, lateDeduction: 0,
    undertimeDeduction: 0, totalDeduction: 0, hourlyRate: 0,
    dailyRate: 0, monthlySalary: 0, isFixedRate: false
  });

  const [formData, setFormData] = useState({
    sss: 0, philhealth: 0, pagibig: 0,
    sssEnabled: false, phicEnabled: false, hdmfEnabled: false,
    totalCA: '', installmentAmount: '',
    food: '', transpo: '', restday: '', others: ''
  });

  const [additionList, setAdditionList] = useState([]);
  const [newEntry, setNewEntry] = useState({
    type: 'Allowance',
    amount: '',
    otHours: '', 
    remarks: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Approved' 
  });

  const [isSaving, setIsSaving] = useState(false);

  // --- PAGINATION & SEARCH LOGIC ---
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);

  // --- TOAST NOTIFICATION ---
  const showPremiumToast = (message, type = 'success') => {
    const toastStyles = {
      success: { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircleIcon className="w-5 h-5 text-emerald-400" />, shadow: 'shadow-emerald-500/20' },
      error: { border: 'border-red-500/50', bg: 'bg-red-500/10', text: 'text-red-400', icon: <ExclamationCircleIcon className="w-5 h-5 text-red-400" />, shadow: 'shadow-red-500/20' },
      loading: { border: 'border-blue-500/50', bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <ArrowPathIcon className="w-5 h-5 text-blue-400 animate-spin" />, shadow: 'shadow-blue-500/20' }
    };
    const style = toastStyles[type];
    return toast.custom((t) => (
      <div className={`${t.visible ? 'animate-in slide-in-from-right-full' : 'animate-out fade-out slide-out-to-right-full'} 
        max-w-md w-full bg-slate-900/80 backdrop-blur-xl border-l-4 ${style.border} rounded-2xl shadow-2xl pointer-events-auto flex ring-1 ring-white/10 ${style.shadow}`}>
        <div className="flex-1 w-0 p-4">
          <div className="flex items-center">
            <div className={`flex-shrink-0 p-2 ${style.bg} rounded-xl`}>{style.icon}</div>
            <div className="ml-4 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Notification</p>
              <p className={`text-sm font-bold ${style.text} leading-tight`}>{message}</p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-white/5">
          <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    ), { duration: 4000 });
  };

  // --- DATA FETCHING ---
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('employees').select('*').order('name');
    if (!error) setEmployees(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const fetchExistingLoans = async (empId) => {
    const { data, error } = await supabase.from('loan_schedules').select('*').eq('employee_id', empId).order('cutoff_date', { ascending: true });
    if (!error) setExistingLoans(data);
  };

  const getAutoStatus = (cutoffDate) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const targetDate = new Date(cutoffDate); targetDate.setHours(0,0,0,0);
    return targetDate <= today ? 'paid' : 'pending';
  };

  // --- UPDATED LOGIC: fetchAttendanceDeductions with Schema-based bypass ---
  const fetchAttendanceDeductions = async (employeeId, basicSalary, isTimeExempted) => {
    const salary = parseFloat(basicSalary) || 0;
    const dailyRate = salary / 30; 
    const hourlyRate = dailyRate / 8;

    // KUNG TRUE ANG is_time_exempted (Fixed Rate)
    if (isTimeExempted) {
      setAttendanceLogs([]);
      setAttendanceMetrics({
        monthlySalary: salary.toLocaleString(),
        dailyRate: dailyRate.toFixed(2),
        hourlyRate: hourlyRate.toFixed(2),
        totalLateHours: "0.00",
        totalUndertimeHours: "0.00",
        lateDeduction: "0.00",
        undertimeDeduction: "0.00",
        totalDeduction: "0.00", // Walang bawas
        isFixedRate: true
      });
      return;
    }

    // KUNG HINDI EXEMPTED (Normal logic)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const { data, error } = await supabase.from('attendance_logs').select('*').eq('Employee_ID', employeeId).gte('Date', firstDay).lte('Date', lastDay).order('Date', { ascending: true });
    
    if (!error && data) {
      setAttendanceLogs(data);
      const lateTotalHrs = data.reduce((sum, log) => sum + (parseFloat(log.Late_hrs) || 0), 0);
      const utTotalHrs = data.reduce((sum, log) => sum + (parseFloat(log.Undertime_hrs) || 0), 0);
      setAttendanceMetrics({
        monthlySalary: salary.toLocaleString(), 
        dailyRate: dailyRate.toFixed(2), 
        hourlyRate: hourlyRate.toFixed(2),
        totalLateHours: lateTotalHrs.toFixed(2), 
        totalUndertimeHours: utTotalHrs.toFixed(2),
        lateDeduction: (lateTotalHrs * hourlyRate).toFixed(2), 
        undertimeDeduction: (utTotalHrs * hourlyRate).toFixed(2),
        totalDeduction: ((lateTotalHrs + utTotalHrs) * hourlyRate).toFixed(2),
        isFixedRate: false
      });
    }
  };

  // --- ACTIONS ---
  const handleManageClick = async (emp) => {
    setSelectedEmp(emp);
    const adj = emp.current_adjustments || {};
    
    const { data: dbAdds } = await supabase
        .from('payroll_additions')
        .select('*')
        .eq('employee_id', emp.employee_id)
        .or('status.eq.pending,status.eq.Approved');

    setAdditionList(dbAdds || []);
    setFormData({
      sss: emp.sss_fixed_amount || 0, philhealth: emp.phic_fixed_amount || 0, pagibig: emp.hdmf_fixed_amount || 0,
      sssEnabled: emp.sss_enabled ?? false, phicEnabled: emp.phic_enabled ?? false, hdmfEnabled: emp.hdmf_enabled ?? false,
      totalCA: '', installmentAmount: '', 
      food: adj.food || '', transpo: adj.transpo || '', restday: adj.restday || '', others: adj.others || ''
    });
    
    // UPDATED: Gamitin ang is_time_exempted column mula sa schema
    fetchAttendanceDeductions(emp.employee_id, emp.basic_salary, emp.is_time_exempted); 
    
    fetchExistingLoans(emp.employee_id);
    setIsModalOpen(true);
    setModalMode('deduction'); 
    setActiveTab('mandatory');
  };

  const getInstallmentList = () => {
    const total = parseFloat(formData.totalCA);
    const installment = parseFloat(formData.installmentAmount);
    if (!total || !installment || installment <= 0) return [];
    let list = []; let remaining = total; let currentDate = new Date();
    while (remaining > 0) {
      if (currentDate.getDate() <= 15) currentDate.setDate(30);
      else { currentDate.setMonth(currentDate.getMonth() + 1); currentDate.setDate(15); }
      const deduction = remaining < installment ? remaining : installment;
      remaining -= deduction;
      const cutoffStr = currentDate.toISOString().split('T')[0];
      list.push({ cutoffDate: cutoffStr, deduction: deduction.toFixed(2), balance: Math.max(0, remaining).toFixed(2), status: getAutoStatus(cutoffStr) });
      if (list.length > 24) break; 
    }
    return list;
  };

  const handleAddEntry = () => {
    let finalAmount = parseFloat(newEntry.amount);
    if (newEntry.type === 'Overtime') {
        const hours = parseFloat(newEntry.otHours) || 0;
        const rate = parseFloat(attendanceMetrics.hourlyRate) || 0;
        finalAmount = hours * rate;
        if (hours <= 0) return showPremiumToast('Please enter valid OT hours', 'error');
    }
    if (!finalAmount || finalAmount <= 0) return showPremiumToast('Please enter a valid amount', 'error');

    const updatedList = [...additionList, { 
        ...newEntry, 
        amount: finalAmount.toFixed(2),
        id: Date.now(),
        isNew: true,
        status: 'Approved' 
    }];
    setAdditionList(updatedList);
    setNewEntry({ ...newEntry, amount: '', otHours: '', remarks: '', status: 'Approved' });
  };

  const handleRemoveEntry = async (item) => {
    try {
      if (!item.isNew && item.id) {
        const toastId = showPremiumToast('Deleting record...', 'loading');
        const { error } = await supabase.from('payroll_additions').delete().eq('id', item.id);
        toast.dismiss(toastId);
        if (error) throw error;
      }
      setAdditionList(prevList => prevList.filter(entry => entry.id !== item.id));
    } catch (err) {
      showPremiumToast('Error: ' + err.message, 'error');
    }
  };

  const handleFinalSave = async () => {
    setIsConfirmModalOpen(false);
    setIsSaving(true);
    const toastId = showPremiumToast('Processing payroll adjustments...', 'loading');
    try {
      // 1. Update Employee General Settings
      const { error: empError } = await supabase.from('employees').update({ 
        sss_fixed_amount: parseFloat(formData.sss), phic_fixed_amount: parseFloat(formData.philhealth), hdmf_fixed_amount: parseFloat(formData.pagibig),
        sss_enabled: formData.sssEnabled, phic_enabled: formData.phicEnabled, hdmf_enabled: formData.hdmfEnabled,
        current_adjustments: { 
          ...selectedEmp.current_adjustments, 
          attendance_deductions: attendanceMetrics,
          food: formData.food, transpo: formData.transpo, restday: formData.restday, others: formData.others,
          date_applied: new Date().toISOString() 
        }
      }).eq('id', selectedEmp.id);
      if (empError) throw empError;

      // 2. Handle Loans
      const installmentList = getInstallmentList();
      if (installmentList.length > 0) {
        await supabase.from('loan_schedules').delete().eq('employee_id', selectedEmp.employee_id);
        const scheduleToInsert = installmentList.map(item => ({
          employee_id: selectedEmp.employee_id, deduction_type: 'cashAdvance', cutoff_date: item.cutoffDate, 
          deduction_amount: parseFloat(item.deduction), remaining_balance: parseFloat(item.balance), status: item.status
        }));
        await supabase.from('loan_schedules').insert(scheduleToInsert);
      }

      // 3. Handle Additions
      const newItems = additionList.filter(item => item.isNew);
      if (newItems.length > 0) {
        const payload = newItems.map(item => ({
          employee_id: selectedEmp.employee_id,
          type: item.type,
          amount: parseFloat(item.amount),
          ot_hours: parseFloat(item.otHours) || 0,
          remarks: item.remarks,
          is_recurring: item.type === 'Allowance',
          applied_date: item.type === 'Allowance' ? null : item.date,
          status: 'Approved' 
        }));
        const { error: addError } = await supabase.from('payroll_additions').insert(payload);
        if (addError) throw addError;
      }
      
      toast.dismiss(toastId);
      showPremiumToast('All changes saved successfully!');
      setIsModalOpen(false); 
      fetchEmployees();
    } catch (err) {
      toast.dismiss(toastId);
      showPremiumToast(`Error: ${err.message}`, 'error');
    } finally { setIsSaving(false); }
  };

return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen bg-slate-50 dark:bg-slate-950">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Adjustments</h1>
          <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Payroll Management System</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" placeholder="Search employee..." 
              className="w-full bg-white dark:bg-slate-800 border-none rounded-xl py-3 pl-11 pr-4 text-xs font-bold outline-none shadow-sm text-slate-800 dark:text-white ring-1 ring-slate-100 dark:ring-white/5"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => { fetchEmployees(); toast.success('Data refreshed'); }} className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:text-blue-600 transition-all active:scale-95">
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b dark:border-slate-800 text-[10px] uppercase text-slate-400 font-black tracking-widest">
            <tr>
              <th className="px-8 py-6">Employee</th>
              <th className="px-8 py-6">Type & Status</th>
              <th className="px-8 py-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800">
            {currentItems.length > 0 ? (
              currentItems.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-8 py-5 text-sm font-bold">
                    {emp.name}
                    <div className="text-[10px] font-mono text-blue-500 font-black">{emp.employee_id}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 text-[9px] font-black uppercase tracking-tighter">
                        Active
                      </span>
                      {/* FIX: Dynamic Badge logic */}
                      {emp.exempted ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                          <ShieldCheckIcon className="w-3 h-3" /> Fixed Rate / Exempted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-tighter">
                          Regular Rate
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => handleManageClick(emp)} className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95">Manage</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="px-8 py-10 text-center text-slate-400 font-bold italic">No employees found.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* --- PAGINATION UI --- */}
        <div className="px-8 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t dark:border-slate-800 flex items-center justify-between">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredEmployees.length)} of {filteredEmployees.length}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm disabled:opacity-30 transition-all hover:text-blue-600"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-100'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm disabled:opacity-30 transition-all hover:text-blue-600"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL SECTION --- */}
      {isModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            
            {/* MODAL HEADER */}
            <div className="p-8 flex justify-between items-center border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black uppercase tracking-tight">{selectedEmp.name}</h2>
                <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-[0.2em] ${modalMode === 'deduction' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        Current View: {modalMode}s
                    </span>
                    {selectedEmp.exempted && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-[0.2em] bg-amber-500 text-white border-none shadow-sm flex items-center gap-1">
                        <ShieldCheckIcon className="w-2 h-2" /> Fixed Rate
                      </span>
                    )}
                </div>
              </div>

              <div className="hidden md:flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl border dark:border-slate-700">
                <button 
                  onClick={() => { setModalMode('deduction'); setActiveTab('mandatory'); }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 ${modalMode === 'deduction' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <MinusCircleIcon className="w-4 h-4" /> Deductions
                </button>
                <button 
                  onClick={() => { setModalMode('addition'); setActiveTab('additions'); }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 ${modalMode === 'addition' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <PlusCircleIcon className="w-4 h-4" /> Additions
                </button>
              </div>

              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            {/* MODAL NAVIGATION TABS */}
            <div className="flex bg-gray-50 dark:bg-slate-800/50 p-2 border-b dark:border-slate-800">
              {modalMode === 'deduction' ? (
                  <>
                    <TabBtn active={activeTab === 'mandatory'} label="Mandatory" icon={<ShieldCheckIcon className="w-4 h-4"/>} onClick={() => setActiveTab('mandatory')} />
                    <TabBtn active={activeTab === 'voluntary'} label="Voluntary / Loans" icon={<BanknotesIcon className="w-4 h-4"/>} onClick={() => setActiveTab('voluntary')} />
                    <TabBtn active={activeTab === 'attendance'} label="Attendance" icon={<ClockIcon className="w-4 h-4"/>} onClick={() => setActiveTab('attendance')} />
                  </>
              ) : (
                  <>
                    <TabBtn active={activeTab === 'additions'} label="Earnings & Allowances" icon={<PlusCircleIcon className="w-4 h-4 text-emerald-500"/>} onClick={() => setActiveTab('additions')} />
                  </>
              )}
            </div>

            {/* MODAL CONTENT */}
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                {modalMode === 'deduction' && (
                  <>
                    {activeTab === 'mandatory' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <MandatoryCard label="SSS" val={formData.sss} enabled={formData.sssEnabled} setVal={(v)=>setFormData({...formData, sss: v})} setEnable={(e)=>setFormData({...formData, sssEnabled: e})} color="blue" rules={["Monthly Salary Credit (MSC) = ₱4,000 to ₱30,000","Total Rate = 15%","Employee Share = 4.5%"]}/>
                        <MandatoryCard label="PhilHealth" val={formData.philhealth} enabled={formData.phicEnabled} setVal={(v)=>setFormData({...formData, philhealth: v})} setEnable={(e)=>setFormData({...formData, phicEnabled: e})} color="emerald" rules={["Premium Rate = 5%","Split 50/50 Employee/Employer","Min Salary ₱10k / Max ₱100k"]}/>
                        <MandatoryCard label="Pag-IBIG" val={formData.pagibig} enabled={formData.hdmfEnabled} setVal={(v)=>setFormData({...formData, pagibig: v})} setEnable={(e)=>setFormData({...formData, hdmfEnabled: e})} color="orange" rules={["Salary Base Ceiling = ₱5,000","Employee Share = 1-2%","Employer Share = 2% fixed"]}/>
                      </div>
                    )}

                    {activeTab === 'voluntary' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border dark:border-slate-800">
                          <Input label="Total Cash Advance" value={formData.totalCA} onChange={(v) => setFormData({...formData, totalCA: v})} />
                          <Input label="Deduction per Cutoff" value={formData.installmentAmount} onChange={(v) => setFormData({...formData, installmentAmount: v})} />
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                            <InformationCircleIcon className="w-5 h-5 text-amber-600" />
                            <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tighter">Status is automatically set to "Paid" based on cutoff date.</p>
                        </div>
                        <div className="border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold uppercase text-[9px]">
                              <tr>
                                <th className="px-4 py-3 text-left">Cutoff Date</th>
                                <th className="px-4 py-3 text-left">Amount</th>
                                <th className="px-4 py-3 text-left">Balance</th>
                                <th className="px-4 py-3 text-center">Auto-Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-800">
                              {(getInstallmentList().length > 0 ? getInstallmentList() : existingLoans).map((row, idx) => {
                                const isPaid = getAutoStatus(row.cutoffDate || row.cutoff_date) === 'paid';
                                return (
                                  <tr key={idx} className={`${isPaid ? 'bg-emerald-50/40' : 'hover:bg-blue-50/30'}`}>
                                    <td className="px-4 py-3 font-bold">{row.cutoffDate || row.cutoff_date}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-red-500">₱{row.deduction || row.deduction_amount}</td>
                                    <td className="px-4 py-3 font-mono text-slate-400">₱{row.balance || row.remaining_balance}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-[8px] px-2 py-1 rounded-full font-black ${isPaid ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                                            {isPaid ? 'PAID' : 'PENDING'}
                                        </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeTab === 'attendance' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        {/* FIX: Fixed Rate Warning Alert */}
                        {attendanceMetrics.isFixedRate && (
                          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-5 rounded-[1.5rem] flex items-center gap-4 animate-bounce-short">
                            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20"><ShieldCheckIcon className="w-6 h-6 text-white"/></div>
                            <div>
                              <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Fixed Rate Mode Active</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">This employee is exempted. Late and Undertime deductions are set to ₱0.00.</p>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <RateCard label="Monthly Salary" value={`₱${attendanceMetrics.monthlySalary}`} color="blue" />
                            <RateCard label="Daily Rate" value={`₱${attendanceMetrics.dailyRate}`} color="indigo" />
                            <RateCard label="Hourly Rate" value={`₱${attendanceMetrics.hourlyRate}`} color="emerald" />
                        </div>
                        <div className="border dark:border-slate-800 rounded-[1.5rem] overflow-hidden bg-white dark:bg-slate-900 shadow-inner">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-black uppercase text-[9px]">
                              <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-center">Late (Hrs)</th>
                                <th className="px-6 py-4 text-center">UT (Hrs)</th>
                                <th className="px-6 py-4 text-right">Deduction</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-800">
                              {attendanceLogs.length > 0 ? (
                                attendanceLogs.map((log, idx) => {
                                  // FIX: Calculation logic for display
                                  const effectiveHourlyRate = attendanceMetrics.isFixedRate ? 0 : (attendanceMetrics.hourlyRate || 0);
                                  const rowDeduc = (parseFloat(log.Late_hrs || 0) + parseFloat(log.Undertime_hrs || 0)) * effectiveHourlyRate;
                                  
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                      <td className="px-6 py-4 font-bold">{new Date(log.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                      <td className="px-6 py-4 text-center text-red-500 font-black">{log.Late_hrs > 0 ? `${log.Late_hrs}h` : '-'}</td>
                                      <td className="px-6 py-4 text-center text-orange-500 font-black">{log.Undertime_hrs > 0 ? `${log.Undertime_hrs}h` : '-'}</td>
                                      <td className="px-6 py-4 text-right font-mono font-black">
                                        ₱{rowDeduc.toFixed(2)}
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr><td colSpan="4" className="px-6 py-12 text-center text-[11px] font-bold text-slate-400 italic">No attendance records found.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex justify-between items-center shadow-2xl overflow-hidden relative group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><CalculatorIcon className="w-20 h-20" /></div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Month Deduction</p>
                            <p className="text-[9px] mt-1 opacity-40">Lates: {attendanceMetrics.totalLateHours}h | UT: {attendanceMetrics.totalUndertimeHours}h</p>
                          </div>
                          <div className="text-right z-10">
                            <span className={`text-3xl font-mono font-black ${attendanceMetrics.isFixedRate ? 'text-emerald-400' : 'text-red-400'}`}>
                              ₱{attendanceMetrics.isFixedRate ? "0.00" : attendanceMetrics.totalDeduction}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {modalMode === 'addition' && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-3 mb-2">
                      <PlusCircleIcon className="w-6 h-6 text-emerald-500" />
                      <h3 className="text-sm font-black uppercase tracking-widest">Incentives & Allowances</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-8 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-500/20 items-end">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Adjustment Type</label>
                        <select 
                          value={newEntry.type}
                          onChange={(e) => setNewEntry({...newEntry, type: e.target.value, otHours: '', amount: ''})}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          <option>Allowance</option>
                          <option>Restday</option>
                          <option>Overtime</option>
                        </select>
                      </div>
                      
                      {newEntry.type === 'Overtime' ? (
                          <Input label="OT Hours" value={newEntry.otHours} onChange={(v) => setNewEntry({...newEntry, otHours: v})} />
                      ) : (
                          <Input label="Amount" value={newEntry.amount} onChange={(v) => setNewEntry({...newEntry, amount: v})} />
                      )}

                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Remarks</label>
                          <input 
                            type="text" 
                            placeholder="Reason or note"
                            value={newEntry.remarks}
                            onChange={(e) => setNewEntry({...newEntry, remarks: e.target.value})}
                            className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                      </div>
                      <button 
                        onClick={handleAddEntry}
                        className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                      >
                        Add Entry
                      </button>
                    </div>

                    <div className="flex items-center gap-2 px-2">
                      <InformationCircleIcon className="w-4 h-4 text-slate-400" />
                      <p className="text-[10px] font-black uppercase text-slate-400">Adjustment History & Queue</p>
                    </div>

                    <div className="border dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                      <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-black uppercase text-[9px]">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Remarks</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-800">
                          {additionList.length > 0 ? (
                            additionList.map((item) => (
                                <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${item.isNew ? 'bg-emerald-50/20' : ''}`}>
                                    <td className="px-6 py-4">
                                      <div className="font-bold text-slate-600 dark:text-slate-300">{selectedEmp.name}</div>
                                      <div className="text-[8px] text-slate-400 font-mono tracking-tighter">{item.date || item.applied_date}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                          <span className="flex items-center gap-1 text-emerald-500 font-black text-[9px] uppercase tracking-widest">
                                            <CheckCircleIcon className="w-3 h-3" /> Approved
                                          </span>
                                          {item.isNew && <span className="text-[7px] text-emerald-600/50 font-black uppercase italic tracking-tighter">(New Entry)</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-slate-700 dark:text-slate-200">
                                          ₱{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        {item.type === 'Allowance' && (
                                          <span className="text-[8px] font-black text-indigo-500 uppercase">Recurring</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 italic">
                                        {item.ot_hours ? `(OT: ${item.ot_hours} hrs) ` : ''}
                                        {item.remarks || '---'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                          onClick={() => handleRemoveEntry(item)} 
                                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                          ) : (
                              <tr>
                                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold italic">
                                      No additions found for this employee.
                                  </td>
                              </tr>
                          )}
                          </tbody>
                      </table>
                    </div>
                    
                    <div className="bg-emerald-600 p-8 rounded-[2rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform">
                        <BanknotesIcon className="w-32 h-32" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Net Total Additions</p>
                        <p className="text-xs opacity-70 mt-1 italic font-medium tracking-tight">Combined earnings and manual adjustments</p>
                      </div>
                      <div className="text-right z-10">
                        <span className="text-3xl font-mono font-black">
                          ₱{additionList.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* MODAL FOOTER ACTION */}
            <div className="p-8 bg-gray-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
              <button 
                onClick={() => setIsConfirmModalOpen(true)} 
                disabled={isSaving} 
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-xl transition-all active:scale-95 
                  ${modalMode === 'deduction' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'}`}
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" /> Processing...
                  </span>
                ) : (
                  `Review & Apply All ${modalMode === 'deduction' ? 'Deductions' : 'Earnings'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION DIALOG --- */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-sm:max-w-xs max-w-sm rounded-[2.5rem] p-8 shadow-2xl border dark:border-slate-800 animate-in zoom-in duration-300">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight">Confirm Save?</h3>
              <p className="text-[11px] text-slate-500 mt-2 font-medium px-4 leading-relaxed italic">
                All changes for {selectedEmp?.name} will be saved and applied to the current payroll period.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={() => setIsConfirmModalOpen(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-200">Cancel</button>
              <button onClick={handleFinalSave} className="py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components (RateCard, MandatoryCard, TabBtn, Input, Toggle)
function RateCard({ label, value, color }) {
    const colors = { blue: 'bg-blue-50 text-blue-600 border-blue-100', indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100', emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    return (
        <div className={`${colors[color]} p-4 rounded-2xl border dark:bg-slate-800/40 dark:border-slate-800`}>
            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest mb-1">{label}</p>
            <p className="text-lg font-mono font-black">{value}</p>
        </div>
    );
}

function MandatoryCard({ label, val, enabled, setVal, setEnable, color, rules }) {
  const colorMap = { blue: 'bg-blue-600 shadow-blue-500/30', emerald: 'bg-emerald-500 shadow-emerald-500/30', orange: 'bg-orange-500 shadow-orange-500/30' };
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3"><div className={`w-1.5 h-4 ${colorMap[color]} rounded-full shadow-lg`}></div><h3 className="text-[11px] font-black uppercase">{label} Computation:</h3></div>
        <ul className="space-y-1 ml-4">
            {rules.map((r, i) => (<li key={i} className="text-[10px] text-slate-500 font-medium list-disc opacity-80">{r}</li>))}
        </ul>
        <div className="mt-4 flex items-center gap-2 text-[9px] text-slate-400 bg-white dark:bg-slate-900 w-fit px-3 py-1 rounded-full border dark:border-slate-800">
          <InformationCircleIcon className="w-3 h-3" /> Note: Policy rules apply by default.
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm flex flex-col justify-center">
        <Input label="Fixed Amount" value={val} onChange={setVal} disabled={!enabled} />
        <div className="flex justify-between items-center mt-4">
          <span className="text-[9px] font-black text-slate-400 uppercase">Status</span>
          <Toggle active={enabled} onClick={() => setEnable(!enabled)} />
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, label, icon, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${active ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon} {label}
    </button>
  );
}

function Input({ label, value, onChange, disabled }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-tighter">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-mono font-bold outline-none ring-1 ring-slate-100 dark:ring-slate-800 text-slate-800 dark:text-white transition-all focus:ring-blue-500/50 ${disabled ? 'opacity-30' : ''}`} />
    </div>
  );
}

function Toggle({ active, onClick }) {
  return (
    <button onClick={onClick} className={`w-10 h-5 rounded-full transition-all duration-300 relative ${active ? 'bg-blue-600 shadow-lg shadow-blue-500/40' : 'bg-slate-300'}`}>
      <div className={`absolute top-1 bg-white w-3 h-3 rounded-full transition-all duration-300 ${active ? 'right-1 scale-110' : 'left-1'}`} />
    </button>
  );
}