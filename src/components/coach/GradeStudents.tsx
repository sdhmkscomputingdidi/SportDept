import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export const GradeStudents: React.FC = () => {
  const { sportId } = useParams<{ sportId: string }>();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [assessmentData, setAssessmentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sportName, setSportName] = useState<string>('');

  const [selectedMonth, setSelectedMonth] = useState(7);
  const seasonMonths = [7,8,9,10,11,12,1,2,3,4,5,6];
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getMonthLabel = (monthNum: number) => {
    const year = monthNum >= 7 ? selectedYear : selectedYear + 1;
    return `${months[monthNum - 1]} ${year}`;
  };

  useEffect(() => {
    if (!sportId) return;
    supabase.from('players').select('id, full_name').eq('sport_id', sportId)
      .then(({ data }) => setStudents(data || []));
  }, [sportId]);

  useEffect(() => {
    if (!sportId) return;
    supabase.from('sports').select('name').eq('id', sportId).single()
      .then(({ data }) => setSportName(data?.name || ''));
  }, [sportId]);

  useEffect(() => {
    setSelectedStudent(null);
    setAssessmentData([]);
  }, [sportId]);

  const fetchScores = async (studentId: string, month: number) => {
    setLoading(true);
    
    const { data: catData } = await supabase
      .from('assessment_categories')
      .select(`id, name, skills(id, name, skill_criteria(description))`)
      .eq('sport_id', sportId);

    const { data: scoreData } = await supabase
      .from('player_assessments')
      .select('skill_id, score')
      .eq('player_id', studentId)
      .or(`and(assessment_year.eq.${selectedYear},assessment_month.gte.7),and(assessment_year.eq.${selectedYear + 1},assessment_month.lte.6)`)
      .eq('assessment_month', month);

    const merged = catData?.map(cat => ({
      ...cat,
      skills: cat.skills.map(skill => ({
        ...skill,
        descriptions: skill.skill_criteria.map((c: any) => c.description),
        score: scoreData?.find(s => s.skill_id === skill.id)?.score || 1
      }))
    }));

    setAssessmentData(merged || []);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedStudent) fetchScores(selectedStudent.id, selectedMonth);
  }, [selectedStudent, selectedMonth, sportId]);

  const handleScoreChange = async (skillId: string, newScore: number) => {
    setAssessmentData(prev => prev.map(cat => ({
      ...cat,
      skills: cat.skills.map((s: any) => s.id === skillId ? { ...s, score: newScore } : s)
    })));

    const { error } = await supabase.from('player_assessments').upsert({
      player_id: selectedStudent.id,
      skill_id: skillId,
      score: newScore,
      assessment_month: selectedMonth,
      assessment_year: selectedMonth >= 7 ? selectedYear : selectedYear + 1
    }, { 
      onConflict: 'player_id,skill_id,assessment_month,assessment_year' 
    });

    if (error) console.error("Upsert failed:", error.message);
  };

  const categoryAverages = useMemo(() => {
    return assessmentData.map(cat => {
      const total = cat.skills.reduce((sum: number, s: any) => sum + s.score, 0);
      return (total / (cat.skills.length || 1)).toFixed(1);
    });
  }, [assessmentData]);

  return (
    <div className="flex flex-col md:flex-row md:h-screen md:overflow-hidden md:p-6 md:gap-6 bg-slate-950 text-white">
      {/* Sidebar with Scrollable Container */}
      <div className="w-full md:w-64 md:flex-shrink-0">
        <h3 className="text-slate-400 font-bold mb-4 uppercase text-xs">Students</h3>
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-150px)] pr-2">
          {students.map(s => (
            <button key={s.id} onClick={() => setSelectedStudent(s)} 
              className={`w-full text-left p-3 rounded-lg ${selectedStudent?.id === s.id ? 'bg-violet-600' : 'bg-slate-900'}`}>
              {s.full_name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full md:flex-1 md:h-full md:overflow-y-auto">
        {selectedStudent ? (
          <>
            <div className="mb-6 bg-slate-900 p-4 rounded-lg flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{selectedStudent.full_name}</h2>
                <p className="text-xs text-slate-400">{sportName}</p>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-slate-800 p-2 rounded border border-slate-700 outline-none text-sm text-white"
                >
                  {seasonMonths.map((m) => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
                </select>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-slate-800 p-2 rounded border border-slate-700 outline-none text-sm text-white"
                >
                  <option value={selectedYear - 1}>{selectedYear - 1}–{selectedYear}</option>
                  <option value={selectedYear}>{selectedYear}–{selectedYear + 1}</option>
                  <option value={selectedYear + 1}>{selectedYear + 1}–{selectedYear + 2}</option>
                </select>
              </div>
            </div>
            {loading ? <p>Loading...</p> : assessmentData.map((cat, idx) => (
              <div key={cat.id} className="bg-slate-900 border border-slate-800 p-6 rounded-xl mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-violet-400">{cat.name}</h2>
                  <span className="text-sm bg-slate-800 px-3 py-1 rounded">Avg: {categoryAverages[idx]}</span>
                </div>
                {cat.skills.map((skill: any) => (
                  <div key={skill.id} className="mb-6 p-4 bg-slate-950 rounded-lg">
                    <h3 className="font-semibold text-white mb-1">{skill.name}</h3>
                    <p className="text-xs text-slate-500 italic mb-3">Observe: {skill.descriptions.join(', ')}</p>
                    <div className="flex items-center gap-4">
<input type="range" min="1" max="10" value={skill.score}
                          onChange={(e) => handleScoreChange(skill.id, parseInt(e.target.value))}
                          className="accent-violet-500 w-full cursor-pointer" />
                      <span className="w-8 text-center font-bold">{skill.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : <p className="text-center mt-20 text-slate-500">Select a student</p>}
      </div>
    </div>
  );
};