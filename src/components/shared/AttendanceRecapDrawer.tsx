import React, { useState } from 'react';
import { ListSkeleton } from './StatCard';
import { ErrorState, EmptyState } from './ErrorState';

interface StudentAttendanceSummary {
  player_id: string;
  full_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total: number;
  percentage: number;
}

interface DetailedAttendanceRecord {
  player_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

interface AttendanceRecapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle: string;
  data: StudentAttendanceSummary[];
  detailedRecords?: DetailedAttendanceRecord[];
  loading: boolean;
  error: string | null;
  sportName: string;
  onRetry?: () => void;
}

export const AttendanceRecapDrawer: React.FC<AttendanceRecapDrawerProps> = ({
  isOpen,
  onClose,
  title = '👥 Students Attendance',
  subtitle,
  data,
  detailedRecords,
  loading,
  error,
  sportName,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'absent'>('name');

  // Reset search/sort when drawer opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSortBy('name');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Summary CSV (original) ──
  const exportCsvSummary = () => {
    if (data.length === 0) return;

    const rows = [
      ['Student Name', 'Present', 'Absent', 'Late', 'Total Sessions', 'Attendance %'],
      ...data.map(s => [
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

  // ── Detailed matrix CSV (new) ──
  const exportCsvDetailed = () => {
    if (!detailedRecords || detailedRecords.length === 0 || data.length === 0) return;

    // Collect all unique dates, sorted oldest to newest
    const allDates = [...new Set(detailedRecords.map(r => r.date))].sort();

    if (allDates.length === 0) return;

    // Build header row: Sport | Student Name | Date1 | Date2 | ... | Present | Absent | Late | %
    const headers = ['Sport', 'Student Name', ...allDates, 'Present', 'Absent', 'Late', 'Attendance %'];

    // For each student, build their status per date + summary stats
    const rows: string[][] = [headers];

    data.forEach(student => {
      const row: string[] = [sportName, student.full_name];

      // Find status for each date
      const studentRecords = detailedRecords.filter(r => r.player_id === student.player_id);
      const recordByDate: Record<string, string> = {};
      studentRecords.forEach(r => {
        recordByDate[r.date] = r.status;
      });

      // Fill date cells
      allDates.forEach(date => {
        const status = recordByDate[date];
        if (status === 'present') row.push('P');
        else if (status === 'absent') row.push('A');
        else if (status === 'late') row.push('L');
        else row.push('');
      });

      // Add summary columns
      row.push(String(student.present_count));
      row.push(String(student.absent_count));
      row.push(String(student.late_count));
      row.push(`${student.percentage}%`);

      rows.push(row);
    });

    const csvContent = '\uFEFF' + rows
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-attendance-detailed-${sportName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={exportCsvSummary}
                disabled={data.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 hover:text-white transition-all text-[10px] font-semibold flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Summary
              </button>
              {detailedRecords && detailedRecords.length > 0 && (
                <button
                  onClick={exportCsvDetailed}
                  className="px-2.5 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 hover:text-violet-300 transition-all text-[10px] font-semibold flex items-center gap-1 border border-violet-500/20"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Dates
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              {/* Skeleton summary card */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 animate-pulse">
                <div className="w-28 h-3 rounded bg-slate-700/50 mb-3" />
                <div className="flex gap-4">
                  <div className="w-16 h-4 rounded bg-slate-700/50" />
                  <div className="w-16 h-4 rounded bg-slate-700/50" />
                  <div className="w-16 h-4 rounded bg-slate-700/50" />
                </div>
              </div>
              <ListSkeleton rows={8} />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <ErrorState
              title="Failed to load students"
              message={error}
              onRetry={onRetry}
            />
          )}

          {/* Empty state */}
          {!loading && !error && data.length === 0 && (
            <EmptyState
              icon="📭"
              title="No students assigned"
              message="Add students to this sport to see attendance data."
            />
          )}

          {/* Data */}
          {!loading && !error && data.length > 0 && (
            <>
              {/* Summary card */}
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    📈 Class Summary
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {data.length} student{data.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-sm font-bold text-emerald-300">{data.reduce((s, p) => s + p.present_count, 0)}</span>
                    <span className="text-[10px] text-slate-500">Present</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span className="text-sm font-bold text-red-300">{data.reduce((s, p) => s + p.absent_count, 0)}</span>
                    <span className="text-[10px] text-slate-500">Absent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span className="text-sm font-bold text-amber-300">{data.reduce((s, p) => s + p.late_count, 0)}</span>
                    <span className="text-[10px] text-slate-500">Late</span>
                  </div>
                </div>
                {data.some(p => p.total > 0) && (() => {
                  const totalPresent = data.reduce((s, p) => s + p.present_count, 0);
                  const totalSessions = data.reduce((s, p) => s + p.total, 0);
                  const avgPct = Math.round((totalPresent / totalSessions) * 100);
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Avg attendance</span>
                        <span className="text-violet-300 font-bold">{avgPct}%</span>
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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search students..."
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'absent')}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="name">Name</option>
                  <option value="absent">Most absent</option>
                </select>
              </div>

              {/* Student rows */}
              <div className="space-y-2">
                {(() => {
                  let filtered = data.filter(p =>
                    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (sortBy === 'absent') {
                    filtered = [...filtered].sort((a, b) => b.absent_count - a.absent_count);
                  } else {
                    filtered = [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name));
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <span className="text-2xl mb-2">🔍</span>
                        <p className="text-sm font-medium">No students match your search</p>
                        <p className="text-xs text-slate-600 mt-1">Try a different name.</p>
                      </div>
                    );
                  }

                  return filtered.map((student) => {
                    const absentRate = student.total > 0
                      ? Math.round((student.absent_count / student.total) * 100) : 0;
                    const presentRate = student.total > 0
                      ? Math.round((student.present_count / student.total) * 100) : 0;
                    const lateRate = student.total > 0
                      ? Math.round((student.late_count / student.total) * 100) : 0;

                    return (
                      <div
                        key={student.player_id}
                        className="rounded-xl border border-slate-800/80 p-4 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-sm font-semibold text-white">{student.full_name}</span>
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span className="text-emerald-400">✅ {student.present_count}</span>
                            <span className="text-red-400">❌ {student.absent_count}</span>
                            <span className="text-amber-400">⏰ {student.late_count}</span>
                          </div>
                        </div>

                        {student.total > 0 && (
                          <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden flex">
                            <div className="h-full bg-emerald-500 transition-all" title={`Present: ${presentRate}%`} style={{ width: `${presentRate}%` }} />
                            <div className="h-full bg-amber-500 transition-all" title={`Late: ${lateRate}%`} style={{ width: `${lateRate}%` }} />
                            <div className="h-full bg-red-500 transition-all" title={`Absent: ${absentRate}%`} style={{ width: `${absentRate}%` }} />
                          </div>
                        )}

                        {student.total > 0 ? (
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-600">{student.total} session{student.total !== 1 ? 's' : ''}</span>
                            <span className={`text-[10px] font-bold ${
                              student.percentage >= 80 ? 'text-emerald-400' :
                              student.percentage >= 60 ? 'text-amber-400' :
                              'text-red-400'
                            }`}>{student.percentage}%</span>
                          </div>
                        ) : (
                          <div className="mt-1.5">
                            <span className="text-[10px] text-slate-600 italic">No attendance records yet</span>
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

        {/* Footer */}
        {!loading && !error && data.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">{data.length} student{data.length !== 1 ? 's' : ''}</span>
            <button onClick={onClose} className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">Close</button>
          </div>
        )}
      </div>
    </>
  );
};
