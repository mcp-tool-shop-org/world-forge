// TemplateManager.tsx — unified template browser (genres + samples + user templates)

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { useTemplateStore, type UserTemplate } from '../store/template-store.js';
import { GENRE_TEMPLATES, SAMPLE_WORLDS, createProjectFromWizard } from '../templates/registry.js';
import { useKitStore, filterKitsByMode, serializeKit, kitFilename } from '../kits/index.js';
import type { StarterKit } from '../kits/index.js';
import type { WorldProject, AuthoringMode } from '@world-forge/schema';
import { AUTHORING_MODES } from '@world-forge/schema';
import { MODE_PROFILES } from '../mode-profiles.js';
import { EditKitModal } from './EditKitModal.js';
import { ImportKitModal } from './ImportKitModal.js';
import { ACTIVE_TAB_BG } from './shared.js';
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase, modalFooter } from '../ui/styles.js';

interface Props { onClose: () => void }

type Tab = 'genres' | 'starters' | 'samples' | 'templates';

export function countContent(p: WorldProject) {
  return {
    zones: p.zones.length,
    entities: p.entityPlacements.length,
    dialogues: p.dialogues.length,
    trees: p.progressionTrees.length,
    items: p.itemPlacements.length,
  };
}

/** Create a new project from a StarterKit (deep clone + new ID). */
export function createProjectFromKit(kit: StarterKit, projectName?: string): WorldProject {
  const copy: WorldProject = JSON.parse(JSON.stringify(kit.project));
  copy.id = `project-${Date.now()}`;
  copy.name = projectName || kit.name;
  return copy;
}

export function TemplateManager({ onClose }: Props) {
  const { loadProject } = useProjectStore();
  const resetChecklist = useEditorStore((s) => s.resetChecklist);
  const setActiveKitId = useEditorStore((s) => s.setActiveKitId);
  const { templates, loadTemplates, duplicateTemplate, deleteTemplate } = useTemplateStore();
  const { kits, loadKits, duplicateKit: duplicateKitAction, deleteKit: deleteKitAction } = useKitStore();

  const [tab, setTab] = useState<Tab>('genres');

  // Wizard state (genres tab)
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<AuthoringMode>('dungeon');
  const [genre, setGenre] = useState('blank');
  const [includePlayer, setIncludePlayer] = useState(false);
  const [includeBuildCatalog, setIncludeBuildCatalog] = useState(false);
  const [includeProgressionTree, setIncludeProgressionTree] = useState(false);
  const [includeDialogue, setIncludeDialogue] = useState(false);
  const [includeSampleNPCs, setIncludeSampleNPCs] = useState(false);

  // Template management state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteKit, setConfirmDeleteKit] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<AuthoringMode | undefined>(undefined);
  const [editingKit, setEditingKit] = useState<StarterKit | null>(null);
  const [showImportKit, setShowImportKit] = useState(false);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadKits(); }, [loadKits]);

  // Samples mode filter
  const [sampleModeFilter, setSampleModeFilter] = useState<AuthoringMode | undefined>(undefined);

  const selectGenre = (id: string) => {
    setGenre(id);
    const isTemplate = id !== 'blank';
    setIncludePlayer(isTemplate);
    setIncludeBuildCatalog(isTemplate);
    setIncludeProgressionTree(isTemplate);
    setIncludeDialogue(isTemplate);
    setIncludeSampleNPCs(isTemplate);
    // Auto-default mode from genre template
    const template = GENRE_TEMPLATES.find((t) => t.id === id);
    if (template?.mode) setMode(template.mode);
  };

  const handleCreate = useCallback(() => {
    const project = createProjectFromWizard({
      name: name || 'Untitled World',
      genre,
      mode,
      includePlayer,
      includeBuildCatalog,
      includeProgressionTree,
      includeDialogue,
      includeSampleNPCs,
    });
    loadProject(project);
    resetChecklist();
    onClose();
  }, [name, genre, mode, includePlayer, includeBuildCatalog, includeProgressionTree, includeDialogue, includeSampleNPCs, loadProject, resetChecklist, onClose]);

  const handleOpenKit = useCallback((kit: StarterKit) => {
    const project = createProjectFromKit(kit, name || undefined);
    loadProject(project);
    resetChecklist();
    setActiveKitId(kit.id);
    onClose();
  }, [name, loadProject, resetChecklist, setActiveKitId, onClose]);

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

  const handleDuplicateKit = useCallback((id: string) => {
    duplicateKitAction(id);
  }, [duplicateKitAction]);

  const handleExportKit = useCallback((kit: StarterKit) => {
    const bundle = serializeKit(kit);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = kitFilename(kit.name);
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDeleteKit = useCallback((id: string) => {
    if (confirmDeleteKit === id) {
      deleteKitAction(id);
      setConfirmDeleteKit(null);
    } else {
      setConfirmDeleteKit(id);
    }
  }, [confirmDeleteKit, deleteKitAction]);

  return (
    <ModalFrame title="New Project" width={520} onClose={onClose}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #30363d', marginBottom: 16 }}>
          {(['genres', 'starters', 'samples', 'templates'] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              genres: 'Genres',
              starters: 'Starter Kits',
              samples: 'Samples',
              templates: `My Templates (${templates.length})`,
            };
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setStep(1); }}
                style={{
                  background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #58a6ff' : '2px solid transparent',
                  color: tab === t ? '#58a6ff' : '#8b949e', padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                }}
              >
                {labels[t]}
              </button>
            );
          })}
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

            <label style={{ ...labelStyle, marginTop: 12 }}>Scale</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {AUTHORING_MODES.map((m) => {
                const p = MODE_PROFILES[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      background: mode === m ? '#0d1d30' : '#0d1117',
                      border: mode === m ? '2px solid #58a6ff' : '1px solid #30363d',
                      borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: '#c9d1d9',
                      fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    title={p.description}
                  >
                    <span style={{ fontSize: 13 }}>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 10, color: '#58a6ff', marginBottom: 12, fontStyle: 'italic' }}>
              {MODE_PROFILES[mode].icon} {MODE_PROFILES[mode].description}
            </div>

            <label style={{ ...labelStyle }}>Template</label>
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

        {/* Starter Kits tab */}
        {tab === 'starters' && (
          <>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 12 }}>
              Browse starter kits to begin a new project. Built-in kits ship with World Forge; custom kits are ones you&apos;ve saved.
            </div>
            <label style={labelStyle}>Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave blank to use kit name"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilterMode(undefined)}
                style={{
                  background: filterMode === undefined ? '#0d1d30' : '#0d1117',
                  border: filterMode === undefined ? '2px solid #58a6ff' : '1px solid #30363d',
                  borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                  color: filterMode === undefined ? '#58a6ff' : '#8b949e', fontSize: 10,
                }}
              >
                All
              </button>
              {AUTHORING_MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  style={{
                    background: filterMode === m ? '#0d1d30' : '#0d1117',
                    border: filterMode === m ? '2px solid #58a6ff' : '1px solid #30363d',
                    borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                    color: filterMode === m ? '#58a6ff' : '#8b949e', fontSize: 10,
                  }}
                >
                  {MODE_PROFILES[m].icon} {MODE_PROFILES[m].label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowImportKit(true)} style={smallBtnStyle}>Import Kit</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filterKitsByMode(kits, filterMode).map((kit) => {
                const c = countContent(kit.project);
                const presetCount = kit.presetRefs.region.length + kit.presetRefs.encounter.length;
                return (
                  <div key={kit.id} style={sampleCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16 }}>{kit.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: '#c9d1d9' }}>{kit.name}</span>
                      {kit.builtIn && <span style={{ fontSize: 10, color: '#8b949e' }} title="Built-in kit">{'\uD83D\uDD12'}</span>}
                      {!kit.builtIn && kit.source === 'imported' && (
                        <span style={importedBadgeStyle} title="Imported kit">imported</span>
                      )}
                      {!kit.builtIn && kit.source !== 'imported' && (
                        <span style={customBadgeStyle} title="Custom kit">custom</span>
                      )}
                      {kit.modes.map((m) => (
                        <span key={m} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#21262d', color: '#8b949e' }}>
                          {MODE_PROFILES[m].icon} {MODE_PROFILES[m].label}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{kit.description}</div>
                    {kit.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                        {kit.tags.map((tag) => (
                          <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#21262d', color: '#484f58' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8 }}>
                      {c.zones} zones &middot; {c.entities} entities &middot; {c.dialogues} dialogues &middot; {c.trees} trees &middot; {c.items} items
                      {presetCount > 0 && <> &middot; {presetCount} presets</>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleOpenKit(kit)} style={openBtnStyle}>Start Project</button>
                      <button onClick={() => handleDuplicateKit(kit.id)} style={smallBtnStyle}>Duplicate</button>
                      <button onClick={() => handleExportKit(kit)} style={smallBtnStyle} title="Export as .wfkit.json">Export</button>
                      {!kit.builtIn && (
                        <>
                          <button onClick={() => setEditingKit(kit)} style={smallBtnStyle}>Edit</button>
                          <button
                            onClick={() => handleDeleteKit(kit.id)}
                            style={{ ...smallBtnStyle, color: confirmDeleteKit === kit.id ? '#f85149' : '#8b949e' }}
                          >
                            {confirmDeleteKit === kit.id ? 'Confirm?' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Samples tab */}
        {tab === 'samples' && (
          <>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
              Open a sample to explore, learn from, or build on. Each opens as an editable copy.
            </div>
            {/* Mode filter pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              <button
                onClick={() => setSampleModeFilter(undefined)}
                style={{
                  fontSize: 10, padding: '3px 8px', cursor: 'pointer', borderRadius: 3,
                  background: sampleModeFilter === undefined ? '#58a6ff' : '#21262d',
                  color: sampleModeFilter === undefined ? '#fff' : '#8b949e',
                  border: '1px solid #30363d',
                }}
              >All</button>
              {AUTHORING_MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setSampleModeFilter(sampleModeFilter === m ? undefined : m)}
                  style={{
                    fontSize: 10, padding: '3px 8px', cursor: 'pointer', borderRadius: 3,
                    background: sampleModeFilter === m ? '#58a6ff' : '#21262d',
                    color: sampleModeFilter === m ? '#fff' : '#8b949e',
                    border: '1px solid #30363d',
                  }}
                >{MODE_PROFILES[m].icon} {MODE_PROFILES[m].label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SAMPLE_WORLDS.filter((s) => !sampleModeFilter || s.mode === sampleModeFilter).map((sample) => {
                const c = countContent(sample.project);
                return (
                  <div key={sample.id} style={sampleCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: '#c9d1d9' }}>{sample.name}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 'bold', ...badgeColors[sample.complexity] }}>
                        {sample.complexity}
                      </span>
                      {sample.mode && (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#21262d', color: '#8b949e' }}>
                          {MODE_PROFILES[sample.mode].icon} {MODE_PROFILES[sample.mode].label}
                        </span>
                      )}
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
        <div style={modalFooter}>
          {tab === 'genres' && step === 2 && (
            <button onClick={() => setStep(1)} style={buttonBase}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={buttonBase}>Cancel</button>
          {tab === 'genres' && step === 1 && (
            <button onClick={() => setStep(2)} style={{ ...buttonBase, background: 'var(--wf-success)', color: '#fff' }}>Next</button>
          )}
          {tab === 'genres' && step === 2 && (
            <button onClick={handleCreate} style={{ ...buttonBase, background: 'var(--wf-success)', color: '#fff' }}>Create</button>
          )}
        </div>
      {editingKit && <EditKitModal kit={editingKit} onClose={() => setEditingKit(null)} />}
      {showImportKit && <ImportKitModal onClose={() => { setShowImportKit(false); loadKits(); }} />}
    </ModalFrame>
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
  intermediate: { background: '#0d1d30', color: '#58a6ff', border: `1px solid ${ACTIVE_TAB_BG}` },
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



const importedBadgeStyle: React.CSSProperties = {
  fontSize: 9, padding: '1px 6px', borderRadius: 4,
  background: '#0d1d30', color: '#58a6ff', border: `1px solid ${ACTIVE_TAB_BG}`,
};

const customBadgeStyle: React.CSSProperties = {
  fontSize: 9, padding: '1px 6px', borderRadius: 4,
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
};
