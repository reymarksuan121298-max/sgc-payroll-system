import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MagnifyingGlassIcon, PencilSquareIcon, QrCodeIcon, XMarkIcon, TrashIcon,
  DevicePhoneMobileIcon, CheckCircleIcon, MinusCircleIcon, ArrowPathIcon, CalendarDaysIcon,
  ExclamationTriangleIcon, QuestionMarkCircleIcon, ArrowPathRoundedSquareIcon,
  LockClosedIcon, LockOpenIcon, ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Html5QrcodeScanner } from "html5-qrcode";

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isEditLocked, setIsEditLocked] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [saveConfirm, setSaveConfirm] = useState({ isOpen: false, type: 'register' });
  
  const scannerRef = useRef(null);
  const barcodeInputRef = useRef(null);

  const [formData, setFormData] = useState({
    employee_id: '', name: '', designation: '', area: '', basic_salary: 0, day_off: '', is_time_exempted: false
  });

  const EmptyPlaceholder = () => (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800/40">
      <div className="w-2 h-[2px] bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
    </div>
  );

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (!error) setEmployees(data || []);
    } catch (err) { 
        console.error(err); 
    } finally { 
        setTimeout(() => setLoading(false), 800); 
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } 
      });
      scannerRef.current = scanner;
      scanner.render((text) => {
        handleBarcodeInputChange({ target: { value: text } });
        setIsScanning(false);
      }, () => {});
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Scanner clear error:", err));
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  const toggleExemption = async (id, currentStatus) => {
    const { error } = await supabase.from('employees').update({ is_time_exempted: !currentStatus }).eq('id', id);
    if (!error) {
      setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, is_time_exempted: !currentStatus } : emp));
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (!error) {
      setDeleteConfirm({ isOpen: false, id: null, name: '' });
      fetchEmployees();
    }
  };

  const handlePreSubmit = (e) => {
    if (e) e.preventDefault();
    if (!formData.employee_id || !formData.name || !formData.area) {
      alert("Employee ID, Name, and Area are required.");
      return;
    }
    setSaveConfirm({ isOpen: true, type: editingId ? 'update' : 'register' });
  };

  const executeSubmit = async () => {
    try {
      const payload = {
        employee_id: formData.employee_id,
        name: formData.name,
        designation: formData.designation || '',
        area: formData.area,
        basic_salary: parseFloat(formData.basic_salary) || 0,
        day_off: formData.day_off || '',
        is_time_exempted: formData.is_time_exempted
      };

      let result;
      if (editingId) {
        result = await supabase.from('employees').update(payload).eq('id', editingId);
      } else {
        result = await supabase.from('employees').insert([payload]);
      }

      if (result.error) throw result.error;

      setSaveConfirm({ isOpen: false, type: 'register' });
      handleCloseModal(); 
      fetchEmployees();
    } catch (err) {
      alert("Error saving: " + err.message);
    }
  };

  const handleBarcodeInputChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, employee_id: value }));
    try {
      const qrData = JSON.parse(value);
      setFormData(prev => ({
        ...prev,
        employee_id: qrData.id || qrData.ID || prev.employee_id,
        name: (qrData.name || qrData.NAME || prev.name).toUpperCase(),
        area: (qrData.area || qrData.AREA || prev.area).toUpperCase()
      }));
    } catch (err) {
      console.log(err)
        return;
    }
  };

  const handleOpenEdit = (emp) => {
    setEditingId(emp.id);
    setFormData({ ...emp });
    setIsEditLocked(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsScanning(false);
    setEditingId(null);
    setIsEditLocked(true);
    setFormData({ employee_id: '', name: '', designation: '', area: '', basic_salary: 0, day_off: '', is_time_exempted: false });
  };

  const filtered = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filtered.slice(indexOfFirstRow, indexOfLastRow);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  return (
    <div className="p-2 md:p-6 max-w-[1400px] mx-auto font-sans dark:bg-slate-950 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 px-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">Employees</h1>
          <p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-widest">Database Control</p>
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 pl-4 pr-3 py-2 text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-[11px] font-black shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest"
          >
            + NEW
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-50 dark:border-slate-800 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50/50 dark:bg-slate-800/20">
                <th className="px-6 py-5">Employee Details</th>
                <th className="px-6 py-5">Area / Designation</th>
                <th className="px-6 py-5">Day Off</th>
                <th className="px-6 py-5 text-center">Exempted</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800 relative">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <ArrowPathRoundedSquareIcon className="w-10 h-10 text-blue-500 animate-spin drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Syncing Masterlist...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentRows.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200">{emp.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono tracking-tighter">{emp.employee_id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase whitespace-nowrap">
                        {emp.area || <EmptyPlaceholder />}
                        <span className="text-slate-300">•</span>
                        {emp.designation || <EmptyPlaceholder />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {emp.day_off ? (
                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 shadow-[0_0_10px_rgba(37,99,235,0.1)]">
                          {emp.day_off}
                        </span>
                      ) : <EmptyPlaceholder />}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleExemption(emp.id, emp.is_time_exempted)} className="mx-auto block active:scale-75 transition-transform duration-200">
                        {emp.is_time_exempted 
                          ? <CheckCircleIcon className="w-7 h-7 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> 
                          : <MinusCircleIcon className="w-7 h-7 text-slate-200 dark:text-slate-700" />
                        }
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(emp)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all hover:shadow-[0_0_10px_rgba(37,99,235,0.2)]"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirm({ isOpen: true, id: emp.id, name: emp.name })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all hover:shadow-[0_0_10px_rgba(239,68,68,0.2)]"><TrashIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/10 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                <span className="px-3 py-1 bg-blue-600 text-white text-[11px] font-black rounded-md shadow-[0_0_10px_rgba(37,99,235,0.4)]">{currentPage}</span>
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-[11px] font-bold text-slate-500">{totalPages}</span>
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DELETE MODAL */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
           <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <ExclamationTriangleIcon className="w-10 h-10 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">Confirm Delete</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-8 uppercase tracking-widest font-bold">{deleteConfirm.name}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleDelete(deleteConfirm.id)} className="w-full py-4 bg-red-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] transition-all">Delete Record</button>
              <button onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE/UPDATE MODAL */}
      {saveConfirm.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
           <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
              <QuestionMarkCircleIcon className="w-10 h-10 text-blue-500 drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">{saveConfirm.type === 'update' ? 'Update Details?' : 'Finalize Entry?'}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-8 uppercase tracking-widest font-bold">Pushing changes to database</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeSubmit} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] transition-all">Submit Now</button>
              <button onClick={() => setSaveConfirm({ isOpen: false, type: 'register' })} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95">Wait, Go Back</button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[380px] rounded-3xl p-6 shadow-2xl relative border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-300">
            <button onClick={handleCloseModal} className="absolute right-5 top-5 text-red-500 hover:rotate-90 transition-transform"><XMarkIcon className="w-6 h-6" /></button>
            <h3 className="text-center font-black text-slate-800 dark:text-white mb-6 uppercase text-xs tracking-[0.4em]">{editingId ? 'Member Profile' : 'New Member'}</h3>
            
            <form onSubmit={handlePreSubmit} className="space-y-4">
              <div className="flex justify-center items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-inner">
                <div className="text-center"><QrCodeIcon className="w-6 h-6 mx-auto text-slate-300" /><p className="text-[7px] font-black text-slate-400 uppercase mt-1">Gun</p></div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                <button type="button" onClick={() => setIsScanning(!isScanning)} className={`flex flex-col items-center transition-all ${isScanning ? 'text-blue-600 drop-shadow-[0_0_5px_rgba(37,99,235,0.5)]' : 'text-slate-400'}`}>
                  <DevicePhoneMobileIcon className="w-7 h-7 transition-transform active:scale-90" /><span className="text-[7px] font-black uppercase mt-1">Camera</span>
                </button>
              </div>

              {isScanning && <div id="reader" className="w-full rounded-2xl overflow-hidden border-4 border-blue-500 mb-4 shadow-[0_0_20px_rgba(37,99,235,0.3)]"></div>}

              <div className="space-y-3">
                <input ref={barcodeInputRef} autoFocus placeholder="SCAN OR TYPE ID" value={formData.employee_id} onChange={handleBarcodeInputChange} className="w-full p-4 text-center text-[13px] bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border-2 border-transparent focus:border-blue-500 focus:shadow-[0_0_15px_rgba(37,99,235,0.1)] font-mono font-black tracking-widest transition-all" />
                <input readOnly placeholder="NAME (AUTO)" value={formData.name} className="w-full p-3.5 text-[11px] bg-slate-100/50 dark:bg-slate-800 rounded-xl italic text-slate-500 outline-none uppercase font-bold tracking-tight" />
                <input readOnly placeholder="AREA (AUTO)" value={formData.area} className="w-full p-3.5 text-[11px] bg-slate-100/50 dark:bg-slate-800 rounded-xl italic text-slate-500 outline-none uppercase font-bold tracking-tight" />
                
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      {isEditLocked ? <LockClosedIcon className="w-3 h-3"/> : <LockOpenIcon className="w-3 h-3 text-blue-500 drop-shadow-[0_0_3px_rgba(37,99,235,0.5)]"/>}
                      Optional Info
                    </p>
                    <button type="button" onClick={() => setIsEditLocked(!isEditLocked)} className={`text-[8px] px-2 py-1 rounded-md font-black transition-all uppercase tracking-tighter ${isEditLocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]'}`}>
                      {isEditLocked ? 'Unlock Fields' : 'Fields Open'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input disabled={isEditLocked} placeholder="Designation" value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value.toUpperCase()})} className={`w-full p-3.5 text-[11px] border rounded-xl outline-none transition-all uppercase ${isEditLocked ? 'bg-slate-50/50 border-slate-100 text-slate-300 italic' : 'bg-white border-blue-100 font-bold focus:shadow-[0_0_10px_rgba(37,99,235,0.1)]'}`} />
                    <input disabled={isEditLocked} type="number" placeholder="Salary" value={formData.basic_salary || ''} onChange={(e) => setFormData({...formData, basic_salary: e.target.value})} className={`w-full p-3.5 text-[11px] border rounded-xl outline-none transition-all ${isEditLocked ? 'bg-slate-50/50 border-slate-100 text-slate-300 italic' : 'bg-white border-blue-100 font-bold focus:shadow-[0_0_10px_rgba(37,99,235,0.1)]'}`} />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100/50">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Off Schedule</p>
                  <button type="button" onClick={() => setFormData({...formData, day_off: ''})} className="text-[9px] font-black text-red-500 hover:scale-105 transition-transform hover:drop-shadow-[0_0_5px_rgba(239,68,68,0.3)]">RESET</button>
                </div>
                <div className="flex justify-between gap-1">
                  {DAYS.map((day) => (
                    <button 
                      key={day} 
                      type="button" 
                      onClick={() => setFormData({ ...formData, day_off: day })} 
                      className={`text-[9px] flex-1 py-2 rounded-lg font-black transition-all ${
                        formData.day_off === day 
                        ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)] scale-105' 
                        : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full py-5 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] hover:bg-blue-700 active:scale-95 transition-all mt-2"
              >
                {editingId ? 'Save Changes' : 'Register Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}