import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Auth } from './components/Auth';
import { AdminLayout } from './components/admin/AdminLayout';
import { ManageSports } from './components/admin/ManageSports';
import ManageCoaches from './components/admin/ManageCoaches';
import { ManagePlayers } from './components/admin/ManagePlayers';
import { ManagePlayers as AdminManagePlayers } from './components/admin/ManagePlayersAdmin';
import { ManageEvents as AdminManageEvents } from './components/admin/ManageEvents';
import { ManageCriteria as AdminManageCriteria } from './components/admin/ManageCriteria';
import { CoachLayout } from './components/coach/CoachLayout';
import { AddStudent } from './components/coach/AddStudent';
import { ManageCriteria } from './components/coach/ManageCriteria';
import { GradeStudents } from './components/coach/GradeStudents';
import { ManageEvents } from './components/coach/ManageEvents';
import { CoachAttendance } from './components/coach/CoachAttendance';
import { AdminAttendance } from './components/admin/AdminAttendance';
import { TrainingSchedule } from './components/admin/TrainingSchedule';
import { ManageHolidays } from './components/admin/ManageHolidays';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'head_coach' | 'coach' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setRole(data.role);
      } else {
        setRole(null);
      }
    } catch (err) {
      console.error('Error fetching profile role:', err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        fetchRole(currentSession.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        fetchRole(newSession.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = (newSession: Session | null) => {
    setSession(newSession);
    if (newSession?.user?.id) {
      setLoading(true);
      fetchRole(newSession.user.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <span className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
          <p className="text-slate-400 text-sm font-medium">Synchronizing Session...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={session && role ? <Navigate to={role === 'head_coach' ? '/admin' : '/coach'} replace /> : <Auth onAuthSuccess={handleAuthSuccess} />}
        />
        <Route
          path="/register"
          element={session && role ? <Navigate to={role === 'head_coach' ? '/admin' : '/coach'} replace /> : <Auth onAuthSuccess={handleAuthSuccess} />}
        />

        {/* Head Coach Workspace */}
        <Route
          path="/admin"
          element={session && role === 'head_coach' ? <Outlet /> : <Navigate to={role === 'coach' ? '/coach' : '/login'} replace />}
        >
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/sports" replace />} />
            <Route path="sports" element={<ManageSports />} />
            <Route path="coaches" element={<ManageCoaches />} />
            <Route path="grade/:sportId" element={<GradeStudents />} />
            <Route path="add-student" element={<AddStudent />} />
            <Route path="players" element={<AdminManagePlayers />} />
            <Route path="players/:sportId" element={<AdminManagePlayers />} />
            <Route path="events" element={<AdminManageEvents />} />
            <Route path="events/:sportId" element={<AdminManageEvents />} />
            <Route path="criteria" element={<AdminManageCriteria />} />
            <Route path="criteria/:sportId" element={<AdminManageCriteria />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="attendance/:sportId" element={<AdminAttendance />} />
            <Route path="training-schedule" element={<TrainingSchedule />} />
            <Route path="holidays" element={<ManageHolidays />} />
          </Route>
        </Route>

        {/* Coach Workspace */}
        <Route path="/coach" element={<CoachLayout />}>
          <Route index element={<Navigate to="/coach/attendance" replace />} />
          <Route path="criteria/:sportId" element={<ManageCriteria />} />
          <Route path="grade/:sportId" element={<GradeStudents />} />
          <Route path="grade/:sportId/:studentId" element={<GradeStudents />} />
          <Route path="add-student" element={<AddStudent />} />
          <Route path="players/:sportId" element={<ManagePlayers />} />
          <Route path="events" element={<ManageEvents />} />
          <Route path="events/:sportId" element={<ManageEvents />} />
          <Route path="attendance" element={<CoachAttendance />} />
          <Route path="attendance/:sportId" element={<CoachAttendance />} />
        </Route>

        {/* Fallback routing layer */}
        <Route
          path="*"
          element={session ? <Navigate to={role === 'head_coach' ? '/admin' : '/coach'} replace /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;