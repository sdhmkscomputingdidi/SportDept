import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

interface AuthProps {
  onAuthSuccess: (session: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      if (data.session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single();

        if (profileError || !profile) {
          const defaultRole = email.includes('admin') ? 'head_coach' : 'coach';
          await supabase.from('profiles').upsert({
            id: data.session.user.id,
            full_name: email.split('@')[0],
            role: defaultRole,
          });
          onAuthSuccess(data.session);
          navigate(defaultRole === 'head_coach' ? '/admin' : '/coach');
        } else {
          onAuthSuccess(data.session);
          navigate(profile.role === 'head_coach' ? '/admin' : '/coach');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-600/20 rounded-full filter blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-600/20 rounded-full filter blur-[80px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500"></div>

        <div className="text-center mb-8">
        {/* 2. Added Logo wrapper with styling */}
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.jpg" 
              alt="SportDept Logo" 
              className="w-32 h-32 object-contain rounded-xl shadow-lg border border-slate-700/50"
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white m-0 mb-2">
            SportDept <span className="text-violet-400">CMS</span>
          </h1>
          <p className="text-sm text-slate-400">Sports Club Management &amp; Assessments</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@club.com"
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-lg py-2.5 transition-all shadow-lg hover:shadow-violet-600/30 flex justify-center items-center text-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are created by your Head Coach / Administrator.
        </p>
      </div>
    </div>
  );
};
