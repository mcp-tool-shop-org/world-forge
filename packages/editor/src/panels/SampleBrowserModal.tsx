// SampleBrowserModal.tsx — browse and open sample worlds

import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { SAMPLE_WORLDS } from '../templates/registry.js';
import type { WorldProject } from '@world-forge/schema';

interface Props {
  onClose: () => void;
}

function countContent(p: WorldProject) {
  return {
    zones: p.zones.length,
    entities: p.entityPlacements.length,
    dialogues: p.dialogues.length,
    trees: p.progressionTrees.length,
    items: p.itemPlacements.length,
  };
}

export function SampleBrowserModal({ onClose }: Props) {
  const { loadProject } = useProjectStore();
  const resetChecklist = useEditorStore((s) => s.resetChecklist);

  const handleOpen = (project: WorldProject) => {
    const copy: WorldProject = JSON.parse(JSON.stringify(project));
    copy.id = `sample-${Date.now()}`;
    loadProject(copy);
    resetChecklist();
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#c9d1d9' }}>Sample Worlds</h3>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 16 }}>
          Open a sample to explore, learn from, or build on. Each opens as an editable copy.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SAMPLE_WORLDS.map((sample) => {
            const c = countContent(sample.project);
            return (
              <div key={sample.id} style={sampleCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 'bold', color: '#c9d1d9' }}>{sample.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 'bold',
                    ...badgeColors[sample.complexity],
                  }}>
                    {sample.complexity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>{sample.description}</div>
                <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8 }}>
                  {c.zones} zones &middot; {c.entities} entities &middot; {c.dialogues} dialogues &middot; {c.trees} trees &middot; {c.items} items
                </div>
                <button onClick={() => handleOpen(sample.project)} style={openBtnStyle}>Open as Copy</button>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnStyle}>Close</button>
        </div>
      </div>
    </div>
  );
}

const badgeColors: Record<string, React.CSSProperties> = {
  minimal: { background: '#0d2818', color: '#3fb950', border: '1px solid #238636' },
  intermediate: { background: '#0d1d30', color: '#58a6ff', border: '1px solid #1f6feb' },
  rich: { background: '#2a1c08', color: '#d29922', border: '1px solid #9e6a03' },
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
};

const cardStyle: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
  padding: 20, width: 460, maxHeight: '85vh', overflow: 'auto',
};

const sampleCardStyle: React.CSSProperties = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: 12,
};

const openBtnStyle: React.CSSProperties = {
  background: '#238636', color: '#fff', border: 'none', borderRadius: 4,
  padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold',
};

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};
