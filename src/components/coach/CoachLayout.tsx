import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export const CoachLayout: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>('Coach');
  const [assignedSports, setAssignedSports] = useState<any[]>([]);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchCoachData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (profile) setUserName(profile.full_name);

      const { data: sportsData } = await supabase
        .from('coaches_sports')
        .select('sports(id, name)')
        .eq('coach_id', user.id);
      
      if (sportsData) {
        setAssignedSports(sportsData.map((item: any) => item.sports));
      }
      setLoading(false);
    };
    fetchCoachData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <span className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const NavSection = ({ label, id }: { label: string, id: string }) => (
    <div>
      <button 
        onClick={() => setExpandedMenu(expandedMenu === id ? null : id)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-900/50"
      >
        {label} <span>{expandedMenu === id ? '▼' : '▶'}</span>
      </button>
      {expandedMenu === id && (
        <div className="ml-4 space-y-1">
          {id === 'players' && (
            <Link 
              to="/coach/add-student"
              onClick={closeSidebar}
              className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              + Add New Student
            </Link>
          )}
          
          {assignedSports.map((sport) => (
            <NavLink 
              key={sport.id}
              to={`/coach/${id}/${sport.id}`}
              onClick={closeSidebar}
              className="block py-1.5 pl-4 text-xs text-slate-500 hover:text-violet-400"
            >
              {sport.name}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass-panel border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-slate-300 hover:text-white"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">SportDept <span className="text-violet-500">Coach</span></h1>
        <button
          onClick={handleLogout}
          className="text-xs font-semibold text-red-400 hover:text-red-300"
        >
          Logout
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar}></div>
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-xl font-bold">SportDept <span className="text-violet-500">Coach</span></h1>
              <button
                onClick={closeSidebar}
                className="p-2 -mr-2 text-slate-400 hover:text-white"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-2">
              <NavSection label="Manage Criteria" id="criteria" />
              <NavSection label="Grade Students" id="grade" />
              <NavSection label="Manage Students" id="players" />
              <NavSection label="Manage Events" id="events" />
            </nav>
            <div className="border-t border-slate-800 pt-4">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 mb-3"
              >
                <option value="default">Default</option>
                <option value="light">Light</option>
                <option value="grey">Grey</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-sm font-semibold">{userName}</p>
              <button onClick={handleLogout} className="text-xs text-red-400 mt-2">Sign Out</button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-slate-800 flex-col justify-between h-screen sticky top-0 p-6">
        <div>
          <h1 className="text-xl font-bold mb-8">SportDept <span className="text-violet-500">Coach</span></h1>
          <nav className="space-y-2">
            <NavSection label="Manage Criteria" id="criteria" />
            <NavSection label="Grade Students" id="grade" />
            <NavSection label="Manage Students" id="players" />
            <NavSection label="Manage Events" id="events" />
          </nav>
        </div>
        <div className="border-t border-slate-800 pt-4">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 mb-3"
          >
            <option value="default">Default</option>
            <option value="light">Light</option>
            <option value="grey">Grey</option>
            <option value="dark">Dark</option>
          </select>
          <p className="text-sm font-semibold">{userName}</p>
          <button onClick={handleLogout} className="text-xs text-red-400 mt-2">Sign Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pt-14 md:pt-8 p-4 md:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
