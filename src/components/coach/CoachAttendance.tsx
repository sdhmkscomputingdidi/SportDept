import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AttendanceRecapDrawer } from '../shared/AttendanceRecapDrawer';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Sport {
  id: string;
  name: string;
}

interface Player {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id?: string;
  player_id: string;
  sport_id: string;
  coach_id?: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes: string;
}

interface Holiday {
  id: string;
  name: string;
  sport_id: string | null;
  date: string;
}

interface StudentAttendanceSummary {
  player_id: string;
  full_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total: number;
  percentage: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Auto-resize textarea component
const AutoTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none overflow-hidden"
    />
  );
};

export const CoachAttendance: React.FC = () => {
  const { sportId: urlSportId } = useParams<{ sportId?: string }>();

  // ── Auth & Sports ──
  const [assignedSports, setAssignedSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [coachId, setCoachId] = useState<string>('');

  // ── Players ──
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Week navigation ──
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceDate, setAttendanceDate] = useState(todayStr);
  const [selectedDayIdx, setSelectedDayIdx] = useState(today.getDay());

  const getMonday = (offset: number) => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    return d;
  };
  const monday = getMonday(weekOffset);

  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + (i - 1));
    weekDates.push(d);
  }

  const formatDateShort = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatDateFull = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const toDateStr = (date: Date) => date.toISOString().split('T')[0];
  const isToday = (date: Date) => toDateStr(date) === todayStr;

  const weekLabel = `${formatDateShort(weekDates[1])} – ${formatDateShort(weekDates[6])}`;
  const isCurrentWeek = weekOffset === 0;

  // ── Training days & holidays ──
  const [trainingDays, setTrainingDays] = useState<number[]>([]);
  const [holidaysOnWeek, setHolidaysOnWeek] = useState<Holiday[]>([]);

  const selectedDateDayOfWeek = new Date(attendanceDate + 'T00:00:00').getDay();
  const isTrainingDay = trainingDays.includes(selectedDateDayOfWeek);

  // ── Attendance records ──
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [modifiedPlayers, setModifiedPlayers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Report state ──
  const [reportPlayerId, setReportPlayerId] = useState<string | null>(null);
  const [reportPlayerName, setReportPlayerName] = useState('');
  const [reportRecords, setReportRecords] = useState<AttendanceRecord[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // ── Recap state ──
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapData, setRecapData] = useState<StudentAttendanceSummary[]>([]);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);

  // ── Mobile view ──
  const [mobileView, setMobileView] = useState<'attendance' | 'report'>('attendance');

  // ── Data fetching ──

  const fetchAssignedSports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);

      const { data, error: fetchErr } = await supabase
        .from('coaches_sports')
        .select(`sport_id, sports(id, name)`)
        .eq('coach_id', user.id);

      if (fetchErr) throw fetchErr;

      const list: Sport[] = [];
      data?.forEach((item: any) => {
        if (item.sports) {
          list.push({ id: item.sports.id, name: item.sports.name });
        }
      });

      setAssignedSports(list);
      if (list.length > 0) {
        const matchFromUrl = urlSportId && list.find((s) => s.id === urlSportId);
        setSelectedSportId(matchFromUrl ? urlSportId : list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assigned sports.');
    }
  };

  const fetchPlayers = async () => {
    if (!selectedSportId) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('players')
        .select('id, full_name')
        .eq('sport_id', selectedSportId)
        .order('full_name');

      if (fetchErr) throw fetchErr;
      setPlayers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch players.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainingInfo = async () => {
    if (!selectedSportId) return;
    try {
      const { data: tdData } = await supabase
        .from('sport_training_days')
        .select('day_of_week')
        .eq('sport_id', selectedSportId);

      setTrainingDays((tdData || []).map((d: any) => d.day_of_week));

      const weekStart = toDateStr(weekDates[0]);
      const weekEnd = toDateStr(weekDates[6]);
      const { data: holData } = await supabase
        .from('holidays')
        .select('id, name, sport_id, date')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .or(`sport_id.is.null,sport_id.eq.${selectedSportId}`);

      setHolidaysOnWeek(holData || []);
    } catch (err) {
      console.warn('Failed to fetch training info:', err);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedSportId || !attendanceDate) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('player_attendance')
        .select('id, player_id, sport_id, coach_id, date, status, notes')
        .eq('sport_id', selectedSportId)
        .eq('date', attendanceDate);

      if (fetchErr) throw fetchErr;

      const recordMap: Record<string, AttendanceRecord> = {};
      (data || []).forEach((rec: any) => {
        recordMap[rec.player_id] = {
          id: rec.id,
          player_id: rec.player_id,
          sport_id: rec.sport_id,
          coach_id: rec.coach_id,
          date: rec.date,
          status: rec.status,
          notes: rec.notes || '',
        };
      });

      // Set defaults for players without records
      players.forEach((player) => {
        if (!recordMap[player.id]) {
          recordMap[player.id] = {
            player_id: player.id,
            sport_id: selectedSportId,
            coach_id: coachId,
            date: attendanceDate,
            status: 'present',
            notes: '',
          };
        }
      });

      setRecords(recordMap);
      setModifiedPlayers(new Set());
    } catch (err: any) {
      console.warn('Failed to fetch attendance:', err);
    }
  };

  useEffect(() => {
    fetchAssignedSports();
  }, [urlSportId]);

  useEffect(() => {
    if (selectedSportId) {
      fetchPlayers();
      fetchTrainingInfo();
    }
  }, [selectedSportId, weekOffset]);

  useEffect(() => {
    if (selectedSportId && players.length > 0) {
      fetchAttendance();
    }
  }, [selectedSportId, attendanceDate, players.length]);

  // ── Handlers ──

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase();
    return players.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [players, searchQuery]);

  const handleSportChange = (sportId: string) => {
    setSelectedSportId(sportId);
    setSearchQuery('');
    setModifiedPlayers(new Set());
  };

  const handleDayClick = (dayIdx: number) => {
    setSelectedDayIdx(dayIdx);
    setAttendanceDate(toDateStr(weekDates[dayIdx]));
  };

  const goPrevWeek = () => {
    const newOffset = weekOffset - 1;
    setWeekOffset(newOffset);
    const newMonday = getMonday(newOffset);
    const newDate = new Date(newMonday);
    newDate.setDate(newMonday.getDate() + (selectedDayIdx - 1));
    setAttendanceDate(toDateStr(newDate));
  };

  const goNextWeek = () => {
    const newOffset = weekOffset + 1;
    setWeekOffset(newOffset);
    const newMonday = getMonday(newOffset);
    const newDate = new Date(newMonday);
    newDate.setDate(newMonday.getDate() + (selectedDayIdx - 1));
    setAttendanceDate(toDateStr(newDate));
  };

  const goToToday = () => {
    setWeekOffset(0);
    const td = new Date();
    setAttendanceDate(toDateStr(td));
    setSelectedDayIdx(td.getDay());
  };

  const handleStatusChange = (playerId: string, status: 'present' | 'absent' | 'late') => {
    setRecords((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], status },
    }));
    setModifiedPlayers((prev) => new Set(prev).add(playerId));
  };

  const handleNotesChange = (playerId: string, notes: string) => {
    setRecords((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], notes },
    }));
    setModifiedPlayers((prev) => new Set(prev).add(playerId));
  };

  const handleMarkAllPresent = () => {
    const newRecords = { ...records };
    const newModified = new Set(modifiedPlayers);
    filteredPlayers.forEach((player) => {
      newRecords[player.id] = {
        ...(newRecords[player.id] || {
          player_id: player.id,
          sport_id: selectedSportId,
          coach_id: coachId,
          date: attendanceDate,
        }),
        status: 'present',
      };
      newModified.add(player.id);
    });
    setRecords(newRecords);
    setModifiedPlayers(newModified);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const recordsToSave = modifiedPlayers.size > 0
        ? Array.from(modifiedPlayers).map((playerId) => ({
            ...records[playerId],
            coach_id: coachId,
            sport_id: selectedSportId,
          }))
        : Object.values(records).map((r) => ({
            ...r,
            coach_id: coachId,
            sport_id: selectedSportId,
          }));

      if (recordsToSave.length === 0) {
        setSuccess('No changes to save.');
        setTimeout(() => setSuccess(null), 2000);
        return;
      }

      // Batch upsert: insert or update on conflict (player_id, sport_id, date)
      // Always include id — use existing or generate client-side — because Supabase's
      // auto-detected `columns` param includes `id` if ANY record has one, causing
      // missing `id` on other records to be sent as null.
      const { error: upsertErr } = await supabase
        .from('player_attendance')
        .upsert(
          recordsToSave.map((r) => ({
            id: r.id || crypto.randomUUID(),
            player_id: r.player_id,
            sport_id: r.sport_id,
            coach_id: r.coach_id,
            date: r.date,
            status: r.status,
            notes: r.notes || null,
          })),
          { onConflict: 'player_id,sport_id,date', ignoreDuplicates: false }
        );

      if (upsertErr) throw upsertErr;

      // Re-fetch to get the IDs back
      await fetchAttendance();

      setSuccess(`Attendance saved for ${recordsToSave.length} student${recordsToSave.length !== 1 ? 's' : ''}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  // ── Report handlers ──

  const openReport = async (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    closeRecapDrawer();
    setReportPlayerId(playerId);
    setReportPlayerName(player.full_name);
    setExpandedNotes(new Set());
    setReportLoading(true);
    setMobileView('report');
    try {
      const { data, error: fetchErr } = await supabase
        .from('player_attendance')
        .select('id, player_id, sport_id, coach_id, date, status, notes')
        .eq('player_id', playerId)
        .eq('sport_id', selectedSportId)
        .order('date', { ascending: false });

      if (fetchErr) throw fetchErr;
      const mapped: AttendanceRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        player_id: r.player_id,
        sport_id: r.sport_id,
        date: r.date,
        status: r.status,
        notes: r.notes || '',
      }));
      setReportRecords(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report.');
      setReportPlayerId(null);
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setReportPlayerId(null);
    setReportRecords([]);
    setExpandedNotes(new Set());
    setMobileView('attendance');
  };

  // ── Recap handlers ──

  const openRecapDrawer = async () => {
    if (!selectedSportId) return;
    closeReport();
    setRecapOpen(true);
    setRecapError(null);
    setRecapLoading(true);

    try {
      // Fetch all players for this sport
      const { data: playersData, error: playersErr } = await supabase
        .from('players')
        .select('id, full_name')
        .eq('sport_id', selectedSportId);

      if (playersErr) throw playersErr;
      const playersList = playersData || [];

      if (playersList.length === 0) {
        setRecapData([]);
        setRecapLoading(false);
        return;
      }

      // Fetch aggregated attendance for all players
      const playerIds = playersList.map(p => p.id);
      const { data: attData, error: attErr } = await supabase
        .from('player_attendance')
        .select('player_id, status')
        .eq('sport_id', selectedSportId)
        .in('player_id', playerIds);

      if (attErr) throw attErr;

      // Aggregate per player
      const aggMap = new Map<string, { present: number; absent: number; late: number }>();
      (attData || []).forEach((rec: any) => {
        if (!aggMap.has(rec.player_id)) {
          aggMap.set(rec.player_id, { present: 0, absent: 0, late: 0 });
        }
        const entry = aggMap.get(rec.player_id)!;
        if (rec.status === 'present') entry.present++;
        else if (rec.status === 'absent') entry.absent++;
        else if (rec.status === 'late') entry.late++;
      });

      const summary: StudentAttendanceSummary[] = playersList.map(p => {
        const a = aggMap.get(p.id) || { present: 0, absent: 0, late: 0 };
        const total = a.present + a.absent + a.late;
        return {
          player_id: p.id,
          full_name: p.full_name,
          present_count: a.present,
          absent_count: a.absent,
          late_count: a.late,
          total,
          percentage: total > 0 ? Math.round((a.present / total) * 100) : 0,
        };
      });

      setRecapData(summary);
    } catch (err: any) {
      console.warn('Failed to fetch student recap:', err);
      setRecapError(err.message || 'Failed to fetch student recap.');
    } finally {
      setRecapLoading(false);
    }
  };

  const closeRecapDrawer = () => {
    setRecapOpen(false);
    setRecapData([]);
    setRecapError(null);
  };

  const toggleNotes = (recordId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  // ── Holidays for selected date ──
  const holidaysOnSelectedDate = holidaysOnWeek.filter((h) => h.date === attendanceDate);
  const hasHolidayConflict = holidaysOnSelectedDate.length > 0;

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400', active: 'ring-emerald-500' };
      case 'absent': return { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400', active: 'ring-red-500' };
      case 'late': return { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400', active: 'ring-amber-500' };
      default: return { bg: '', border: '', text: '', dot: '', active: '' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">
            📋 Student Attendance
          </h2>
          <p className="text-sm text-slate-400">{formatDateFull(today)}</p>
        </div>
        <div className="flex items-center gap-3">
          {assignedSports.length > 0 && (
            <select
              value={selectedSportId}
              onChange={(e) => handleSportChange(e.target.value)}
              className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm font-semibold"
            >
              {assignedSports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => setMobileView('attendance')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'attendance' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          }`}
        >
          Attendance ({filteredPlayers.length})
        </button>
        <button
          onClick={() => reportPlayerId && setMobileView('report')}
          disabled={!reportPlayerId}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'report' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          } ${!reportPlayerId ? 'opacity-50' : ''}`}
        >
          Report {reportPlayerName ? `(${reportPlayerName.split(' ')[0]})` : ''}
        </button>
      </div>

      {/* Week Navigation + Day Selector */}
      {selectedSportId && (
        <div className="glass-panel border border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goPrevWeek}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs font-semibold transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{weekLabel}</span>
              {!isCurrentWeek && (
                <button
                  onClick={goToToday}
                  className="text-[10px] px-2 py-1 rounded bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 font-semibold transition-all"
                >
                  Today
                </button>
              )}
            </div>

            <button
              onClick={goNextWeek}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs font-semibold transition-all"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day-of-week bar */}
          <div className="flex gap-2">
            {DAY_LABELS.map((label, idx) => {
              const date = weekDates[idx];
              const dateStr = toDateStr(date);
              const isSelected = dateStr === attendanceDate;
              const isTDay = trainingDays.includes(idx);
              const dayHoliday = holidaysOnWeek.filter((h) => h.date === dateStr);
              const hasHoliday = dayHoliday.length > 0;
              const isTodayDate = isToday(date);

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(idx)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-violet-600/30 text-violet-300 border-2 border-violet-500 shadow-lg shadow-violet-600/10'
                      : isTodayDate
                        ? 'bg-sky-500/10 text-sky-300 border-2 border-sky-500/30'
                        : isTDay
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:border-emerald-400/40'
                          : 'bg-slate-900/30 text-slate-500 border border-slate-800/60 hover:border-slate-700 hover:text-slate-300'
                  } ${hasHoliday ? 'opacity-60' : ''}`}
                >
                  <span>{label}</span>
                  <span className={`text-[9px] font-medium ${isSelected ? 'text-violet-400' : isTodayDate ? 'text-sky-400' : 'text-slate-500'}`}>
                    {formatDateShort(date)}
                  </span>
                  {isTodayDate && (
                    <span className="text-[6px] px-1 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold">TODAY</span>
                  )}
                  {hasHoliday && !isTodayDate && (
                    <span className="text-[6px] px-1 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                      {dayHoliday[0].name.slice(0, 4)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status badges */}
          {selectedSportId && (
            <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-slate-800/60">
              {trainingDays.length > 0 ? (
                isTrainingDay ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Training Day — {DAY_FULL[selectedDateDayOfWeek]}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    Non-training Day — {DAY_FULL[selectedDateDayOfWeek]}
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                  ⚠️ No training schedule set
                </span>
              )}
              {hasHolidayConflict && holidaysOnSelectedDate.map((h) => (
                <span
                  key={h.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold"
                >
                  🔴 Holiday — {h.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-sm">{success}</div>
      )}

      {/* Main content area */}
      <div className={`${mobileView === 'report' ? 'hidden md:block' : ''}`}>
        {/* Empty states */}
        {assignedSports.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
            No sports clubs assigned to your coach account yet.
          </div>
        ) : loading ? (
          <div className="glass-panel rounded-xl p-12 text-center text-slate-500">
            <span className="w-6 h-6 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin inline-block"></span>
            <p className="mt-3 text-sm">Loading students...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
            No students registered for this sport yet.{' '}
            <a href="/coach/add-student" className="text-violet-400 hover:underline">Add a student</a>
          </div>
        ) : (
          /* ── Bulk Attendance Table ── */
          <div className="glass-panel border border-slate-800/60 rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-slate-800/60">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search students..."
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {filteredPlayers.length} of {players.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllPresent}
                  className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-semibold rounded-lg text-xs transition-all border border-emerald-500/20"
                >
                  ✅ Mark All Present
                </button>
                <button
                  onClick={openRecapDrawer}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-all border border-slate-700/50 flex items-center gap-1.5"
                >
                  👥 Recap
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-all shadow-lg shadow-violet-600/10 flex items-center gap-1.5"
                >
                  {saving ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    '💾'
                  )}
                  {saving ? 'Saving...' : 'Save All'}
                </button>
              </div>
            </div>

            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/30">
              <div className="col-span-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</div>
              <div className="col-span-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-800/40 max-h-[600px] overflow-y-auto">
              {filteredPlayers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No students match your search.
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const rec = records[player.id];
                  const isModified = modifiedPlayers.has(player.id);
                  const isSaved = rec?.id;
                  const colors = rec ? statusColor(rec.status) : statusColor('present');

                  return (
                    <div
                      key={player.id}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 transition-colors ${
                        isModified ? 'bg-violet-500/5' : 'hover:bg-slate-900/30'
                      }`}
                    >
                      {/* Mobile: student name row */}
                      <div className="md:col-span-4 flex items-center justify-between md:justify-start">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`}></span>
                          <span className="text-sm font-medium text-white">{player.full_name}</span>
                        </div>
                        <div className="flex md:hidden items-center gap-1.5">
                          {isModified && <span className="text-[9px] text-violet-400 font-bold">●</span>}
                          {isSaved && !isModified && <span className="text-[9px] text-emerald-400 font-bold">✓</span>}
                        </div>
                      </div>

                      {/* Status toggles */}
                      <div className="md:col-span-6 flex items-center gap-1.5">
                        {(['present', 'absent', 'late'] as const).map((status) => {
                          const sc = statusColor(status);
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(player.id, status)}
                              className={`flex-1 md:flex-none px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all min-h-[32px] ${
                                rec?.status === status
                                  ? `${sc.bg} ${sc.border} ${sc.text} ring-1 ${sc.active}`
                                  : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:bg-slate-700/40 hover:text-slate-300'
                              }`}
                            >
                              <span className="md:hidden">
                                {status === 'present' ? '✅' : status === 'absent' ? '❌' : '⏰'}
                              </span>
                              <span className="hidden md:inline">{status}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Actions (Notes + Report) */}
                      <div className="md:col-span-2 flex items-center justify-end gap-2">
                        {/* Notes inline editor */}
                        <div className="relative group">
                          <button
                            onClick={() => {
                              const textarea = document.getElementById(`notes-${player.id}`) as HTMLTextAreaElement;
                              if (textarea) {
                                textarea.classList.toggle('hidden');
                                if (!textarea.classList.contains('hidden')) textarea.focus();
                              }
                            }}
                            className={`text-[10px] px-2 py-1.5 rounded-lg font-semibold transition-all border ${
                              rec?.notes
                                ? 'bg-slate-700/40 border-slate-600/40 text-slate-300'
                                : 'bg-slate-800/40 border-slate-700/30 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            📝
                          </button>
                        </div>

                        {/* Report button */}
                        <button
                          onClick={() => openReport(player.id)}
                          className="text-[10px] px-2 py-1.5 rounded-lg font-semibold transition-all border bg-slate-800/40 border-slate-700/30 text-slate-500 hover:text-violet-400 hover:border-violet-500/30"
                        >
                          📊
                        </button>

                        {/* Edit indicator */}
                        {isModified && (
                          <span className="text-[9px] text-violet-400 font-bold hidden md:inline">Edited</span>
                        )}
                        {isSaved && !isModified && (
                          <span className="text-[9px] text-emerald-400 font-bold hidden md:inline">Saved</span>
                        )}
                      </div>

                      {/* Notes textarea (hidden by default, toggled by 📝) */}
                      <div className="md:col-span-12 hidden" id={`notes-${player.id}`}>
                        <AutoTextarea
                          value={rec?.notes || ''}
                          onChange={(v) => handleNotesChange(player.id, v)}
                          placeholder="Notes (reason for absence, late arrival time...)"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {filteredPlayers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60 bg-slate-900/30">
                <span className="text-[10px] text-slate-500">
                  {modifiedPlayers.size > 0
                    ? `${modifiedPlayers.size} unsaved change${modifiedPlayers.size !== 1 ? 's' : ''}`
                    : 'All changes saved'}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Present
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 ml-2"></span> Absent
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 ml-2"></span> Late
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Students Recap Drawer ── */}
      <AttendanceRecapDrawer
        isOpen={recapOpen}
        onClose={closeRecapDrawer}
        title="👥 Students Recap"
        subtitle={assignedSports.find(s => s.id === selectedSportId)?.name || ''}
        data={recapData}
        loading={recapLoading}
        error={recapError}
        sportName={assignedSports.find(s => s.id === selectedSportId)?.name || 'Unknown'}
        onRetry={openRecapDrawer}
      />

      {/* ── Report Drawer ── */}
      {reportPlayerId && (
        <>
          <div className="hidden md:block">
            {/* Backdrop (desktop) */}
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeReport} />

            {/* Drawer (desktop) */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in hidden md:flex">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">📊 Attendance Report</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {reportPlayerName}
                    <span className="text-slate-500 ml-2">• {assignedSports.find(s => s.id === selectedSportId)?.name}</span>
                  </p>
                </div>
                <button onClick={closeReport} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-lg">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <span className="w-8 h-8 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
                    <p className="mt-4 text-sm">Loading report...</p>
                  </div>
                ) : reportRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <span className="text-4xl mb-4">📭</span>
                    <p className="text-sm font-medium">No attendance records found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {reportRecords.length} record{reportRecords.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] text-slate-600">Newest first</span>
                    </div>

                    {reportRecords.map((rec) => {
                      const dateObj = new Date(rec.date + 'T00:00:00');
                      const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      const isNotesExpanded = expandedNotes.has(rec.id || '');
                      const sc = statusColor(rec.status);
                      const statusLabel = { present: 'Present', absent: 'Absent', late: 'Late' }[rec.status];

                      return (
                        <div key={rec.id || rec.date} className="rounded-xl border border-slate-800/80 overflow-hidden transition-all">
                          <button
                            onClick={() => rec.id && toggleNotes(rec.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors ${
                              rec.notes ? 'hover:bg-slate-800/40 cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <div className="flex-shrink-0 text-center w-14">
                              <div className="text-xs font-bold text-white leading-tight">{dateObj.getDate()}</div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {dayLabel} {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                              </div>
                            </div>

                            <div className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold ${sc.bg} ${sc.text}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${sc.dot}`}></span>
                              {statusLabel}
                            </div>

                            <div className="flex-1 text-right">
                              {rec.notes ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium transition-all ${
                                  isNotesExpanded ? 'text-violet-400' : 'text-slate-600'
                                }`}>
                                  {isNotesExpanded ? 'Hide notes' : 'Show notes'}
                                  <svg className={`w-3 h-3 transition-transform ${isNotesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-700 italic">No notes</span>
                              )}
                            </div>
                          </button>

                          {rec.notes && isNotesExpanded && (
                            <div className="px-4 pb-3.5 animate-fade-in">
                              <div className="ml-[3.5rem] p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-sm text-slate-300 leading-relaxed">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes</span>
                                {rec.notes}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-3 py-6">
                      <div className="flex-1 h-px bg-slate-800/60"></div>
                      <span className="text-[10px] text-slate-700 font-medium">End of records</span>
                      <div className="flex-1 h-px bg-slate-800/60"></div>
                    </div>
                  </div>
                )}
              </div>

              {!reportLoading && reportRecords.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Present: {reportRecords.filter(r => r.status === 'present').length}
                    {' · '}Absent: {reportRecords.filter(r => r.status === 'absent').length}
                    {' · '}Late: {reportRecords.filter(r => r.status === 'late').length}
                  </span>
                  <button onClick={closeReport} className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile full-screen report */}
          <div className={`md:hidden ${mobileView === 'report' ? '' : 'hidden'}`}>
            <div className="glass-panel border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">📊 Attendance Report</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{reportPlayerName}</p>
                </div>
                <button onClick={closeReport} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs">✕ Close</button>
              </div>

              {reportLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <span className="w-6 h-6 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
                  <p className="mt-3 text-sm">Loading...</p>
                </div>
              ) : reportRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm font-medium">No attendance records found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reportRecords.map((rec) => {
                    const dateObj = new Date(rec.date + 'T00:00:00');
                    const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isNotesExpanded = expandedNotes.has(rec.id || '');
                    const sc = statusColor(rec.status);
                    const statusLabel = { present: 'Present', absent: 'Absent', late: 'Late' }[rec.status];

                    return (
                      <div key={rec.id || rec.date} className="rounded-xl border border-slate-800/80 overflow-hidden">
                        <button
                          onClick={() => rec.id && toggleNotes(rec.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                            rec.notes ? 'hover:bg-slate-800/40 cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <div className="flex-shrink-0 text-center w-12">
                            <div className="text-xs font-bold text-white">{dateObj.getDate()}</div>
                            <div className="text-[9px] text-slate-500">{dayLabel}</div>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                            <span className={`inline-block w-1 h-1 rounded-full mr-1 align-middle ${sc.dot}`}></span>
                            {statusLabel}
                          </div>
                          <div className="flex-1 text-right">
                            {rec.notes ? (
                              <svg className={`w-3 h-3 inline-block transition-transform ${isNotesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            ) : null}
                          </div>
                        </button>
                        {rec.notes && isNotesExpanded && (
                          <div className="px-3 pb-3">
                            <div className="ml-12 p-2.5 rounded-lg bg-slate-800/40 text-xs text-slate-300">{rec.notes}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
