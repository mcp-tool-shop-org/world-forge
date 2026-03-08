// TemplateManager.tsx — unified template browser (genres + samples + user templates)

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { useTemplateStore, type UserTemplate } from '../store/template-store.js';
import { GENRE_TEMPLATES, SAMPLE_WORLDS, createProjectFromWizard } from '../templates/registry.js';
import type { WorldProject } from '@world-forge/schema';

interface Props { onClose: () => void }

type Tab = 'genres' | 'samples' | 'templates';

function countContent(p: WorldProject) {
  return {
    zones: p.zones.length,
    entities: p.entityPlacements.length,
    dialogues: p.dialogues.length,
    trees: p.progressionTrees.length,
    items: p.itemPlacements.length,
  };
}

export function TemplateManager({ onClose }: Props) {
  const { loadProject } = useProjectStore();
  const resetChecklist = useEditorStore((s) => s.resetChecklist);
  const { templates, loadTemplates, duplicateTemplate, deleteTemplate } = useTemplateStore();

  const [tab, setTab] = useState<Tab>('genres');

  // Wizard state (genres tab)
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('blank');
  const [includePlayer, setIncludePlayer] = useState(false);
  const [includeBuildCatalog, setIncludeBuildCatalog] = useState(false);
  const [includeProgressionTree, setIncludeProgressionTree] = useState(false);
  const [includeDialogue, setIncludeDialogue] = useState(false);
  const [includeSampleNPCs, setIncludeSampleNPCs] = useState(false);

  // Template management state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const selectGenre = (id: string) => {
    setGenre(id);
    const isTemplate = id !== 'blank';
    setIncludePlayer(isTemplate);
    setIncludeBuildCatalog(isTemplate);
    setIncludeProgressionTree(isTemplate);
    setIncludeDialogue(isTemplate);
    setIncludeSampleNPCs(isTemplate);
  };

  const handleCreate = useCallback(() => {
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
  }, [name, genre, includePlayer, includeBuildCatalog, includeProgressionTree, includeDialogue, includeSampleNPCs, loadProject, resetChecklist, onClose]);

  const handleOpenSample = useCallback((project: WorldProject) => {
    const copy: WorldProject = JSON.parse(JSON.stringify(project));
    copy.id = `sample-${Date.now()}`;
    loadProject(copy);
    resetChecklist();
    onClose();
  }, [loadProject, resetChecklist, onClose]);

  const handleOpenTemplate = useCallback((template: UserTemplate) => {
    const copy: WorldProject = JSON.parse(JSON.stringify(template.project));
    copy.id = `from-template-${Date.now()}`;
    copy.name = `${template.name} Project`;
    loadProject(copy);
    resetChecklist();
    onClose();
  }, [loadProject, resetChecklist, onClose]);

  const handleDuplicate = useCallback((id: string) => {
    duplicateTemplate(id);
  }, [duplicateTemplate]);

  const handleDelete = useCallback((id: string) => {
    if (confirmDelete === id) {
      deleteTemplate(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }, [confirmDelete, deleteTemplate]);

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#c9d1d9' }}>New Project</h3>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #30363d', marginBottom: 16 }}>
          {(['genres', 'samples', 'templates'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setStep(1); }}
              style={{
                background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #58a6ff' : '2px solid transparent',
                color: tab === t ? '#58a6ff' : '#8b949e', padding: '8px 16px', cursor: 'pointer', fontSize: 12,
              }}
            >
              {t === 'genres' ? 'Genres' : t === 'samples' ? 'Samples' : `My Templates (${templates.length})`}
            </button>
          ))}
        </div>

        {/* Genres tab */}
        {tab === 'genres' && step === 1 && (
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
                style={genre === 'blank' ? selectedCardBtnStyle : cardBtnStyle}
              >
                <div style={{ fontSize: 18 }}>{'\u2B1C'}</div>
                <div style={{ fontSize: 12, fontWeight: 'bold' }}>Blank</div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>Empty canvas</div>
              </button>
              {GENRE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectGenre(t.id)}
                  style={genre === t.id ? selectedCardBtnStyle : cardBtnStyle}
                >
                  <div style={{ fontSize: 18 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 'bold' }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: '#8b949e' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'genres' && step === 2 && (
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
          </>
        )}

        {/* Samples tab */}
        {tab === 'samples' && (
          <>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 12 }}>
              Open a sample to explore, learn from, or build on. Each opens as an editable copy.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SAMPLE_WORLDS.map((sample) => {
                const c = countContent(sample.project);
                return (
                  <div key={sample.id} style={sampleCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: '#c9d1d9' }}>{sample.name}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 'bold', ...badgeColors[sample.complexity] }}>
                        {sample.complexity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>{sample.description}</div>
                    <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8 }}>
                      {c.zones} zones &middot; {c.entities} entities &middot; {c.dialogues} dialogues &middot; {c.trees} trees &middot; {c.items} items
                    </div>
                    <button onClick={() => handleOpenSample(sample.project)} style={openBtnStyle}>Open as Copy</button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* My Templates tab */}
        {tab === 'templates' && (
          <>
            {templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 8 }}>No templates yet.</div>
                <div style={{ fontSize: 11, color: '#484f58' }}>
                  Save your current project as a template to see it here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {templates.map((t) => {
                  const c = countContent(t.project);
                  return (
                    <div key={t.id} style={sampleCardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{t.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#c9d1d9' }}>{t.name}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 'bold', background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>
                          {t.genre}
                        </span>
                      </div>
                      {t.description && <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>{t.description}</div>}
                      <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8 }}>
                        {c.zones} zones &middot; {c.entities} entities &middot; {c.dialogues} dialogues &middot; {c.items} items
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleOpenTemplate(t)} style={openBtnStyle}>Open</button>
                        <button onClick={() => handleDuplicate(t.id)} style={smallBtnStyle}>Duplicate</button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          style={{ ...smallBtnStyle, color: confirmDelete === t.id ? '#f85149' : '#8b949e' }}
                        >
                          {confirmDelete === t.id ? 'Confirm?' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          {tab === 'genres' && step === 2 && (
            <button onClick={() => setStep(1)} style={btnStyle}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          {tab === 'genres' && step === 1 && (
            <button onClick={() => setStep(2)} style={{ ...btnStyle, background: '#238636', color: '#fff' }}>Next</button>
          )}
          {tab === 'genres' && step === 2 && (
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
  padding: 20, width: 520, maxHeight: '85vh', overflow: 'auto',
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

const selectedCardBtnStyle: React.CSSProperties = {
  ...cardBtnStyle,
  border: '2px solid #58a6ff', background: '#0d1d30',
};

const sampleCardStyle: React.CSSProperties = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: 12,
};

const badgeColors: Record<string, React.CSSProperties> = {
  minimal: { background: '#0d2818', color: '#3fb950', border: '1px solid #238636' },
  intermediate: { background: '#0d1d30', color: '#58a6ff', border: '1px solid #1f6feb' },
  rich: { background: '#2a1c08', color: '#d29922', border: '1px solid #9e6a03' },
};

const openBtnStyle: React.CSSProperties = {
  background: '#238636', color: '#fff', border: 'none', borderRadius: 4,
  padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold',
};

const smallBtnStyle: React.CSSProperties = {
  background: 'none', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4,
  padding: '4px 10px', cursor: 'pointer', fontSize: 10,
};

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 18, cursor: 'pointer',
};
