import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

const adminClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
); 

interface CoachProfile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface Sport {
  id: string;
  name: string;
}

const ManageCoaches: React.FC = () => {
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Modal & Target Assignment States
  const [selectedCoach, setSelectedCoach] = useState<CoachProfile | null>(null);
  const [selectedSportId, setSelectedSportId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'coach' | 'head_coach'>('coach');
  const [editLoading, setEditLoading] = useState(false);

  const [registerRole, setRegisterRole] = useState<'coach' | 'head_coach'>('coach');

  const [deleteTarget, setDeleteTarget] = useState<CoachProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = async () => {
    setFetching(true);
    setError(null);
    try {
      // Get current user to exclude from the list
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserId = currentUser?.id || '';

      // 1. Fetch profiles with coach or head_coach role (excluding current user)
      let query = supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .in('role', ['coach', 'head_coach']);

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data: profilesData, error: profilesError } = await query;

      if (profilesError) throw profilesError;
      setCoaches(profilesData || []);

      // 2. Fetch sports options list
      const { data: sportsData, error: sportsError } = await supabase
        .from('sports')
        .select('id, name');

      if (sportsError) throw sportsError;
      setSports(sportsData || []);

      // 3. Fetch relational active assignments
      const { data: linkData, error: linkError } = await supabase
        .from('coaches_sports')
        .select(`
          coach_id,
          sport_id,
          sports ( name )
        `);

      if (linkError) throw linkError;

      const mapping: Record<string, string[]> = {};
      (linkData as any[])?.forEach((item) => {
        if (!mapping[item.coach_id]) mapping[item.coach_id] = [];
        if (item.sports?.name) {
          mapping[item.coach_id].push(item.sports.name);
        }
      });
      setAssignments(mapping);

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to populate dashboard entries.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      const { data, error: signUpError } = await adminClient.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: registerRole,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data?.user) {
        setSuccess(`Coach ${fullName} registered successfully!`);
        setFullName('');
        setEmail('');
        setPassword('');
        setRegisterRole('coach');
        await loadData();
      }
    } catch (err: any) {
      console.error('Registration error details:', err);
      setError(err.message || 'An error occurred while creating the coach profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoach || !selectedSportId) return;

    setAssigning(true);
    setError(null);
    try {
      const { error: linkError } = await supabase
        .from('coaches_sports')
        .insert({
          coach_id: selectedCoach.id,
          sport_id: selectedSportId
        });

      if (linkError) throw linkError;

      setSelectedSportId('');
      await loadData();
    } catch (err: any) {
      console.error('Link generation error:', err);
      setError(err.message || 'Row-level safety rules blocked assignment sync.');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignSport = async (coachId: string, sportId: string) => {
    setAssigning(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('coaches_sports')
        .delete()
        .eq('coach_id', coachId)
        .eq('sport_id', sportId);

      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to unassign sport.');
    } finally {
      setAssigning(false);
    }
  };

  const handleEditCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoach) return;
    setEditLoading(true);
    setError(null);
    try {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ full_name: editFullName.trim(), role: editRole })
        .eq('id', selectedCoach.id);

      if (profileError) throw profileError;

      const updateData: any = {};
      if (editEmail.trim()) updateData.email = editEmail.trim();
      if (editPassword.trim()) {
        if (editPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        updateData.password = editPassword;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: authError } = await adminClient.auth.admin.updateUserById(selectedCoach.id, updateData);
        if (authError) throw authError;
      }

      setSuccess('Coach details updated successfully.');
      setEditFullName('');
      setEditEmail('');
      setEditPassword('');
      setEditRole('coach');
      setSelectedCoach(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update coach details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteCoach = async () => {
    if (!deleteTarget) return;
    if (!deleteTarget.id || deleteTarget.id === '00000000-0000-0000-0000-000000000000') {
      setError('Invalid coach ID. Cannot delete.');
      setDeleteTarget(null);
      return;
    }
    setDeleteLoading(true);
    setError(null);
    try {
      const coachId = deleteTarget.id;

      const { error: unlinkError } = await supabase
        .from('coaches_sports')
        .delete()
        .eq('coach_id', coachId);

      if (unlinkError) console.warn('Unlink warning:', unlinkError.message);

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', coachId);

      if (profileError) throw profileError;

      try {
        const { error: authError } = await adminClient.auth.admin.deleteUser(coachId);
        if (authError) console.warn('Auth cleanup warning:', authError.message);
      } catch (authWarn: any) {
        console.warn('Auth user may not exist:', authWarn.message);
      }

      setSuccess(`Coach ${deleteTarget.full_name} deleted successfully.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete coach.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="p-6 text-slate-400 text-sm flex items-center gap-3">
        <span className="w-4 h-4 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
        Loading coaches administrative panel...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Club Coaches</h1>
        <p className="text-sm text-slate-400">Register new coaches and manage their workspace contexts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Panel */}
        <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white mb-4">Register New Coach Account</h2>
          
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
              {success}
            </div>
          )}

          <form onSubmit={handleRegisterCoach} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Coach Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Coach Dean"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dean@sportsclub.com"
                  autoComplete="username"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
                />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Coach Role</label>
              <select
                value={registerRole}
                onChange={(e) => setRegisterRole(e.target.value as 'coach' | 'head_coach')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              >
                <option value="coach">Coach — standard access</option>
                <option value="head_coach">Head Coach — full administrative access (God mode)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Head Coaches have unrestricted access to all panels and features.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg shadow-lg shadow-violet-600/10 transition-all flex items-center justify-center"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Register Coach'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Unassigned Coaches</h3>
            <div className="space-y-2">
              {coaches.filter(c => !assignments[c.id] || assignments[c.id].length === 0).length === 0 ? (
                <p className="text-xs text-slate-500 italic">All coaches have at least one club assignment.</p>
              ) : (
                coaches.filter(c => !assignments[c.id] || assignments[c.id].length === 0).map((coach) => (
                  <div key={coach.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center font-bold text-[10px] uppercase">
                        {coach.full_name?.charAt(0) || 'C'}
                      </div>
                      <span className="text-xs font-medium text-slate-300">{coach.full_name}</span>
                    </div>
                     <div className="flex gap-2">
                       <button
                         onClick={() => setSelectedCoach(coach)}
                         className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white font-semibold px-2 py-1 rounded transition-colors"
                       >
                         Assign
                       </button>
                       <button
                         onClick={() => setDeleteTarget(coach)}
                         className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold px-2 py-1 rounded transition-colors"
                       >
                         🗑
                       </button>
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Directory List */}
        <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white mb-4">Coaches Directory</h2>
          
          {coaches.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center">
              <p className="text-sm text-slate-500">No coaches registered yet. Add one in the left panel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coaches.map((coach) => (
                <div key={coach.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-full flex items-center justify-center font-bold text-sm uppercase">
                        {coach.full_name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-white">{coach.full_name}</h3>
                          {coach.role === 'head_coach' ? (
                            <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              Head Coach
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 font-medium px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              Coach
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 tracking-wider font-mono">ID: {coach.id.slice(0, 8)}...</p>
                      </div>
                    </div>

                    {/* Active Assigned Sports Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {assignments[coach.id]?.length > 0 ? (
                        assignments[coach.id].map((sportName, i) => (
                          <span key={i} className="text-[10px] bg-slate-900 text-violet-400 border border-violet-500/20 font-medium px-2 py-0.5 rounded-md">
                            {sportName}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">No assigned clubs</span>
                      )}
                    </div>
                  </div>
                  
                   <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
                     <span className="text-[11px] text-slate-500 font-medium">Clubs Config</span>
                     <div className="flex gap-2">
                       <button
                         onClick={() => {
                           setSelectedCoach(coach);
                           setEditRole(coach.role as 'coach' | 'head_coach');
                           setEditFullName(coach.full_name);
                           setEditEmail('');
                           setEditPassword('');
                         }}
                         className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-2.5 py-1 rounded-md border border-slate-800 transition-colors"
                       >
                         ✏️ Manage
                       </button>
                       <button
                         onClick={() => setDeleteTarget(coach)}
                         className="text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold px-2.5 py-1 rounded-md transition-colors"
                       >
                         🗑 Delete
                       </button>
                     </div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal Popup */}
      {selectedCoach && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-bold text-white">Manage Coach</h3>
              <p className="text-xs text-slate-400">Edit details or manage club assignments for <b>{selectedCoach.full_name}</b>.</p>
            </div>

            <form onSubmit={handleEditCoach} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email Address</label>
                 <input
                   type="email"
                   autoComplete="username"
                   className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                   value={editEmail}
                   onChange={(e) => setEditEmail(e.target.value)}
                   placeholder="Leave blank to keep current"
                 />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">New Password</label>
                 <input
                   type="password"
                   autoComplete="new-password"
                   className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                   value={editPassword}
                   onChange={(e) => setEditPassword(e.target.value)}
                   placeholder="Leave blank to keep current"
                 />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Coach Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'coach' | 'head_coach')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="coach">Coach — standard access</option>
                  <option value="head_coach">Head Coach — full administrative access (God mode)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedCoach(null); setEditFullName(''); setEditEmail(''); setEditPassword(''); setEditRole('coach'); }}
                  className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  {editLoading ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>

            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-sm font-semibold text-white mb-2">Club Assignments</h4>
              {assignments[selectedCoach.id]?.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(assignments[selectedCoach.id] || []).map((sportName, i) => {
                    const sportId = sports.find(s => s.name === sportName)?.id || '';
                    return (
                      <span key={i} className="flex items-center gap-1 text-[10px] bg-slate-900 text-violet-400 border border-violet-500/20 font-medium px-2 py-0.5 rounded-md">
                        {sportName}
                        <button
                          type="button"
                          onClick={() => handleUnassignSport(selectedCoach.id, sportId)}
                          className="text-red-400 hover:text-red-300 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic mb-3">No assigned clubs</p>
              )}

              <form onSubmit={handleAssignSportSubmit} className="flex gap-2">
                <select
                  required
                  value={selectedSportId}
                  onChange={(e) => setSelectedSportId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">-- Assign Club --</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={assigning || !selectedSportId}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {assigning ? '...' : 'Assign'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-white mb-2">Delete Coach</h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to permanently delete <span className="text-white font-semibold">{deleteTarget.full_name}</span>? This action cannot be undone and will remove all club assignments.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCoach}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {deleteLoading ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : null}
                {deleteLoading ? 'Deleting...' : 'Delete Coach'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCoaches;