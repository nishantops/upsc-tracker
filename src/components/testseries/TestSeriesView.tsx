import { useState, memo } from 'react';
import { useTracker } from '../../hooks/useTracker';
import { TS_PRELIMS, TS_MAINS, type TSPaper } from '../../data/ts-data';

type Stage = 'prelims' | 'mains';

export function TestSeriesView() {
  const { progress, toggleCheck, updateNote, syncStatus } = useTracker();
  const [stage, setStage] = useState<Stage>('prelims');
  const [activePaper, setActivePaper] = useState(0);

  const papers = stage === 'prelims' ? TS_PRELIMS : TS_MAINS;
  const paper = papers[activePaper] ?? papers[0];

  const total = paper.items.length;
  const done = paper.items.filter((_, i) => progress[`ts_${paper.prefix}_${i}`]?.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="ts-view">
      {/* Sync badge */}
      <div className="sync-bar">
        <span className={`sync-badge ${syncStatus}`}>
          {syncStatus === 'saving' ? '⏳ Saving…' : syncStatus === 'synced' ? '✓ Synced' : '⚠ Offline'}
        </span>
      </div>

      {/* Stage tabs */}
      <div className="ts-stages">
        {(['prelims', 'mains'] as Stage[]).map((s) => (
          <button
            key={s}
            className={`ts-stage-btn ${stage === s ? 'ts-stage-active' : ''}`}
            onClick={() => { setStage(s); setActivePaper(0); }}
          >
            {s === 'prelims' ? 'Stage I: Prelims' : 'Stage II: Mains & Optional'}
          </button>
        ))}
      </div>

      {/* Paper sub-tabs */}
      <div className="ts-papers">
        {papers.map((p, i) => (
          <button
            key={p.key}
            className={`ts-paper-btn ${activePaper === i ? 'ts-paper-active' : ''}`}
            onClick={() => setActivePaper(i)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="ts-progress">
        <div className="ts-progress-bar" style={{ width: `${pct}%` }} />
        <span className="ts-progress-label">{done}/{total} completed ({pct}%)</span>
      </div>

      {/* Items */}
      <div className="ts-items">
        {paper.items.map((name, idx) => (
          <TSRow
            key={`${paper.prefix}-${idx}`}
            name={name}
            dataKey={`ts_${paper.prefix}_${idx}`}
            checked={!!progress[`ts_${paper.prefix}_${idx}`]?.checked}
            note={progress[`ts_${paper.prefix}_${idx}`]?.note ?? ''}
            onToggle={toggleCheck}
            onNote={updateNote}
          />
        ))}
      </div>
    </div>
  );
}

const TSRow = memo(function TSRow({
  name,
  dataKey,
  checked,
  note,
  onToggle,
  onNote,
}: {
  name: string;
  dataKey: string;
  checked: boolean;
  note: string;
  onToggle: (key: string) => void;
  onNote: (key: string, note: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className={`ts-row ${checked ? 'ts-done' : ''}`}>
      <label className="ts-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(dataKey)}
          className="ts-checkbox"
        />
        <span className="ts-name">{name}</span>
      </label>
      <button className="ts-note-toggle" onClick={() => setShowNote((o) => !o)}>
        {note ? '📝' : '✏️'}
      </button>
      {showNote && (
        <textarea
          className="ts-note-input"
          placeholder="Score, remarks, date attempted…"
          value={note}
          onChange={(e) => onNote(dataKey, e.target.value)}
          rows={2}
        />
      )}
    </div>
  );
});
