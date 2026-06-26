import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Sport {
  id: string;
  name: string;
}

interface Holiday {
  id: string;
  sport_id: string | null;
  date: string;
  name: string;
  description: string | null;
}

export const ManageHolidays: React.FC = () => {
  const [sports, setSports] = useState<Sport[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSportId, setNewSportId] = useState<string>('');

  const fetchSports = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('sports')
        .select('id, name')
        .order('name');

      if (fetchErr) throw fetchErr;
      setSports(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sports.');
    }
  };

  const fetchHolidays = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('holidays')
        .select('id, sport_id, date, name, description')
        .order('date', { ascending: false });

      if (fetchErr) throw fetchErr;
      setHolidays(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch holidays.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSports();
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate.trim() || !newName.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        date: newDate,
        name: newName.trim(),
        description: newDescription.trim() || null,
      };

      // If a specific sport is selected, link the holiday to it
      // Otherwise, it's a global holiday (sport_id = null)
      if (newSportId) {
        payload.sport_id = newSportId;
      }

      const { error: insertErr } = await supabase
        .from('holidays')
        .insert(payload);

      if (insertErr) throw insertErr;

      setNewDate('');
      setNewName('');
      setNewDescription('');
      setNewSportId('');
      setSuccess('Holiday added successfully!');
      setTimeout(() => setSuccess(null), 3000);
      fetchHolidays();
    } catch (err: any) {
      setError(err.message || 'Failed to add holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm('Delete this holiday?')) return;
    setDeleting(id);
    setError(null);
    try {
      const { error: deleteErr } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      setHolidays(prev => prev.filter(h => h.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete holiday.');
    } finally {
      setDeleting(null);
    }
  };

  const getSportName = (sportId: string | null): string => {
    if (!sportId) return '🌍 Global';
    return sports.find(s => s.id === sportId)?.name || 'Unknown Sport';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingHolidays = holidays.filter(h => h.date >= today);
  const pastHolidays = holidays.filter(h => h.date < today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">
          🎉 Manage Holidays
        </h2>
        <p className="text-sm text-slate-400">
          Add global or sport-specific holidays when training is cancelled.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add Holiday Form */}
        <div className="lg:col-span-4 glass-panel border border-slate-800/60 rounded-xl p-6 h-fit">
          <h3 className="text-base font-bold text-white mb-4">Add Holiday</h3>

          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Holiday Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Christmas, New Year, Summer Break"
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Description (optional)
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Affects
              </label>
              <select
                value={newSportId}
                onChange={(e) => setNewSportId(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
              >
                <option value="">🌍 All Sports (Global)</option>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-all"
            >
              {saving ? 'Adding...' : '➕ Add Holiday'}
            </button>
          </form>
        </div>

        {/* Holidays List */}
        <div className="lg:col-span-8 glass-panel border border-slate-800/60 rounded-xl p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <span className="w-6 h-6 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin inline-block"></span>
              <p className="mt-3 text-sm">Loading holidays...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No holidays added yet. Use the form to add one.
            </div>
          ) : (
            <>
              {/* Upcoming Holidays */}
              {upcomingHolidays.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Upcoming Holidays ({upcomingHolidays.length})
                  </h3>
                  <div className="space-y-2">
                    {upcomingHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-4 bg-slate-900/40 rounded-lg border border-slate-800/80 hover:border-amber-500/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            🎉 {holiday.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDate(holiday.date)}
                          </p>
                          {holiday.description && (
                            <p className="text-xs text-slate-500 mt-1 italic">
                              {holiday.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className={`text-[10px] px-2 py-1 rounded font-semibold ${
                            holiday.sport_id
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {getSportName(holiday.sport_id)}
                          </span>
                          <button
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            disabled={deleting === holiday.id}
                            className="text-red-400 hover:text-red-300 text-xs font-semibold disabled:opacity-50"
                          >
                            {deleting === holiday.id ? '...' : '✕'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Holidays */}
              {pastHolidays.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Past Holidays ({pastHolidays.length})
                  </h3>
                  <div className="space-y-1 opacity-60">
                    {pastHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-3 bg-slate-900/20 rounded-lg border border-slate-800/60"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300">
                            {holiday.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatDate(holiday.date)}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-600 px-2">
                          {getSportName(holiday.sport_id)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
