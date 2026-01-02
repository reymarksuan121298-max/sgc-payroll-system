import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Bars3Icon, 
  Cog8ToothIcon, 
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  MoonIcon,
  SunIcon, 
  ArrowRightOnRectangleIcon 
} from '@heroicons/react/24/outline';

// Components & Pages
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Employees from './components/Employees';
import Login from './pages/Login';
import AdditionDeduction from './components/AdditionDeduction';
import CalendarDayOff from './components/CalendarDayoff'; 
import PayrollReport from './components/PayrollReport'; 
import TimeInTimeOutReport from './components/TimeInTimeOutReport';
import PayrollSettingsModal from './components/PayrollSettingsModal'; 

// --- BAGONG IMPORT PARA SA AGENT ATTENDANCE MAP ---
import AgentMap from './components/AgentGlobe'; 

// Employee Portal Page (Para sa Filing, Payslip, etc.)
import EmployeePortal from './pages/EmployeePortal'; 

// Attendance Terminal (Yung ID Scanner na ginawa natin)
import AttendanceTerminal from './components/Portal'; 

function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [isPayrollSettingsOpen, setIsPayrollSettingsOpen] = useState(false);

  const handleLogout = () => {
    sessionStorage.clear();
    sessionStorage.removeItem("loggedIn"); 
    window.location.replace('/admin'); 
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen w-full bg-[#F2F2F7] dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 z-40 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full cursor-pointer">
                <Bars3Icon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              </button>
              <h2 className="text-[15px] md:text-[17px] font-bold tracking-tight text-slate-800 dark:text-white ">Admin Panel</h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 text-[13px] font-semibold text-gray-400 mr-4">
                <CalendarDaysIcon className="w-4 h-4" />
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`p-2 rounded-full transition-all cursor-pointer ${isSettingsOpen ? 'bg-blue-50 dark:bg-slate-700 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500'}`}
                >
                  <Cog8ToothIcon className="w-6 h-6" />
                </button>

                {isSettingsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 overflow-hidden p-2">
                      <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          {isDarkMode ? <SunIcon className="w-5 h-5 text-yellow-500" /> : <MoonIcon className="w-5 h-5 text-indigo-500" />}
                          <span className="text-sm font-bold">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`}></div>
                        </div>
                      </button>

                      <button 
                        onClick={() => {
                          setIsPayrollSettingsOpen(true);
                          setIsSettingsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl font-bold text-sm cursor-pointer"
                      >
                        <WrenchScrewdriverIcon className="w-5 h-5" /> Payroll Settings
                      </button>

                      <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                      
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold text-sm cursor-pointer">
                        <ArrowRightOnRectangleIcon className="w-5 h-5" /> Logout Admin
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#F2F2F7] dark:bg-slate-900 transition-colors duration-300">
            <Outlet />
          </main>
        </div>
      </div>

      <PayrollSettingsModal 
        isOpen={isPayrollSettingsOpen} 
        onClose={() => setIsPayrollSettingsOpen(false)} 
      />
    </div>
  );
}

function App() {
  const [adminSession, setAdminSession] = useState(() => sessionStorage.getItem("loggedIn") === "true");
  const [employeeSession, setEmployeeSession] = useState(() => localStorage.getItem("current_employee") !== null);

  useEffect(() => {
    const checkSessions = () => {
      setAdminSession(sessionStorage.getItem("loggedIn") === "true");
      setEmployeeSession(localStorage.getItem("current_employee") !== null);
    };
    window.addEventListener('storage', checkSessions);
    return () => window.removeEventListener('storage', checkSessions);
  }, []);

  return (
    <Router>
      <Routes>
        {/* --- ATTENDANCE TERMINAL --- */}
        <Route path="/attendance" element={<AttendanceTerminal />} />

        {/* --- EMPLOYEE ROUTES --- */}
        <Route path="/" element={!employeeSession ? <Login userType="employee" setSession={setEmployeeSession} /> : <Navigate to="/portal" replace />} />
        <Route path="/portal" element={employeeSession ? <EmployeePortal /> : <Navigate to="/" replace />} />

        {/* --- ADMIN ROUTES --- */}
        <Route path="/admin" element={!adminSession ? <Login userType="admin" setSession={setAdminSession} /> : <Navigate to="/app/dashboard" replace />} />

        <Route path="/app" element={adminSession ? <MainLayout /> : <Navigate to="/admin" replace />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          
          {/* --- BAGONG ROUTE PARA SA AGENT MAP --- */}
          <Route path="agent-map" element={<AgentMap />} />

          <Route path="addition-deduction" element={<AdditionDeduction />} />
          <Route path="calendar-dayoff" element={<CalendarDayOff />} />
          <Route path="payroll-report" element={<PayrollReport />} />
          <Route path="attendance-report" element={<TimeInTimeOutReport />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;