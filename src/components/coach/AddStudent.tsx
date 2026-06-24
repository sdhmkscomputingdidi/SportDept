import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export const AddStudent: React.FC = () => {
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState('');
  const [assignedSports, setAssignedSports] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCoachSports = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch only sports associated with this specific coach
      const { data } = await supabase
        .from('coaches_sports')
        .select('sports(id, name)')
        .eq('coach_id', user.id);
      
      if (data) {
        setAssignedSports(data.map((item: any) => item.sports));
      }
    };
    fetchCoachSports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sportId) return alert("Please select a sport.");

    const { error } = await supabase
      .from('players')
      .insert([{ full_name: name, sport_id: sportId }]);
    
    if (error) {
      console.error("Error adding student:", error.message);
      alert("Failed to add student. Please try again.");
    } else {
      alert("Student added successfully!");
      navigate(-1);
    }
  };

  return (
    <div className="bg-slate-900 p-8 rounded-xl max-w-lg mx-auto text-white shadow-xl border border-slate-800">
      <h2 className="text-2xl font-bold mb-6">Add New Student</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-slate-400">Full Name</label>
          <input 
            required 
            className="w-full bg-slate-800 p-2.5 rounded border border-slate-700 focus:border-violet-500 outline-none"
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Enter student name"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-400">Assign to Your Sport</label>
          <select 
            required
            className="w-full bg-slate-800 p-2.5 rounded border border-slate-700 focus:border-violet-500 outline-none"
            value={sportId} onChange={(e) => setSportId(e.target.value)}
          >
            <option value="">Select a sport</option>
            {assignedSports.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="w-full bg-violet-600 p-3 rounded-lg font-bold hover:bg-violet-700 transition-colors mt-4">
          Register Student
        </button>
      </form>
    </div>
  );
};