import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState<string>('Head Coach');
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          if (data.role !== 'head_coach') {
            navigate(data.role === 'coach' ? '/coach' : '/login');
            return;
          }
          setUserName(data.full_name);
        }
      } else {
        navigate('/login');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const fetchSports = async () => {
      const { data } = await supabase
        .from('sports')
        .select('id, name')
        .order('name');
      setSports(data || []);
    };
    fetchSports();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const NavSection = ({ label, id, basePath }: { label: string, id: string, basePath: string }) => (
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
              to={`${basePath}`}
              className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              + Add Students
            </Link>
          )}
          {id === 'attendance' && (
            <>
              <Link
                to="/admin/training-schedule"
                onClick={() => setSidebarOpen(false)}
                className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
              >
                ⚙ Training Schedule
              </Link>
              <Link
                to="/admin/holidays"
                onClick={() => setSidebarOpen(false)}
                className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
              >
                🎉 Manage Holidays
              </Link>
            </>
          )}
          {sports.map((sport) => (
            <NavLink
              key={sport.id}
              to={`${basePath}/${sport.id}`}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `block py-1.5 pl-4 text-xs transition-colors ${
                  isActive
                    ? 'text-violet-300 font-semibold'
                    : 'text-slate-500 hover:text-violet-400'
                }`
              }
            >
              {sport.name}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );

  const NavSectionMobile = ({ label, id, basePath, closeSidebar }: { label: string, id: string, basePath: string, closeSidebar: () => void }) => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-900/50"
        >
          {label} <span>{open ? '▼' : '▶'}</span>
        </button>
        {open && (
          <div className="ml-4 space-y-1">
            {id === 'players' && (
              <Link
                to={`${basePath}`}
                onClick={closeSidebar}
                className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
              >
                + Add Students
              </Link>
            )}
            {id === 'attendance' && (
              <>
                <Link
                  to="/admin/training-schedule"
                  onClick={closeSidebar}
                  className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
                >
                  ⚙ Training Schedule
                </Link>
                <Link
                  to="/admin/holidays"
                  onClick={closeSidebar}
                  className="block py-2 pl-4 text-xs font-bold text-violet-400 hover:text-violet-300"
                >
                  🎉 Manage Holidays
                </Link>
              </>
            )}
            {sports.map((sport) => (
              <NavLink
                key={sport.id}
                to={`${basePath}/${sport.id}`}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `block py-1.5 pl-4 text-xs transition-colors ${
                    isActive
                      ? 'text-violet-300 font-semibold'
                      : 'text-slate-500 hover:text-violet-400'
                  }`
                }
              >
                {sport.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <span className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-800/60 flex flex-col justify-between hidden md:flex sticky top-0 h-screen">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-800/80">
            <Link to="/admin" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-violet-500 animate-pulse"></span>
              SportDept <span className="text-violet-400 font-semibold text-sm px-1.5 py-0.5 bg-violet-500/10 rounded">HQ</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Management</p>
            <NavSection label="📋 Attendance" id="attendance" basePath="/admin/attendance" />
            <NavSection label="Grade Students" id="grade" basePath="/admin/grade" />
            <NavLink
              to="/admin/coaches"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-violet-600/25 text-violet-300 border-l-2 border-violet-500 pl-2.5 shadow-inner'
                    : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                }`
              }
            >
              👔 Manage Coaches
            </NavLink>
            <NavSection label="📋 Manage Criteria" id="criteria" basePath="/admin/criteria" />
            <NavSection label="📅 Manage Events" id="events" basePath="/admin/events" />
            <NavLink
              to="/admin/sports"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-violet-600/25 text-violet-300 border-l-2 border-violet-500 pl-2.5 shadow-inner'
                    : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                }`
              }
            >
              📊 Manage Sports
            </NavLink>
            <NavSection label="🏃 Manage Students" id="players" basePath="/admin/players" />
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Theme</span>
            {([
              { value: 'default', label: '🌙', title: 'Default' },
              { value: 'light', label: '☀️', title: 'Light' },
              { value: 'grey', label: '🌫️', title: 'Grey' },
              { value: 'dark', label: '🌑', title: 'Dark' },
            ] as const).map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                title={t.title}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-all ${
                  theme === t.value
                    ? 'bg-violet-600/30 text-violet-300 ring-1 ring-violet-500/50'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-violet-600/35 border border-violet-500/50 flex items-center justify-center text-sm font-bold text-violet-200 uppercase">
              {userName.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-violet-400 font-medium">Head Coach</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors"
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
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
          <Link to="/admin" className="text-lg font-bold text-white">
            SportDept <span className="text-violet-400">HQ</span>
          </Link>
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <Link to="/admin" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-violet-500 animate-pulse"></span>
                  SportDept <span className="text-violet-400 font-semibold text-sm px-1.5 py-0.5 bg-violet-500/10 rounded">HQ</span>
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 -mr-2 text-slate-400 hover:text-white"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="space-y-2 flex-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Management</p>
                <NavSectionMobile label="📋 Attendance" id="attendance" basePath="/admin/attendance" closeSidebar={() => setSidebarOpen(false)} />
                <NavSectionMobile label="Grade Students" id="grade" basePath="/admin/grade" closeSidebar={() => setSidebarOpen(false)} />
                <NavLink
                  to="/admin/coaches"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-violet-600/25 text-violet-300 border-l-2 border-violet-500 pl-2.5 shadow-inner'
                        : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`
                  }
                >
                  👔 Manage Coaches
                </NavLink>
                <NavSectionMobile label="📋 Manage Criteria" id="criteria" basePath="/admin/criteria" closeSidebar={() => setSidebarOpen(false)} />
                <NavSectionMobile label="📅 Manage Events" id="events" basePath="/admin/events" closeSidebar={() => setSidebarOpen(false)} />
                <NavLink
                  to="/admin/sports"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-violet-600/25 text-violet-300 border-l-2 border-violet-500 pl-2.5 shadow-inner'
                        : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`
                  }
                >
                  📊 Manage Sports
                </NavLink>
                <NavSectionMobile label="🏃 Manage Students" id="players" basePath="/admin/players" closeSidebar={() => setSidebarOpen(false)} />
              </nav>
              <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Theme</span>
                  {([
                    { value: 'default', label: '🌙', title: 'Default' },
                    { value: 'light', label: '☀️', title: 'Light' },
                    { value: 'grey', label: '🌫️', title: 'Grey' },
                    { value: 'dark', label: '🌑', title: 'Dark' },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => { setTheme(t.value); }}
                      title={t.title}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-all ${
                        theme === t.value
                          ? 'bg-violet-600/30 text-violet-300 ring-1 ring-violet-500/50'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 px-2">
                  <div className="w-9 h-9 rounded-full bg-violet-600/35 border border-violet-500/50 flex items-center justify-center text-sm font-bold text-violet-200 uppercase">
                    {userName.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{userName}</p>
                    <p className="text-[10px] text-violet-400 font-medium">Head Coach</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSidebarOpen(false); handleLogout(); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors"
                >
                  🚪 Sign Out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-panel border-t border-slate-800/80 flex justify-around items-center py-2 px-1 safe-area-pb">
          <NavLink
            to="/admin/attendance"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                location.pathname.startsWith('/admin/attendance') ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-lg">📋</span>
            <span className="text-[10px] font-medium">Attend</span>
          </NavLink>
          <NavLink
            to="/admin/coaches"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-lg">👔</span>
            <span className="text-[10px] font-medium">Coaches</span>
          </NavLink>
          <NavLink
            to="/admin/criteria"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-lg">📋</span>
            <span className="text-[10px] font-medium">Criteria</span>
          </NavLink>
          <NavLink
            to="/admin/events"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-lg">📅</span>
            <span className="text-[10px] font-medium">Events</span>
          </NavLink>
          <button
            onClick={() => {
              if (sports.length > 0) {
                navigate(`/admin/grade/${sports[0].id}`);
              } else {
                navigate('/admin/sports');
              }
            }}
            className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
              location.pathname.startsWith('/admin/grade') ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-lg">📊</span>
            <span className="text-[10px] font-medium">Grade</span>
          </button>
          <NavLink
            to="/admin/sports"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-lg">📊</span>
            <span className="text-[10px] font-medium">Sports</span>
          </NavLink>
          <NavLink
            to="/admin/players"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-lg">🏃</span>
            <span className="text-[10px] font-medium">Students</span>
          </NavLink>
        </nav>

        {/* Main Nested View Router Output */}
        <main className="flex-1 pt-14 md:pt-0 p-4 md:p-8 overflow-y-auto pb-20 md:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
