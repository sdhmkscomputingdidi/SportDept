import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const STATS_COLORS = ['#8b5cf6', '#f472b6', '#34d399', '#fbbf24', '#3b82f6', '#ef4444', '#06b6d4', '#d946ef', '#f97316', '#22c55e', '#64748b', '#0ea5e9'];

interface Sport {
  id: string;
  name: string;
}

interface SportEvent {
  id: string;
  sport_id: string;
  name: string;
  event_date: string;
  description: string;
  notes: string;
  created_at: string;
}

interface Player {
  id: string;
  full_name: string;
}

interface EventParticipant {
  event_id: string;
  player_id: string;
  joined_at: string;
  players: { full_name: string }[];
}

export const ManageEvents: React.FC = () => {
  const { sportId: urlSportId } = useParams<{ sportId?: string }>();
  const [mobileView, setMobileView] = useState<'events' | 'participants'>('events');
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);

  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [editEvent, setEditEvent] = useState<SportEvent | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('asc');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');
  const [eventShowUpcoming, setEventShowUpcoming] = useState(false);
  const [eventPage, setEventPage] = useState(1);
  const EVENTS_PER_PAGE = 15;

  // Player stats data
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, { attendance_pct: number; event_count: number }>>({});

  // Stats modal state
  const [statsModalPlayerId, setStatsModalPlayerId] = useState<string | null>(null);
  const [statsModalPlayerName, setStatsModalPlayerName] = useState('');
  const [statsChartType, setStatsChartType] = useState<'radar' | 'line'>('radar');
  const [statsMonths, setStatsMonths] = useState<number[]>([7]);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsCategories, setStatsCategories] = useState<any[]>([]);
  const [statsRadarData, setStatsRadarData] = useState<any[]>([]);
  const [statsLineData, setStatsLineData] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

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

  const fetchEvents = async () => {
    if (!selectedSportId) return;
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('events')
        .select('id, sport_id, name, event_date, description, notes, created_at')
        .eq('sport_id', selectedSportId)
        .order('event_date', { ascending: true });

      if (fetchErr) throw fetchErr;
      setEvents(data || []);
      setSelectedEvent(null);
      setParticipants([]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch events.');
    }
  };

  const fetchPlayers = async () => {
    if (!selectedSportId) return;
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
    }
  };

  const fetchParticipants = async (eventId: string) => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('players_events')
        .select(`
          event_id,
          player_id,
          joined_at,
          players ( full_name )
        `)
        .eq('event_id', eventId);

      if (fetchErr) throw fetchErr;
      const normalized = (data || []).map((item: any) => ({
        ...item,
        players: Array.isArray(item.players)
          ? item.players
          : item.players
            ? [item.players]
            : [],
      }));
      normalized.sort((a, b) => {
        const nameA = a.players[0]?.full_name || '';
        const nameB = b.players[0]?.full_name || '';
        return nameA.localeCompare(nameB);
      });
      setParticipants(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch participants.');
    }
  };

  useEffect(() => {
    fetchSports();
  }, [urlSportId]);

  // ── Player Stats Helpers ──
  const seasonMonths = [7,8,9,10,11,12,1,2,3,4,5,6];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const fetchPlayerStats = async () => {
    if (!selectedSportId) return;
    try {
      const { data: playersList } = await supabase
        .from('players')
        .select('id')
        .eq('sport_id', selectedSportId);

      if (!playersList || playersList.length === 0) {
        setPlayerStatsMap({});
        return;
      }

      const playerIds = playersList.map(p => p.id);

      // Fetch attendance records
      const { data: attData } = await supabase
        .from('player_attendance')
        .select('player_id, status')
        .eq('sport_id', selectedSportId)
        .in('player_id', playerIds);

      // Count events per player
      const { data: eventData } = await supabase
        .from('players_events')
        .select('player_id')
        .in('player_id', playerIds);

      // Aggregate attendance
      const attAgg: Record<string, { present: number; total: number }> = {};
      (attData || []).forEach((r: any) => {
        if (!attAgg[r.player_id]) {
          attAgg[r.player_id] = { present: 0, total: 0 };
        }
        attAgg[r.player_id].total++;
        if (r.status === 'present') attAgg[r.player_id].present++;
      });

      // Count events
      const eventCount: Record<string, number> = {};
      (eventData || []).forEach((r: any) => {
        eventCount[r.player_id] = (eventCount[r.player_id] || 0) + 1;
      });

      const stats: Record<string, { attendance_pct: number; event_count: number }> = {};
      playerIds.forEach(pid => {
        const a = attAgg[pid];
        stats[pid] = {
          attendance_pct: a && a.total > 0 ? Math.round((a.present / a.total) * 100) : 0,
          event_count: eventCount[pid] || 0,
        };
      });

      setPlayerStatsMap(stats);
    } catch (err) {
      console.warn('Failed to fetch player stats:', err);
    }
  };

  // ── Stats Modal Helpers ──
  const getStatsMonthLabel = (monthNum: number) => {
    const year = monthNum >= 7 ? statsYear : statsYear + 1;
    return `${months[monthNum - 1]} ${year}`;
  };

  const getSeasonMonthOrder = (monthNum: number) => {
    return monthNum >= 7 ? monthNum - 7 : monthNum + 5;
  };

  const toggleStatsMonth = (m: number) => {
    setStatsMonths(prev => prev.includes(m) ? prev.filter(i => i !== m) : [...prev, m]);
  };

  const fetchStatsData = async () => {
    if (!statsModalPlayerId || !selectedSportId) return;
    setStatsLoading(true);

    const { data: catData } = await supabase
      .from('assessment_categories')
      .select(`id, name, skills(id, name)`)
      .eq('sport_id', selectedSportId);

    const { data: scoreData } = await supabase
      .from('player_assessments')
      .select('skill_id, score, assessment_month')
      .eq('player_id', statsModalPlayerId)
      .or(`and(assessment_year.eq.${statsYear},assessment_month.gte.7),and(assessment_year.eq.${statsYear + 1},assessment_month.lte.6)`)
      .in('assessment_month', statsMonths);

    setStatsCategories(catData || []);

    // Radar data
    const radarFormatted = catData?.map(cat => {
      const entry: any = { category: cat.name };
      statsMonths.forEach(m => {
        const monthSkills = (cat.skills || []).map((s: any) => ({
          ...s,
          score: scoreData?.find(sd => sd.skill_id === s.id && sd.assessment_month === m)?.score || 0
        }));
        const avg = monthSkills.length > 0
          ? monthSkills.reduce((sum: number, s: any) => sum + s.score, 0) / monthSkills.length
          : 0;
        entry[`month_${m}`] = parseFloat(avg.toFixed(1));
      });
      return entry;
    }) || [];
    setStatsRadarData(radarFormatted);

    // Line data
    const skillToCategory: Record<string, string> = {};
    catData?.forEach((cat: any) => {
      (cat.skills || []).forEach((s: any) => {
        skillToCategory[s.id] = cat.name;
      });
    });

    const monthMap: Record<number, any> = {};
    scoreData?.forEach((score: any) => {
      const catName = skillToCategory[score.skill_id];
      if (!catName) return;
      const m = score.assessment_month;
      if (!monthMap[m]) {
        monthMap[m] = { month: getStatsMonthLabel(m), monthNum: m };
      }
      if (!monthMap[m][catName]) {
        monthMap[m][catName] = [];
      }
      monthMap[m][catName].push(score.score);
    });

    const lineArr = Object.values(monthMap)
      .map((entry: any) => {
        const row: any = { month: entry.month, monthNum: entry.monthNum };
        catData?.forEach((cat: any) => {
          const scores = entry[cat.name];
          if (scores && scores.length > 0) {
            row[cat.name] = parseFloat((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1));
          } else {
            row[cat.name] = undefined;
          }
        });
        return row;
      })
      .sort((a: any, b: any) => getSeasonMonthOrder(a.monthNum) - getSeasonMonthOrder(b.monthNum));
    setStatsLineData(lineArr);
    setStatsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    if (statsModalPlayerId) {
      fetchStatsData().then(() => {
        // fetchStatsData sets state internally; cancelled check is for the outer effect
        if (cancelled) {
          setStatsRadarData([]);
          setStatsLineData([]);
          setStatsCategories([]);
          setStatsLoading(false);
        }
      });
    }

    return () => { cancelled = true; };
  }, [statsModalPlayerId, statsMonths, statsYear]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (cancelled) return;
      await fetchEvents();
      if (cancelled) return;
      await fetchPlayers();
      if (cancelled) return;
      await fetchPlayerStats();
    }

    if (selectedSportId) {
      loadData();
    }

    return () => { cancelled = true; };
  }, [selectedSportId]);

  useEffect(() => {
    if (selectedEvent) {
      fetchParticipants(selectedEvent.id);
    } else {
      setParticipants([]);
    }
  }, [selectedEvent?.id]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !selectedSportId) return;
    setFormLoading(true);
    try {
      const { error: insertErr } = await supabase
        .from('events')
        .insert({
          sport_id: selectedSportId,
          name: newEventName.trim(),
          event_date: newEventDate || new Date().toISOString().split('T')[0],
          notes: newEventNotes.trim(),
        });

      if (insertErr) throw insertErr;
      setNewEventName('');
      setNewEventDate('');
      setNewEventNotes('');
      fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to create event.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent) return;
    setEditLoading(true);
    try {
      const { error: updateErr } = await supabase
        .from('events')
        .update({
          name: editName.trim(),
          event_date: editDate,
          notes: editNotes.trim(),
        })
        .eq('id', editEvent.id);

      if (updateErr) throw updateErr;
      setEditEvent(null);
      fetchEvents();
      if (selectedEvent?.id === editEvent.id) {
        setSelectedEvent({ ...editEvent, name: editName.trim(), event_date: editDate, notes: editNotes.trim() });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update event.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event? All participant data will be lost.')) return;
    try {
      const { error: deleteErr } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      if (selectedEvent?.id === id) {
        setSelectedEvent(null);
        setParticipants([]);
      }
      fetchEvents();
      setEditEvent(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete event.');
    }
  };

  const handleToggleParticipant = async (playerId: string) => {
    if (!selectedEvent) return;
    const isParticipant = participants.some((p) => p.player_id === playerId);
    setFormLoading(true);
    try {
      if (isParticipant) {
        const { error: deleteErr } = await supabase
          .from('players_events')
          .delete()
          .eq('event_id', selectedEvent.id)
          .eq('player_id', playerId);

        if (deleteErr) throw deleteErr;
        setParticipants((prev) => prev.filter((p) => p.player_id !== playerId));
      } else {
        const { error: insertErr } = await supabase
          .from('players_events')
          .insert({
            event_id: selectedEvent.id,
            player_id: playerId,
          });

        if (insertErr) throw insertErr;
        const { data } = await supabase
          .from('players')
          .select('full_name')
          .eq('id', playerId)
          .single();

        setParticipants((prev) => [
          ...prev,
          {
            event_id: selectedEvent.id,
            player_id: playerId,
            joined_at: new Date().toISOString(),
            players: data ? [{ full_name: data.full_name }] : [],
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update participant.');
    } finally {
      setFormLoading(false);
    }
  };

  const participantPlayerIds = new Set(participants.map((p) => p.player_id));
  const filteredParticipants = participants.filter(p =>
    p.players?.[0]?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredAvailablePlayers = players
    .filter((p) => !participantPlayerIds.has(p.id))
    .filter(p => p.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const availablePlayersUse = searchQuery ? filteredAvailablePlayers : players.filter((p) => !participantPlayerIds.has(p.id));
  const participantsUse = searchQuery ? filteredParticipants : participants;

  return (
    <div className="flex flex-col md:flex-row md:h-screen bg-slate-950 text-white">
      {/* Mobile Tabs */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-900 safe-area-pt">
        <button
          onClick={() => setMobileView('events')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'events' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          }`}
        >
          Events ({events.length})
        </button>
        <button
          onClick={() => selectedEvent && setMobileView('participants')}
          disabled={!selectedEvent}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'participants' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          } ${!selectedEvent ? 'opacity-50' : ''}`}
        >
          Participants
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:h-screen md:p-6 md:gap-6 flex-1">
      {/* Left Sidebar - Events */}
      <div className={`w-full md:w-64 bg-slate-900 p-4 md:p-4 md:rounded-xl md:overflow-y-auto md:flex md:flex-col ${mobileView === 'participants' ? 'hidden md:block' : ''}`}>
        <h3 className="font-bold mb-4 uppercase text-xs text-slate-400">Events — {sports.find(s => s.id === selectedSportId)?.name || ''}</h3>

        <form onSubmit={handleAddEvent} className="mb-3 space-y-2">
          <input
            type="text"
            required
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="New Event..."
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500"
          />
          <input
            type="date"
            value={newEventDate}
            onChange={(e) => setNewEventDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500"
          />
          <textarea
            value={newEventNotes}
            onChange={(e) => setNewEventNotes(e.target.value)}
            placeholder="Notes (result, outcome...)"
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
          />
          <button
            type="submit"
            disabled={formLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded py-1.5 text-xs transition-colors disabled:opacity-50"
          >
            + Add Event
          </button>
        </form>

        {/* Events Search, Sort, Date Range */}
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={eventSearchQuery}
                onChange={(e) => { setEventSearchQuery(e.target.value); setEventPage(1); }}
                placeholder="🔍 Search events..."
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-[11px] focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              onClick={() => { setEventShowUpcoming(prev => !prev); setEventPage(1); }}
              className={`flex items-center gap-1 text-[11px] border rounded px-2 py-1.5 transition-colors whitespace-nowrap ${
                eventShowUpcoming
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Show only upcoming events"
            >
              🚀 Upcoming
            </button>
            <button
              onClick={() => { setEventSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setEventPage(1); }}
              className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-2 py-1.5 text-slate-300 transition-colors whitespace-nowrap"
              title={eventSortOrder === 'asc' ? 'Sorted: Oldest first' : 'Sorted: Newest first'}
            >
              {eventSortOrder === 'asc' ? '📅 Oldest' : '📅 Recent'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={eventDateFrom}
              onChange={(e) => { setEventDateFrom(e.target.value); setEventPage(1); }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-[11px] focus:outline-none focus:border-violet-500"
              placeholder="From"
            />
            <span className="text-[10px] text-slate-500">→</span>
            <input
              type="date"
              value={eventDateTo}
              onChange={(e) => { setEventDateTo(e.target.value); setEventPage(1); }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-[11px] focus:outline-none focus:border-violet-500"
              placeholder="To"
            />
            {(eventDateFrom || eventDateTo) && (
              <button
                onClick={() => { setEventDateFrom(''); setEventDateTo(''); setEventPage(1); }}
                className="text-[10px] text-red-400 hover:text-red-300 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filtered, Sorted & Paginated Events */}
        <div className="space-y-2 flex-1">
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const filtered = events
              .filter(evt =>
                (evt.name.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
                evt.event_date.includes(eventSearchQuery)) &&
                (!eventDateFrom || evt.event_date >= eventDateFrom) &&
                (!eventDateTo || evt.event_date <= eventDateTo) &&
                (!eventShowUpcoming || evt.event_date >= todayStr)
              )
              .sort((a, b) => {
                const cmp = a.event_date.localeCompare(b.event_date);
                return eventSortOrder === 'asc' ? cmp : -cmp;
              });

            const totalShown = eventPage * EVENTS_PER_PAGE;
            const paginated = filtered.slice(0, totalShown);
            const hasMore = paginated.length < filtered.length;

            if (filtered.length === 0) {
              return (
                <p className="text-xs text-slate-500 italic">
                  {eventSearchQuery || eventDateFrom || eventDateTo || eventShowUpcoming ? 'No events match your filters.' : 'No events yet.'}
                </p>
              );
            }

            return (
              <>
                {paginated.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setEditEvent(null);
                      setMobileView('participants');
                    }}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedEvent?.id === evt.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{evt.name}</p>
                        <p className="text-[10px] text-slate-400">{evt.event_date}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditEvent(evt);
                            setEditName(evt.name);
                            setEditDate(evt.event_date);
                            setEditNotes(evt.notes || '');
                          }}
                          className="text-[10px] text-violet-300 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(evt.id);
                          }}
                          className="text-[10px] text-red-400 hover:underline"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={() => setEventPage(prev => prev + 1)}
                    className="w-full py-2 text-[11px] text-violet-400 hover:text-violet-300 bg-slate-800/50 hover:bg-slate-700/50 rounded border border-slate-700/50 transition-colors"
                  >
                    Load More ({filtered.length - totalShown} remaining)
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Right Main - Participants */}
      <div className={`w-full md:flex-1 md:flex md:flex-col md:min-w-0 bg-slate-900 p-4 md:p-6 rounded-xl border border-slate-800 ${mobileView === 'events' ? 'hidden md:block' : ''}`}>
        {selectedEvent ? (
          <>
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select Event</label>
              <select
                value={selectedEvent.id}
                onChange={(e) => {
                  const event = events.find(ev => ev.id === e.target.value);
                  if (event) {
                    setSelectedEvent(event);
                    setEditEvent(null);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              >
                {events.map(evt => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name} — {evt.event_date}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">
                <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
              </div>
              {selectedEvent.notes && (
                <p className="text-sm text-slate-300 mt-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700 whitespace-pre-wrap">{selectedEvent.notes}</p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search players by name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div className="space-y-6">
              {/* Participants */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Participants
                </h3>
                <div className="space-y-2">
                  {participantsUse.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">{searchQuery ? 'No participants match your search.' : 'No participants selected yet.'}</p>
                  ) : (
                    participantsUse.map((part) => (
                      <div
                        key={part.player_id}
                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-200 block truncate">
                            {part.players?.[0]?.full_name || 'Unknown Player'}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold ${
                              (playerStatsMap[part.player_id]?.attendance_pct || 0) >= 80 ? 'text-emerald-400' :
                              (playerStatsMap[part.player_id]?.attendance_pct || 0) >= 60 ? 'text-amber-400' :
                              'text-red-400'
                            }`}>
                              📊 {playerStatsMap[part.player_id]?.attendance_pct || 0}% attend.
                            </span>
                            <span className="text-[10px] text-slate-500">
                              🏆 {playerStatsMap[part.player_id]?.event_count || 0} events
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatsModalPlayerId(part.player_id);
                                setStatsModalPlayerName(part.players?.[0]?.full_name || 'Player');
                              }}
                              className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold underline"
                            >
                              View Stats
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleParticipant(part.player_id)}
                          disabled={formLoading}
                          className="flex-shrink-0 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50"
                        >
                          Selected
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Available Players */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  All Players in Sport
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availablePlayersUse.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">{searchQuery ? 'No players match your search.' : 'All players are already participants or no players found.'}</p>
                  ) : (
                    availablePlayersUse.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-800"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-300 block truncate">
                            {player.full_name}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold ${
                              (playerStatsMap[player.id]?.attendance_pct || 0) >= 80 ? 'text-emerald-400' :
                              (playerStatsMap[player.id]?.attendance_pct || 0) >= 60 ? 'text-amber-400' :
                              'text-red-400'
                            }`}>
                              📊 {playerStatsMap[player.id]?.attendance_pct || 0}% attend.
                            </span>
                            <span className="text-[10px] text-slate-500">
                              🏆 {playerStatsMap[player.id]?.event_count || 0} events
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatsModalPlayerId(player.id);
                                setStatsModalPlayerName(player.full_name);
                              }}
                              className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold underline"
                            >
                              View Stats
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleParticipant(player.id)}
                          disabled={formLoading}
                          className="flex-shrink-0 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded transition-colors disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Select an event to manage participants.
          </div>
        )}
      </div>

      </div>

      {/* ── Stats Modal ── */}
      {statsModalPlayerId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setStatsModalPlayerId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">📊 Progress Statistics</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {statsModalPlayerName}
                    <span className="text-slate-500 ml-2">• {sports.find(s => s.id === selectedSportId)?.name || ''}</span>
                  </p>
                </div>
                <button onClick={() => setStatsModalPlayerId(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-lg">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="flex flex-wrap gap-3 mb-6 bg-slate-950 p-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">View:</span>
                    <select value={statsChartType} onChange={(e) => setStatsChartType(e.target.value as 'radar' | 'line')}
                      className="bg-slate-800 p-1.5 rounded border border-slate-700 outline-none text-xs text-white">
                      <option value="radar">Radar</option>
                      <option value="line">Line Progress</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Season Year:</span>
                    <select value={statsYear} onChange={(e) => setStatsYear(parseInt(e.target.value))}
                      className="bg-slate-800 p-1.5 rounded border border-slate-700 outline-none text-xs text-white">
                      <option value={statsYear - 1}>{statsYear - 1}–{statsYear}</option>
                      <option value={statsYear}>{statsYear}–{statsYear + 1}</option>
                      <option value={statsYear + 1}>{statsYear + 1}–{statsYear + 2}</option>
                    </select>
                  </div>
                  <span className="text-xs text-slate-400 self-center">Compare Months:</span>
                  {seasonMonths.map(m => (
                    <label key={m} className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded text-[10px] ${statsMonths.includes(m) ? 'bg-violet-600' : 'bg-slate-800'}`}>
                      <input type="checkbox" className="hidden" checked={statsMonths.includes(m)} onChange={() => toggleStatsMonth(m)} />
                      {getStatsMonthLabel(m)}
                    </label>
                  ))}
                </div>

                {statsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <span className="w-8 h-8 border-3 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></span>
                  </div>
                ) : statsRadarData.length > 0 || statsLineData.length > 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                    <div className="w-full min-h-[300px] h-[350px] md:h-[450px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {statsChartType === 'radar' ? (
                          <RadarChart data={statsRadarData}>
                            <PolarGrid stroke="#475569" />
                            <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <PolarRadiusAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            {statsMonths.map((m, idx) => (
                              <Radar key={m} name={getStatsMonthLabel(m)} dataKey={`month_${m}`}
                                stroke={STATS_COLORS[idx % STATS_COLORS.length]}
                                fill={STATS_COLORS[idx % STATS_COLORS.length]} fillOpacity={0.15} />
                            ))}
                            <Legend wrapperStyle={{ paddingTop: '16px' }} />
                          </RadarChart>
                        ) : (
                          <LineChart data={statsLineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                            <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#f1f5f9' }} />
                            <Legend wrapperStyle={{ paddingTop: '16px' }} />
                            {statsCategories.map((cat: any, idx: number) => (
                              <Line key={cat.id} type="monotone" dataKey={cat.name}
                                stroke={STATS_COLORS[idx % STATS_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            ))}
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center">
                    <p className="text-xs text-slate-500 italic">No assessment history recorded yet.</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">{statsModalPlayerName}</span>
                <button onClick={() => setStatsModalPlayerId(null)} className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">Close</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateEvent} className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-full max-w-sm mx-4 md:w-96">
            <h3 className="text-lg font-bold mb-4 text-white">Edit Event</h3>
            <input
              className="w-full bg-slate-800 p-2 mb-4 rounded text-white text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Event Name"
              required
            />
            <input
              type="date"
              className="w-full bg-slate-800 p-2 mb-4 rounded text-white text-sm"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              required
            />
            <textarea
              className="w-full bg-slate-800 p-2 mb-4 rounded text-white text-sm"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notes (result, outcome...)"
              rows={3}
            />
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => handleDeleteEvent(editEvent.id)}
                className="text-red-400 text-sm"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditEvent(null)} className="px-4 py-1 text-slate-300 hover:text-white">
                  Cancel
                </button>
                <button type="submit" disabled={editLoading} className="bg-violet-600 px-4 py-1 rounded text-white text-sm disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
