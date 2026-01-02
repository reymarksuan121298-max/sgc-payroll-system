import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  UserGroupIcon, 
  ClipboardDocumentIcon, 
  AdjustmentsHorizontalIcon, 
  ChartBarIcon,
  ChevronRightIcon,
  MapIcon // <--- Idinagdag para sa Map Update
} from '@heroicons/react/24/outline';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // --- MENU ITEMS WITH THE NEW MAP LINK ---
  const menuItems = [
    { 
      id: 'dashboard', 
      path: '/app/dashboard', 
      label: 'Attendance Logs', 
      icon: <ClipboardDocumentIcon className="w-5 h-5" /> 
    },
    { 
      id: 'agent-map', 
      path: '/app/agent-map', 
      label: 'Agent Attendance Map', 
      icon: <MapIcon className="w-5 h-5" /> 
    },
    { 
      id: 'employees', 
      path: '/app/employees', 
      label: 'Employee Dashboard', 
      icon: <UserGroupIcon className="w-5 h-5" /> 
    },
  ];

  const handleNavigation = (path) => {
    if (!path) return;
    navigate(path);
    if (window.innerWidth < 1024) toggleSidebar();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={toggleSidebar} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-[#F2F2F7] dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transform transition-all duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        flex flex-col font-sans
      `}>
        <div className="p-6 pt-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-black dark:text-white">Payroll System</h1>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">
            Simpal Group of Companies
          </p>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
          {menuItems.map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleNavigation(item.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                location.pathname === item.path 
                ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-blue-400' 
                : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className={`${location.pathname === item.path ? 'scale-110' : 'scale-100'} transition-transform`}>
                {item.icon}
              </div>
              <span className="text-[15px] font-bold">{item.label}</span>
            </div>
          ))}

          <div className="pt-6 pb-2 px-4">
            <p className="text-[10px] font-black text-gray-400 dark:text-slate-600 uppercase tracking-[0.15em]">Management</p>
          </div>

          {/* ADJUSTMENTS DROPDOWN */}
          <IOSDropdown 
            label="Adjustments" 
            icon={<AdjustmentsHorizontalIcon className="w-5 h-5" />} 
            isOpen={openDropdown === 'adj'} 
            onClick={() => setOpenDropdown(openDropdown === 'adj' ? null : 'adj')}
          >
            <SubItem 
              label="Addition & Deductions" 
              active={location.pathname === '/app/addition-deduction'}
              onClick={() => handleNavigation('/app/addition-deduction')}
            />
            <SubItem 
              label="Calendar (Day Offs)" 
              active={location.pathname === '/app/calendar-dayoff'}
              onClick={() => handleNavigation('/app/calendar-dayoff')}
            />
            <SubItem label="Request Management" />
          </IOSDropdown>

          {/* REPORTS DROPDOWN */}
          <IOSDropdown 
            label="Reports" 
            icon={<ChartBarIcon className="w-5 h-5" />} 
            isOpen={openDropdown === 'rep'} 
            onClick={() => setOpenDropdown(openDropdown === 'rep' ? null : 'rep')}
          >
            <SubItem 
              label="Payroll Report" 
              active={location.pathname === '/app/payroll-report'}
              onClick={() => handleNavigation('/app/payroll-report')}
            />
            <SubItem 
              label="Time In/Out Report" 
              active={location.pathname === '/app/attendance-report'}
              onClick={() => handleNavigation('/app/attendance-report')}
            />
            <SubItem label="Payslip Summary" />
            <SubItem label="13 Month Pay " />
          </IOSDropdown>
        </nav>
        
        <div className="p-6 border-t border-gray-200/50 dark:border-slate-800">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl flex items-center gap-3 transition-colors">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">A</div>
              <div>
                <p className="text-[12px] font-bold text-gray-900 dark:text-slate-200">Admin User</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium italic">Authorized Access</p>
              </div>
           </div>
        </div>
      </aside>
    </>
  );
}

function IOSDropdown({ label, icon, isOpen, onClick, children }) {
  return (
    <div className="space-y-1">
      <button 
        onClick={onClick} 
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
          isOpen 
          ? 'text-gray-900 dark:text-white bg-gray-200/30 dark:bg-slate-800' 
          : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
        }`}
      >
        <div className="flex items-center gap-3">
          {icon} 
          <span className="text-[14px] font-bold">{label}</span>
        </div>
        <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-90 text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
      </button>
      {isOpen && (
        <div className="ml-4 pl-6 border-l-2 border-gray-200 dark:border-slate-800 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

function SubItem({ label, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`px-3 py-2 text-[13px] cursor-pointer font-bold transition-all rounded-lg ${
        active 
        ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 shadow-sm' 
        : 'text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </div>
  );
}