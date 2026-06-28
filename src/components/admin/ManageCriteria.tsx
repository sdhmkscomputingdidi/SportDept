import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Sport {
  id: string;
  name: string;
}

interface Category {
  id: string;
  sport_id: string;
  name: string;
}

interface Skill {
  id: string;
  category_id: string;
  name: string;
}

interface Criteria {
  id: string;
  skill_id: string;
  description: string;
}

export const ManageCriteria: React.FC = () => {
  const { sportId: urlSportId } = useParams<{ sportId?: string }>();
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');

  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [newSkillName, setNewSkillName] = useState('');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editSkillName, setEditSkillName] = useState('');

  const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
  const [newCritDesc, setNewCritDesc] = useState('');
  const [editingCrit, setEditingCrit] = useState<Criteria | null>(null);
  const [editCritDesc, setEditCritDesc] = useState('');

  const newCritRef = useRef<HTMLTextAreaElement>(null);
  const editCritRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  useEffect(() => { autoResize(newCritRef.current); }, [newCritDesc]);
  useEffect(() => { autoResize(editCritRef.current); }, [editCritDesc]);

  const [actionLoading, setActionLoading] = useState(false);

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

  const fetchCategories = async () => {
    try {
      const { data, error: err } = await supabase
        .from('assessment_categories')
        .select('*')
        .eq('sport_id', selectedSportId)
        .order('name');
      if (err) throw err;
      setCategories(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch categories.');
    }
  };

  const fetchSkills = async () => {
    try {
      const { data, error: err } = await supabase
        .from('skills')
        .select('*')
        .eq('category_id', selectedCategoryId)
        .order('name');
      if (err) throw err;
      setSkills(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch skills.');
    }
  };

  const fetchCriteria = async () => {
    try {
      const { data, error: err } = await supabase
        .from('skill_criteria')
        .select('*')
        .eq('skill_id', selectedSkillId)
        .order('description');
      if (err) throw err;
      setCriteriaList(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch criteria.');
    }
  };

  useEffect(() => {
    fetchSports();
  }, [urlSportId]);

  useEffect(() => {
    if (selectedSportId) {
      fetchCategories();
    }
  }, [selectedSportId]);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchSkills();
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (selectedSkillId) {
      fetchCriteria();
    }
  }, [selectedSkillId]);

  const handleSportChange = (sportId: string) => {
    setSelectedSportId(sportId);
    setSelectedCategoryId('');
    setSkills([]);
    setSelectedSkillId('');
    setCriteriaList([]);
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedSkillId('');
    setSkills([]);
    setCriteriaList([]);
  };

  const handleSkillSelect = (skillId: string) => {
    setSelectedSkillId(skillId);
    setCriteriaList([]);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedSportId) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('assessment_categories')
        .insert({ sport_id: selectedSportId, name: newCatName.trim() });
      if (err) throw err;
      setNewCatName('');
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to add category.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editCatName.trim()) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('assessment_categories')
        .update({ name: editCatName.trim() })
        .eq('id', editingCat.id);
      if (err) throw err;
      setEditingCat(null);
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to update category.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete this category? This will delete all underlying skills and criteria.')) return;
    try {
      const { error: err } = await supabase
        .from('assessment_categories')
        .delete()
        .eq('id', id);
      if (err) throw err;
      if (selectedCategoryId === id) {
        setSelectedCategoryId('');
        setSkills([]);
        setSelectedSkillId('');
        setCriteriaList([]);
      }
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to delete category.');
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !selectedCategoryId) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('skills')
        .insert({ category_id: selectedCategoryId, name: newSkillName.trim() });
      if (err) throw err;
      setNewSkillName('');
      fetchSkills();
    } catch (err: any) {
      setError(err.message || 'Failed to add skill.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill || !editSkillName.trim()) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('skills')
        .update({ name: editSkillName.trim() })
        .eq('id', editingSkill.id);
      if (err) throw err;
      setEditingSkill(null);
      fetchSkills();
    } catch (err: any) {
      setError(err.message || 'Failed to update skill.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!window.confirm('Delete this skill? This will remove all child assessment criteria.')) return;
    try {
      const { error: err } = await supabase
        .from('skills')
        .delete()
        .eq('id', id);
      if (err) throw err;
      if (selectedSkillId === id) {
        setSelectedSkillId('');
        setCriteriaList([]);
      }
      fetchSkills();
    } catch (err: any) {
      setError(err.message || 'Failed to delete skill.');
    }
  };

  const handleAddCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritDesc.trim() || !selectedSkillId) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('skill_criteria')
        .insert({ skill_id: selectedSkillId, description: newCritDesc.trim() });
      if (err) throw err;
      setNewCritDesc('');
      fetchCriteria();
    } catch (err: any) {
      setError(err.message || 'Failed to add criteria.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCrit || !editCritDesc.trim()) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('skill_criteria')
        .update({ description: editCritDesc.trim() })
        .eq('id', editingCrit.id);
      if (err) throw err;
      setEditingCrit(null);
      fetchCriteria();
    } catch (err: any) {
      setError(err.message || 'Failed to update criteria.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCriteria = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this criterion?')) return;
    try {
      const { error: err } = await supabase
        .from('skill_criteria')
        .delete()
        .eq('id', id);
      if (err) throw err;
      fetchCriteria();
    } catch (err: any) {
      setError(err.message || 'Failed to delete criteria.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white m-0">Evaluation Criteria Builder</h2>
          <p className="text-sm text-slate-400">Design dynamic evaluation templates for all clubs.</p>
        </div>
        <div className="flex items-center gap-3">
          {sports.length > 0 && (
            <select
              value={selectedSportId}
              onChange={(e) => handleSportChange(e.target.value)}
              className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm font-semibold"
            >
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {sports.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-slate-400">
          No sports clubs configured. Please add a sport first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMN 1: CATEGORIES */}
           <div className="glass-panel border border-slate-800/60 rounded-xl p-5 flex flex-col md:h-[550px]">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800/80">
              1. Categories
            </h3>

            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New Category..."
                className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 transition-colors text-xs"
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors"
              >
                Add
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {categories.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">No categories created.</p>
              ) : (
                categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const isEditing = editingCat?.id === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => !isEditing && handleCategorySelect(cat.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:border-slate-750'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={handleUpdateCategory}
                          onClick={(e) => e.stopPropagation()}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            required
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                          />
                          <button type="submit" className="text-[10px] text-emerald-400 font-bold">Save</button>
                          <button type="button" onClick={() => setEditingCat(null)} className="text-[10px] text-slate-400">Cancel</button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs truncate max-w-[150px]">{cat.name}</span>
                          <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCat(cat);
                                setEditCatName(cat.name);
                              }}
                              className="text-[10px] text-blue-400 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(cat.id);
                              }}
                              className="text-[10px] text-red-400 hover:underline"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2: SKILLS */}
           <div className="glass-panel border border-slate-800/60 rounded-xl p-5 flex flex-col md:h-[550px]">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800/80">
              2. Skills
            </h3>

            {!selectedCategoryId ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
                Select a category first to configure skills.
              </div>
            ) : (
              <>
                <form onSubmit={handleAddSkill} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    required
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="New Skill..."
                    className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 transition-colors text-xs"
                  />
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    Add
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {skills.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">No skills created under this category.</p>
                  ) : (
                    skills.map((skill) => {
                      const isSelected = selectedSkillId === skill.id;
                      const isEditing = editingSkill?.id === skill.id;

                      return (
                        <div
                          key={skill.id}
                          onClick={() => !isEditing && handleSkillSelect(skill.id)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                            isSelected
                              ? 'bg-blue-600/15 border-blue-500 text-white'
                              : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:border-slate-750'
                          }`}
                        >
                          {isEditing ? (
                            <form
                              onSubmit={handleUpdateSkill}
                              onClick={(e) => e.stopPropagation()}
                              className="flex gap-2"
                            >
                              <input
                                type="text"
                                required
                                value={editSkillName}
                                onChange={(e) => setEditSkillName(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                              />
                              <button type="submit" className="text-[10px] text-emerald-400 font-bold">Save</button>
                              <button type="button" onClick={() => setEditingSkill(null)} className="text-[10px] text-slate-400">Cancel</button>
                            </form>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs truncate max-w-[150px]">{skill.name}</span>
                              <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSkill(skill);
                                    setEditSkillName(skill.name);
                                  }}
                                  className="text-[10px] text-blue-400 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSkill(skill.id);
                                  }}
                                  className="text-[10px] text-red-400 hover:underline"
                                >
                                  Del
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* COLUMN 3: SKILL CRITERIA */}
           <div className="glass-panel border border-slate-800/60 rounded-xl p-5 flex flex-col md:h-[550px]">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800/80">
              3. Rubric Criteria
            </h3>

            {!selectedSkillId ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
                Select a skill first to configure specific observation criteria.
              </div>
            ) : (
              <>
                <form onSubmit={handleAddCriteria} className="space-y-2 mb-4">
                  <textarea
                    ref={newCritRef}
                    required
                    rows={2}
                    value={newCritDesc}
                    onChange={(e) => setNewCritDesc(e.target.value)}
                    placeholder="Describe observable criteria (e.g. controls pass with soft touch)..."
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-xs resize-none overflow-hidden"
                  />
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    Add Observation Point
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {criteriaList.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">No criteria created under this skill.</p>
                  ) : (
                    criteriaList.map((crit) => {
                      const isEditing = editingCrit?.id === crit.id;

                      return (
                        <div
                          key={crit.id}
                          className="p-3 bg-slate-900/40 border border-slate-800/80 text-slate-350 rounded-lg flex flex-col gap-2 hover:border-slate-750 transition-colors"
                        >
                          {isEditing ? (
                            <form
                              onSubmit={handleUpdateCriteria}
                              className="space-y-2"
                            >
                              <textarea
                                ref={editCritRef}
                                required
                                rows={2}
                                value={editCritDesc}
                                onChange={(e) => setEditCritDesc(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs resize-none overflow-hidden"
                              />
                              <div className="flex gap-2 justify-end">
                                <button type="submit" className="text-[10px] text-emerald-400 font-bold">Save</button>
                                <button type="button" onClick={() => setEditingCrit(null)} className="text-[10px] text-slate-400">Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <div>
                              <p className="text-xs font-medium leading-relaxed mb-2 text-slate-200">
                                {crit.description}
                              </p>
                              <div className="flex gap-2 justify-end opacity-50 hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingCrit(crit);
                                    setEditCritDesc(crit.description);
                                  }}
                                  className="text-[10px] text-blue-400 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCriteria(crit.id)}
                                  className="text-[10px] text-red-400 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
