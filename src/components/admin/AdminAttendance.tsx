import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Sport {
  id: string;
  name: string;
}

interface Coach {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  coach_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes: string;
  id?: string;
}

interface Holiday {
  id: string;
  name: string;
  sport_id: string | null;
  description: string | null;
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

export const AdminAttendance: React.FC = () => {
  const { sportId: urlSportId } = useParams<{ sportId?: string }>();

  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoachIndex, setSelectedCoachIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Training schedule state
  const [trainingDays, setTrainingDays] = useState<number[]>([]);
  const [holidaysOnWeek, setHolidaysOnWeek] = useState<Holiday[]>([]);

  // Week navigation
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceDate, setAttendanceDate] = useState(todayStr);
  const [selectedDayIdx, setSelectedDayIdx] = useState(today.getDay());

  // Compute Monday of the offset week
  const getMonday = (offset: number) => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    return d;
  };
  const monday = getMonday(weekOffset);

  // Build 7 dates for this week (Sun=0 ... Sat=6)
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
  const toDateStr = (date: Date) =>
    date.toISOString().split('T')[0];
  const isToday = (date: Date) => toDateStr(date) === todayStr;

  // Compute week range label
  const weekLabel = `${formatDateShort(weekDates[1])} – ${formatDateShort(weekDates[6])}`;

  // Selected date day-of-week
  const selectedDateDayOfWeek = new Date(attendanceDate + 'T00:00:00').getDay();
  const isTrainingDay = trainingDays.includes(selectedDateDayOfWeek);

  // Holidays filtered for the selected date
  const holidaysOnSelectedDate = holidaysOnWeek.filter(
    h => h.date === attendanceDate
  );
  const hasHolidayConflict = holidaysOnSelectedDate.length > 0;

  // Attendance records keyed by coach_id
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});

  // Report state
  const [reportCoachId, setReportCoachId] = useState<string | null>(null);
  const [reportCoachName, setReportCoachName] = useState('');
  const [reportRecords, setReportRecords] = useState<AttendanceRecord[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Students attendance recap state
  const [studentsCoachId, setStudentsCoachId] = useState<string | null>(null);
  const [studentsCoachName, setStudentsCoachName] = useState('');
  const [studentsData, setStudentsData] = useState<StudentAttendanceSummary[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsSearchQuery, setStudentsSearchQuery] = useState('');
  const [studentsSortBy, setStudentsSortBy] = useState<'name' | 'absent'>('name');

  // ── Data fetching ────────────────────────────────────────

  const fetchSports = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('sports')
        .select('id, name')
        .order('name');

      if (fetchErr) throw fetchErr;
      setSports(data || []);
      if (data && data.length > 0) {
        setSelectedSportId(prev => {
          const matchFromUrl = urlSportId && data.find((s) => s.id === urlSportId);
          return matchFromUrl ? urlSportId : (prev || data[0].id);
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sports.');
    }
  };

  const fetchTrainingInfo = async () => {
    if (!selectedSportId) return;
    try {
      // Fetch training days for this sport
      const { data: tdData } = await supabase
        .from('sport_training_days')
        .select('day_of_week')
        .eq('sport_id', selectedSportId);

      setTrainingDays((tdData || []).map((d: any) => d.day_of_week));

      // Fetch holidays for this entire week (global + sport-specific)
      const weekStart = toDateStr(weekDates[0]);
      const weekEnd = toDateStr(weekDates[6]);
      const { data: holData } = await supabase
        .from('holidays')
        .select('id, name, sport_id, description, date')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .or(`sport_id.is.null,sport_id.eq.${selectedSportId}`);

      setHolidaysOnWeek(holData || []);
    } catch (err) {
      console.warn('Failed to fetch training info:', err);
    }
  };

  const fetchCoaches = async () => {
    if (!selectedSportId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('coaches_sports')
        .select(`
          coach_id,
          profiles:profiles!coaches_sports_coach_id_fkey (
            id,
            full_name
          )
        `)
        .eq('sport_id', selectedSportId);

      if (fetchErr) throw fetchErr;

      const coachList: Coach[] = (data || [])
        .map((item: any) => item.profiles)
        .filter((p: any) => p !== null);

      // Remove duplicates
      const seen = new Set<string>();
      const uniqueCoaches: Coach[] = [];
      coachList.forEach((c: Coach) => {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          uniqueCoaches.push(c);
        }
      });

      uniqueCoaches.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setCoaches(uniqueCoaches);
      setSelectedCoachIndex(0);

      // Fetch existing attendance records for the selected date
      if (uniqueCoaches.length > 0) {
        const coachIds = uniqueCoaches.map(c => c.id);
        const { data: attData, error: attErr } = await supabase
          .from('coach_attendance')
          .select('id, coach_id, date, status, notes')
          .eq('sport_id', selectedSportId)
          .eq('date', attendanceDate)
          .in('coach_id', coachIds);

        if (attErr) throw attErr;

        const recordMap: Record<string, AttendanceRecord> = {};
        (attData || []).forEach((rec: any) => {
          recordMap[rec.coach_id] = {
            coach_id: rec.coach_id,
            date: rec.date,
            status: rec.status,
            notes: rec.notes || '',
            id: rec.id,
          };
        });

        uniqueCoaches.forEach((coach) => {
          if (!recordMap[coach.id]) {
            recordMap[coach.id] = {
              coach_id: coach.id,
              date: attendanceDate,
              status: 'present',
              notes: '',
            };
          }
        });

        setRecords(recordMap);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch coaches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSports();
  }, [urlSportId]);

  useEffect(() => {
    if (selectedSportId) {
      fetchTrainingInfo();
    }
  }, [selectedSportId, weekOffset]);

  useEffect(() => {
    if (selectedSportId) {
      setCoaches([]);
      setRecords({});
      setSelectedCoachIndex(0);
      fetchCoaches();
    }
  }, [selectedSportId, attendanceDate]);

  // ── Handlers ─────────────────────────────────────────────

  const handleSportChange = (sportId: string) => {
    setSelectedSportId(sportId);
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

  const handleStatusChange = (coachId: string, status: 'present' | 'absent' | 'late') => {
    setRecords(prev => ({
      ...prev,
      [coachId]: { ...prev[coachId], status },
    }));
  };

  const handleNotesChange = (coachId: string, notes: string) => {
    setRecords(prev => ({
      ...prev,
      [coachId]: { ...prev[coachId], notes },
    }));
  };

  const handleSave = async (coachId: string) => {
    const record = records[coachId];
    if (!record) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        coach_id: coachId,
        sport_id: selectedSportId,
        date: record.date,
        status: record.status,
        notes: record.notes || null,
      };

      if (record.id) {
        const { error: updateErr } = await supabase
          .from('coach_attendance')
          .update(payload)
          .eq('id', record.id);

        if (updateErr) throw updateErr;
      } else {
        const { data, error: insertErr } = await supabase
          .from('coach_attendance')
          .insert(payload)
          .select('id')
          .single();

        if (insertErr) throw insertErr;

        setRecords(prev => ({
          ...prev,
          [coachId]: { ...prev[coachId], id: data.id },
        }));
      }

      setSuccess(`Attendance saved for ${coaches.find(c => c.id === coachId)?.full_name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCoach = coaches[selectedCoachIndex];
  const currentRecord = selectedCoach ? records[selectedCoach.id] : null;

  // Check if this week has the current today
  const isCurrentWeek = weekOffset === 0;

  // ── Report handlers ──────────────────────────────────────

  const openReport = async (coachId: string) => {
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) return;
    setReportCoachId(coachId);
    setReportCoachName(coach.full_name);
    setExpandedNotes(new Set());
    setReportLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('coach_attendance')
        .select('id, coach_id, date, status, notes')
        .eq('coach_id', coachId)
        .eq('sport_id', selectedSportId)
        .order('date', { ascending: false });

      if (fetchErr) throw fetchErr;
      const mapped: AttendanceRecord[] = (data || []).map((r: any) => ({
        coach_id: r.coach_id,
        date: r.date,
        status: r.status,
        notes: r.notes || '',
        id: r.id,
      }));
      setReportRecords(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report.');
      setReportCoachId(null);
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setReportCoachId(null);
    setReportRecords([]);
    setExpandedNotes(new Set());
  };

  const toggleNotes = (recordId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  // ── Students drawer handlers ────────────────────────────

  const openStudentsDrawer = async (coachId: string) => {
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) return;
    setStudentsCoachId(coachId);
    setStudentsCoachName(coach.full_name);
    setStudentsSearchQuery('');
    setStudentsSortBy('name');
    setStudentsLoading(true);

    try {
      // Fetch all players for this sport
      const { data: playersData, error: playersErr } = await supabase
        .from('players')
        .select('id, full_name')
        .eq('sport_id', selectedSportId);

      if (playersErr) throw playersErr;
      const players = playersData || [];

      if (players.length === 0) {
        setStudentsData([]);
        setStudentsLoading(false);
        return;
      }

      // Fetch aggregated attendance for all players in this sport
      const playerIds = players.map(p => p.id);
      const { data: attData, error: attErr } = await supabase
        .from('player_attendance')
        .select('player_id, status')
        .eq('sport_id', selectedSportId)
        .in('player_id', playerIds);

      if (attErr) throw attErr;

      // Aggregate attendance per player
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

      // Build summary array
      const summary: StudentAttendanceSummary[] = players.map(p => {
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

      setStudentsData(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch student attendance.');
      setStudentsCoachId(null);
    } finally {
      setStudentsLoading(false);
    }
  };

  const closeStudentsDrawer = () => {
    setStudentsCoachId(null);
    setStudentsData([]);
    setStudentsSearchQuery('');
  };

  const exportStudentsCsv = () => {
    if (studentsData.length === 0) return;

    const sportName = sports.find(s => s.id === selectedSportId)?.name || 'Unknown';
    const rows = [
      ['Student Name', 'Present', 'Absent', 'Late', 'Total Sessions', 'Attendance %'],
      ...studentsData.map(s => [
        s.full_name,
        String(s.present_count),
        String(s.absent_count),
        String(s.late_count),
        String(s.total),
        `${s.percentage}%`,
      ]),
    ];

    const csvContent = '\uFEFF' + rows
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-attendance-${sportName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">
            📋 Coach Attendance
          </h2>
          <p className="text-sm text-slate-400">
            {formatDateFull(today)}
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

      {/* Week Navigation + Day Selector */}
      {selectedSportId && (
        <div className="glass-panel border border-slate-800/60 rounded-xl p-4">
          {/* Week toolbar */}
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

          {/* Day-of-week bar (clickable) */}
          <div className="flex gap-2">
            {DAY_LABELS.map((label, idx) => {
              const date = weekDates[idx];
              const dateStr = toDateStr(date);
              const isSelected = dateStr === attendanceDate;
              const isTDay = trainingDays.includes(idx);
              const dayHoliday = holidaysOnWeek.filter(
                h => h.date === dateStr
              );
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
                  <span className={`text-[9px] font-medium ${
                    isSelected ? 'text-violet-400' : isTodayDate ? 'text-sky-400' : 'text-slate-500'
                  }`}>
                    {formatDateShort(date)}
                  </span>
                  {isTodayDate && (
                    <span className="text-[6px] px-1 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold">
                      TODAY
                    </span>
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
              {trainingDays.length > 0 && (
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
              )}
              {trainingDays.length === 0 && (
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
                  {h.sport_id && (
                    <span className="text-[10px] text-red-400/70 ml-1">
                      ({sports.find(s => s.id === h.sport_id)?.name})
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
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

      {/* Empty states */}
      {sports.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
          No sports clubs configured. Please add a sport first.
        </div>
      ) : loading ? (
        <div className="glass-panel rounded-xl p-12 text-center text-slate-500">
          <span className="w-6 h-6 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin inline-block"></span>
          <p className="mt-3 text-sm">Loading coaches...</p>
        </div>
      ) : coaches.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
          No coaches assigned to this sport for {formatDateFull(new Date(attendanceDate + 'T00:00:00'))}.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coach Tabs (Left Side) */}
          <div className="lg:col-span-3 glass-panel border border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Coaches ({coaches.length})
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">
                {formatDateShort(weekDates[selectedDayIdx])}
              </span>
            </div>
            <div className="space-y-1">
              {coaches.map((coach, idx) => {
                const rec = records[coach.id];
                const isSaved = rec?.id;
                return (
                  <button
                    key={coach.id}
                    onClick={() => setSelectedCoachIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                      selectedCoachIndex === idx
                        ? 'bg-violet-600/20 text-violet-300 border-l-2 border-violet-500'
                        : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-medium truncate">{coach.full_name}</span>
                    {isSaved && (
                      <span className="text-[10px] text-emerald-400 font-semibold ml-2 flex-shrink-0">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coach Attendance Form (Right Side) */}
          <div className="lg:col-span-9 glass-panel border border-slate-800/60 rounded-xl p-6">
            {selectedCoach && currentRecord ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedCoach.full_name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {sports.find(s => s.id === selectedSportId)?.name}
                      {' • '}
                      {formatDateFull(new Date(attendanceDate + 'T00:00:00'))}
                      {isTrainingDay && <span className="text-emerald-400 ml-2">• Training Day</span>}
                    </p>
                  </div>
                  {currentRecord.id && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded font-semibold">
                      Saved
                    </span>
                  )}
                </div>

                {/* Status Radio */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Attendance Status
                  </label>
                  <div className="flex gap-4">
                    {(['present', 'absent', 'late'] as const).map((status) => (
                      <label
                        key={status}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm font-medium ${
                          currentRecord.status === status
                            ? status === 'present'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : status === 'absent'
                                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`status-${selectedCoach.id}`}
                          checked={currentRecord.status === status}
                          onChange={() => handleStatusChange(selectedCoach.id, status)}
                          className="accent-violet-500"
                        />
                        <span className="capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Notes Textarea */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Notes
                  </label>
                  <AutoTextarea
                    value={currentRecord.notes}
                    onChange={(v) => handleNotesChange(selectedCoach.id, v)}
                    placeholder="Optional notes about attendance..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSave(selectedCoach.id)}
                    disabled={saving}
                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-violet-600/10 flex items-center gap-2"
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      '💾'
                    )}
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                  <button
                    onClick={() => openReport(selectedCoach.id)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-sm transition-all border border-slate-700/50 flex items-center gap-2"
                  >
                    📊 Report
                  </button>
                  <button
                    onClick={() => openStudentsDrawer(selectedCoach.id)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-sm transition-all border border-slate-700/50 flex items-center gap-2"
                  >
                    👥 Students
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                Select a coach from the left panel to fill attendance.
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Attendance Report Drawer ── */}
      {reportCoachId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={closeReport}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">📊 Attendance Report</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  {reportCoachName}
                  {selectedSportId && (
                    <span className="text-slate-500 ml-2">
                      • {sports.find(s => s.id === selectedSportId)?.name}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closeReport}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-lg"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
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
                  <p className="text-xs text-slate-600 mt-1">
                    Attendance entries will appear here once recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {reportRecords.length} record{reportRecords.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      Newest first
                    </span>
                  </div>

                  {reportRecords.map((rec) => {
                    const dateObj = new Date(rec.date + 'T00:00:00');
                    const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isNotesExpanded = expandedNotes.has(rec.id || '');

                    const statusConfig = {
                      present: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Present' },
                      absent: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Absent' },
                      late: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Late' },
                    }[rec.status];

                    return (
                      <div
                        key={rec.id || rec.date}
                        className="rounded-xl border border-slate-800/80 overflow-hidden transition-all"
                      >
                        {/* Main row — clickable */}
                        <button
                          onClick={() => rec.id && toggleNotes(rec.id)}
                          className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors ${
                            rec.notes
                              ? 'hover:bg-slate-800/40 cursor-pointer'
                              : 'cursor-default'
                          }`}
                        >
                          {/* Date column */}
                          <div className="flex-shrink-0 text-center w-14">
                            <div className="text-xs font-bold text-white leading-tight">
                              {dateObj.getDate()}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {dayLabel} {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                          </div>

                          {/* Status badge */}
                          <div className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold ${statusConfig.bg} ${statusConfig.text}`}>
                            <span className={"inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle " + statusConfig.dot}></span>
                            {statusConfig.label}
                          </div>

                          {/* Notes indicator */}
                          <div className="flex-1 text-right">
                            {rec.notes ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium transition-all ${
                                isNotesExpanded ? 'text-violet-400' : 'text-slate-600'
                              }`}>
                                {isNotesExpanded ? 'Hide notes' : 'Show notes'}
                                <svg
                                  className={`w-3 h-3 transition-transform ${isNotesExpanded ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-700 italic">No notes</span>
                            )}
                          </div>
                        </button>

                        {/* Expandable notes */}
                        {rec.notes && isNotesExpanded && (
                          <div className="px-4 pb-3.5 animate-fade-in">
                            <div className="ml-[3.5rem] p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-sm text-slate-300 leading-relaxed">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Notes
                              </span>
                              {rec.notes}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* End marker */}
                  <div className="flex items-center gap-3 py-6">
                    <div className="flex-1 h-px bg-slate-800/60"></div>
                    <span className="text-[10px] text-slate-700 font-medium">End of records</span>
                    <div className="flex-1 h-px bg-slate-800/60"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {!reportLoading && reportRecords.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Present: {reportRecords.filter(r => r.status === 'present').length}
                  {' · '}Absent: {reportRecords.filter(r => r.status === 'absent').length}
                  {' · '}Late: {reportRecords.filter(r => r.status === 'late').length}
                </span>
                <button
                  onClick={closeReport}
                  className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Students Attendance Recap Drawer ── */}
      {studentsCoachId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={closeStudentsDrawer}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">👥 Students Attendance</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Coach: {studentsCoachName}
                  {selectedSportId && (
                    <span className="text-slate-500 ml-2">
                      • {sports.find(s => s.id === selectedSportId)?.name}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportStudentsCsv}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CSV
                </button>
                <button
                  onClick={closeStudentsDrawer}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {studentsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <span className="w-8 h-8 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
                  <p className="mt-4 text-sm">Loading student attendance...</p>
                </div>
              ) : studentsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <span className="text-4xl mb-4">📭</span>
                  <p className="text-sm font-medium">No students assigned</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Add students to this sport to see attendance data.
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary card */}
                  <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        📈 Class Summary
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {studentsData.length} student{studentsData.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="text-sm font-bold text-emerald-300">{studentsData.reduce((s, p) => s + p.present_count, 0)}</span>
                        <span className="text-[10px] text-slate-500">Present</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        <span className="text-sm font-bold text-red-300">{studentsData.reduce((s, p) => s + p.absent_count, 0)}</span>
                        <span className="text-[10px] text-slate-500">Absent</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-sm font-bold text-amber-300">{studentsData.reduce((s, p) => s + p.late_count, 0)}</span>
                        <span className="text-[10px] text-slate-500">Late</span>
                      </div>
                    </div>
                    {studentsData.some(p => p.total > 0) && (() => {
                      const totalPresent = studentsData.reduce((s, p) => s + p.present_count, 0);
                      const totalSessions = studentsData.reduce((s, p) => s + p.total, 0);
                      const avgPct = Math.round((totalPresent / totalSessions) * 100);
                      return (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Avg attendance</span>
                            <span className="text-violet-300 font-bold">
                              {avgPct}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
                              style={{ width: `${avgPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Search + Sort */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={studentsSearchQuery}
                        onChange={(e) => setStudentsSearchQuery(e.target.value)}
                        placeholder="Search students..."
                        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                    <select
                      value={studentsSortBy}
                      onChange={(e) => setStudentsSortBy(e.target.value as 'name' | 'absent')}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition-colors"
                    >
                      <option value="name">Name</option>
                      <option value="absent">Most absent</option>
                    </select>
                  </div>

                  {/* Filtered & sorted students */}
                  <div className="space-y-2">
                    {(() => {
                      let filtered = studentsData.filter(p =>
                        p.full_name.toLowerCase().includes(studentsSearchQuery.toLowerCase())
                      );

                      if (studentsSortBy === 'absent') {
                        filtered = [...filtered].sort((a, b) => b.absent_count - a.absent_count);
                      } else {
                        filtered = [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name));
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <span className="text-2xl mb-2">🔍</span>
                            <p className="text-sm font-medium">No students match your search</p>
                            <p className="text-xs text-slate-600 mt-1">
                              Try a different name.
                            </p>
                          </div>
                        );
                      }

                      return filtered.map((student) => {
                        const absentRate = student.total > 0
                          ? Math.round((student.absent_count / student.total) * 100)
                          : 0;
                        const presentRate = student.total > 0
                          ? Math.round((student.present_count / student.total) * 100)
                          : 0;
                        const lateRate = student.total > 0
                          ? Math.round((student.late_count / student.total) * 100)
                          : 0;

                        return (
                          <div
                            key={student.player_id}
                            className="rounded-xl border border-slate-800/80 p-4 hover:bg-slate-800/30 transition-colors"
                          >
                            {/* Name row */}
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-sm font-semibold text-white">
                                {student.full_name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] font-bold">
                                <span className="text-emerald-400">✅ {student.present_count}</span>
                                <span className="text-red-400">❌ {student.absent_count}</span>
                                <span className="text-amber-400">⏰ {student.late_count}</span>
                              </div>
                            </div>

                            {/* Visual attendance bar */}
                            {student.total > 0 && (
                              <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden flex">
                                <div
                                  className="h-full bg-emerald-500 transition-all"
                                  title={`Present: ${presentRate}%`}
                                  style={{ width: `${presentRate}%` }}
                                />
                                <div
                                  className="h-full bg-amber-500 transition-all"
                                  title={`Late: ${lateRate}%`}
                                  style={{ width: `${lateRate}%` }}
                                />
                                <div
                                  className="h-full bg-red-500 transition-all"
                                  title={`Absent: ${absentRate}%`}
                                  style={{ width: `${absentRate}%` }}
                                />
                              </div>
                            )}

                            {/* Percentage label */}
                            {student.total > 0 && (
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[10px] text-slate-600">
                                  {student.total} session{student.total !== 1 ? 's' : ''}
                                </span>
                                <span className={`text-[10px] font-bold ${
                                  student.percentage >= 80 ? 'text-emerald-400' :
                                  student.percentage >= 60 ? 'text-amber-400' :
                                  'text-red-400'
                                }`}>
                                  {student.percentage}%
                                </span>
                              </div>
                            )}

                            {/* No data yet */}
                            {student.total === 0 && (
                              <div className="mt-1.5">
                                <span className="text-[10px] text-slate-600 italic">
                                  No attendance records yet
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* End marker */}
                  <div className="flex items-center gap-3 py-6">
                    <div className="flex-1 h-px bg-slate-800/60"></div>
                    <span className="text-[10px] text-slate-700 font-medium">End of students</span>
                    <div className="flex-1 h-px bg-slate-800/60"></div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            {!studentsLoading && studentsData.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {studentsData.length} student{studentsData.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={closeStudentsDrawer}
                  className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
