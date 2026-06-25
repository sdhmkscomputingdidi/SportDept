import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface Sport {
  id: string;
  name: string;
}

interface Player {
  id: string;
  full_name: string;
  sport_id: string | null;
}

interface Category {
  id: string;
  name: string;
  skills: Skill[];
}

interface Skill {
  id: string;
  name: string;
  descriptions: string[];
  score: number;
}

interface PlayerEvent {
  joined_at: string;
  event: {
    id: string;
    name: string;
    event_date: string;
    sport: { name: string } | null;
  } | null;
}

export const ManagePlayers: React.FC = () => {
  const { sportId: urlSportId } = useParams<{ sportId?: string }>();
  const [mobileView, setMobileView] = useState<'add' | 'list'>('list');
  const [sports, setSports] = useState<Sport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerSportId, setNewPlayerSportId] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [assessmentData, setAssessmentData] = useState<Category[]>([]);
  const [playerEvents, setPlayerEvents] = useState<PlayerEvent[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const selectedYear = new Date().getFullYear();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('players')
        .select('id, full_name, sport_id')
        .order('full_name');

      if (urlSportId) {
        query = query.eq('sport_id', urlSportId);
      } else {
        query = query.is('sport_id', null);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setPlayers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch players.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalStats = async (playerId: string) => {
    setStatsLoading(true);
    try {
      const sportId = urlSportId || selectedPlayer?.sport_id || '';
      
      const { data: catData } = await supabase
        .from('assessment_categories')
        .select(`id, name`)
        .eq('sport_id', sportId);

      const { data: scoreData } = await supabase
        .from('player_assessments')
        .select('skill_id, score, assessment_month, assessment_year')
        .eq('player_id', playerId)
        .order('assessment_year', { ascending: true })
        .order('assessment_month', { ascending: true });

      if (!catData || !scoreData || catData.length === 0) {
        setChartData([]);
        return;
      }

      const skillToCategory: Record<string, string> = {};
      const { data: skillsData } = await supabase
        .from('skills')
        .select('id, category_id');
      
      skillsData?.forEach((sk: any) => {
        const cat = catData.find((c: any) => c.id === sk.category_id);
        if (cat) skillToCategory[sk.id] = cat.name;
      });

      const monthMap: Record<string, any> = {};
      scoreData.forEach((score: any) => {
        const catName = skillToCategory[score.skill_id];
        if (!catName) return;
        const key = `${score.assessment_year}-${String(score.assessment_month).padStart(2, '0')}`;
        const label = `${months[score.assessment_month - 1]} ${score.assessment_year}`;
        
        if (!monthMap[key]) {
          monthMap[key] = { month: label, sortKey: key };
        }
        if (!monthMap[key][catName]) {
          monthMap[key][catName] = [];
        }
        monthMap[key][catName].push(score.score);
      });

      const seasonMonthOrder = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
      const chartArr = seasonMonthOrder.map((m) => {
        const year = m >= 7 ? selectedYear : selectedYear + 1;
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const entry = monthMap[key];
        if (!entry) return null;
        const row: any = { month: entry.month, sortKey: entry.sortKey };
        catData.forEach((cat: any) => {
          const scores = entry[cat.name];
          if (scores && scores.length > 0) {
            row[cat.name] = parseFloat(
              (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)
            );
          } else {
            row[cat.name] = undefined;
          }
        });
        return row;
      }).filter((row: any) => row !== null);

      setChartData(chartArr);
      setAssessmentData(catData.map((cat: any) => ({ ...cat, skills: [] })));
    } catch (err: any) {
      console.error('Failed to fetch historical stats:', err);
      setChartData([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPlayerEvents = async (playerId: string) => {
    try {
      const { data } = await supabase
        .from('players_events')
        .select(`
          joined_at,
          events (
            id,
            name,
            event_date,
            sports ( name )
          )
        `)
        .eq('player_id', playerId)
        .order('joined_at', { ascending: false });

      const normalized = (data || []).map((item: any) => ({
        joined_at: item.joined_at,
        event: item.events ? {
          id: item.events.id,
          name: item.events.name,
          event_date: item.events.event_date,
          sport: item.events.sports ? { name: item.events.sports.name } : null,
        } : null,
      })).filter((item: any) => item.event !== null);

      setPlayerEvents(normalized);
    } catch (err: any) {
      console.error('Failed to fetch events:', err);
    }
  };

  useEffect(() => {
    fetchSports();
  }, []);

  useEffect(() => {
    fetchPlayers();
    setSelectedPlayer(null);
    setAssessmentData([]);
    setPlayerEvents([]);
  }, [urlSportId]);

  useEffect(() => {
    setNewPlayerSportId(urlSportId || '');
  }, [urlSportId]);

  useEffect(() => {
    if (selectedPlayer) {
      fetchHistoricalStats(selectedPlayer.id);
      fetchPlayerEvents(selectedPlayer.id);
    }
  }, [selectedPlayer]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setFormLoading(true);
    try {
      const { error: insertErr } = await supabase
        .from('players')
        .insert({
          full_name: newPlayerName.trim(),
          sport_id: newPlayerSportId || null,
        });

      if (insertErr) throw insertErr;
      setNewPlayerName('');
      setNewPlayerSportId('');
      fetchPlayers();
    } catch (err: any) {
      setError(err.message || 'Failed to add student.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUnassignPlayer = async (playerId: string) => {
    try {
      const { error: updateErr } = await supabase
        .from('players')
        .update({ sport_id: null })
        .eq('id', playerId);

      if (updateErr) throw updateErr;
      if (selectedPlayer?.id === playerId) {
        setSelectedPlayer(null);
        setAssessmentData([]);
        setPlayerEvents([]);
      }
      fetchPlayers();
    } catch (err: any) {
      setError(err.message || 'Failed to unassign student.');
    }
  };

  const handleAssignPlayer = async (playerId: string, sportId: string) => {
    try {
      const { error: updateErr } = await supabase
        .from('players')
        .update({ sport_id: sportId })
        .eq('id', playerId);

      if (updateErr) throw updateErr;
      fetchPlayers();
    } catch (err: any) {
      setError(err.message || 'Failed to assign student.');
    }
  };

  const getSportName = (id: string | null) => {
    if (!id) return null;
    return sports.find(s => s.id === id)?.name || null;
  };

  return (
    <div className="flex flex-col md:flex-row md:h-screen md:p-6 md:gap-6 bg-slate-950 text-white">
      {/* Mobile Tabs */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-900 safe-area-pt">
        <button
          onClick={() => setMobileView('add')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'add' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          }`}
        >
          Add Student
        </button>
        <button
          onClick={() => setMobileView('list')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'list' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          }`}
        >
          {selectedPlayer ? 'Stats' : 'Students List'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:gap-6 flex-1">
      {/* Left Column - Add Student Form */}
      <div className={`w-full md:w-96 bg-slate-900 p-4 md:p-6 rounded-xl md:overflow-y-auto md:flex md:flex-col ${mobileView === 'list' ? 'hidden md:block' : ''}`}>
        <h3 className="font-bold mb-4 uppercase text-xs text-slate-400">
          {urlSportId ? `Add Student to ${sports.find(s => s.id === urlSportId)?.name || ''}` : 'Add New Student'}
        </h3>

        <form onSubmit={handleAddPlayer} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Student Name
            </label>
            <input
              type="text"
              required
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Enter student name"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Assign to Sport (optional)
            </label>
            <select
              value={newPlayerSportId}
              onChange={(e) => setNewPlayerSportId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
            >
              <option value="">-- Unassigned --</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={formLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg py-2.5 transition-all text-sm disabled:opacity-50"
          >
            {formLoading ? 'Adding...' : 'Add Student'}
          </button>
        </form>
      </div>

      {/* Right Column - List or Stats */}
      <div className={`w-full md:flex-1 md:flex md:flex-col md:min-w-0 bg-slate-900 p-4 md:p-6 rounded-xl border border-slate-800 ${mobileView === 'add' ? 'hidden md:block' : ''}`}>
        {selectedPlayer ? (
          /* STATS VIEW */
          <div className="flex-1 overflow-y-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select Student</label>
                  <select
                    value={selectedPlayer.id}
                    onChange={(e) => {
                      const player = players.find(p => p.id === e.target.value);
                      if (player) setSelectedPlayer(player);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    {players.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}{p.sport_id ? ` — ${getSportName(p.sport_id) || ''}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors self-end mb-0.5 whitespace-nowrap"
                >
                  ← Back
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Progress Overview</h3>
            </div>

            {statsLoading ? (
              <div className="flex items-center justify-center h-64">
                <span className="w-8 h-8 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
              </div>
             ) : chartData.length > 0 ? (
                <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
                  <div className="w-full min-h-[300px] h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                     <LineChart data={chartData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                       <XAxis 
                         dataKey="month" 
                         tick={{ fill: '#94a3b8', fontSize: 12 }}
                         angle={-45}
                         textAnchor="end"
                         height={60}
                       />
                       <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                         labelStyle={{ color: '#f1f5f9' }}
                       />
                       <Legend wrapperStyle={{ paddingTop: '20px' }} />
                       {assessmentData.map((cat, idx) => (
                         <Line 
                           key={cat.id}
                           type="monotone" 
                           dataKey={cat.name} 
                           stroke={['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx % 5]}
                           strokeWidth={2}
                           dot={{ r: 4 }}
                           activeDot={{ r: 6 }}
                         />
                       ))}
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
               </div>
             ) : (
               <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-8 text-center">
                 <p className="text-xs text-slate-500 italic">No assessment history recorded yet.</p>
               </div>
             )}

             {/* Events Participated */}
             {playerEvents.length > 0 && (
               <div>
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Events Participated</h3>
                 <div className="space-y-2">
                   {playerEvents.map((evt) => (
                     <div key={evt.event?.id || evt.joined_at} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                       <div>
                         <p className="text-sm font-medium text-slate-200">{evt.event?.name || 'Unknown Event'}</p>
                         <p className="text-[10px] text-slate-400">
                           {evt.event?.sport?.name || ''} — {evt.event?.event_date ? new Date(evt.event.event_date).toLocaleDateString() : ''}
                         </p>
                       </div>
                       <span className="text-[10px] text-slate-500">
                         Joined {new Date(evt.joined_at).toLocaleDateString()}
                       </span>
                     </div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        ) : (
          /* LIST VIEW */
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {urlSportId ? `${sports.find(s => s.id === urlSportId)?.name || 'Sport'} Students` : 'Unassigned Students'}
                </h2>
                <p className="text-sm text-slate-400">
                  {players.length} student{players.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm mb-4">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <span className="w-8 h-8 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
              </div>
            ) : players.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
                {urlSportId ? 'No students assigned to this sport yet.' : 'No unassigned students. Add a new student or assign existing ones.'}
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-800"
                  >
                    <button
                      onClick={() => setSelectedPlayer(player)}
                      className="flex-1 text-left"
                    >
                      <span className="text-sm font-medium text-slate-200">{player.full_name}</span>
                      {player.sport_id && (
                        <span className="ml-2 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded">
                          {getSportName(player.sport_id)}
                        </span>
                      )}
                      {!player.sport_id && (
                        <span className="ml-2 text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
                          Unassigned
                        </span>
                      )}
                    </button>
                    <div className="flex gap-2">
                      {player.sport_id ? (
                        <button
                          onClick={() => handleUnassignPlayer(player.id)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs font-semibold transition-colors"
                        >
                          Unassign
                        </button>
                      ) : (
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleAssignPlayer(player.id, e.target.value);
                          }}
                          defaultValue=""
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500"
                        >
                          <option value="" disabled>Assign to...</option>
                          {sports.map((sport) => (
                            <option key={sport.id} value={sport.id}>
                              {sport.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  );
};
