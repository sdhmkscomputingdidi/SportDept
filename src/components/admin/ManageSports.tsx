import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Sport {
  id: string;
  name: string;
  sport_code?: number;
}

export const ManageSports: React.FC = () => {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [editName, setEditName] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchSports();
  }, []);

  const fetchSports = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('sports')
        .select('*')
        .order('sport_code', { ascending: true });

      if (fetchErr) throw fetchErr;
      setSports(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sports.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFormLoading(true);
    setError(null);

    try {
      const { error: insertErr } = await supabase
        .from('sports')
        .insert([{ name: name.trim() }]);

      if (insertErr) throw insertErr;
      setName('');
      fetchSports();
    } catch (err: any) {
      setError(err.message || 'Failed to add sport.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateSport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSport || !editName.trim()) return;
    setFormLoading(true);
    setError(null);

    try {
      const { error: updateErr } = await supabase
        .from('sports')
        .update({ name: editName.trim() })
        .eq('id', editingSport.id);

      if (updateErr) throw updateErr;
      setEditingSport(null);
      fetchSports();
    } catch (err: any) {
      setError(err.message || 'Failed to update sport.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSport = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sport? This will remove all associated data: coaches, students, events, attendance records, assessment criteria, training schedules, and holidays.')) return;
    setError(null);
    setFormLoading(true);

    try {
      // 1. Delete coach-sport assignments
      await supabase.from('coaches_sports').delete().eq('sport_id', id);

      // 2. Unassign all players from this sport (preserve student records)
      await supabase.from('players').update({ sport_id: null }).eq('sport_id', id);

      // 3. Delete events and their participant links
      const { data: events } = await supabase.from('events').select('id').eq('sport_id', id);
      if (events && events.length > 0) {
        const eventIds = events.map(e => e.id);
        await supabase.from('players_events').delete().in('event_id', eventIds);
        await supabase.from('events').delete().in('id', eventIds);
      }

      // 4. Delete attendance records
      await supabase.from('coach_attendance').delete().eq('sport_id', id);
      await supabase.from('player_attendance').delete().eq('sport_id', id);

      // 5. Delete training schedule & holidays
      await supabase.from('sport_training_days').delete().eq('sport_id', id);
      await supabase.from('holidays').delete().eq('sport_id', id);

      // 6. Delete assessment hierarchy: categories -> skills -> criteria & assessments
      const { data: categories } = await supabase
        .from('assessment_categories')
        .select('id')
        .eq('sport_id', id);

      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);

        const { data: skills } = await supabase
          .from('skills')
          .select('id')
          .in('category_id', categoryIds);

        if (skills && skills.length > 0) {
          const skillIds = skills.map(s => s.id);

          await supabase.from('player_assessments').delete().in('skill_id', skillIds);
          await supabase.from('skill_criteria').delete().in('skill_id', skillIds);
          await supabase.from('skills').delete().in('id', skillIds);
        }

        await supabase.from('assessment_categories').delete().in('id', categoryIds);
      }

      // 7. Finally, delete the sport itself
      const { error: deleteErr } = await supabase
        .from('sports')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      fetchSports();
    } catch (err: any) {
      setError(err.message || 'Failed to delete sport. Make sure no dependent assessment configurations exist.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSeedSports = async () => {
    setFormLoading(true);
    setError(null);
    const defaultSports = [
      { name: 'Football / Soccer' },
      { name: 'Basketball' },
      { name: 'Tennis' },
      { name: 'Swimming' },
      { name: 'Athletics / Track & Field' }
    ];

    try {
      const { error: insertErr } = await supabase
        .from('sports')
        .insert(defaultSports);

      if (insertErr) throw insertErr;
      fetchSports();
    } catch (err: any) {
      setError(err.message || 'Failed to seed default sports.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">Sports Clubs</h2>
          <p className="text-sm text-slate-400">View and manage the 5 active sports divisions.</p>
        </div>
        {sports.length === 0 && !loading && (
          <button
            onClick={handleSeedSports}
            disabled={formLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-emerald-500/20"
          >
            🌱 Seed 5 Default Sports
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Grid of Add Form & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="lg:col-span-1 glass-panel rounded-xl p-6 h-fit border border-slate-800/60">
          <h3 className="text-base font-bold text-white mb-4">
            {editingSport ? 'Edit Sport Details' : 'Add New Sports Club'}
          </h3>

          <form onSubmit={editingSport ? handleUpdateSport : handleAddSport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sport Name
              </label>
              <input
                type="text"
                required
                value={editingSport ? editName : name}
                onChange={(e) => editingSport ? setEditName(e.target.value) : setName(e.target.value)}
                placeholder="e.g. Volleyball"
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg py-2 transition-all text-sm disabled:opacity-50"
              >
                {formLoading ? 'Saving...' : editingSport ? 'Update Sport' : 'Create Sport'}
              </button>

              {editingSport && (
                <button
                  type="button"
                  onClick={() => setEditingSport(null)}
                  className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 px-4 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Table panel */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-6 border border-slate-800/60 overflow-hidden">
          <h3 className="text-base font-bold text-white mb-4">Sports Roster</h3>

          {loading ? (
            <div className="py-12 flex justify-center">
              <span className="w-8 h-8 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
            </div>
          ) : sports.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No sports clubs configured. Use the form to add one or click "Seed Default Sports".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="py-3 font-semibold text-slate-400">Sport Code</th>
                    <th className="py-3 font-semibold text-slate-400">Sport Name</th>
                    <th className="py-3 text-right font-semibold text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sports.map((sport) => (
                    <tr key={sport.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3">
                        <span className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs">
                          {sport.sport_code ?? 'TBD'}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-white">{sport.name}</td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingSport(sport);
                            setEditName(sport.name);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded hover:bg-violet-500/20 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSport(sport.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-all"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
