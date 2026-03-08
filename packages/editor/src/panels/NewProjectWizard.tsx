// NewProjectWizard.tsx — new project wizard modal

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { GENRE_TEMPLATES, createProjectFromWizard } from '../templates/registry.js';

interface Props {
  onClose: () => void;
  onOpenSamples: () => void;
}

export function NewProjectWizard({ onClose, onOpenSamples }: Props) {
  const { loadProject } = useProjectStore();
  const resetChecklist = useEditorStore((s) => s.resetChecklist);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('blank');
  const [includePlayer, setIncludePlayer] = useState(false);
  const [includeBuildCatalog, setIncludeBuildCatalog] = useState(false);
  const [includeProgressionTree, setIncludeProgressionTree] = useState(false);
  const [includeDialogue, setIncludeDialogue] = useState(false);
  const [includeSampleNPCs, setIncludeSampleNPCs] = useState(false);

  const selectGenre = (id: string) => {
    setGenre(id);
    const isTemplate = id !== 'blank';
    setIncludePlayer(isTemplate);
    setIncludeBuildCatalog(isTemplate);
    setIncludeProgressionTree(isTemplate);
    setIncludeDialogue(isTemplate);
    setIncludeSampleNPCs(isTemplate);
  };

  const handleCreate = () => {
    const project = createProjectFromWizard({
      name: name || 'Untitled World',
      genre,
      includePlayer,
      includeBuildCatalog,
      includeProgressionTree,
      includeDialogue,
      includeSampleNPCs,
    });
    loadProject(project);
    resetChecklist();
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#c9d1d9' }}>New Project</h3>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 16 }}>
          {step === 1 ? 'Choose a name and starting template.' : 'Select what to include.'}
        </div>

        {step === 1 && (
          <>
            <label style={labelStyle}>Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My First World"
              style={inputStyle}
              autoFocus
            />

            <label style={{ ...labelStyle, marginTop: 12 }}>Template</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => selectGenre('blank')}
                style={genre === 'blank' ? selectedCardStyle : cardBtnStyle}
              >
                <div style={{ fontSize: 18 }}>{'\u2B1C'}</div>
                <div style={{ fontSize: 12, fontWeight: 'bold' }}>Blank</div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>Empty canvas</div>
              </button>
              {GENRE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectGenre(t.id)}
                  style={genre === t.id ? selectedCardStyle : cardBtnStyle}
                >
                  <div style={{ fontSize: 18 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 'bold' }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: '#8b949e' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 12, color: '#c9d1d9', marginBottom: 8 }}>
              Template: <strong>{genre === 'blank' ? 'Blank' : GENRE_TEMPLATES.find((t) => t.id === genre)?.name}</strong>
            </div>

            <label style={labelStyle}>Include in project:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CheckItem label="Player template" checked={includePlayer} onChange={setIncludePlayer} hint="Starting stats, inventory, spawn" />
              <CheckItem label="Build catalog" checked={includeBuildCatalog} onChange={setIncludeBuildCatalog} hint="Archetypes, backgrounds, traits" />
              <CheckItem label="Progression tree" checked={includeProgressionTree} onChange={setIncludeProgressionTree} hint="Skills and abilities" />
              <CheckItem label="Starter dialogue" checked={includeDialogue} onChange={setIncludeDialogue} hint="NPC conversation example" />
              <CheckItem label="Sample NPCs" checked={includeSampleNPCs} onChange={setIncludeSampleNPCs} hint="Pre-placed entities and items" />
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: '#58a6ff', cursor: 'pointer' }} onClick={() => { onClose(); onOpenSamples(); }}>
              Or load a sample world instead...
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          {step === 2 && (
            <button onClick={() => setStep(1)} style={btnStyle}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} style={{ ...btnStyle, background: '#238636', color: '#fff' }}>Next</button>
          ) : (
            <button onClick={handleCreate} style={{ ...btnStyle, background: '#238636', color: '#fff' }}>Create</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#c9d1d9', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        <span style={{ fontSize: 10, color: '#8b949e', marginLeft: 6 }}>{hint}</span>
      </span>
    </label>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};

const cardStyle: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
  padding: 20, width: 480, maxHeight: '85vh', overflow: 'auto',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 4,
  background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d',
  boxSizing: 'border-box',
};

const cardBtnStyle: React.CSSProperties = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
  padding: '8px 6px', cursor: 'pointer', textAlign: 'center', color: '#c9d1d9',
};

const selectedCardStyle: React.CSSProperties = {
  ...cardBtnStyle,
  border: '2px solid #58a6ff', background: '#0d1d30',
};

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};
