import { useState, useRef, useCallback, type FormEvent } from 'react';
import { GridLayout, noCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  useSources,
  type SourceFormData,
  EMPTY_SOURCE_FORM,
  SOURCE_TOPICS,
  TOPIC_COLORS,
} from '../../hooks/useSources';
import { useSourceLayouts } from '../../hooks/useSourceLayouts';
import { useToast } from '../common/Toast';
import { PlanTable } from '../plans/PlanTable';
import { ENV } from '../../lib/env';

// All resize handles — north, south, east, west + all corners
const ALL_HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

const SRC_PINNED_KEY = 'source-card-pinned';
const SRC_LOCKED_KEY = 'source-card-locked';

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function saveSet(key: string, s: Set<string>) { localStorage.setItem(key, JSON.stringify([...s])); }

export function SourcesView() {
  const { sources, loading, saveSource, deleteSource } = useSources();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editState, setEditState] = useState<{ form: SourceFormData; id?: string } | null>(null);
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => loadSet(SRC_PINNED_KEY));
  const [locked, setLocked] = useState(() => localStorage.getItem(SRC_LOCKED_KEY) === '1');

  const sortedSources = [
    ...sources.filter((s) => pinnedIds.has(s.source_id)),
    ...sources.filter((s) => !pinnedIds.has(s.source_id)),
  ];
  const sourceIds = sortedSources.map((s) => s.source_id);

  const { layout, saveLayout, removeLayout, resetLayout } = useSourceLayouts(sourceIds);

  const [containerWidth, setContainerWidth] = useState(800);
  const roRef = useRef<ResizeObserver | null>(null);
  const attachRef = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) roRef.current.disconnect();
    if (!el) return;
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setContainerWidth(w); };
    roRef.current = new ResizeObserver(measure);
    roRef.current.observe(el);
    measure();
  }, []);

  const toggleLock = () => { const next = !locked; setLocked(next); localStorage.setItem(SRC_LOCKED_KEY, next ? '1' : '0'); };
  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); saveSet(SRC_PINNED_KEY, next); return next; });
  }, []);
  const toggleTable = (sourceId: string) => setOpenTables((prev) => ({ ...prev, [sourceId]: !prev[sourceId] }));
  const openCreate = () => { setEditState({ form: { ...EMPTY_SOURCE_FORM } }); setModalOpen(true); };
  const openEdit = (sourceId: string) => {
    const s = sources.find((x) => x.source_id === sourceId);
    if (!s) return;
    setEditState({ id: sourceId, form: { title: s.title, link: s.link ?? '', topic: s.topic, notes: s.notes ?? '' } });
    setModalOpen(true);
  };
  const handleSave = (form: SourceFormData, id?: string) => {
    saveSource(form, id); setModalOpen(false); setEditState(null);
    showToast(id ? 'Source updated' : 'Source added', 'success');
  };
  const handleDelete = (sourceId: string) => {
    deleteSource(sourceId); removeLayout(sourceId); showToast('Source deleted', 'success'); setConfirmDeleteId(null);
  };

  if (loading) return <div className="neo-card rounded-3xl p-6"><p className="text-xs text-slate-400 font-mono">Loading sources...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="heading-font text-xl font-black">Sources &amp; Reference Links</h2>
          <p className="text-xs text-[var(--t3)] mt-0.5">Save study materials, YouTube channels, PDFs, websites — anything useful for your prep.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (window.confirm('Reset all source card positions to default grid?')) resetLayout(); }}
            className="cursor-pointer text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all font-mono border bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400">
            ↺ RESET
          </button>
          <button onClick={toggleLock}
            className="cursor-pointer text-[10px] font-bold font-mono px-3 py-1.5 rounded-lg border transition-all"
            style={{ background: locked ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.08)', border: locked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,102,241,0.25)', color: locked ? '#f87171' : '#a5b4fc' }}
            title={locked ? 'Click to unlock — resize from any side' : 'Click to lock — prevents accidental changes'}>
            {locked ? '🔓 UNLOCK' : '🔒 LOCK'}
          </button>
          <button onClick={openCreate}
            className="cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg shadow-violet-500/20 font-mono btn-vibrant">
            + ADD SOURCE
          </button>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="neo-card rounded-3xl p-6 text-center">
          <h3 className="heading-font text-lg font-black mb-2">No Sources Yet</h3>
          <p className="text-xs text-slate-400">Add books, YouTube channels, newspapers, and online resources you use for UPSC prep.</p>
        </div>
      ) : (
        <div ref={attachRef} style={{ width: '100%' }}>
          <GridLayout
            layout={layout}
            gridConfig={{ cols: ENV.SOURCE_GRID_COLS, rowHeight: ENV.SOURCE_ROW_HEIGHT, margin: [ENV.SOURCE_GRID_MARGIN, ENV.SOURCE_GRID_MARGIN], containerPadding: [0, 0] }}
            dragConfig={{ enabled: !locked }}
            resizeConfig={{ enabled: !locked, handles: ALL_HANDLES }}
            compactor={noCompactor}
            width={containerWidth}
            onLayoutChange={(rgl) => { if (!locked) saveLayout(rgl); }}
          >
            {sortedSources.map((s) => {
              const color = TOPIC_COLORS[s.topic] ?? '#64748b';
              const pinned = pinnedIds.has(s.source_id);
              return (
                <div key={s.source_id} style={{ overflow: 'hidden' }}>
                  <div className="neo-card rounded-2xl p-3 h-full flex flex-col border-l-4 transition hover:shadow-md"
                    style={{ borderLeftColor: color, overflow: 'auto' }}>
                    <div className="src-card-handle flex justify-between items-start mb-2 cursor-grab active:cursor-grabbing select-none">
                      <span className="text-sm font-black text-slate-200 leading-tight pr-1">{s.title}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); togglePin(s.source_id); }} className="text-[11px] cursor-pointer" style={{ background: 'none', border: 'none', padding: '0.1rem', opacity: pinned ? 1 : 0.4 }} title={pinned ? 'Unpin' : 'Pin to top'}>📌</button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(s.source_id); }} className="text-[11px] cursor-pointer" style={{ background: 'none', border: 'none', padding: '0.1rem' }} title="Edit">✏️</button>
                        {confirmDeleteId === s.source_id ? (
                          <span className="src-confirm-del">
                            <button className="src-cd-yes" onClick={() => handleDelete(s.source_id)}>Delete</button>
                            <button className="src-cd-no" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.source_id); }} className="text-[11px] cursor-pointer" style={{ background: 'none', border: 'none', padding: '0.1rem' }} title="Delete">🗑️</button>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-full w-fit"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{s.topic}</span>
                    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-indigo-400 font-mono mt-2 truncate hover:underline">🔗 {s.link}</a>}
                    {s.notes && <p className="text-[11px] text-slate-400 mt-2">{s.notes}</p>}
                    <button onClick={() => toggleTable(s.source_id)}
                      className="mt-2 text-[10px] font-bold font-mono px-2 py-1 rounded-lg border border-violet-500/20 text-violet-300 hover:bg-violet-500/10 cursor-pointer w-fit" style={{ background: 'none' }}>
                      {openTables[s.source_id] ? '⊟ Hide Table' : '⊞ Table'}
                    </button>
                    {openTables[s.source_id] && <div className="mt-2"><PlanTable planId={s.source_id} /></div>}
                  </div>
                </div>
              );
            })}
          </GridLayout>
        </div>
      )}

      {modalOpen && editState && (
        <SourceModal form={editState.form} editId={editState.id} onSave={handleSave} onClose={() => { setModalOpen(false); setEditState(null); }} />
      )}
    </div>
  );
}
function SourceModal({
  form: initial,
  editId,
  onSave,
  onClose,
}: {
  form: SourceFormData;
  editId?: string;
  onSave: (form: SourceFormData, id?: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);

  const set = <K extends keyof SourceFormData>(k: K, v: SourceFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form, editId);
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surf)',
    border: '1px solid var(--bdr)',
    borderRadius: '0.4rem',
    padding: '0.3rem 0.55rem',
    fontSize: '0.72rem',
    color: 'var(--t1)',
    fontFamily: 'var(--mono)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,4,20,0.72)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--card)', backdropFilter: 'blur(40px) saturate(200%)',
        border: '1px solid var(--bdr-h)', borderRadius: '1.5rem', padding: '2rem 1.75rem',
        maxWidth: 440, width: '100%', margin: '1rem', boxShadow: 'var(--shd)',
        animation: 'dropIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '1rem', fontWeight: 900, color: 'var(--t1)', marginBottom: '1rem' }}>
          {editId ? '✏️ Edit Source' : '📚 Add Source'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Title *</label>
            <input style={fieldStyle} value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Link (URL)</label>
            <input style={fieldStyle} value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://..." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Topic</label>
            <select style={fieldStyle} value={form.topic} onChange={(e) => set('topic', e.target.value)}>
              {SOURCE_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Notes</label>
            <textarea style={{ ...fieldStyle, resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Quick notes..." />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '0.7rem', border: '1px solid var(--bdr)', background: 'var(--surf)',
              color: 'var(--t2)', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
            }}>Cancel</button>
            <button type="submit" style={{
              flex: 1, padding: '0.7rem', border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)',
              color: 'white', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem',
              boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            }}>{editId ? 'Save Changes' : 'Add Source'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
