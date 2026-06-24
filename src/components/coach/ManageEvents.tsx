import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

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
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
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

  const fetchAssignedSports = async () => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchErr } = await supabase
        .from('coaches_sports')
        .select(`
          sport_id,
          sports (
            id,
            name
          )
        `)
        .eq('coach_id', user.id);

      if (fetchErr) throw fetchErr;

      const list: { id: string; name: string }[] = [];
      data?.forEach((item: any) => {
        if (item.sports) {
          list.push({ id: item.sports.id, name: item.sports.name });
        }
      });

      if (list.length > 0) {
        setSports(list);
        const matchFromUrl = urlSportId && list.find((s) => s.id === urlSportId);
        setSelectedSportId(matchFromUrl ? urlSportId : list[0].id);
      } else {
        setSports([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assigned sports.');
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
    fetchAssignedSports();
  }, [urlSportId]);

  useEffect(() => {
    if (selectedSportId) {
      fetchEvents();
      fetchPlayers();
    }
  }, [selectedSportId]);

  useEffect(() => {
    if (selectedEvent) {
      fetchParticipants(selectedEvent.id);
    } else {
      setParticipants([]);
    }
  }, [selectedEvent]);

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
  const availablePlayers = players.filter((p) => !participantPlayerIds.has(p.id));

  return (
    <div className="flex h-screen p-6 gap-6 bg-slate-950 text-white">
      {/* Left Sidebar - Events */}
      <div className="w-64 bg-slate-900 p-4 rounded-xl overflow-y-auto flex flex-col">
        <h3 className="font-bold mb-4 uppercase text-xs text-slate-400">Events — {sports.find(s => s.id === selectedSportId)?.name || ''}</h3>

        <form onSubmit={handleAddEvent} className="mb-4 space-y-2">
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

        <div className="space-y-2 flex-1">
          {events.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No events yet.</p>
          ) : (
            events.map((evt) => (
              <div
                key={evt.id}
                onClick={() => {
                  setSelectedEvent(evt);
                  setEditEvent(null);
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
            ))
          )}
        </div>
      </div>

      {/* Right Main - Participants */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 p-6 rounded-xl border border-slate-800">
        {selectedEvent ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedEvent.name}</h2>
                <p className="text-sm text-slate-400">
                  {new Date(selectedEvent.event_date).toLocaleDateString()} — {participants.length} participant{participants.length !== 1 ? 's' : ''}
                </p>
                {selectedEvent.notes && (
                  <p className="text-sm text-slate-300 mt-2 bg-slate-800 p-3 rounded-lg border border-slate-700 whitespace-pre-wrap">{selectedEvent.notes}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Participants */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Participants
                </h3>
                <div className="space-y-2">
                  {participants.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No participants selected yet.</p>
                  ) : (
                    participants.map((part) => (
                      <div
                        key={part.player_id}
                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700"
                      >
                        <span className="text-sm font-medium text-slate-200">
                          {part.players?.[0]?.full_name || 'Unknown Player'}
                        </span>
                        <button
                          onClick={() => handleToggleParticipant(part.player_id)}
                          disabled={formLoading}
                          className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50"
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
                  {availablePlayers.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">All players are already participants or no players found.</p>
                  ) : (
                    availablePlayers.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-800"
                      >
                        <span className="text-sm font-medium text-slate-300">
                          {player.full_name}
                        </span>
                        <button
                          onClick={() => handleToggleParticipant(player.id)}
                          disabled={formLoading}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded transition-colors disabled:opacity-50"
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

      {/* Edit Modal */}
      {editEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateEvent} className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-96">
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
