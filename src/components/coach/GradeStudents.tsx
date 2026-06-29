import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#8b5cf6', '#f472b6', '#34d399', '#fbbf24', '#3b82f6', '#ef4444', '#06b6d4', '#d946ef', '#f97316', '#22c55e', '#64748b', '#0ea5e9'];

export const GradeStudents: React.FC = () => {
  const { sportId } = useParams<{ sportId: string }>();
  
  // Mobile view state: 'students' or 'grading'
  const [mobileView, setMobileView] = useState<'students' | 'grading'>('students');
  
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [assessmentData, setAssessmentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sportName, setSportName] = useState<string>('');

  // Stats modal state
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsChartType, setStatsChartType] = useState<'radar' | 'line'>('radar');
  const [statsMonths, setStatsMonths] = useState<number[]>([7]);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsCategories, setStatsCategories] = useState<any[]>([]);
  const [statsRadarData, setStatsRadarData] = useState<any[]>([]);
  const [statsLineData, setStatsLineData] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

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

  // ── Stats Modal Helpers & Data Fetching ──

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
    if (!selectedStudent || !sportId) return;
    setStatsLoading(true);

    // Fetch categories with skills
    const { data: catData } = await supabase
      .from('assessment_categories')
      .select(`id, name, skills(id, name)`)
      .eq('sport_id', sportId);

    // Fetch scores for selected months
    const { data: scoreData } = await supabase
      .from('player_assessments')
      .select('skill_id, score, assessment_month')
      .eq('player_id', selectedStudent.id)
      .or(`and(assessment_year.eq.${statsYear},assessment_month.gte.7),and(assessment_year.eq.${statsYear + 1},assessment_month.lte.6)`)
      .in('assessment_month', statsMonths);

    setStatsCategories(catData || []);

    // Build radar data — one row per category, columns per month
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

    // Build line chart data — one row per month, columns per category
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

    setStatsLineData(lineArr);
    setStatsLoading(false);
  };

  // Fetch stats data whenever modal state changes
  useEffect(() => {
    let cancelled = false;

    if (statsModalOpen) {
      fetchStatsData().then(() => {
        if (cancelled) {
          setStatsRadarData([]);
          setStatsLineData([]);
          setStatsCategories([]);
          setStatsLoading(false);
        }
      });
    }

    return () => { cancelled = true; };
  }, [statsModalOpen, selectedStudent?.id, statsYear, JSON.stringify(statsMonths)]);

  const categoryAverages = useMemo(() => {
    return assessmentData.map(cat => {
      const total = cat.skills.reduce((sum: number, s: any) => sum + s.score, 0);
      return (total / (cat.skills.length || 1)).toFixed(1);
    });
  }, [assessmentData]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* Mobile Tabs */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-900 safe-area-pt">
        <button
          onClick={() => setMobileView('students')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'students' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          }`}
        >
          Students ({students.length})
        </button>
        <button
          onClick={() => selectedStudent && setMobileView('grading')}
          disabled={!selectedStudent}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileView === 'grading' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-400'
          } ${!selectedStudent ? 'opacity-50' : ''}`}
        >
          Grading
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:h-screen md:overflow-hidden md:p-6 md:gap-6 flex-1 overflow-hidden">
        {/* Students Sidebar/List - hidden on mobile when in grading view */}
        <div className={`w-full md:w-64 md:flex-shrink-0 ${mobileView === 'grading' ? 'hidden md:block' : ''}`}>
          <h3 className="text-slate-400 font-bold mb-4 uppercase text-xs md:block hidden">Students</h3>
          <div className="space-y-2 overflow-y-auto max-h-full md:max-h-[calc(100vh-150px)] pr-2">
            {students.map(s => (
              <button key={s.id} onClick={() => { setSelectedStudent(s); setMobileView('grading'); }} 
                className={`w-full text-left p-3 rounded-lg transition-all min-h-[44px] ${selectedStudent?.id === s.id ? 'bg-violet-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
                {s.full_name}
              </button>
            ))}
          </div>
        </div>

        <div className={`w-full flex-1 overflow-y-auto pb-20 md:pb-0 ${mobileView === 'students' ? 'hidden md:block' : ''}`}>
          {selectedStudent ? (
            <>
              <div className="mb-4 md:mb-6 bg-slate-900 p-3 md:p-4 rounded-lg">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select Student</label>
                <select
                  value={selectedStudent.id}
                  onChange={(e) => {
                    const student = students.find(s => s.id === e.target.value);
                    if (student) setSelectedStudent(student);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="bg-slate-800 p-2 rounded border border-slate-700 outline-none text-sm text-white min-h-[40px]"
                  >
                    {seasonMonths.map((m) => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
                  </select>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-slate-800 p-2 rounded border border-slate-700 outline-none text-sm text-white min-h-[40px]"
                  >
                    <option value={selectedYear - 1}>{selectedYear - 1}–{selectedYear}</option>
                    <option value={selectedYear}>{selectedYear}–{selectedYear + 1}</option>
                    <option value={selectedYear + 1}>{selectedYear + 1}–{selectedYear + 2}</option>
                  </select>
                  <button
                    onClick={() => setStatsModalOpen(true)}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs transition-all shadow-lg shadow-violet-600/10 flex items-center gap-1.5 min-h-[40px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    See Statistic
                  </button>
                  <span className="text-xs text-slate-400 ml-auto self-center">{sportName}</span>
                </div>
              </div>
              {loading ? <p className="p-4 text-center">Loading...</p> : assessmentData.map((cat, idx) => (
                <div key={cat.id} className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-xl mb-4 md:mb-6">
                  <div className="flex justify-between items-center mb-3 md:mb-4">
                    <h2 className="text-lg md:text-xl font-bold text-violet-400">{cat.name}</h2>
                    <span className="text-xs md:text-sm bg-slate-800 px-2 md:px-3 py-1 rounded">Avg: {categoryAverages[idx]}</span>
                  </div>
                  {cat.skills.map((skill: any) => (
                    <div key={skill.id} className="mb-4 md:mb-6 p-3 md:p-4 bg-slate-950 rounded-lg">
                      <h3 className="font-semibold text-white mb-1 text-sm md:text-base">{skill.name}</h3>
                      <p className="text-xs text-slate-500 italic mb-2 md:mb-3">Observe: {skill.descriptions.join(', ')}</p>
                      <div className="flex items-center gap-3">
                        <input type="range" min="1" max="10" value={skill.score}
                          onChange={(e) => handleScoreChange(skill.id, parseInt(e.target.value))}
                          className="accent-violet-500 w-full cursor-pointer h-5" />
                        <span className="w-8 text-center font-bold text-sm">{skill.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 p-4 text-center">
              {mobileView === 'grading' ? 'Select a student to begin grading' : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Modal ── */}
      {statsModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setStatsModalOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">📊 Progress Statistics</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {selectedStudent?.full_name || ''}
                    <span className="text-slate-500 ml-2">• {sportName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setStatsModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Controls */}
                <div className="flex flex-wrap gap-3 mb-6 bg-slate-950 p-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">View:</span>
                    <select
                      value={statsChartType}
                      onChange={(e) => setStatsChartType(e.target.value as 'radar' | 'line')}
                      className="bg-slate-800 p-1.5 rounded border border-slate-700 outline-none text-xs text-white"
                    >
                      <option value="radar">Radar</option>
                      <option value="line">Line Progress</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Season Year:</span>
                    <select
                      value={statsYear}
                      onChange={(e) => setStatsYear(parseInt(e.target.value))}
                      className="bg-slate-800 p-1.5 rounded border border-slate-700 outline-none text-xs text-white"
                    >
                      <option value={statsYear - 1}>{statsYear - 1}–{statsYear}</option>
                      <option value={statsYear}>{statsYear}–{statsYear + 1}</option>
                      <option value={statsYear + 1}>{statsYear + 1}–{statsYear + 2}</option>
                    </select>
                  </div>
                  <span className="text-xs text-slate-400 self-center">Compare Months:</span>
                  {seasonMonths.map(m => (
                    <label
                      key={m}
                      className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded text-[10px] ${
                        statsMonths.includes(m) ? 'bg-violet-600' : 'bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={statsMonths.includes(m)}
                        onChange={() => toggleStatsMonth(m)}
                      />
                      {getStatsMonthLabel(m)}
                    </label>
                  ))}
                </div>

                {/* Charts */}
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
                              <Radar
                                key={m}
                                name={getStatsMonthLabel(m)}
                                dataKey={`month_${m}`}
                                stroke={COLORS[idx % COLORS.length]}
                                fill={COLORS[idx % COLORS.length]}
                                fillOpacity={0.15}
                              />
                            ))}
                            <Legend wrapperStyle={{ paddingTop: '16px' }} />
                          </RadarChart>
                        ) : (
                          <LineChart data={statsLineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                            <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                              labelStyle={{ color: '#f1f5f9' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '16px' }} />
                            {statsCategories.map((cat: any, idx: number) => (
                              <Line
                                key={cat.id}
                                type="monotone"
                                dataKey={cat.name}
                                stroke={COLORS[idx % COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                              />
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

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {selectedStudent?.full_name || ''} — {sportName}
                </span>
                <button
                  onClick={() => setStatsModalOpen(false)}
                  className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
