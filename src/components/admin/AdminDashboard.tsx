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
  coachesCount: number;
  playersCount: number;
  unassignedCount: number;
  eventsCount: number;
  totalEventsCount: number;
  totalAttendance: number;
  recentSessions: number;
}

interface RecentActivity {
  id: string;
  coach_name: string;
  sport_name: string;
  date: string;
  status: string;
}

interface TopPerformer {
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

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    sportsCount: 0, coachesCount: 0, playersCount: 0, unassignedCount: 0, eventsCount: 0,
    totalEventsCount: 0,
    totalAttendance: 0, recentSessions: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<{ id: string; name: string; event_date: string; sport_name: string }[]>([]);
  // ── Modal state ──
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false);
  const [allUpcomingEvents, setAllUpcomingEvents] = useState<{ id: string; name: string; event_date: string; sport_id: string; sport_name: string }[]>([]);
  const [upcomingModalLoading, setUpcomingModalLoading] = useState(false);
  const [upcomingSearchQuery, setUpcomingSearchQuery] = useState('');

  const [sportsModalOpen, setSportsModalOpen] = useState(false);
  const [allSports, setAllSports] = useState<{ id: string; name: string; coaches: string[] }[]>([]);
  const [sportsModalLoading, setSportsModalLoading] = useState(false);
  const [sportSearchQuery, setSportSearchQuery] = useState('');

  const [coachesModalOpen, setCoachesModalOpen] = useState(false);
  const [allCoaches, setAllCoaches] = useState<{ id: string; full_name: string; sports: string[] }[]>([]);
  const [coachesModalLoading, setCoachesModalLoading] = useState(false);
  const [coachSearchQuery, setCoachSearchQuery] = useState('');

  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; name: string; count: number }[]>([]);
  const [studentsModalLoading, setStudentsModalLoading] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const [coachAttModalOpen, setCoachAttModalOpen] = useState(false);
  const [allCoachAtt, setAllCoachAtt] = useState<{ coach_name: string; sport_name: string; date: string; status: string }[]>([]);
  const [coachAttModalLoading, setCoachAttModalLoading] = useState(false);
  const [coachAttSearchQuery, setCoachAttSearchQuery] = useState('');

  const [studentSessModalOpen, setStudentSessModalOpen] = useState(false);
  const [allStudentSess, setAllStudentSess] = useState<{ player_name: string; sport_name: string; date: string; status: string }[]>([]);
  const [studentSessModalLoading, setStudentSessModalLoading] = useState(false);
  const [studentSessSearchQuery, setStudentSessSearchQuery] = useState('');

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [topCoaches, setTopCoaches] = useState<TopPerformer[]>([]);
  const [topStudents, setTopStudents] = useState<TopPerformer[]>([]);
  const [attendanceByDay, setAttendanceByDay] = useState<AttendanceByDay[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
      const [
        { count: sportsCount },
        { count: coachesCount },
        { count: playersCount },
        { count: unassignedCount },
        { count: eventsCount },
        { count: totalEventsCount },
        { count: attendanceCount },
        { count: sessionsCount },
        recentData,
        coachAttData,
        playerAttData,
        upcomingData,
      ] = await Promise.all([
        supabase.from('sports').select('*', { count: 'exact', head: true }),
        supabase.from('coaches_sports').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }).is('sport_id', null),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('event_date', todayStr),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('coach_attendance').select('*', { count: 'exact', head: true }),
        supabase.from('player_attendance').select('*', { count: 'exact', head: true }),
        supabase
          .from('coach_attendance')
          .select(`id, date, status, coach_id, sport_id,
            profiles:coach_id(full_name),
            sports:coach_attendance_sport_id_fkey(name)
          `)
          .order('date', { ascending: false })
          .limit(10),
        supabase.from('coach_attendance').select('coach_id, date, status, coach_name:profiles!coach_id(full_name)').gte('date', sixMonthsAgoStr),
        supabase.from('player_attendance').select('player_id, date, status, player_info:players!player_id(full_name)').gte('date', sixMonthsAgoStr),
        supabase.from('events').select('id, name, event_date, sports(name)').gte('event_date', todayStr).order('event_date', { ascending: true }).limit(5),
      ]);

      // ── Extract records from query results ──
      const activitySource = (recentData?.data || []) as any[];
      const coachAttRecords = (coachAttData?.data || []) as any[];
      const playerAttRecords = (playerAttData?.data || []) as any[];
      const upcomingSource = (upcomingData?.data || []) as any[];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // ── Declare all processing variables (top-level to prevent TDZ) ──
      const coachAgg = new Map<string, { present: number; absent: number; late: number }>();
      const coachNameMap = new Map<string, string>();
      const playerAgg = new Map<string, { present: number; absent: number; late: number }>();
      const playerNameMap = new Map<string, string>();
      const dayMap = new Map<string, { present: number; absent: number; late: number }>();
      dayNames.forEach(d => dayMap.set(d, { present: 0, absent: 0, late: 0 }));

      const topCoachList: TopPerformer[] = [];
      const topStudentList: TopPerformer[] = [];
      const activity: RecentActivity[] = [];

      let totalPresent = 0, totalAbsent = 0, totalLate = 0;

      // ── Process recent activity ──
      activitySource.forEach((r: any) => {
        activity.push({
          id: r.id,
          coach_name: r.profiles?.full_name || 'Unknown',
          sport_name: r.sports?.name || 'Unknown',
          date: r.date,
          status: r.status,
        });
      });

      // ── Process coach attendance ──
      coachAttRecords.forEach((r: any) => {
        if (!coachNameMap.has(r.coach_id)) {
          coachNameMap.set(r.coach_id, r.coach_name?.full_name || 'Unknown');
        }
        if (!coachAgg.has(r.coach_id)) {
          coachAgg.set(r.coach_id, { present: 0, absent: 0, late: 0 });
        }
        const e = coachAgg.get(r.coach_id)!;
        if (r.status === 'present') e.present++;
        else if (r.status === 'absent') e.absent++;
        else if (r.status === 'late') e.late++;

        if (r.status === 'present') totalPresent++;
        else if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;

        const day = dayNames[new Date(r.date + 'T00:00:00').getDay()];
        const entry = dayMap.get(day)!;
        if (r.status === 'present') entry.present++;
        else if (r.status === 'absent') entry.absent++;
        else if (r.status === 'late') entry.late++;
      });

      // ── Process player attendance ──
      playerAttRecords.forEach((r: any) => {
        if (!playerNameMap.has(r.player_id)) {
          playerNameMap.set(r.player_id, r.player_info?.full_name || 'Unknown');
        }
        if (!playerAgg.has(r.player_id)) {
          playerAgg.set(r.player_id, { present: 0, absent: 0, late: 0 });
        }
        const e = playerAgg.get(r.player_id)!;
        if (r.status === 'present') e.present++;
        else if (r.status === 'absent') e.absent++;
        else if (r.status === 'late') e.late++;

        if (r.status === 'present') totalPresent++;
        else if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;
      });

      // ── Build top performer lists ──
      coachAgg.forEach((val, id) => {
        const total = val.present + val.absent + val.late;
        if (total > 0) {
          topCoachList.push({
            name: coachNameMap.get(id) || 'Unknown', ...val, total,
            percentage: Math.round((val.present / total) * 100),
          });
        }
      });
      topCoachList.sort((a, b) => b.percentage - a.percentage);

      playerAgg.forEach((val, id) => {
        const total = val.present + val.absent + val.late;
        if (total > 0) {
          topStudentList.push({
            name: playerNameMap.get(id) || 'Unknown', ...val, total,
            percentage: Math.round((val.present / total) * 100),
          });
        }
      });
      topStudentList.sort((a, b) => b.percentage - a.percentage);

      // ── Set all state ──
      setStats({
        sportsCount: sportsCount || 0,
        coachesCount: coachesCount || 0,
        playersCount: playersCount || 0,
        unassignedCount: unassignedCount || 0,
        eventsCount: eventsCount || 0,
        totalEventsCount: totalEventsCount || 0,
        totalAttendance: (attendanceCount || 0) + (sessionsCount || 0),
        recentSessions: sessionsCount || 0,
      });

      setUpcomingEvents(upcomingSource.map((e: any) => ({
        id: e.id, name: e.name, event_date: e.event_date,
        sport_name: e.sports?.name || '',
      })));

      setRecentActivity(activity);
      setTopCoaches(topCoachList.slice(0, 5));
      setTopStudents(topStudentList.slice(0, 5));
      setAttendanceByDay(dayNames.map(d => ({ day: d, ...dayMap.get(d)! })));

      const total = totalPresent + totalAbsent + totalLate;
      setStatusBreakdown(
        total > 0
          ? [
              { name: 'Present', value: Math.round((totalPresent / total) * 100), color: '#34d399' },
              { name: 'Absent', value: Math.round((totalAbsent / total) * 100), color: '#f87171' },
              { name: 'Late', value: Math.round((totalLate / total) * 100), color: '#fbbf24' },
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

  const openUpcomingModal = useCallback(async () => {
    setUpcomingModalOpen(true);
    setUpcomingSearchQuery('');
    setUpcomingModalLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('id, name, event_date, sport_id, sports(name)')
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true });
      setAllUpcomingEvents((data || []).map((e: any) => ({
        id: e.id, name: e.name, event_date: e.event_date, sport_id: e.sport_id,
        sport_name: e.sports?.name || '',
      })));
    } catch (err) {
      console.warn('Failed to fetch upcoming events:', err);
    } finally {
      setUpcomingModalLoading(false);
    }
  }, []);

  const openSportsModal = useCallback(async () => {
    setSportsModalOpen(true);
    setSportSearchQuery('');
    setSportsModalLoading(true);
    try {
      const { data: sportsData } = await supabase.from('sports').select('id, name').order('name', { ascending: true });
      const { data: csData } = await supabase
        .from('coaches_sports')
        .select('sport_id, profiles!coaches_sports_coach_id_fkey(full_name)');
      const coachMap = new Map<string, string[]>();
      (csData || []).forEach((cs: any) => {
        if (!coachMap.has(cs.sport_id)) coachMap.set(cs.sport_id, []);
        if (cs.profiles?.full_name) coachMap.get(cs.sport_id)!.push(cs.profiles.full_name);
      });
      setAllSports((sportsData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        coaches: coachMap.get(s.id) || [],
      })));
    } catch (err) {
      console.warn('Failed to fetch sports:', err);
    } finally {
      setSportsModalLoading(false);
    }
  }, []);

  const openCoachesModal = useCallback(async () => {
    setCoachesModalOpen(true);
    setCoachSearchQuery('');
    setCoachesModalLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('role', 'coach').order('full_name', { ascending: true });
      const coachIds = (profiles || []).map(p => p.id);
      if (coachIds.length === 0) {
        setAllCoaches([]);
        return;
      }
      const { data: csData } = await supabase
        .from('coaches_sports')
        .select('coach_id, sports(name)')
        .in('coach_id', coachIds);
      const sportMap = new Map<string, string[]>();
      (csData || []).forEach((cs: any) => {
        if (!sportMap.has(cs.coach_id)) sportMap.set(cs.coach_id, []);
        if (cs.sports?.name) sportMap.get(cs.coach_id)!.push(cs.sports.name);
      });
      setAllCoaches((profiles || []).map(p => ({
        id: p.id, full_name: p.full_name || 'Unknown',
        sports: sportMap.get(p.id) || [],
      })));
    } catch (err) {
      console.warn('Failed to fetch coaches:', err);
    } finally {
      setCoachesModalLoading(false);
    }
  }, []);

  const openStudentsModal = useCallback(async () => {
    setStudentsModalOpen(true);
    setStudentSearchQuery('');
    setStudentsModalLoading(true);
    try {
      // Lightweight query: fetch sports with player counts instead of all individual students
      const { data: sportsData } = await supabase
        .from('sports')
        .select(`id, name, players(count)`)
        .order('name', { ascending: true });
      const { count: unassignedCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .is('sport_id', null);
      const list: { id: string; name: string; count: number }[] = (sportsData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        count: s.players?.[0]?.count || 0,
      }));
      if (unassignedCount && unassignedCount > 0) {
        list.push({ id: '', name: 'Unassigned', count: unassignedCount });
      }
      setAllStudents(list);
    } catch (err) {
      console.warn('Failed to fetch students:', err);
      // Fallback: still try to show something meaningful
      try {
        const { data: fallback } = await supabase.from('sports').select('id, name').order('name');
        setAllStudents((fallback || []).map((s: any) => ({ id: s.id, name: s.name, count: 0 })));
      } catch {}
    } finally {
      setStudentsModalLoading(false);
    }
  }, []);

  const openCoachAttModal = useCallback(async () => {
    setCoachAttModalOpen(true);
    setCoachAttSearchQuery('');
    setCoachAttModalLoading(true);
    try {
      const { data } = await supabase
        .from('coach_attendance')
        .select(`
          date, status,
          profiles:coach_id(full_name),
          sports:coach_attendance_sport_id_fkey(name)
        `)
        .order('date', { ascending: false })
        .limit(50);
      setAllCoachAtt((data || []).map((r: any) => ({
        coach_name: r.profiles?.full_name || 'Unknown',
        sport_name: r.sports?.name || 'Unknown',
        date: r.date,
        status: r.status,
      })));
    } catch (err) {
      console.warn('Failed to fetch coach attendance:', err);
    } finally {
      setCoachAttModalLoading(false);
    }
  }, []);

  const openStudentSessModal = useCallback(async () => {
    setStudentSessModalOpen(true);
    setStudentSessSearchQuery('');
    setStudentSessModalLoading(true);
    try {
      const { data: sportList } = await supabase.from('sports').select('id, name');
      const sportNameMap = new Map((sportList || []).map((s: any) => [s.id, s.name]));
      const { data } = await supabase
        .from('player_attendance')
        .select(`
          date, status, sport_id,
          player_info:players!player_id(full_name)
        `)
        .order('date', { ascending: false })
        .limit(50);
      setAllStudentSess((data || []).map((r: any) => ({
        player_name: r.player_info?.full_name || 'Unknown',
        sport_name: sportNameMap.get(r.sport_id) || 'Unknown',
        date: r.date,
        status: r.status,
      })));
    } catch (err) {
      console.warn('Failed to fetch student sessions:', err);
    } finally {
      setStudentSessModalLoading(false);
    }
  }, []);

  const cards = [
    { label: 'Sports', value: stats.sportsCount, icon: '📊', color: 'violet' as const, onClick: openSportsModal },
    { label: 'Coaches', value: stats.coachesCount, icon: '👔', color: 'blue' as const, onClick: openCoachesModal },
    { label: 'Students', value: stats.unassignedCount, icon: '🏃', color: 'emerald' as const, total: stats.playersCount, onClick: openStudentsModal },
    { label: 'Upcoming Events', value: stats.eventsCount, icon: '📅', color: 'amber' as const, total: stats.totalEventsCount, onClick: openUpcomingModal },
    { label: 'Coach Attendance', value: stats.totalAttendance, icon: '📋', color: 'rose' as const, onClick: openCoachAttModal },
    { label: 'Student Sessions', value: stats.recentSessions, icon: '🎯', color: 'cyan' as const, onClick: openStudentSessModal },
  ];

  const quickActions = [
    { label: 'Add New Sport', icon: '➕', link: '/admin/sports' },
    { label: 'Assign Coach', icon: '👔', link: '/admin/coaches' },
    { label: 'Register Student', icon: '🏃', link: '/admin/players' },
    { label: 'Create Event', icon: '📅', link: '/admin/events' },
    { label: 'Training Schedule', icon: '⚙️', link: '/admin/training-schedule' },
    { label: 'Manage Holidays', icon: '🎉', link: '/admin/holidays' },
  ];

  // --- Loading state with skeletons ---
  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">🏠 Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Overview of your sports department</p>
        </div>

        {/* Skeleton stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Skeleton quick actions */}
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <div className="w-32 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-700/30 animate-pulse" />
            ))}
          </div>
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

        {/* Skeleton top performers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
            <div className="w-36 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
            <ListSkeleton rows={5} />
          </div>
          <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
            <div className="w-36 h-3 rounded bg-slate-700/50 mb-4 animate-pulse" />
            <ListSkeleton rows={5} />
          </div>
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
          <p className="text-sm text-slate-400 mt-1">Overview of your sports department</p>
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">🏠 Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">Overview of your sports department</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.link}
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:bg-slate-700/40 hover:border-violet-500/30 text-slate-300 hover:text-white transition-all text-sm font-medium"
            >
              <span>{action.icon}</span><span>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📊 Attendance by Day of Week</h3>
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
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🍩 Overall Attendance Breakdown</h3>
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

      {/* Top Performers Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🏆 Top Coaches by Attendance</h3>
          {topCoaches.length > 0 ? (
            <div className="space-y-2">
              {topCoaches.map((coach, idx) => (
                <div key={coach.name} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/30">
                  <span className="w-6 h-6 rounded-full bg-violet-600/30 text-violet-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{coach.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span className="text-emerald-400">✅ {coach.present}</span>
                      <span className="text-red-400">❌ {coach.absent}</span>
                      <span className="text-amber-400">⏰ {coach.late}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${
                      coach.percentage >= 80 ? 'text-emerald-400' : coach.percentage >= 60 ? 'text-amber-400' : 'text-red-400'
                    }`}>{coach.percentage}%</p>
                    <p className="text-[9px] text-slate-600">{coach.total} sessions</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🏆" message="No coach attendance data yet" />
          )}
        </div>

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
            <EmptyState icon="🏆" message="No student attendance data yet" />
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📅 Upcoming Events</h3>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-2">
            {upcomingEvents.map((evt) => (
              <Link key={evt.id} to="/admin/events" className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 transition-all">
                <div>
                  <p className="text-sm font-medium text-white">{evt.name}</p>
                  <p className="text-[10px] text-slate-500">{evt.sport_name}</p>
                </div>
                <span className="text-[11px] text-slate-400">{evt.event_date}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon="📅" message="No upcoming events" />
        )}
      </div>

      {/* Recent Activity */}
      <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🕐 Recent Coach Attendance Activity</h3>
        {recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coach</th>
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sport</th>
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((act) => (
                  <tr key={act.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="py-2.5 text-sm text-white">{act.coach_name}</td>
                    <td className="py-2.5 text-sm text-slate-400">{act.sport_name}</td>
                    <td className="py-2.5 text-sm text-slate-400">{act.date}</td>
                    <td className="py-2.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${
                        act.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' :
                        act.status === 'absent' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {act.status}
                      </span>
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

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📈 At a Glance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-sm text-slate-400">Total Students</span>
              <span className="text-lg font-bold text-white">{stats.playersCount}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-sm text-slate-400">Assigned Coaches</span>
              <span className="text-lg font-bold text-white">{stats.coachesCount}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-sm text-slate-400">Active Sports</span>
              <span className="text-lg font-bold text-white">{stats.sportsCount}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Upcoming Events</span>
              <span className="text-lg font-bold text-white">{stats.eventsCount}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel border border-slate-800/60 rounded-xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📋 Attendance Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-sm text-slate-400">Total Attendance Records</span>
              <span className="text-lg font-bold text-white">{stats.totalAttendance}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-sm text-slate-400">Student Sessions Recorded</span>
              <span className="text-lg font-bold text-white">{stats.recentSessions}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Per-student avg</span>
              <span className="text-lg font-bold text-white">
                {stats.playersCount > 0 ? Math.round(stats.recentSessions / stats.playersCount) : 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sports Modal ── */}
      {sportsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSportsModalOpen(false); setSportSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">📊 Sports</h3>
              <button onClick={() => { setSportsModalOpen(false); setSportSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search input */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search sports or coaches..."
                  value={sportSearchQuery}
                  onChange={(e) => setSportSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {sportSearchQuery && (
                  <button
                    onClick={() => setSportSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {sportsModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allSports.length > 0 ? (
                <>
                  {(() => {
                    const filtered = allSports.filter(s =>
                      s.name.toLowerCase().includes(sportSearchQuery.toLowerCase()) ||
                      s.coaches.some(c => c.toLowerCase().includes(sportSearchQuery.toLowerCase()))
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-1.5">
                        {filtered.map((s) => (
                          <div key={s.id} className="p-3 rounded-lg bg-slate-800/30">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">⚽</span>
                              <p className="text-sm font-medium text-white">{s.name}</p>
                              <span className="ml-auto text-[10px] text-slate-500">{s.coaches.length} coach{s.coaches.length !== 1 ? 'es' : ''}</span>
                            </div>
                            {s.coaches.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                                {s.coaches.map((coach) => (
                                  <span key={coach} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                                    👔 {coach}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-slate-400 text-sm">No sports match "{sportSearchQuery}"</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">No sports yet</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to="/admin/sports" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setSportsModalOpen(false); setSportSearchQuery(''); }}>Manage Sports →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Coaches Modal ── */}
      {coachesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setCoachesModalOpen(false); setCoachSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">👔 Coaches</h3>
              <button onClick={() => { setCoachesModalOpen(false); setCoachSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search coaches or sports..."
                  value={coachSearchQuery}
                  onChange={(e) => setCoachSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {coachSearchQuery && (
                  <button onClick={() => setCoachSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {coachesModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allCoaches.length > 0 ? (
                <>
                  {(() => {
                    const filtered = allCoaches.filter(c =>
                      c.full_name.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
                      c.sports.some(s => s.toLowerCase().includes(coachSearchQuery.toLowerCase()))
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-1.5">
                        {filtered.map((c) => (
                          <div key={c.id} className="p-3 rounded-lg bg-slate-800/30">
                            <p className="text-sm font-medium text-white">{c.full_name}</p>
                            {c.sports.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {c.sports.map((s) => (
                                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-slate-400 text-sm">No coaches match "{coachSearchQuery}"</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">No coaches yet</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to="/admin/coaches" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setCoachesModalOpen(false); setCoachSearchQuery(''); }}>Manage Coaches →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Students Modal ── */}
      {studentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setStudentsModalOpen(false); setStudentSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">🏃 Students by Sport</h3>
              <button onClick={() => { setStudentsModalOpen(false); setStudentSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search sports..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {studentSearchQuery && (
                  <button onClick={() => setStudentSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
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
                    const q = studentSearchQuery.toLowerCase();
                    const filtered = allStudents.filter(s =>
                      s.name.toLowerCase().includes(q)
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-1.5">
                        {filtered.map((s) =>
                          s.id ? (
                            <Link
                              key={s.id}
                              to={`/admin/players/${s.id}`}
                              onClick={() => { setStudentsModalOpen(false); setStudentSearchQuery(''); }}
                              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">🏃</span>
                                <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">{s.name}</p>
                              </div>
                              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold">
                                {s.count} student{s.count !== 1 ? 's' : ''}
                              </span>
                            </Link>
                          ) : (
                            <div key="unassigned" className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 opacity-70">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">📋</span>
                                <p className="text-sm font-medium text-slate-400">{s.name}</p>
                              </div>
                              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-400 font-semibold">
                                {s.count} student{s.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-slate-400 text-sm">No sports match "{studentSearchQuery}"</p>
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
              <Link to="/admin/players" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setStudentsModalOpen(false); setStudentSearchQuery(''); }}>Manage Students →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Coach Attendance Modal ── */}
      {coachAttModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setCoachAttModalOpen(false); setCoachAttSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">📋 Coach Attendance</h3>
              <button onClick={() => { setCoachAttModalOpen(false); setCoachAttSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by coach, sport, or status..."
                  value={coachAttSearchQuery}
                  onChange={(e) => setCoachAttSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {coachAttSearchQuery && (
                  <button onClick={() => setCoachAttSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {coachAttModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allCoachAtt.length > 0 ? (
                <>
                  {(() => {
                    const q = coachAttSearchQuery.toLowerCase();
                    const filtered = allCoachAtt.filter(r =>
                      r.coach_name.toLowerCase().includes(q) ||
                      r.sport_name.toLowerCase().includes(q) ||
                      r.status.toLowerCase().includes(q) ||
                      r.date.includes(q)
                    );
                    return filtered.length > 0 ? (
                      <div className="space-y-1.5">
                        {filtered.map((r, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{r.coach_name}</p>
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
                        <p className="text-slate-400 text-sm">No records match "{coachAttSearchQuery}"</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">No attendance records yet</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800/60 flex justify-end">
              <Link to="/admin/attendance" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setCoachAttModalOpen(false); setCoachAttSearchQuery(''); }}>View Attendance →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Sessions Modal ── */}
      {studentSessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setStudentSessModalOpen(false); setStudentSessSearchQuery(''); }} />
          <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">🎯 Student Sessions</h3>
              <button onClick={() => { setStudentSessModalOpen(false); setStudentSessSearchQuery(''); }} className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm">✕</button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by student, sport, or status..."
                  value={studentSessSearchQuery}
                  onChange={(e) => setStudentSessSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                {studentSessSearchQuery && (
                  <button onClick={() => setStudentSessSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-5 pt-2">
              {studentSessModalLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/30 animate-pulse" />)}
                </div>
              ) : allStudentSess.length > 0 ? (
                <>
                  {(() => {
                    const q = studentSessSearchQuery.toLowerCase();
                    const filtered = allStudentSess.filter(r =>
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
                        <p className="text-slate-400 text-sm">No sessions match "{studentSessSearchQuery}"</p>
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
              <Link to="/admin/attendance" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setStudentSessModalOpen(false); setStudentSessSearchQuery(''); }}>View Attendance →</Link>
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
                            <Link key={evt.id} to={`/admin/events/${evt.sport_id}?eventId=${evt.id}`} onClick={() => setUpcomingModalOpen(false)} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 transition-all">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{evt.name}</p>
                                <p className="text-[10px] text-slate-500">{evt.sport_name}</p>
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
              <Link to="/admin/events" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-all" onClick={() => { setUpcomingModalOpen(false); setUpcomingSearchQuery(''); }}>View All Events →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
