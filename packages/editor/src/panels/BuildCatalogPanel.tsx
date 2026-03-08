// BuildCatalogPanel.tsx — character creation catalog editor

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import type { BuildCatalogDefinition, ArchetypeDefinition, BackgroundDefinition, TraitDefinition, DisciplineDefinition, TraitEffect } from '@world-forge/schema';

type SubTab = 'config' | 'archetypes' | 'backgrounds' | 'traits' | 'disciplines' | 'combos';

function createEmptyCatalog(): BuildCatalogDefinition {
  return {
    statBudget: 10, maxTraits: 3, requiredFlaws: 0,
    archetypes: [], backgrounds: [], traits: [],
    disciplines: [], crossTitles: [], entanglements: [],
  };
}

export function BuildCatalogPanel() {
  const { project, setBuildCatalog, updateBuildCatalogConfig,
    addArchetype, updateArchetype, removeArchetype,
    addBackground, updateBackground, removeBackground,
    addTrait, updateTrait, removeTrait,
    addDiscipline, updateDiscipline, removeDiscipline,
    addCrossTitle, removeCrossTitle, addEntanglement, removeEntanglement,
  } = useProjectStore();
  const [subTab, setSubTab] = useState<SubTab>('config');
  const cat = project.buildCatalog;

  if (!cat) {
    return (
      <div>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>Build Catalog</div>
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>No build catalog defined.</div>
        <button onClick={() => setBuildCatalog(createEmptyCatalog())} style={addBtnStyle}>
          + Create Build Catalog
        </button>
      </div>
    );
  }

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'config', label: 'Config' },
    { id: 'archetypes', label: `Arch (${cat.archetypes.length})` },
    { id: 'backgrounds', label: `Bg (${cat.backgrounds.length})` },
    { id: 'traits', label: `Traits (${cat.traits.length})` },
    { id: 'disciplines', label: `Disc (${cat.disciplines.length})` },
    { id: 'combos', label: `Combos` },
  ];

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Build Catalog</div>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 8 }}>
        {subTabs.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            fontSize: 10, padding: '2px 6px', cursor: 'pointer', borderRadius: 3,
            background: subTab === t.id ? '#1f6feb' : '#21262d',
            color: subTab === t.id ? '#fff' : '#8b949e',
            border: '1px solid #30363d',
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === 'config' && <ConfigSection cat={cat} onUpdate={updateBuildCatalogConfig} />}
      {subTab === 'archetypes' && <ArchetypeSection cat={cat} trees={project.progressionTrees}
        onAdd={addArchetype} onUpdate={updateArchetype} onRemove={removeArchetype} />}
      {subTab === 'backgrounds' && <BackgroundSection cat={cat}
        onAdd={addBackground} onUpdate={updateBackground} onRemove={removeBackground} />}
      {subTab === 'traits' && <TraitSection cat={cat}
        onAdd={addTrait} onUpdate={updateTrait} onRemove={removeTrait} />}
      {subTab === 'disciplines' && <DisciplineSection cat={cat}
        onAdd={addDiscipline} onUpdate={updateDiscipline} onRemove={removeDiscipline} />}
      {subTab === 'combos' && <CombosSection cat={cat}
        onAddCT={addCrossTitle} onRemoveCT={removeCrossTitle}
        onAddEnt={addEntanglement} onRemoveEnt={removeEntanglement} />}
    </div>
  );
}

function ConfigSection({ cat, onUpdate }: {
  cat: BuildCatalogDefinition;
  onUpdate: (u: Partial<Pick<BuildCatalogDefinition, 'statBudget' | 'maxTraits' | 'requiredFlaws'>>) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>Stat Budget
        <input style={inputStyle} type="number" value={cat.statBudget}
          onChange={(e) => onUpdate({ statBudget: Number(e.target.value) })} />
      </label>
      <label style={labelStyle}>Max Traits
        <input style={inputStyle} type="number" value={cat.maxTraits}
          onChange={(e) => onUpdate({ maxTraits: Number(e.target.value) })} />
      </label>
      <label style={labelStyle}>Required Flaws
        <input style={inputStyle} type="number" value={cat.requiredFlaws}
          onChange={(e) => onUpdate({ requiredFlaws: Number(e.target.value) })} />
      </label>
    </div>
  );
}

function ArchetypeSection({ cat, trees, onAdd, onUpdate, onRemove }: {
  cat: BuildCatalogDefinition;
  trees: { id: string; name: string }[];
  onAdd: (a: ArchetypeDefinition) => void;
  onUpdate: (id: string, u: Partial<ArchetypeDefinition>) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const handleAdd = () => {
    const id = `arch-${Date.now()}`;
    onAdd({ id, name: 'New Archetype', description: '', statPriorities: {}, startingTags: [], progressionTreeId: '' });
    setEditing(id);
  };

  return (
    <div>
      {cat.archetypes.map((a) => (
        <div key={a.id} style={itemStyle}>
          {editing === a.id ? (
            <>
              <label style={labelStyle}>Name
                <input style={inputStyle} value={a.name} onChange={(e) => onUpdate(a.id, { name: e.target.value })} />
              </label>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={a.description}
                  onChange={(e) => onUpdate(a.id, { description: e.target.value })} />
              </label>
              <label style={labelStyle}>Progression Tree
                <select style={inputStyle} value={a.progressionTreeId}
                  onChange={(e) => onUpdate(a.id, { progressionTreeId: e.target.value })}>
                  <option value="">None</option>
                  {trees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Starting Tags (comma-separated)
                <input style={inputStyle} value={a.startingTags.join(', ')}
                  onChange={(e) => onUpdate(a.id, { startingTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <label style={labelStyle}>Granted Verbs (comma-separated)
                <input style={inputStyle} value={(a.grantedVerbs ?? []).join(', ')}
                  onChange={(e) => onUpdate(a.id, { grantedVerbs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(a.id); setEditing(null); }} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(a.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: '#c9d1d9' }}>{a.name}</div>
              <div style={{ fontSize: 10, color: '#8b949e' }}>{a.id}</div>
            </div>
          )}
        </div>
      ))}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Archetype</button>
    </div>
  );
}

function BackgroundSection({ cat, onAdd, onUpdate, onRemove }: {
  cat: BuildCatalogDefinition;
  onAdd: (b: BackgroundDefinition) => void;
  onUpdate: (id: string, u: Partial<BackgroundDefinition>) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const handleAdd = () => {
    const id = `bg-${Date.now()}`;
    onAdd({ id, name: 'New Background', description: '', statModifiers: {}, startingTags: [] });
    setEditing(id);
  };

  return (
    <div>
      {cat.backgrounds.map((b) => (
        <div key={b.id} style={itemStyle}>
          {editing === b.id ? (
            <>
              <label style={labelStyle}>Name
                <input style={inputStyle} value={b.name} onChange={(e) => onUpdate(b.id, { name: e.target.value })} />
              </label>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={b.description}
                  onChange={(e) => onUpdate(b.id, { description: e.target.value })} />
              </label>
              <label style={labelStyle}>Starting Tags (comma-separated)
                <input style={inputStyle} value={b.startingTags.join(', ')}
                  onChange={(e) => onUpdate(b.id, { startingTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(b.id); setEditing(null); }} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(b.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: '#c9d1d9' }}>{b.name}</div>
              <div style={{ fontSize: 10, color: '#8b949e' }}>{b.id}</div>
            </div>
          )}
        </div>
      ))}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Background</button>
    </div>
  );
}

function TraitSection({ cat, onAdd, onUpdate, onRemove }: {
  cat: BuildCatalogDefinition;
  onAdd: (t: TraitDefinition) => void;
  onUpdate: (id: string, u: Partial<TraitDefinition>) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const handleAdd = () => {
    const id = `trait-${Date.now()}`;
    onAdd({ id, name: 'New Trait', description: '', category: 'perk', effects: [] });
    setEditing(id);
  };

  return (
    <div>
      {cat.traits.map((t) => (
        <div key={t.id} style={itemStyle}>
          {editing === t.id ? (
            <>
              <label style={labelStyle}>Name
                <input style={inputStyle} value={t.name} onChange={(e) => onUpdate(t.id, { name: e.target.value })} />
              </label>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={t.description}
                  onChange={(e) => onUpdate(t.id, { description: e.target.value })} />
              </label>
              <label style={labelStyle}>Category
                <select style={inputStyle} value={t.category}
                  onChange={(e) => onUpdate(t.id, { category: e.target.value as 'perk' | 'flaw' })}>
                  <option value="perk">Perk</option>
                  <option value="flaw">Flaw</option>
                </select>
              </label>
              <label style={labelStyle}>Incompatible With (comma-separated IDs)
                <input style={inputStyle} value={(t.incompatibleWith ?? []).join(', ')}
                  onChange={(e) => onUpdate(t.id, { incompatibleWith: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <EffectListEditor effects={t.effects}
                onChange={(effects) => onUpdate(t.id, { effects })} />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(t.id); setEditing(null); }} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(t.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: '#c9d1d9' }}>{t.name} <span style={{ fontSize: 10, color: t.category === 'flaw' ? '#f85149' : '#3fb950' }}>({t.category})</span></div>
              <div style={{ fontSize: 10, color: '#8b949e' }}>{t.effects.length} effect(s)</div>
            </div>
          )}
        </div>
      ))}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Trait</button>
    </div>
  );
}

function DisciplineSection({ cat, onAdd, onUpdate, onRemove }: {
  cat: BuildCatalogDefinition;
  onAdd: (d: DisciplineDefinition) => void;
  onUpdate: (id: string, u: Partial<DisciplineDefinition>) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const handleAdd = () => {
    const id = `disc-${Date.now()}`;
    onAdd({
      id, name: 'New Discipline', description: '', grantedVerb: '',
      passive: { type: 'grant-tag' }, drawback: { type: 'stat-modifier' },
    });
    setEditing(id);
  };

  return (
    <div>
      {cat.disciplines.map((d) => (
        <div key={d.id} style={itemStyle}>
          {editing === d.id ? (
            <>
              <label style={labelStyle}>Name
                <input style={inputStyle} value={d.name} onChange={(e) => onUpdate(d.id, { name: e.target.value })} />
              </label>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={d.description}
                  onChange={(e) => onUpdate(d.id, { description: e.target.value })} />
              </label>
              <label style={labelStyle}>Granted Verb
                <input style={inputStyle} value={d.grantedVerb}
                  onChange={(e) => onUpdate(d.id, { grantedVerb: e.target.value })} />
              </label>
              <label style={labelStyle}>Required Tags (comma-separated)
                <input style={inputStyle} value={(d.requiredTags ?? []).join(', ')}
                  onChange={(e) => onUpdate(d.id, { requiredTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(d.id); setEditing(null); }} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(d.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: '#c9d1d9' }}>{d.name}</div>
              <div style={{ fontSize: 10, color: '#8b949e' }}>verb: {d.grantedVerb || '(none)'}</div>
            </div>
          )}
        </div>
      ))}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Discipline</button>
    </div>
  );
}

function CombosSection({ cat, onAddCT, onRemoveCT, onAddEnt, onRemoveEnt }: {
  cat: BuildCatalogDefinition;
  onAddCT: (ct: { archetypeId: string; disciplineId: string; title: string; tags: string[] }) => void;
  onRemoveCT: (archetypeId: string, disciplineId: string) => void;
  onAddEnt: (e: { id: string; archetypeId: string; disciplineId: string; description: string; effects: TraitEffect[] }) => void;
  onRemoveEnt: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Cross-Titles ({cat.crossTitles.length})</div>
      {cat.crossTitles.map((ct, i) => (
        <div key={i} style={itemStyle}>
          <div style={{ fontSize: 12, color: '#c9d1d9' }}>{ct.title}</div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>{ct.archetypeId} + {ct.disciplineId}</div>
          <button onClick={() => onRemoveCT(ct.archetypeId, ct.disciplineId)} style={{ ...xBtnStyle, fontSize: 10 }}>remove</button>
        </div>
      ))}
      <button onClick={() => {
        if (cat.archetypes.length === 0 || cat.disciplines.length === 0) return;
        onAddCT({ archetypeId: cat.archetypes[0].id, disciplineId: cat.disciplines[0].id, title: 'New Title', tags: [] });
      }} style={addBtnStyle}>+ Add Cross-Title</button>

      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 12, marginBottom: 4 }}>Entanglements ({cat.entanglements.length})</div>
      {cat.entanglements.map((e) => (
        <div key={e.id} style={itemStyle}>
          <div style={{ fontSize: 12, color: '#c9d1d9' }}>{e.description || e.id}</div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>{e.archetypeId} + {e.disciplineId}</div>
          <button onClick={() => onRemoveEnt(e.id)} style={{ ...xBtnStyle, fontSize: 10 }}>remove</button>
        </div>
      ))}
      <button onClick={() => {
        if (cat.archetypes.length === 0 || cat.disciplines.length === 0) return;
        onAddEnt({
          id: `ent-${Date.now()}`, archetypeId: cat.archetypes[0].id,
          disciplineId: cat.disciplines[0].id, description: '', effects: [],
        });
      }} style={addBtnStyle}>+ Add Entanglement</button>
    </div>
  );
}

/** Compact effect list editor for TraitEffect[]. */
function EffectListEditor({ effects, onChange }: {
  effects: TraitEffect[];
  onChange: (effects: TraitEffect[]) => void;
}) {
  const handleAdd = () => {
    onChange([...effects, { type: 'stat-modifier', stat: '', amount: 0 }]);
  };

  const handleUpdate = (i: number, updates: Partial<TraitEffect>) => {
    onChange(effects.map((e, idx) => idx === i ? { ...e, ...updates } : e));
  };

  const handleRemove = (i: number) => {
    onChange(effects.filter((_, idx) => idx !== i));
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 2 }}>Effects</div>
      {effects.map((eff, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
          <select style={{ ...inputStyle, width: 90, marginTop: 0 }} value={eff.type}
            onChange={(e) => handleUpdate(i, { type: e.target.value as TraitEffect['type'] })}>
            <option value="stat-modifier">stat-mod</option>
            <option value="resource-modifier">res-mod</option>
            <option value="grant-tag">tag</option>
            <option value="verb-access">verb</option>
            <option value="faction-modifier">faction</option>
          </select>
          <input style={{ ...inputStyle, width: 60, marginTop: 0 }} placeholder="key"
            value={eff.stat ?? eff.resource ?? eff.tag ?? eff.verb ?? eff.faction ?? ''}
            onChange={(e) => {
              const key = eff.type === 'stat-modifier' ? 'stat' : eff.type === 'resource-modifier' ? 'resource'
                : eff.type === 'grant-tag' ? 'tag' : eff.type === 'verb-access' ? 'verb' : 'faction';
              handleUpdate(i, { [key]: e.target.value });
            }} />
          {(eff.type === 'stat-modifier' || eff.type === 'resource-modifier' || eff.type === 'faction-modifier') && (
            <input style={{ ...inputStyle, width: 40, marginTop: 0 }} type="number"
              value={eff.amount ?? 0} onChange={(e) => handleUpdate(i, { amount: Number(e.target.value) })} />
          )}
          <button onClick={() => handleRemove(i)} style={xBtnStyle}>&times;</button>
        </div>
      ))}
      <button onClick={handleAdd} style={{ ...addBtnStyle, fontSize: 10 }}>+ effect</button>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', fontSize: 12, marginTop: 2,
};
const addBtnStyle: React.CSSProperties = {
  fontSize: 11, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, cursor: 'pointer', padding: '4px 10px', width: '100%', marginTop: 4,
};
const smallBtnStyle: React.CSSProperties = {
  fontSize: 10, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, cursor: 'pointer', padding: '2px 8px',
};
const xBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#f85149',
  cursor: 'pointer', fontSize: 14, padding: '0 4px',
};
const itemStyle: React.CSSProperties = {
  padding: 6, background: '#161b22', borderRadius: 3, marginBottom: 4, border: '1px solid #30363d',
};
