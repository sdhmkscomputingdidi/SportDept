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
  eventsCount: number;
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
    sportsCount: 0, coachesCount: 0, playersCount: 0, eventsCount: 0,
    totalAttendance: 0, recentSessions: 0,
  });
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
      const [
        { count: sportsCount },
        { count: coachesCount },
        { count: playersCount },
        { count: eventsCount },
        { count: attendanceCount },
        { count: sessionsCount },
        recentData,
        coachAttData,
        playerAttData,
      ] = await Promise.all([
        supabase.from('sports').select('*', { count: 'exact', head: true }),
        supabase.from('coaches_sports').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }),
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
        supabase.from('coach_attendance').select('coach_id, date, status'),
        supabase.from('player_attendance').select('player_id, date, status'),
      ]);

      setStats({
        sportsCount: sportsCount || 0,
        coachesCount: coachesCount || 0,
        playersCount: playersCount || 0,
        eventsCount: eventsCount || 0,
        totalAttendance: (attendanceCount || 0) + (sessionsCount || 0),
        recentSessions: sessionsCount || 0,
      });

      // Recent activity
      const activity: RecentActivity[] = (recentData?.data || []).map((r: any) => ({
        id: r.id,
        coach_name: r.profiles?.full_name || 'Unknown',
        sport_name: r.sports?.name || 'Unknown',
        date: r.date,
        status: r.status,
      }));
      setRecentActivity(activity);

      // Coach attendance aggregation
      const coachAttRecords = (coachAttData?.data || []) as any[];
      const coachAgg = new Map<string, { present: number; absent: number; late: number }>();
      const coachNameMap = new Map<string, string>();

      const allCoachIds = [...new Set(coachAttRecords.map((r: any) => r.coach_id))];
      if (allCoachIds.length > 0) {
        const { data: coachProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allCoachIds);
        (coachProfiles || []).forEach((p: any) => coachNameMap.set(p.id, p.full_name));
      }

      coachAttRecords.forEach((r: any) => {
        if (!coachAgg.has(r.coach_id)) {
          coachAgg.set(r.coach_id, { present: 0, absent: 0, late: 0 });
        }
        const e = coachAgg.get(r.coach_id)!;
        if (r.status === 'present') e.present++;
        else if (r.status === 'absent') e.absent++;
        else if (r.status === 'late') e.late++;
      });

      const topCoachList: TopPerformer[] = [];
      coachAgg.forEach((val, id) => {
        const total = val.present + val.absent + val.late;
        if (total > 0) {
          topCoachList.push({
            name: coachNameMap.get(id) || 'Unknown',
            ...val,
            total,
            percentage: Math.round((val.present / total) * 100),
          });
        }
      });
      topCoachList.sort((a, b) => b.percentage - a.percentage);
      setTopCoaches(topCoachList.slice(0, 5));

      // Student attendance aggregation
      const playerAttRecords = (playerAttData?.data || []) as any[];
      const playerAgg = new Map<string, { present: number; absent: number; late: number }>();
      const playerNameMap = new Map<string, string>();

      const allPlayerIds = [...new Set(playerAttRecords.map((r: any) => r.player_id))];
      if (allPlayerIds.length > 0) {
        const { data: playerProfiles } = await supabase
          .from('players')
          .select('id, full_name')
          .in('id', allPlayerIds);
        (playerProfiles || []).forEach((p: any) => playerNameMap.set(p.id, p.full_name));
      }

      playerAttRecords.forEach((r: any) => {
        if (!playerAgg.has(r.player_id)) {
          playerAgg.set(r.player_id, { present: 0, absent: 0, late: 0 });
        }
        const e = playerAgg.get(r.player_id)!;
        if (r.status === 'present') e.present++;
        else if (r.status === 'absent') e.absent++;
        else if (r.status === 'late') e.late++;
      });

      const topStudentList: TopPerformer[] = [];
      playerAgg.forEach((val, id) => {
        const total = val.present + val.absent + val.late;
        if (total > 0) {
          topStudentList.push({
            name: playerNameMap.get(id) || 'Unknown',
            ...val,
            total,
            percentage: Math.round((val.present / total) * 100),
          });
        }
      });
      topStudentList.sort((a, b) => b.percentage - a.percentage);
      setTopStudents(topStudentList.slice(0, 5));

      // Attendance by day of week
      const dayMap = new Map<string, { present: number; absent: number; late: number }>();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dayNames.forEach(d => dayMap.set(d, { present: 0, absent: 0, late: 0 }));

      coachAttRecords.forEach((r: any) => {
        const day = dayNames[new Date(r.date + 'T00:00:00').getDay()];
        const entry = dayMap.get(day)!;
        if (r.status === 'present') entry.present++;
        else if (r.status === 'absent') entry.absent++;
        else if (r.status === 'late') entry.late++;
      });

      setAttendanceByDay(dayNames.map(d => ({ day: d, ...dayMap.get(d)! })));

      // Status breakdown
      let totalPresent = 0, totalAbsent = 0, totalLate = 0;
      coachAttRecords.forEach((r: any) => {
        if (r.status === 'present') totalPresent++;
        else if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;
      });
      playerAttRecords.forEach((r: any) => {
        if (r.status === 'present') totalPresent++;
        else if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;
      });

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

  const cards = [
    { label: 'Sports', value: stats.sportsCount, icon: '📊', color: 'violet' as const, link: '/admin/sports' },
    { label: 'Coaches', value: stats.coachesCount, icon: '👔', color: 'blue' as const, link: '/admin/coaches' },
    { label: 'Students', value: stats.playersCount, icon: '🏃', color: 'emerald' as const, link: '/admin/players' },
    { label: 'Events', value: stats.eventsCount, icon: '📅', color: 'amber' as const, link: '/admin/events' },
    { label: 'Coach Attendance', value: stats.totalAttendance, icon: '📋', color: 'rose' as const, link: '/admin/attendance' },
    { label: 'Student Sessions', value: stats.recentSessions, icon: '🎯', color: 'cyan' as const, link: '/admin/attendance' },
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
    </div>
  );
};
