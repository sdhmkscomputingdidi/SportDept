import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { StatCard, StatCardSkeleton, ChartSkeleton, ListSkeleton, TableSkeleton } from '../shared/StatCard';
import { ErrorState, EmptyState } from '../shared/ErrorState';

interface DashboardStats {
  sportsCount: number;
  studentsCount: number;
  eventsCount: number;
  totalEventsCount: number;
  totalSessions: number;
}

interface RecentActivity {
  id: string;
  player_name: string;
  sport_name: string;
  date: string;
  status: string;
}

interface TopStudent {
  name: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

interface AttendanceByDay {
  day: string;
  present: number;
  absent: number;
  late: number;
}

interface StatusBreakdown {
  name: string;
  value: number;
  color: string;
}

const PIE_COLORS = ['#34d399', '#f87171', '#fbbf24'];

export const CoachDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    sportsCount: 0, studentsCount: 0, eventsCount: 0, totalEventsCount: 0, totalSessions: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<{ id: string; name: string; event_date: string; sport_name: string; sport_id: string }[]>([]);
  // ── Modal state ──
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false);
  const [allUpcomingEvents, setAllUpcomingEvents] = useState<{ id: string; name: string; event_date: string; sport_name: string; sport_id: string }[]>([]);
  const [upcomingModalLoading, setUpcomingModalLoading] = useState(false);
  const [upcomingSearchQuery, setUpcomingSearchQuery] = useState('');

  const [sportsModalOpen, setSportsModalOpen] = useState(false);
  const [sportSearchQuery, setSportSearchQuery] = useState('');
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [allSessions, setAllSessions] = useState<{ player_name: string; sport_name: string; date: string; status: string }[]>([]);
  const [sessionsModalLoading, setSessionsModalLoading] = useState(false);
  const [coachSessSearchQuery, setCoachSessSearchQuery] = useState('');

  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; full_name: string; sport_name: string }[]>([]);
  const [studentsModalLoading, setStudentsModalLoading] = useState(false);
  const [coachStudentSearchQuery, setCoachStudentSearchQuery] = useState('');

  const [assignedSports, setAssignedSports] = useState<{ id: string; name: string }[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [attendanceByDay, setAttendanceByDay] = useState<AttendanceByDay[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to view this dashboard.');
      setLoading(false);
      return;
    }

    try {
      // Fetch assigned sports
      const { data: sportsData } = await supabase
        .from('coaches_sports')
        .select('sports(id, name)')
        .eq('coach_id', user.id);

      const sportsList = (sportsData || []).map((item: any) => item.sports).filter(Boolean);
      setAssignedSports(sportsList);
      const sportId = sportsList[0]?.id || '';

      if (!sportId) {
        setLoading(false);
        return;
      }

      // Get all sport IDs
      const sportIds = sportsList.map((s: any) => s.id);

      const todayStr = new Date().toISOString().split('T')[0];
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      // Fetch related data
      const [{ count: studentsCount }, { count: eventsCount }, { count: totalEventsCount }, { data: attData }, { data: playersData }, upcomingData] =
        await Promise.all([
          supabase.from('players').select('*', { count: 'exact', head: true }).in('sport_id', sportIds),
          supabase.from('events').select('*', { count: 'exact', head: true }).in('sport_id', sportIds).gte('event_date', todayStr),
          supabase.from('events').select('*', { count: 'exact', head: true }).in('sport_id', sportIds),
          supabase.from('player_attendance').select('id, player_id, sport_id, date, status').in('sport_id', sportIds).gte('date', sixMonthsAgoStr),
          supabase.from('players').select('id, full_name, sport_id').in('sport_id', sportIds),
          supabase.from('events').select('id, name, event_date, sport_id').in('sport_id', sportIds).gte('event_date', todayStr).order('event_date', { ascending: true }).limit(5),
        ]);

      const attRecords = (attData || []) as any[];
      const players = (playersData || []) as any[];
      const upcomingSource = (upcomingData?.data || []) as any[];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // ── Declare all processing variables (top-level to prevent TDZ) ──
      const playerNameMap = new Map<string, string>();
      players.forEach((p: any) => playerNameMap.set(p.id, p.full_name));

      const sportNameMap = new Map<string, string>();
      sportsList.forEach((s: any) => sportNameMap.set(s.id, s.name));

      const studentAgg = new Map<string, { present: number; absent: number; late: number }>();
      const dayMap = new Map<string, { present: number; absent: number; late: number }>();
      dayNames.forEach(d => dayMap.set(d, { present: 0, absent: 0, late: 0 }));

      const topList: TopStudent[] = [];
      const sorted = [...attRecords].sort((a: any, b: any) => b.date.localeCompare(a.date));
      const recentActivityItems: RecentActivity[] = [];

      let present = 0, absent = 0, late = 0;

      // ── Process attendance records ──
      attRecords.forEach((r: any) => {
        if (!studentAgg.has(r.player_id)) {
          studentAgg.set(r.player_id, { present: 0, absent: 0, late: 0 });
        }
        const e = studentAgg.get(r.player_id)!;
        if (r.status === 'present') e.present++;
        else if (r.status === 'absent') e.absent++;
        else if (r.status === 'late') e.late++;

        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'late') late++;

        const day = dayNames[new Date(r.date + 'T00:00:00').getDay()];
        const entry = dayMap.get(day)!;
        if (r.status === 'present') entry.present++;
        else if (r.status === 'absent') entry.absent++;
        else if (r.status === 'late') entry.late++;
      });

      // ── Build top students list ──
      studentAgg.forEach((val, id) => {
        const total = val.present + val.absent + val.late;
        if (total > 0) {
          topList.push({
            name: playerNameMap.get(id) || 'Unknown', ...val, total,
            percentage: Math.round((val.present / total) * 100),
          });
        }
      });
      topList.sort((a, b) => b.percentage - a.percentage);

      // ── Build recent activity ──
      sorted.slice(0, 10).forEach((r: any) => {
        recentActivityItems.push({
          id: r.id,
          player_name: playerNameMap.get(r.player_id) || 'Unknown',
          sport_name: sportNameMap.get(r.sport_id) || 'Unknown',
          date: r.date,
          status: r.status,
        });
      });

      // ── Set all state ──
      setStats({
        sportsCount: sportsList.length,
        studentsCount: studentsCount || 0,
        eventsCount: eventsCount || 0,
        totalEventsCount: totalEventsCount || 0,
        totalSessions: attRecords.length,
      });

      setUpcomingEvents(upcomingSource.map((e: any) => ({
        id: e.id, name: e.name, event_date: e.event_date,
        sport_name: sportNameMap.get(e.sport_id) || '',
        sport_id: e.sport_id,
      })));

      setRecentActivity(recentActivityItems);
      setTopStudents(topList.slice(0, 5));
      setAttendanceByDay(dayNames.map(d => ({ day: d, ...dayMap.get(d)! })));

      const total = present + absent + late;
      setStatusBreakdown(
        total > 0
          ? [
              { name: 'Present', value: Math.round((present / total) * 100), color: '#34d399' },
              { name: 'Absent', value: Math.round((absent / total) * 100), color: '#f87171' },
              { name: 'Late', value: Math.round((late / total) * 100), color: '#fbbf24' },
            ]
          : []
      );
    } catch (err) {
      console.warn('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openSportsModal = useCallback(() => {
    setSportsModalOpen(true);
    setSportSearchQuery('');
  }, []);

  const openStudentsModal = useCallback(async () => {
    setStudentsModalOpen(true);
    setCoachStudentSearchQuery('');
    setStudentsModalLoading(true);
    try {
      const sportIds = assignedSports.map(s => s.id);
      if (sportIds.length === 0) { setAllStudents([]); return; }
      const { data } = await supabase
        .from('players')
        .select('id, full_name, sport_id')
        .in('sport_id', sportIds)
        .order('full_name', { ascending: true });
      const sportNameMap = new Map(assignedSports.map(s => [s.id, s.name]));
      setAllStudents((data || []).map((p: any) => ({
        id: p.id, full_name: p.full_name || 'Unknown',
        sport_name: sportNameMap.get(p.sport_id) || '',
      })));
    } catch (err) {
      console.warn('Failed to fetch students:', err);
    } finally {
      setStudentsModalLoading(false);
    }
  }, [assignedSports]);

  const openSessionsModal = useCallback(async () => {
    setSessionsModalOpen(true);
    setCoachSessSearchQuery('');
    setSessionsModalLoading(true);
    try {
      const sportIds = assignedSports.map(s => s.id);
      if (sportIds.length === 0) { setAllSessions([]); return; }
      const { data } = await supabase
        .from('player_attendance')
        .select(`
          date, status, player_id, sport_id,
          player_info:players!player_id(full_name)
        `)
        .in('sport_id', sportIds)
        .order('date', { ascending: false })
        .limit(50);
      const sportNameMap = new Map(assignedSports.map(s => [s.id, s.name]));
      setAllSessions((data || []).map((r: any) => ({
        player_name: r.player_info?.full_name || 'Unknown',
        sport_name: sportNameMap.get(r.sport_id) || 'Unknown',
        date: r.date,
        status: r.status,
      })));
    } catch (err) {
      console.warn('Failed to fetch sessions:', err);
    } finally {
      setSessionsModalLoading(false);
    }
  }, [assignedSports]);

  const openUpcomingModal = useCallback(async () => {
    setUpcomingModalOpen(true);
    setUpcomingSearchQuery('');
    setUpcomingModalLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const sportIds = assignedSports.map(s => s.id);
      if (sportIds.length === 0) {
        setAllUpcomingEvents([]);
        return;
      }
      const { data } = await supabase
        .from('events')
        .select('id, name, event_date, sport_id')
        .in('sport_id', sportIds)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true });
      const sportNameMap = new Map(assignedSports.map(s => [s.id, s.name]));
      setAllUpcomingEvents((data || []).map((e: any) => ({
        id: e.id, name: e.name, event_date: e.event_date,
        sport_name: sportNameMap.get(e.sport_id) || '',
        sport_id: e.sport_id,
      })));
    } catch (err) {
      console.warn('Failed to fetch upcoming events:', err);
    } finally {
      setUpcomingModalLoading(false);
    }
  }, [assignedSports]);

  const cards = [
    { label: 'Sports', value: stats.sportsCount, icon: '📊', color: 'violet' as const, onClick: openSportsModal },
    { label: 'Students', value: stats.studentsCount, icon: '🏃', color: 'emerald' as const, onClick: openStudentsModal },
    { label: 'Upcoming Events', value: stats.eventsCount, icon: '📅', color: 'amber' as const, total: stats.totalEventsCount, onClick: openUpcomingModal },
    { label: 'Sessions', value: stats.totalSessions, icon: '🎯', color: 'cyan' as const, onClick: openSessionsModal },
  ];

  // --- Loading state with skeletons ---
  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">🏠 Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Welcome back! Loading your overview...</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Skeleton charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
            <div className="w-48 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
            <ChartSkeleton />
          </div>
          <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
            <div className="w-48 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
            <ChartSkeleton />
          </div>
        </div>

        {/* Skeleton top students */}
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <div className="w-36 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
          <ListSkeleton rows={5} />
        </div>

        {/* Skeleton table */}
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <div className="w-44 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
          <TableSkeleton rows={5} cols={4} />
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">🏠 Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Welcome back!</p>
        </div>
        <div className="glass-panel border border-slate-800/60 rounded-xl">
          <ErrorState
            title="Failed to load dashboard"
            message={error}
            onRetry={fetchAll}
          />
        </div>
      </div>
    );
  }

  // --- No sports assigned ---
  if (assignedSports.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">🏠 Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Welcome, Coach!</p>
        </div>
        <div className="glass-panel rounded-xl">
          <EmptyState
            icon="📭"
            title="No sports assigned"
            message="No sports are assigned to your coach account yet. Contact your admin to get set up."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">🏠 Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">Welcome back! Here's your overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📊 Student Attendance by Day</h3>
          {attendanceByDay.some(d => d.present + d.absent + d.late > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByDay} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  />
                  <Bar dataKey="present" name="Present" fill="#34d399" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#fbbf24" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon="📊" message="No attendance data to show charts yet" />
          )}
        </div>

        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🍩 Student Attendance Breakdown</h3>
          {statusBreakdown.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-52 w-52 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {statusBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      formatter={(value) => `${value}%`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {statusBreakdown.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
                    <span className="text-slate-400">{s.name}</span>
                    <span className="text-white font-bold">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="🍩" message="No attendance data to show breakdown yet" />
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📅 Upcoming Events</h3>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-2">
            {upcomingEvents.map((evt) => (
              <Link key={evt.id} to={`/coach/events/${evt.sport_id}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 transition-all">
                <div>
                  <p className="text-sm font-medium text-white">{evt.name}</p>
                  {evt.sport_name && <p className="text-[10px] text-slate-500">{evt.sport_name}</p>}
                </div>
                <span className="text-[11px] text-slate-400">{evt.event_date}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon="📅" message="No upcoming events" />
        )}
      </div>

      {/* Top Students */}
      <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🏆 Top Students by Attendance</h3>
        {topStudents.length > 0 ? (
          <div className="space-y-2">
            {topStudents.map((student, idx) => (
              <div key={student.name} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/30">
                <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{student.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    <span className="text-emerald-400">✅ {student.present}</span>
                    <span className="text-red-400">❌ {student.absent}</span>
                    <span className="text-amber-400">⏰ {student.late}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${
                    student.percentage >= 80 ? 'text-emerald-400' : student.percentage >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>{student.percentage}%</p>
                  <p className="text-[9px] text-slate-600">{student.total} sessions</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="🏆" message="No attendance data yet" />
        )}
      </div>

      {/* Recent Activity */}
      <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🕐 Recent Student Attendance</h3>
        {recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sport</th>
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((act) => (
                  <tr key={act.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="py-2.5 text-sm text-white">{act.player_name}</td>
                    <td className="py-2.5 text-sm text-slate-400">{act.sport_name}</td>
                    <td className="py-2.5 text-sm text-slate-400">{act.date}</td>
                    <td className="py-2.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${
                        act.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' :
                        act.status === 'absent' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>{act.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🕐" message="No recent activity" />
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {assignedSports.slice(0, 4).map((sport) => (
          <Link
            key={sport.id}
            to={`/coach/attendance/${sport.id}`}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:bg-slate-700/40 hover:border-violet-500/30 text-slate-300 hover:text-white transition-all text-sm font-medium"
          >
            <span>📋</span>
            <div>
              <p className="text-sm font-medium text-white">{sport.name}</p>
              <p className="text-[10px] text-slate-500">Take attendance</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Sports Modal ── */}
      {sportsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSportsModalOpen(false); setSportSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">📊 My Sports</h3>
              <button onClick={() => { setSportsModalOpen(false); setSportSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search sports..."
                  value={sportSearchQuery}
                  onChange={(e) => setSportSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {sportSearchQuery && (
                  <button onClick={() => setSportSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {(() => {
                const filtered = assignedSports.filter(s =>
                  s.name.toLowerCase().includes(sportSearchQuery.toLowerCase())
                );
                return filtered.length > 0 ? (
                  <div className="space-y-1.5">
                    {filtered.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30">
                        <span className="text-lg">⚽</span>
                        <p className="text-sm font-medium text-white">{s.name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="text-slate-400 text-sm">{sportSearchQuery ? `No sports match "${sportSearchQuery}"` : 'No sports assigned yet'}</p>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to="/coach/attendance" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setSportsModalOpen(false); setSportSearchQuery(''); }}>Take Attendance →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Students Modal ── */}
      {studentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setStudentsModalOpen(false); setCoachStudentSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">🏃 My Students</h3>
              <button onClick={() => { setStudentsModalOpen(false); setCoachStudentSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students or sports..."
                  value={coachStudentSearchQuery}
                  onChange={(e) => setCoachStudentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {coachStudentSearchQuery && (
                  <button onClick={() => setCoachStudentSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {studentsModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allStudents.length > 0 ? (
                <>
                  {(() => {
                    const filtered = allStudents.filter(s =>
                      s.full_name.toLowerCase().includes(coachStudentSearchQuery.toLowerCase()) ||
                      (s.sport_name && s.sport_name.toLowerCase().includes(coachStudentSearchQuery.toLowerCase()))
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-1.5">
                        {filtered.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                            <p className="text-sm font-medium text-white">{s.full_name}</p>
                            {s.sport_name && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">{s.sport_name}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-slate-400 text-sm">No students match "{coachStudentSearchQuery}"</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">No students yet</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to={assignedSports[0] ? `/coach/attendance/${assignedSports[0].id}` : '#'} className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setStudentsModalOpen(false); setCoachStudentSearchQuery(''); }}>Take Attendance →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions Modal ── */}
      {sessionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSessionsModalOpen(false); setCoachSessSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">🎯 Recent Sessions</h3>
              <button onClick={() => { setSessionsModalOpen(false); setCoachSessSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by student, sport, or status..."
                  value={coachSessSearchQuery}
                  onChange={(e) => setCoachSessSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {coachSessSearchQuery && (
                  <button onClick={() => setCoachSessSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {sessionsModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allSessions.length > 0 ? (
                <>
                  {(() => {
                    const q = coachSessSearchQuery.toLowerCase();
                    const filtered = allSessions.filter(r =>
                      r.player_name.toLowerCase().includes(q) ||
                      r.sport_name.toLowerCase().includes(q) ||
                      r.status.toLowerCase().includes(q) ||
                      r.date.includes(q)
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-1.5">
                        {filtered.map((r, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{r.player_name}</p>
                              <p className="text-[10px] text-slate-500">{r.sport_name} · {r.date}</p>
                            </div>
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${
                              r.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' :
                              r.status === 'absent' ? 'bg-red-500/10 text-red-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>{r.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-slate-400 text-sm">No sessions match "{coachSessSearchQuery}"</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">No sessions recorded yet</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to={assignedSports[0] ? `/coach/attendance/${assignedSports[0].id}` : '#'} className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setSessionsModalOpen(false); setCoachSessSearchQuery(''); }}>Take Attendance →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Upcoming Events Modal ── */}
      {upcomingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setUpcomingModalOpen(false); setUpcomingSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">📅 Upcoming Events</h3>
              <button onClick={() => { setUpcomingModalOpen(false); setUpcomingSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search events or sports..."
                  value={upcomingSearchQuery}
                  onChange={(e) => setUpcomingSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {upcomingSearchQuery && (
                  <button onClick={() => setUpcomingSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {upcomingModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allUpcomingEvents.length > 0 ? (
                <>
                  {(() => {
                    const q = upcomingSearchQuery.toLowerCase();
                    const filtered = allUpcomingEvents.filter(e =>
                      e.name.toLowerCase().includes(q) ||
                      (e.sport_name && e.sport_name.toLowerCase().includes(q))
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-2">
                        {filtered.map((evt) => {
                          const daysUntil = Math.ceil((new Date(evt.event_date + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          return (
                            <Link key={evt.id} to={`/coach/events/${evt.sport_id}?eventId=${evt.id}`} onClick={() => setUpcomingModalOpen(false)} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 transition-all">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{evt.name}</p>
                                {evt.sport_name && <p className="text-[10px] text-slate-500">{evt.sport_name}</p>}
                              </div>
                              <div className="text-right flex-shrink-0 ml-4">
                                <p className="text-sm text-slate-300">{evt.event_date}</p>
                                <p className="text-[10px] font-semibold text-amber-400">
                                  {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-slate-400 text-sm">No events match "{upcomingSearchQuery}"</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">No upcoming events</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to="/coach/events" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setUpcomingModalOpen(false); setUpcomingSearchQuery(''); }}>View All Events →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
