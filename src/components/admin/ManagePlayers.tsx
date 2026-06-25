import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';

const COLORS = ['#8b5cf6', '#f472b6', '#34d399', '#fbbf24', '#3b82f6', '#ef4444', '#06b6d4', '#d946ef', '#f97316', '#22c55e', '#64748b', '#0ea5e9'];

export const ManagePlayers: React.FC = () => {
  const { sportId } = useParams<{ sportId: string }>();
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([7]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [radarData, setRadarData] = useState<any[]>([]);
  const [lineChartData, setLineChartData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'radar' | 'line'>('radar');

  const monthLabels = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getMonthLabel = (monthNum: number) => {
    const year = monthNum >= 7 ? selectedYear : selectedYear + 1;
    return `${monthLabels[monthNum - 1]} ${year}`;
  };

  const seasonMonths = [7,8,9,10,11,12,1,2,3,4,5,6];
  const getSeasonMonthOrder = (monthNum: number) => {
    return monthNum >= 7 ? monthNum - 7 : monthNum + 5;
  };
  
  // Edit/CRUD State
  const [editPlayer, setEditPlayer] = useState<any | null>(null);
  const [coachSports, setCoachSports] = useState<any[]>([]);
  const [playerEvents, setPlayerEvents] = useState<any[]>([]);

  const fetchPlayers = async () => {
    if (sportId) {
      const { data } = await supabase
        .from('players')
        .select('id, full_name, sport_id')
        .eq('sport_id', sportId);
      setPlayers(data || []);
    } else {
      // Admin context: no sportId in URL — fetch all players across all sports
      const { data } = await supabase
        .from('players')
        .select('id, full_name, sport_id');
      setPlayers(data || []);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [sportId]);

  useEffect(() => {
    const fetchCoachSports = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('coaches_sports')
        .select(`
          sport_id,
          sports (
            id,
            name
          )
        `)
        .eq('coach_id', user.id);
      const list: any[] = [];
      data?.forEach((item: any) => {
        if (item.sports) {
          list.push({ id: item.sports.id, name: item.sports.name });
        }
      });
      setCoachSports(list);
    };
    fetchCoachSports();
  }, []);

  useEffect(() => {
    const fetchPlayerEvents = async () => {
      if (!selectedPlayer) {
        setPlayerEvents([]);
        return;
      }
      const { data } = await supabase
        .from('players_events')
        .select(`
          joined_at,
          events (
            id,
            name,
            event_date,
            sports (
              id,
              name
            )
          )
        `)
        .eq('player_id', selectedPlayer.id);

      const normalized = (data || []).map((item: any) => ({
        joined_at: item.joined_at,
        event: item.events ? {
          id: item.events.id,
          name: item.events.name,
          event_date: item.events.event_date,
          sport: item.events.sports ? { name: item.events.sports.name } : null,
        } : null,
      })).filter((item: any) => item.event !== null);

      normalized.sort((a, b) => {
        const dateA = a.event?.event_date || '';
        const dateB = b.event?.event_date || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setPlayerEvents(normalized);
    };

    fetchPlayerEvents();
  }, [selectedPlayer]);

  useEffect(() => {
    if (!selectedPlayer || selectedMonths.length === 0) {
      setRadarData([]);
      return;
    }

    const fetchRadarData = async () => {
      const { data: catData } = await supabase
        .from('assessment_categories')
        .select(`name, skills(id, name)`)
        .eq('sport_id', selectedPlayer.sport_id);

      const { data: scoreData } = await supabase
        .from('player_assessments')
        .select('skill_id, score, assessment_month, assessment_year')
        .eq('player_id', selectedPlayer.id)
        .or(`and(assessment_year.eq.${selectedYear},assessment_month.gte.7),and(assessment_year.eq.${selectedYear + 1},assessment_month.lte.6)`)
        .in('assessment_month', selectedMonths);

      const formatted = catData?.map(cat => {
        const entry: any = { category: cat.name };
        selectedMonths.forEach(m => {
          const monthSkills = cat.skills.map((s: any) => ({
            ...s,
            score: scoreData?.find(sd => sd.skill_id === s.id && sd.assessment_month === m)?.score || 0
          }));
          const avg = monthSkills.reduce((sum: number, s: any) => sum + s.score, 0) / (monthSkills.length || 1);
          entry[`month_${m}`] = avg;
        });
        return entry;
      });
      setRadarData(formatted || []);
    };
    fetchRadarData();
    
    const fetchLineChartData = async () => {
      if (!selectedPlayer) return;
      const { data: catData } = await supabase
        .from('assessment_categories')
        .select(`id, name`)
        .eq('sport_id', selectedPlayer.sport_id);

      const { data: skillsData } = await supabase
        .from('skills')
        .select('id, category_id');

      const skillToCategory: Record<string, string> = {};
      skillsData?.forEach((sk: any) => {
        const cat = catData?.find((c: any) => c.id === sk.category_id);
        if (cat) skillToCategory[sk.id] = cat.name;
      });

      const { data: scoreData } = await supabase
        .from('player_assessments')
        .select('skill_id, score, assessment_month')
        .eq('player_id', selectedPlayer.id)
        .or(`and(assessment_year.eq.${selectedYear},assessment_month.gte.7),and(assessment_year.eq.${selectedYear + 1},assessment_month.lte.6)`)
        .order('assessment_month', { ascending: true });

      const monthMap: Record<number, any> = {};
      scoreData?.forEach((score: any) => {
        const catName = skillToCategory[score.skill_id];
        if (!catName) return;
        const m = score.assessment_month;
        if (!monthMap[m]) {
          monthMap[m] = { month: getMonthLabel(m), monthNum: m };
        }
        if (!monthMap[m][catName]) {
          monthMap[m][catName] = [];
        }
        monthMap[m][catName].push(score.score);
      });

      const lineArr = Object.values(monthMap)
        .map((entry: any) => {
          const row: any = { month: entry.month };
          catData?.forEach((cat: any) => {
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
        })
        .sort((a: any, b: any) => getSeasonMonthOrder(a.monthNum) - getSeasonMonthOrder(b.monthNum));
      setLineChartData(lineArr);
    };

    fetchLineChartData();
  }, [selectedPlayer, selectedMonths, selectedYear]);

  const toggleMonth = (m: number) => {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(i => i !== m) : [...prev, m]);
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('players').update({ 
      full_name: editPlayer.full_name, 
      sport_id: editPlayer.sport_id 
    }).eq('id', editPlayer.id);
    if (!error) { setEditPlayer(null); fetchPlayers(); setSelectedPlayer(null); }
  };

  const handleDeletePlayer = async () => {
    if (window.confirm('Delete this student?')) {
      await supabase.from('players').delete().eq('id', editPlayer.id);
      setEditPlayer(null);
      setSelectedPlayer(null);
      fetchPlayers();
    }
  };

  return (
    <div className="flex h-screen p-6 gap-6 bg-slate-950 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 p-4 rounded-xl overflow-y-auto">
        <h3 className="font-bold mb-4 uppercase text-xs text-slate-400">Players</h3>
        {players.map(p => (
          <div key={p.id} className="flex items-center gap-2 mb-2">
            <button onClick={() => setSelectedPlayer(p)} 
              className={`flex-1 text-left p-3 rounded transition-colors ${selectedPlayer?.id === p.id ? 'bg-violet-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {p.full_name}
            </button>
            <button onClick={() => setEditPlayer(p)} className="text-xs bg-slate-700 px-2 py-3 rounded hover:bg-slate-600">Edit</button>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 p-6 rounded-xl border border-slate-800">
        {selectedPlayer ? (
          <>
            <h2 className="text-2xl font-bold mb-2">{selectedPlayer.full_name} Statistics</h2>
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-950 p-4 rounded-lg">
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-slate-400">View:</span>
                <select 
                  value={chartType} 
                  onChange={(e) => setChartType(e.target.value as 'radar' | 'line')}
                  className="bg-slate-800 p-1.5 rounded border border-slate-700 outline-none text-xs text-white"
                >
                  <option value="radar">Radar</option>
                  <option value="line">Line Progress</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-slate-400">Season Year:</span>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-slate-800 p-1.5 rounded border border-slate-700 outline-none text-xs text-white"
                >
                  <option value={selectedYear - 1}>{selectedYear - 1}–{selectedYear}</option>
                  <option value={selectedYear}>{selectedYear}–{selectedYear + 1}</option>
                  <option value={selectedYear + 1}>{selectedYear + 1}–{selectedYear + 2}</option>
                </select>
              </div>
              <span className="text-xs text-slate-400 self-center mr-2">Compare Months:</span>
              {seasonMonths.map(m => (
                <label key={m} className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded text-[10px] ${selectedMonths.includes(m) ? 'bg-violet-600' : 'bg-slate-800'}`}>
                  <input type="checkbox" className="hidden" checked={selectedMonths.includes(m)} onChange={() => toggleMonth(m)} />
                  {getMonthLabel(m)}
                </label>
              ))}
            </div>

            <div className="flex-1 w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'radar' ? (
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#475569" />
                    <PolarAngleAxis dataKey="category" />
                    <PolarRadiusAxis domain={[0, 10]} />
                    {selectedMonths.map((m, idx) => (
                      <Radar key={m} name={getMonthLabel(m)} 
                        dataKey={`month_${m}`} stroke={COLORS[idx % COLORS.length]} 
                        fill={COLORS[idx % COLORS.length]} fillOpacity={0.2} />
                    ))}
                    <Legend />
                  </RadarChart>
                ) : (
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {radarData.length > 0 ? radarData.map((d: any, idx: number) => (
                      <Line 
                        key={d.category || idx}
                        type="monotone" 
                        dataKey={d.category} 
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    )) : null}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {playerEvents.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Events Participated</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {playerEvents.map((pe) => (
                    <div key={pe.event.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{pe.event.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {pe.event.sport?.name || ''} — {new Date(pe.event.event_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Joined {new Date(pe.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Select a player to view stats.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdatePlayer} className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-96">
            <h3 className="text-lg font-bold mb-4">Edit Student</h3>
            <input className="w-full bg-slate-800 p-2 mb-4 rounded" value={editPlayer.full_name} onChange={e => setEditPlayer({...editPlayer, full_name: e.target.value})} />
            <select className="w-full bg-slate-800 p-2 mb-4 rounded" value={editPlayer.sport_id} onChange={e => setEditPlayer({...editPlayer, sport_id: e.target.value})}>
              {coachSports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex justify-between gap-2">
              <button type="button" onClick={handleDeletePlayer} className="text-red-400 text-sm">Delete</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditPlayer(null)} className="px-4 py-1">Cancel</button>
                <button type="submit" className="bg-violet-600 px-4 py-1 rounded">Save</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};