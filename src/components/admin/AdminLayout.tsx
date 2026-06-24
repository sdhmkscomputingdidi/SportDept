import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>('Head Coach');
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

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
          {sports.map((sport) => (
            <NavLink
              key={sport.id}
              to={`${basePath}/${sport.id}`}
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
            <NavSection label="Grade Students" id="grade" basePath="/admin/grade" />
            <NavSection label="🏃 Manage Students" id="players" basePath="/admin/players" />
            <NavSection label="📅 Manage Events" id="events" basePath="/admin/events" />
            <NavSection label="📋 Manage Criteria" id="criteria" basePath="/admin/criteria" />
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
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
        <header className="md:hidden glass-panel border-b border-slate-800/80 p-4 flex items-center justify-between">
          <Link to="/admin" className="text-lg font-bold text-white">
            SportDept <span className="text-violet-400">HQ</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-300">{userName}</span>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Mobile Nav Bar */}
        <nav className="md:hidden glass-panel border-b border-slate-800/50 flex justify-around p-2">
          <NavLink
            to="/admin/sports"
            className={({ isActive }) =>
              `text-xs font-medium py-1.5 px-3 rounded ${
                isActive ? 'bg-violet-600/35 text-violet-300 font-bold' : 'text-slate-400'
              }`
            }
          >
            Sports
          </NavLink>
          <NavLink
            to="/admin/coaches"
            className={({ isActive }) =>
              `text-xs font-medium py-1.5 px-3 rounded ${
                isActive ? 'bg-violet-600/35 text-violet-300 font-bold' : 'text-slate-400'
              }`
            }
          >
            Coaches
          </NavLink>
          <NavLink
            to="/admin/players"
            className={({ isActive }) =>
              `text-xs font-medium py-1.5 px-3 rounded ${
                isActive ? 'bg-violet-600/35 text-violet-300 font-bold' : 'text-slate-400'
              }`
            }
          >
            Students
          </NavLink>
          <NavLink
            to="/admin/events"
            className={({ isActive }) =>
              `text-xs font-medium py-1.5 px-3 rounded ${
                isActive ? 'bg-violet-600/35 text-violet-300 font-bold' : 'text-slate-400'
              }`
            }
          >
            Events
          </NavLink>
          <NavLink
            to="/admin/criteria"
            className={({ isActive }) =>
              `text-xs font-medium py-1.5 px-3 rounded ${
                isActive ? 'bg-violet-600/35 text-violet-300 font-bold' : 'text-slate-400'
              }`
            }
          >
            Criteria
          </NavLink>
        </nav>

        {/* Main Nested View Router Output */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
