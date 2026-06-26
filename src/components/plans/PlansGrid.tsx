import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GridLayout, noCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { usePlans, type PlanFormData } from '../../hooks/usePlans';
import { usePlanLayouts } from '../../hooks/usePlanLayouts';
import { PlanCard } from './PlanCard';
import { PlanModal } from './PlanModal';
import { PlanDrawer } from './PlanDrawer';

import { ENV } from '../../lib/env';

const COLS       = ENV.PLAN_GRID_COLS;
const ROW_HEIGHT = ENV.PLAN_ROW_HEIGHT;

/** Measure container width via ResizeObserver (no extra package). */
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure(); // capture immediately
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Persist a Set<string> to localStorage. */
function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}
function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]));
}

const PINNED_LS_KEY = 'plan-grid-pinned';
const LOCKED_LS_KEY = 'plan-grid-locked';

export function PlansGrid() {
  const { plans, loading, savePlan, deletePlan, EMPTY_FORM, refresh } = usePlans();
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<{ form: PlanFormData; id: string } | null>(null);
  const [drawerPlanId, setDrawerPlanId] = useState<string | null>(null);

  // Pin / Lock state (persisted in localStorage)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => loadSet(PINNED_LS_KEY));
  const [locked, setLocked] = useState(() => localStorage.getItem(LOCKED_LS_KEY) === '1');

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  // plans are already sorted GS-wise by usePlans hook
  // Reset layout is exposed from usePlanLayouts
  const planIds = useMemo(() => plans.map((p) => p.plan_id), [plans]);
  const { layout, saveLayout, removeLayout, resetLayout, loaded } = usePlanLayouts(planIds);

  // Apply static=true for pinned/locked cards
  const effectiveLayout = useMemo(() =>
    layout.map((item) => ({
      ...item,
      static: locked || pinnedIds.has(item.i),
    })),
  [layout, locked, pinnedIds]);

  const handleOpen = useCallback((planId: string) => {
    setDrawerPlanId(planId);
  }, []);

  const handleDelete = useCallback(
    (planId: string) => {
      deletePlan(planId);
      removeLayout(planId);
    },
    [deletePlan, removeLayout],
  );

  const handlePin = useCallback((planId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      saveSet(PINNED_LS_KEY, next);
      return next;
    });
  }, []);

  const toggleLock = useCallback(() => {
    setLocked((prev) => {
      const next = !prev;
      localStorage.setItem(LOCKED_LS_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setEditPlan(null);
  };

  const drawerPlan = drawerPlanId ? plans.find((p) => p.plan_id === drawerPlanId) ?? null : null;

  if (loading || !loaded) {
    return (
      <div className="neo-card rounded-3xl p-6">
        <p className="text-xs text-slate-400 font-mono">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="heading-font text-xl font-black">My Plans</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (window.confirm('Reset all card positions to compact default (6 per row)?')) resetLayout(); }}
            className="cursor-pointer text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all font-mono border bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
            title="Reset all card positions to compact grid"
          >
            ↺ RESET
          </button>
          <button
            onClick={toggleLock}
            title={locked ? 'Click to unlock — allows drag & resize' : 'Click to lock — prevents accidental changes'}
            className={`cursor-pointer text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all font-mono border ${
              locked
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-slate-500/20'
            }`}
          >
            {locked ? '🔓 UNLOCK' : '🔒 LOCK'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg shadow-violet-500/20 font-mono btn-vibrant"
          >
            + CREATE NEW PLAN
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="neo-card rounded-3xl p-6 text-center">
          <h3 className="heading-font text-lg font-black mb-2">No Plans Yet</h3>
          <p className="text-xs text-slate-400">Create your first study plan to start tracking weekly sprints, revision blocks, and custom schedules.</p>
        </div>
      ) : (
        <div ref={containerRef} className="plan-grid-container">
          <GridLayout
            className="plan-rgl"
            layout={effectiveLayout as unknown as Layout}
            gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: [12, 12], containerPadding: [0, 0] }}
            dragConfig={{ enabled: !locked }}
            resizeConfig={{ enabled: !locked, handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] }}
            compactor={noCompactor}
            width={containerWidth}
            onLayoutChange={(rgl) => {
              if (!locked) saveLayout([...rgl].map(({ i, x, y, w, h, minW, minH }) => ({ i, x, y, w, h, minW, minH })));
            }}
          >
            {plans.map((p) => (
              <div key={p.plan_id}>
                <PlanCard
                  plan={p}
                  onOpen={handleOpen}
                  onDelete={handleDelete}
                  pinned={pinnedIds.has(p.plan_id)}
                  onPin={handlePin}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      )}

      <PlanModal open={modalOpen} initial={EMPTY_FORM} onSave={savePlan} onClose={closeModal} />
      {editPlan && (
        <PlanModal open={true} initial={editPlan.form} editId={editPlan.id} onSave={savePlan} onClose={closeModal} />
      )}
      {drawerPlan && (
        <PlanDrawer plan={drawerPlan} onClose={() => setDrawerPlanId(null)} onPlanUpdated={refresh} />
      )}
    </div>
  );
}
