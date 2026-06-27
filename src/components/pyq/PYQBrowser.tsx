import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import {
  pyqGS1Data,
  pyqCSATData,
  pyqAnthroP1Data,
  pyqAnthroP2Data,
  pyqMainsGS1Data,
  pyqMainsGS2Data,
  pyqMainsGS3Data,
  pyqMainsGS4Data,
  pyqEssayData,
} from '../../data/pyq-data';
import { PYQ_SECTION_LABELS, type PYQSection } from '../../data/pyq-types';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface QuestionLike {
  question: string; year: string; number?: number | string;
  marks?: string; options?: Record<string, string>; answer?: string; passage?: string;
}
interface SubtopicLike { name: string; questions: QuestionLike[]; }
interface TopicLike { name: string; subtopics?: SubtopicLike[]; questions?: QuestionLike[]; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DATA_MAP: Record<PYQSection, TopicLike[]> = {
  gs1: pyqGS1Data as any, csat: pyqCSATData as any,
  anthro_p1: pyqAnthroP1Data as any, anthro_p2: pyqAnthroP2Data as any,
  mains_gs1: pyqMainsGS1Data as any, mains_gs2: pyqMainsGS2Data as any,
  mains_gs3: pyqMainsGS3Data as any, mains_gs4: pyqMainsGS4Data as any,
  essay: pyqEssayData as any,
};

type StageTab = 'prelims' | 'mains';
const PRELIMS_SECTIONS: PYQSection[] = ['gs1', 'csat'];
const MAINS_BASE: PYQSection[] = ['mains_gs1', 'mains_gs2', 'mains_gs3', 'mains_gs4', 'essay'];
const ANTHRO_SECTIONS: PYQSection[] = ['anthro_p1', 'anthro_p2'];

function secPrefix(section: PYQSection): string {
  if (section === 'gs1') return 'pyq';
  if (section === 'csat') return 'csat';
  return section;
}

function buildFlatList(topic: TopicLike): Array<{ q: QuestionLike; stIdx: number; flatIdx: number }> {
  const out: Array<{ q: QuestionLike; stIdx: number; flatIdx: number }> = [];
  if (topic.subtopics) {
    let flat = 0;
    topic.subtopics.forEach((st, stIdx) => {
      st.questions.forEach((q) => out.push({ q, stIdx, flatIdx: flat++ }));
    });
  } else {
    (topic.questions ?? []).forEach((q, flatIdx) => out.push({ q, stIdx: 0, flatIdx }));
  }
  return out;
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────
interface QCardProps {
  q: QuestionLike; qKey: string; cbId: string; checked: boolean; note: string;
  onCheck: (id: string) => void; onNote: (id: string, val: string) => void;
}

const QuestionCard = memo(function QuestionCard({ q, qKey, cbId, checked, note, onCheck, onNote }: QCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [fb, setFb] = useState<'correct' | 'wrong' | 'dropped' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [passageOpen, setPassageOpen] = useState(false);
  const hasOptions = q.options && Object.keys(q.options).length > 0;

  const checkAnswer = useCallback((k: string) => {
    setSelectedAnswer(k);
    const correct = q.answer ?? '';
    if (correct === 'X') setFb('dropped');
    else if (k === correct) setFb('correct');
    else setFb('wrong');
  }, [q.answer]);

  return (
    <div className={`p-3 rounded-xl border transition-colors ${
      fb === 'correct' ? 'border-emerald-500/30 bg-emerald-900/5' :
      fb === 'wrong'   ? 'border-red-500/30 bg-red-900/5' :
      checked          ? 'border-violet-500/25 bg-violet-900/5' :
                         'border-violet-500/15 bg-slate-900/20'
    }`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={checked} onChange={() => onCheck(cbId)}
          className="mt-1 h-5 w-5 rounded border-gray-400 cursor-pointer shrink-0"
          style={{ accentColor: '#6366f1' }} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded font-mono">{q.year}</span>
            {q.number !== undefined && <span className="text-[10px] font-mono font-bold text-indigo-400">Q{q.number}</span>}
            {q.marks && <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded font-mono">{q.marks}m</span>}
            {q.answer === 'X' && <span className="bg-orange-500/20 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">DROPPED</span>}
          </div>
          {q.passage && (
            <div className="mb-3 rounded-lg border-2 border-blue-500/20 bg-blue-900/12 p-3">
              <button onClick={() => setPassageOpen((p) => !p)}
                className="text-[11px] font-bold text-blue-300 hover:text-blue-200 cursor-pointer text-left"
                style={{ background: 'none', border: 'none', padding: 0 }}>
                {passageOpen ? 'Hide Passage ▾' : 'Show Passage ▸'}
              </button>
              {passageOpen && <div className="mt-2 text-[12px] text-slate-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: q.passage }} />}
            </div>
          )}
          <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--t1)' }}
            dangerouslySetInnerHTML={{ __html: q.question }} />
          {hasOptions && (
            <div className="pl-3 border-l-2 border-indigo-500/25 space-y-0.5 mb-2">
              {Object.entries(q.options!).map(([k, v]) => (
                <label key={k} className={`flex items-start gap-1.5 py-1 px-2 rounded cursor-pointer text-[11px] transition-all ${
                  revealed && q.answer === k ? 'bg-emerald-500/20 border border-emerald-500/30' :
                  selectedAnswer === k && fb === 'wrong'   ? 'bg-red-500/10 border border-red-500/20' :
                  selectedAnswer === k && fb === 'correct' ? 'bg-emerald-500/15 border border-emerald-500/25' :
                  'hover:bg-white/5 border border-transparent'
                }`}>
                  <input type="radio" name={qKey} value={k} checked={selectedAnswer === k}
                    onChange={() => checkAnswer(k)} className="mt-0.5 h-4 w-4 cursor-pointer"
                    style={{ accentColor: '#6366f1' }} />
                  <span className="font-bold text-violet-400">({k})</span>
                  <span className="ml-1 font-medium" style={{ color: 'var(--t2)' }}>{v}</span>
                </label>
              ))}
              {selectedAnswer && (
                <button onClick={() => { setSelectedAnswer(''); setFb(null); }}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 mt-1 cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}>✕ Clear answer</button>
              )}
            </div>
          )}
          {fb && (
            <div className={`rounded-lg px-3 py-1.5 text-[11px] font-bold mb-2 ${
              fb === 'correct' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
              fb === 'wrong'   ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                                 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
            }`}>
              {fb === 'correct' ? '✓ Correct!' :
               fb === 'wrong'   ? `✗ Wrong — Correct: (${(q.answer ?? '').toUpperCase()})` :
                                  '⚠ Dropped by UPSC'}
            </div>
          )}
          {q.answer && (
            <button onClick={() => setRevealed((r) => !r)}
              className="text-[10px] font-bold font-mono uppercase tracking-wider px-3 py-1 rounded-lg cursor-pointer transition-all"
              style={{
                background: revealed ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                border: `1px solid ${revealed ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`,
                color: revealed ? 'var(--emerald)' : 'var(--accent)',
              }}>
              {revealed ? `Answer: ${q.answer === 'X' ? 'DROPPED' : q.answer.toUpperCase()}` : 'Show Answer'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 ml-8">
        <input type="text" value={note} onChange={(e) => onNote(cbId, e.target.value)}
          placeholder="✏ Add a note…" className="w-full rounded-lg p-2 text-[11px] font-mono focus:outline-none transition-all"
          style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', color: 'var(--t2)' }} />
      </div>
    </div>
  );
});

// ─── SubtopicSection ──────────────────────────────────────────────────────────
interface SubSecProps {
  st: SubtopicLike; ti: number; si: number; section: PYQSection; stKey: string;
  flatOffset: number; expanded: boolean; onToggle: (key: string) => void;
  getChecked: (id: string) => boolean; getNote: (id: string) => string;
  onCheck: (id: string) => void; onNote: (id: string, val: string) => void;
  yearFilter: string; search: string;
}

const SubtopicSection = memo(function SubtopicSection({
  st, ti, si, section, stKey, flatOffset, expanded, onToggle,
  getChecked, getNote, onCheck, onNote, yearFilter, search,
}: SubSecProps) {
  const prefix = secPrefix(section);
  const filteredIdxs = useMemo(() => {
    const idxs: number[] = [];
    st.questions.forEach((q, qi) => {
      if (yearFilter && q.year !== yearFilter) return;
      if (search.trim() && !q.question.toLowerCase().includes(search.toLowerCase())) return;
      idxs.push(qi);
    });
    return idxs;
  }, [st.questions, yearFilter, search]);

  if (filteredIdxs.length === 0 && (yearFilter || search.trim())) return null;

  return (
    <div className="mb-1">
      <button onClick={() => onToggle(stKey)}
        className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-xl cursor-pointer transition-all"
        style={{ background: 'none', border: 'none' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.07)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}>
        <span style={{ color: 'var(--amber-l,#f59e0b)', fontSize: '10px', minWidth: '10px' }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span className="text-[12px] font-bold flex-1" style={{ color: 'var(--amber-l,#f59e0b)' }}>{st.name}</span>
        <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded border ml-2 shrink-0"
          style={{ background: 'rgba(245,158,11,0.10)', color: 'var(--amber-l,#f59e0b)', borderColor: 'rgba(245,158,11,0.22)' }}>
          {filteredIdxs.length} Q
        </span>
      </button>
      {expanded && (
        <div className="ml-5 mt-2 space-y-3">
          {filteredIdxs.map((qi) => {
            const q = st.questions[qi];
            const flatIdx = flatOffset + qi;
            const cbId = `${prefix}-cb-${ti}-${flatIdx}`;
            const qKey = `${section}-${ti}-${si}-${qi}`;
            return (
              <QuestionCard key={cbId} q={q} qKey={qKey} cbId={cbId}
                checked={getChecked(cbId)} note={getNote(cbId)}
                onCheck={onCheck} onNote={onNote} />
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
export function PYQBrowser() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [pyqStage, setPyqStage] = useState<StageTab>('prelims');
  const [section, setSection] = useState<PYQSection>('gs1');
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  const [expandedSubtopics, setExpandedSubtopics] = useState<Record<string, boolean>>({});
  const [yearFilter, setYearFilter] = useState('');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('upsc_tracker_progress').select('id, is_checked, topic_note')
        .eq('user_id', user.id).like('id', '%-cb-%');
      if (data) {
        const checkedMap: Record<string, boolean> = {};
        const notesMap: Record<string, string> = {};
        data.forEach((row) => {
          if (row.is_checked) checkedMap[row.id] = true;
          if (row.topic_note) notesMap[row.id] = row.topic_note;
        });
        setChecked(checkedMap); setNotes(notesMap);
      }
    };
    load();
  }, [user]);

  const syncCheck = useCallback(async (id: string, val: boolean) => {
    if (!user) return;
    await supabase.from('upsc_tracker_progress').upsert(
      { id, user_id: user.id, is_checked: val, updated_at: new Date().toISOString() },
      { onConflict: 'id,user_id' });
  }, [user]);

  const syncNote = useCallback((id: string, value: string) => {
    if (!user) return;
    if (noteTimers.current[id]) clearTimeout(noteTimers.current[id]);
    noteTimers.current[id] = setTimeout(async () => {
      await supabase.from('upsc_tracker_progress').upsert(
        { id, user_id: user.id, is_checked: checked[id] ?? false, topic_note: value, updated_at: new Date().toISOString() },
        { onConflict: 'id,user_id' });
    }, 800);
  }, [user, checked]);

  const handleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const newVal = !prev[id];
      syncCheck(id, newVal);
      return { ...prev, [id]: newVal };
    });
  }, [syncCheck]);

  const handleNote = useCallback((id: string, value: string) => {
    setNotes((prev) => ({ ...prev, [id]: value }));
    syncNote(id, value);
  }, [syncNote]);

  const getChecked = useCallback((id: string) => !!checked[id], [checked]);
  const getNote = useCallback((id: string) => notes[id] ?? '', [notes]);
  const toggleSubtopic = useCallback((key: string) => {
    setExpandedSubtopics((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isAnthroUser = useMemo(() => {
    const opt = profile?.optional_subject ?? '';
    return !opt || opt === 'none' || opt.toLowerCase().includes('anthro');
  }, [profile]);
  const mainsSections = useMemo(() => isAnthroUser ? [...MAINS_BASE, ...ANTHRO_SECTIONS] : [...MAINS_BASE, 'opt_p1' as PYQSection, 'opt_p2' as PYQSection], [isAnthroUser]);
  const subSections = pyqStage === 'prelims' ? PRELIMS_SECTIONS : mainsSections;
  const isCustomOptSection = section === 'opt_p1' || section === 'opt_p2';
  const topics = isCustomOptSection ? [] : DATA_MAP[section];

  const years = useMemo(() => {
    const ys = new Set<string>();
    topics.forEach((t) => {
      const qs = t.subtopics ? t.subtopics.flatMap((s) => s.questions) : (t.questions ?? []);
      qs.forEach((q) => ys.add(q.year));
    });
    return Array.from(ys).sort().reverse();
  }, [topics]);

  const totalCount = useMemo(() => {
    let count = 0;
    topics.forEach((t) => {
      const qs = t.subtopics ? t.subtopics.flatMap((s) => s.questions) : (t.questions ?? []);
      qs.forEach((q) => {
        if (yearFilter && q.year !== yearFilter) return;
        if (search.trim() && !q.question.toLowerCase().includes(search.toLowerCase())) return;
        count++;
      });
    });
    return count;
  }, [topics, yearFilter, search]);

  const checkedCounts = useMemo(() => {
    const prefix = secPrefix(section);
    return topics.map((topic, ti) => {
      const flat = buildFlatList(topic);
      return flat.filter(({ flatIdx }) => !!checked[`${prefix}-cb-${ti}-${flatIdx}`]).length;
    });
  }, [topics, checked, section]);

  const switchSection = useCallback((s: PYQSection) => {
    setSection(s); setExpandedTopic(null); setExpandedSubtopics({}); setYearFilter(''); setSearch('');
  }, []);
  const switchStage = useCallback((st: StageTab) => {
    setPyqStage(st);
    const def: PYQSection = st === 'prelims' ? 'gs1' : 'mains_gs1';
    setSection(def); setExpandedTopic(null); setExpandedSubtopics({}); setYearFilter(''); setSearch('');
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
        {(['prelims', 'mains'] as StageTab[]).map((st) => (
          <button key={st} onClick={() => switchStage(st)}
            className={`cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all heading-font ${
              pyqStage === st ? 'bg-indigo-600 text-white shadow-md' : 'stage-btn-inactive'
            }`}>
            {st === 'prelims' ? 'Stage I: Prelims' : 'Stage II: Mains & Optional'}
          </button>
        ))}
      </div>

      <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap scrollbar-none p-1.5 rounded-xl border border-violet-500/20"
        style={{ background: 'var(--surf)' }}>
        {subSections.map((s) => (
          <button key={s} onClick={() => switchSection(s)}
            className={`inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all ${
              s === section ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500' : 'border border-transparent hover:bg-white/10'
            }`} style={s !== section ? { color: 'var(--t2)' } : undefined}>
            {PYQ_SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {isCustomOptSection ? (
        <CustomOptionalPYQ paper={section === 'opt_p1' ? 'p1' : 'p2'} />
      ) : (
      <div className="neo-card rounded-3xl p-6">
        <div className="flex flex-wrap justify-between items-center border-b border-violet-500/20 pb-3 mb-4 gap-2">
          <h2 className="heading-font text-xl font-black">PYQ: {PYQ_SECTION_LABELS[section]}</h2>
          <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--t3)' }}>{totalCount} questions</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <input type="text" placeholder="Search questions…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-all"
            style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', color: 'var(--t1)' }} />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs font-mono focus:outline-none"
            style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', color: 'var(--t1)' }}>
            <option value="">All Years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {(yearFilter || search.trim()) && (
            <button onClick={() => { setYearFilter(''); setSearch(''); }}
              className="text-[10px] font-bold font-mono px-2 py-1 rounded cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              ✕ Clear
            </button>
          )}
        </div>

        <div className="space-y-2">
          {topics.map((topic, ti) => {
            const flatList = buildFlatList(topic);
            const totalQAll = flatList.length;
            const filteredCount = flatList.filter(({ q }) => {
              if (yearFilter && q.year !== yearFilter) return false;
              if (search.trim() && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
              return true;
            }).length;
            if (filteredCount === 0 && (yearFilter || search.trim())) return null;
            const isExpanded = expandedTopic === ti;
            const checkedCnt = checkedCounts[ti] ?? 0;
            const prefix = secPrefix(section);
            return (
              <div key={ti} className="task-row rounded-2xl overflow-hidden">
                <button className="flex items-center w-full text-left cursor-pointer px-3.5 py-3 transition-all"
                  style={{ background: 'none', border: 'none' }}
                  onClick={() => { setExpandedTopic(isExpanded ? null : ti); if (!isExpanded) setExpandedSubtopics({}); }}>
                  <span style={{ color: 'var(--accent1,#6366f1)', marginRight: '8px', fontSize: '11px' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <span className="flex-1 text-sm font-bold break-words" style={{ color: 'var(--t1)' }}>{topic.name}</span>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {checkedCnt > 0 && (
                      <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded border"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', borderColor: 'rgba(16,185,129,0.25)' }}>
                        ✓{checkedCnt}/{totalQAll}
                      </span>
                    )}
                    <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded border"
                      style={{ background: 'rgba(99,102,241,0.14)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.25)' }}>
                      {filteredCount} Q
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-violet-500/12 py-2 px-2">
                    {topic.subtopics ? (
                      <div className="space-y-1">
                        {topic.subtopics.map((st, si) => {
                          let offset = 0;
                          for (let s = 0; s < si; s++) offset += topic.subtopics![s].questions.length;
                          const stKey = `${ti}_${si}`;
                          return (
                            <SubtopicSection key={stKey} st={st} ti={ti} si={si} section={section}
                              stKey={stKey} flatOffset={offset} expanded={!!expandedSubtopics[stKey]}
                              onToggle={toggleSubtopic} getChecked={getChecked} getNote={getNote}
                              onCheck={handleCheck} onNote={handleNote} yearFilter={yearFilter} search={search} />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-2 space-y-3">
                        {(topic.questions ?? []).map((q, qi) => {
                          if (yearFilter && q.year !== yearFilter) return null;
                          if (search.trim() && !q.question.toLowerCase().includes(search.toLowerCase())) return null;
                          const cbId = `${prefix}-cb-${ti}-${qi}`;
                          const qKey = `${section}-${ti}-${qi}`;
                          return (
                            <QuestionCard key={cbId} q={q} qKey={qKey} cbId={cbId}
                              checked={getChecked(cbId)} note={getNote(cbId)}
                              onCheck={handleCheck} onNote={handleNote} />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

// ── Custom Optional PYQ Entry for non-Anthro users ────────────────────────────
interface CustomPYQQuestion { question: string; year: string; marks: string; }

function CustomOptionalPYQ({ paper }: { paper: 'p1' | 'p2' }) {
  const { session } = useAuth();
  const [questions, setQuestions] = useState<CustomPYQQuestion[]>([]);
  const [newQ, setNewQ] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newMarks, setNewMarks] = useState('');
  const [saving, setSaving] = useState(false);
  const storageKey = `custom_opt_pyq_${paper}`;

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('upsc_user_profiles')
        .select('profile_data')
        .eq('id', session.user.id)
        .single();
      const stored = data?.profile_data?.[storageKey];
      if (Array.isArray(stored)) setQuestions(stored);
    })();
  }, [session?.user?.id, storageKey]);

  const saveQuestions = async (updated: CustomPYQQuestion[]) => {
    if (!session?.user?.id) return;
    setSaving(true);
    const { data: current } = await supabase
      .from('upsc_user_profiles')
      .select('profile_data')
      .eq('id', session.user.id)
      .single();
    const profileData = current?.profile_data ?? {};
    profileData[storageKey] = updated;
    await supabase
      .from('upsc_user_profiles')
      .update({ profile_data: profileData })
      .eq('id', session.user.id);
    setSaving(false);
  };

  const addQuestion = () => {
    const q = newQ.trim();
    if (!q) return;
    const updated = [...questions, { question: q, year: newYear || '—', marks: newMarks || '—' }];
    setQuestions(updated);
    setNewQ(''); setNewYear(''); setNewMarks('');
    saveQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    saveQuestions(updated);
  };

  const paperLabel = paper === 'p1' ? 'Optional Paper I' : 'Optional Paper II';

  return (
    <div className="neo-card rounded-3xl p-6">
      <div className="flex flex-wrap justify-between items-center border-b border-violet-500/20 pb-3 mb-4 gap-2">
        <h2 className="heading-font text-xl font-black">PYQ: {paperLabel}</h2>
        {saving && <span className="text-[10px] font-mono" style={{ color: 'var(--accent1)' }}>saving...</span>}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--t3)', margin: '0 0 1rem' }}>
        Add your optional subject PYQ questions below. You can track which ones you've practiced.
      </p>

      {/* Add question form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem',
        padding: '1rem', borderRadius: '12px', background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
        <textarea
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          placeholder="Enter question text..."
          rows={2}
          style={{
            width: '100%', padding: '0.5rem', borderRadius: '8px',
            border: '1px solid var(--bdr)', background: 'var(--bg)',
            color: 'var(--t1)', fontSize: '0.85rem', resize: 'vertical'
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text" value={newYear} onChange={(e) => setNewYear(e.target.value)}
            placeholder="Year" style={{
              width: '80px', padding: '0.4rem', borderRadius: '6px',
              border: '1px solid var(--bdr)', background: 'var(--bg)',
              color: 'var(--t1)', fontSize: '0.8rem'
            }}
          />
          <input
            type="text" value={newMarks} onChange={(e) => setNewMarks(e.target.value)}
            placeholder="Marks" style={{
              width: '80px', padding: '0.4rem', borderRadius: '6px',
              border: '1px solid var(--bdr)', background: 'var(--bg)',
              color: 'var(--t1)', fontSize: '0.8rem'
            }}
          />
          <button onClick={addQuestion} disabled={!newQ.trim()} style={{
            padding: '0.4rem 1rem', borderRadius: '8px', border: 'none',
            background: 'var(--accent1, #6366f1)', color: '#fff',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700
          }}>Add</button>
        </div>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--t3)', fontStyle: 'italic' }}>
          No questions added yet. Add your optional PYQ questions above.
        </p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div key={idx} style={{
              padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'var(--surf)', border: '1px solid var(--bdr)',
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--t1)' }}>{q.question}</p>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--t3)', fontFamily: 'monospace' }}>Year: {q.year}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--t3)', fontFamily: 'monospace' }}>Marks: {q.marks}</span>
                </div>
              </div>
              <button onClick={() => removeQuestion(idx)} title="Remove" style={{
                background: 'none', border: 'none', color: 'var(--t3)',
                cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.3rem'
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}