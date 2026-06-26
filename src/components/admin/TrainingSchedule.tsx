import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Sport {
  id: string;
  name: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TrainingSchedule: React.FC = () => {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Compute dates for the current week (Sun=0 through Sat=6)
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1));
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + (i - 1));
    weekDates.push(d);
  }
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatFullDate = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const fetchSports = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('sports')
        .select('id, name')
        .order('name');

      if (fetchErr) throw fetchErr;
      setSports(data || []);
      if (data && data.length > 0) {
        setSelectedSportId(prev => prev || data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sports.');
    }
  };

  const fetchTrainingDays = async () => {
    if (!selectedSportId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('sport_training_days')
        .select('day_of_week')
        .eq('sport_id', selectedSportId);

      if (fetchErr) throw fetchErr;
      setSelectedDays((data || []).map((d: any) => d.day_of_week));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch training days.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSports();
  }, []);

  useEffect(() => {
    if (selectedSportId) {
      fetchTrainingDays();
    }
  }, [selectedSportId]);

  const handleSportChange = (sportId: string) => {
    setSelectedSportId(sportId);
    setSuccess(null);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (!selectedSportId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Delete all existing training days for this sport
      const { error: deleteErr } = await supabase
        .from('sport_training_days')
        .delete()
        .eq('sport_id', selectedSportId);

      if (deleteErr) throw deleteErr;

      // Insert new training days
      if (selectedDays.length > 0) {
        const { error: insertErr } = await supabase
          .from('sport_training_days')
          .insert(selectedDays.map(day => ({
            sport_id: selectedSportId,
            day_of_week: day,
          })));

        if (insertErr) throw insertErr;
      }

      setSuccess('Training schedule saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save training schedule.');
    } finally {
      setSaving(false);
    }
  };

  const selectedSport = sports.find(s => s.id === selectedSportId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">
            ⚙ Training Schedule
          </h2>
          <p className="text-sm text-slate-400">
            Set which days of the week each sport trains on.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sports.length > 0 && (
            <select
              value={selectedSportId}
              onChange={(e) => handleSportChange(e.target.value)}
              className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm font-semibold"
            >
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          )}
        </div>
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

      {sports.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
          No sports clubs configured. Please add a sport first.
        </div>
      ) : loading ? (
        <div className="glass-panel rounded-xl p-12 text-center text-slate-500">
          <span className="w-6 h-6 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin inline-block"></span>
          <p className="mt-3 text-sm">Loading training schedule...</p>
        </div>
      ) : (
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6 max-w-2xl">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-1">{selectedSport?.name}</h3>
            <p className="text-sm text-slate-400">Select the training days for this sport</p>
          </div>

          {/* Day of week selectors */}
          <div className="grid grid-cols-7 gap-3 mb-8">
            {DAY_LABELS.map((label, idx) => {
              const isSelected = selectedDays.includes(idx);
              const dateStr = formatDate(weekDates[idx]);
              return (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-lg shadow-violet-600/10'
                      : 'bg-slate-900/30 border-slate-800/80 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                    isSelected
                      ? 'border-violet-400 bg-violet-500/30 text-white'
                      : 'border-slate-700 text-transparent'
                  }`}>
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className={`text-[9px] font-medium mt-0.5 transition-all ${
                    isSelected ? 'text-violet-400' : 'text-slate-600'
                  }`}>
                    {dateStr}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mb-6 p-4 bg-slate-900/40 rounded-lg border border-slate-800/60">
            <p className="text-sm text-slate-300">
              {selectedDays.length === 0 ? (
                <span className="text-slate-500 italic">No training days selected. Select at least one day.</span>
              ) : (
                <>
                  <span className="font-semibold text-white">Training days:</span>{' '}
                  {selectedDays.map(d => (
                    <span key={d} className="inline-flex items-center gap-1.5 mr-2">
                      <span className="text-violet-300 font-medium">{DAY_FULL[d]}</span>
                      <span className="text-slate-500 text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded">
                        {formatFullDate(weekDates[d])}
                      </span>
                    </span>
                  ))}
                </>
              )}
            </p>
            <p className="text-[10px] text-slate-600 mt-2">
              Based on the current week ({formatFullDate(weekDates[1])} – {formatFullDate(weekDates[6])})
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-violet-600/10 flex items-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              '💾'
            )}
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      )}
    </div>
  );
};
