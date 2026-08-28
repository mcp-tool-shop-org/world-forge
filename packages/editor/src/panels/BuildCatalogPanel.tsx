// BuildCatalogPanel.tsx — character creation catalog editor

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, type BuildsSubTab } from '../store/editor-store.js';
import { EmptyState, useFocusHighlight } from './shared.js';
import { sectionHeader as sectionTitle, labelText as labelStyle, inputBase as inputStyle, buttonFullWidth as addBtnStyle, buttonCompact as smallBtnStyle, buttonRemove as xBtnStyle, cardItem as itemStyle, hintText as hintStyle, activeTabBg as ACTIVE_TAB_BG } from '../ui/styles.js';
import type { BuildCatalogDefinition, ArchetypeDefinition, BackgroundDefinition, TraitDefinition, DisciplineDefinition, TraitEffect } from '@world-forge/schema';

const STARTER_CATALOG: BuildCatalogDefinition = {
  statBudget: 10, maxTraits: 3, requiredFlaws: 1,
  archetypes: [
    { id: 'warrior', name: 'Warrior', description: 'Front-line combatant.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['martial'], progressionTreeId: '', grantedVerbs: ['strike', 'block'] },
    { id: 'scholar', name: 'Scholar', description: 'Seeker of hidden knowledge.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['learned'], progressionTreeId: '', grantedVerbs: ['study', 'recall'] },
  ],
  backgrounds: [
    { id: 'wanderer', name: 'Wanderer', description: 'A life spent on the road.', statModifiers: { instinct: 1 }, startingTags: ['traveler'] },
  ],
  traits: [
    { id: 'keen-eye', name: 'Keen Eye', description: 'Notice things others miss.', category: 'perk' as const, effects: [{ type: 'grant-tag' as const, tag: 'perceptive' }] },
    { id: 'reckless', name: 'Reckless', description: 'Act before thinking.', category: 'flaw' as const, effects: [{ type: 'stat-modifier' as const, stat: 'will', amount: -1 }] },
  ],
  disciplines: [],
  crossTitles: [],
  entanglements: [],
};

export function BuildCatalogPanel() {
  const { project, setBuildCatalog, updateBuildCatalogConfig,
    addArchetype, updateArchetype, removeArchetype,
    addBackground, updateBackground, removeBackground,
    addTrait, updateTrait, removeTrait,
    addDiscipline, updateDiscipline, removeDiscipline,
    addCrossTitle, updateCrossTitle, removeCrossTitle, addEntanglement, updateEntanglement, removeEntanglement,
  } = useProjectStore();
  const { buildsSubTab, setBuildsSubTab } = useEditorStore();
  const focusRef = useFocusHighlight('builds');
  const cat = project.buildCatalog;

  if (!cat) {
    return (
      <EmptyState
        title="Build Catalog"
        description="Defines character creation options: archetypes (class), backgrounds (origin), traits (perks/flaws), and disciplines (specializations). Enables structured character creation in-game."
        actions={[
          { label: '+ Starter Catalog (Fantasy)', onClick: () => setBuildCatalog(STARTER_CATALOG) },
          { label: '+ Empty Catalog', onClick: () => setBuildCatalog({ statBudget: 10, maxTraits: 3, requiredFlaws: 0, archetypes: [], backgrounds: [], traits: [], disciplines: [], crossTitles: [], entanglements: [] }) },
        ]}
      />
    );
  }

  const subTabs: { id: BuildsSubTab; label: string }[] = [
    { id: 'config', label: 'Config' },
    { id: 'archetypes', label: `Arch (${cat.archetypes.length})` },
    { id: 'backgrounds', label: `Bg (${cat.backgrounds.length})` },
    { id: 'traits', label: `Traits (${cat.traits.length})` },
    { id: 'disciplines', label: `Disc (${cat.disciplines.length})` },
    { id: 'combos', label: 'Combos' },
  ];

  return (
    <div ref={focusRef}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
        {subTabs.map((t) => (
          <button key={t.id} onClick={() => setBuildsSubTab(t.id)} style={{
            fontSize: 10, padding: '3px 8px', cursor: 'pointer', borderRadius: 3,
            background: buildsSubTab === t.id ? ACTIVE_TAB_BG : 'var(--wf-bg-control)',
            color: buildsSubTab === t.id ? '#fff' : 'var(--wf-text-muted)',
            border: '1px solid var(--wf-border-default)',
          }}>{t.label}</button>
        ))}
      </div>

      {buildsSubTab === 'config' && <ConfigSection cat={cat} onUpdate={updateBuildCatalogConfig} />}
      {buildsSubTab === 'archetypes' && <ArchetypeSection cat={cat} trees={project.progressionTrees}
        onAdd={addArchetype} onUpdate={updateArchetype} onRemove={removeArchetype} />}
      {buildsSubTab === 'backgrounds' && <BackgroundSection cat={cat}
        onAdd={addBackground} onUpdate={updateBackground} onRemove={removeBackground} />}
      {buildsSubTab === 'traits' && <TraitSection cat={cat}
        onAdd={addTrait} onUpdate={updateTrait} onRemove={removeTrait} />}
      {buildsSubTab === 'disciplines' && <DisciplineSection cat={cat}
        onAdd={addDiscipline} onUpdate={updateDiscipline} onRemove={removeDiscipline} />}
      {buildsSubTab === 'combos' && <CombosSection cat={cat}
        onAddCT={addCrossTitle} onUpdateCT={updateCrossTitle} onRemoveCT={removeCrossTitle}
        onAddEnt={addEntanglement} onUpdateEnt={updateEntanglement} onRemoveEnt={removeEntanglement} />}
    </div>
  );
}

function ConfigSection({ cat, onUpdate }: {
  cat: BuildCatalogDefinition;
  onUpdate: (u: Partial<Pick<BuildCatalogDefinition, 'statBudget' | 'maxTraits' | 'requiredFlaws'>>) => void;
}) {
  return (
    <div>
      <div style={sectionTitle}>Creation Rules</div>
      <label style={labelStyle}>Stat Budget
        <input style={inputStyle} type="number" value={cat.statBudget}
          onChange={(e) => onUpdate({ statBudget: Number(e.target.value) })} />
        <div style={hintStyle}>Total stat points a player can allocate.</div>
      </label>
      <label style={labelStyle}>Max Traits
        <input style={inputStyle} type="number" value={cat.maxTraits}
          onChange={(e) => onUpdate({ maxTraits: Number(e.target.value) })} />
        <div style={hintStyle}>Maximum perks + flaws a player can pick.</div>
      </label>
      <label style={labelStyle}>Required Flaws
        <input style={inputStyle} type="number" value={cat.requiredFlaws}
          onChange={(e) => onUpdate({ requiredFlaws: Number(e.target.value) })} />
        <div style={hintStyle}>Minimum flaws required before creation is valid.</div>
      </label>
    </div>
  );
}

function ArchetypeSection({ cat, trees, onAdd, onUpdate, onRemove }: {
  cat: BuildCatalogDefinition; trees: { id: string; name: string }[];
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
      {cat.archetypes.length === 0 && <div style={hintStyle}>No archetypes. Add one below.</div>}
      {cat.archetypes.map((a) => {
        // EUB-016: warn if referenced progressionTreeId not found
        if (a.progressionTreeId && !trees.some((t) => t.id === a.progressionTreeId)) {
          console.warn(`[BuildCatalog] Archetype "${a.name}" references missing progressionTreeId "${a.progressionTreeId}"`);
        }
        return (
        <div key={a.id} style={itemStyle}>
          {editing === a.id ? (
            <>
              <label style={labelStyle}>Name
                <input style={inputStyle} value={a.name} onChange={(e) => onUpdate(a.id, { name: e.target.value })} />
              </label>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={a.description} placeholder="What this archetype represents..."
                  onChange={(e) => onUpdate(a.id, { description: e.target.value })} />
              </label>
              <label style={labelStyle}>Progression Tree
                <select style={inputStyle} value={a.progressionTreeId}
                  onChange={(e) => onUpdate(a.id, { progressionTreeId: e.target.value })}>
                  <option value="">None</option>
                  {trees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Starting Tags
                <input style={inputStyle} value={a.startingTags.join(', ')} placeholder="e.g. martial, arcane"
                  onChange={(e) => onUpdate(a.id, { startingTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <label style={labelStyle}>Granted Verbs
                <input style={inputStyle} value={(a.grantedVerbs ?? []).join(', ')} placeholder="e.g. strike, block"
                  onChange={(e) => onUpdate(a.id, { grantedVerbs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <RecordNumberField label="Stat Priorities" testId="wf-arch-stat-priorities"
                value={a.statPriorities} placeholder="e.g. vigor:2, instinct:1"
                onChange={(statPriorities) => onUpdate(a.id, { statPriorities })} />
              <RecordNumberField label="Resource Overrides" testId="wf-arch-resource-overrides"
                value={a.resourceOverrides ?? {}} placeholder="e.g. hp:100, mana:50"
                onChange={(resourceOverrides) => onUpdate(a.id, { resourceOverrides })} />
              <CsvField label="Starting Inventory" testId="wf-arch-starting-inventory"
                value={a.startingInventory ?? []} placeholder="item ids"
                onChange={(startingInventory) => onUpdate(a.id, { startingInventory })} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(a.id); setEditing(null); }} style={{ ...smallBtnStyle, color: 'var(--wf-danger-text)' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(a.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>{a.name}</div>
              <div style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{a.id}</div>
            </div>
          )}
        </div>
        );
      })}
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
      {cat.backgrounds.length === 0 && <div style={hintStyle}>No backgrounds. Add one below.</div>}
      {cat.backgrounds.map((b) => (
        <div key={b.id} style={itemStyle}>
          {editing === b.id ? (
            <>
              <label style={labelStyle}>Name
                <input style={inputStyle} value={b.name} onChange={(e) => onUpdate(b.id, { name: e.target.value })} />
              </label>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={b.description} placeholder="Origin story..."
                  onChange={(e) => onUpdate(b.id, { description: e.target.value })} />
              </label>
              <label style={labelStyle}>Starting Tags
                <input style={inputStyle} value={b.startingTags.join(', ')} placeholder="e.g. traveler, noble"
                  onChange={(e) => onUpdate(b.id, { startingTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <RecordNumberField label="Stat Modifiers" testId="wf-bg-stat-modifiers"
                value={b.statModifiers} placeholder="e.g. instinct:1"
                onChange={(statModifiers) => onUpdate(b.id, { statModifiers })} />
              <RecordNumberField label="Faction Modifiers" testId="wf-bg-faction-modifiers"
                value={b.factionModifiers ?? {}} placeholder="e.g. harbour:5"
                onChange={(factionModifiers) => onUpdate(b.id, { factionModifiers })} />
              <CsvField label="Starting Inventory" testId="wf-bg-starting-inventory"
                value={b.startingInventory ?? []} placeholder="item ids"
                onChange={(startingInventory) => onUpdate(b.id, { startingInventory })} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(b.id); setEditing(null); }} style={{ ...smallBtnStyle, color: 'var(--wf-danger-text)' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(b.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>{b.name}</div>
              <div style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{b.id}</div>
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
      {cat.traits.length === 0 && <div style={hintStyle}>No traits. Add perks and flaws below.</div>}
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
              <label style={labelStyle}>Incompatible With
                <input style={inputStyle} value={(t.incompatibleWith ?? []).join(', ')} placeholder="e.g. reckless, cautious"
                  onChange={(e) => onUpdate(t.id, { incompatibleWith: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                <div style={hintStyle}>Comma-separated trait IDs that conflict.</div>
              </label>
              <EffectListEditor effects={t.effects}
                onChange={(effects) => onUpdate(t.id, { effects })} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(t.id); setEditing(null); }} style={{ ...smallBtnStyle, color: 'var(--wf-danger-text)' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(t.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>
                {t.name} <span style={{ fontSize: 10, color: t.category === 'flaw' ? 'var(--wf-danger-text)' : 'var(--wf-success-text)' }}>({t.category})</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{t.effects.length} effect(s)</div>
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
      {cat.disciplines.length === 0 && <div style={hintStyle}>No disciplines. Add specializations below.</div>}
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
                <input style={inputStyle} value={d.grantedVerb} placeholder="e.g. meditate"
                  onChange={(e) => onUpdate(d.id, { grantedVerb: e.target.value })} />
              </label>
              <label style={labelStyle}>Required Tags
                <input style={inputStyle} value={(d.requiredTags ?? []).join(', ')} placeholder="e.g. learned, arcane"
                  onChange={(e) => onUpdate(d.id, { requiredTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <div data-testid="wf-disc-passive">
                <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>Passive</div>
                <EffectListEditor effects={d.passive ? [d.passive] : []}
                  onChange={(effects) => onUpdate(d.id, { passive: effects[0] ?? { type: 'grant-tag' } })} />
              </div>
              <div data-testid="wf-disc-drawback">
                <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>Drawback</div>
                <EffectListEditor effects={d.drawback ? [d.drawback] : []}
                  onChange={(effects) => onUpdate(d.id, { drawback: effects[0] ?? { type: 'stat-modifier' } })} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => setEditing(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemove(d.id); setEditing(null); }} style={{ ...smallBtnStyle, color: 'var(--wf-danger-text)' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditing(d.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>{d.name}</div>
              <div style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>verb: {d.grantedVerb || '(none)'}</div>
            </div>
          )}
        </div>
      ))}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Discipline</button>
    </div>
  );
}

function CombosSection({ cat, onAddCT, onUpdateCT, onRemoveCT, onAddEnt, onUpdateEnt, onRemoveEnt }: {
  cat: BuildCatalogDefinition;
  onAddCT: (ct: { archetypeId: string; disciplineId: string; title: string; tags: string[] }) => void;
  onUpdateCT: (archetypeId: string, disciplineId: string, u: Partial<{ archetypeId: string; disciplineId: string; title: string; tags: string[] }>) => void;
  onRemoveCT: (archetypeId: string, disciplineId: string) => void;
  onAddEnt: (e: { id: string; archetypeId: string; disciplineId: string; description: string; effects: TraitEffect[] }) => void;
  onUpdateEnt: (id: string, u: Partial<{ archetypeId: string; disciplineId: string; description: string; effects: TraitEffect[] }>) => void;
  onRemoveEnt: (id: string) => void;
}) {
  const needsBoth = cat.archetypes.length === 0 || cat.disciplines.length === 0;
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingEnt, setEditingEnt] = useState<string | null>(null);

  return (
    <div>
      <div style={sectionTitle}>Cross-Titles ({cat.crossTitles.length})</div>
      {needsBoth && <div style={hintStyle}>Requires at least one archetype and one discipline.</div>}
      {cat.crossTitles.map((ct, i) => {
        const key = `${ct.archetypeId}::${ct.disciplineId}`;
        const editing = editingTitle === key;
        return (
        <div key={i} style={itemStyle}>
          {editing ? (
            <>
              <label style={labelStyle}>Title
                <input style={inputStyle} data-testid="wf-cross-title" value={ct.title}
                  onChange={(e) => onUpdateCT(ct.archetypeId, ct.disciplineId, { title: e.target.value })} />
              </label>
              <label style={labelStyle}>Archetype
                <select style={inputStyle} data-testid="wf-cross-archetype" value={ct.archetypeId}
                  onChange={(e) => {
                    onUpdateCT(ct.archetypeId, ct.disciplineId, { archetypeId: e.target.value });
                    setEditingTitle(`${e.target.value}::${ct.disciplineId}`);
                  }}>
                  {cat.archetypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Discipline
                <select style={inputStyle} data-testid="wf-cross-discipline" value={ct.disciplineId}
                  onChange={(e) => {
                    onUpdateCT(ct.archetypeId, ct.disciplineId, { disciplineId: e.target.value });
                    setEditingTitle(`${ct.archetypeId}::${e.target.value}`);
                  }}>
                  {cat.disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <CsvField label="Tags" testId="wf-cross-tags" value={ct.tags} placeholder="e.g. hybrid"
                onChange={(tags) => onUpdateCT(ct.archetypeId, ct.disciplineId, { tags })} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => setEditingTitle(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemoveCT(ct.archetypeId, ct.disciplineId); setEditingTitle(null); }}
                  style={{ ...smallBtnStyle, color: 'var(--wf-danger-text)' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditingTitle(key)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>{ct.title}</div>
              <div style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{ct.archetypeId} + {ct.disciplineId}</div>
            </div>
          )}
        </div>
        );
      })}
      {!needsBoth && (
        <button onClick={() => {
          onAddCT({ archetypeId: cat.archetypes[0].id, disciplineId: cat.disciplines[0].id, title: 'New Title', tags: [] });
          setEditingTitle(`${cat.archetypes[0].id}::${cat.disciplines[0].id}`);
        }} style={addBtnStyle}>+ Add Cross-Title</button>
      )}

      <div style={{ ...sectionTitle, marginTop: 14 }}>Entanglements ({cat.entanglements.length})</div>
      {needsBoth && <div style={hintStyle}>Requires at least one archetype and one discipline.</div>}
      {cat.entanglements.map((e) => (
        <div key={e.id} style={itemStyle}>
          {editingEnt === e.id ? (
            <>
              <label style={labelStyle}>Description
                <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} data-testid="wf-ent-description"
                  value={e.description} onChange={(ev) => onUpdateEnt(e.id, { description: ev.target.value })} />
              </label>
              <label style={labelStyle}>Archetype
                <select style={inputStyle} value={e.archetypeId}
                  onChange={(ev) => onUpdateEnt(e.id, { archetypeId: ev.target.value })}>
                  {cat.archetypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Discipline
                <select style={inputStyle} value={e.disciplineId}
                  onChange={(ev) => onUpdateEnt(e.id, { disciplineId: ev.target.value })}>
                  {cat.disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <div data-testid="wf-ent-effects">
                <EffectListEditor effects={e.effects}
                  onChange={(effects) => onUpdateEnt(e.id, { effects })} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => setEditingEnt(null)} style={smallBtnStyle}>Done</button>
                <button onClick={() => { onRemoveEnt(e.id); setEditingEnt(null); }}
                  style={{ ...smallBtnStyle, color: 'var(--wf-danger-text)' }}>Delete</button>
              </div>
            </>
          ) : (
            <div onClick={() => setEditingEnt(e.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>{e.description || e.id}</div>
              <div style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{e.archetypeId} + {e.disciplineId}</div>
            </div>
          )}
        </div>
      ))}
      {!needsBoth && (
        <button onClick={() => {
          const id = `ent-${Date.now()}`;
          onAddEnt({
            id, archetypeId: cat.archetypes[0].id,
            disciplineId: cat.disciplines[0].id, description: '', effects: [],
          });
          setEditingEnt(id);
        }} style={addBtnStyle}>+ Add Entanglement</button>
      )}
    </div>
  );
}

function EffectListEditor({ effects, onChange }: {
  effects: TraitEffect[]; onChange: (effects: TraitEffect[]) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>Effects</div>
      {effects.length === 0 && <div style={hintStyle}>No effects. Add one below.</div>}
      {effects.map((eff, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
          <select style={{ ...inputStyle, width: 90, marginTop: 0 }} value={eff.type}
            onChange={(e) => onChange(effects.map((ef, idx) => idx === i ? { ...ef, type: e.target.value as TraitEffect['type'] } : ef))}>
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
              onChange(effects.map((ef, idx) => idx === i ? { ...ef, [key]: e.target.value } : ef));
            }} />
          {(eff.type === 'stat-modifier' || eff.type === 'resource-modifier' || eff.type === 'faction-modifier') && (
            <input style={{ ...inputStyle, width: 40, marginTop: 0 }} type="number"
              value={eff.amount ?? 0} onChange={(e) => onChange(effects.map((ef, idx) => idx === i ? { ...ef, amount: Number(e.target.value) } : ef))} />
          )}
          <button onClick={() => onChange(effects.filter((_, idx) => idx !== i))} style={xBtnStyle} aria-label="Remove effect">&times;</button>
        </div>
      ))}
      <button onClick={() => onChange([...effects, { type: 'stat-modifier', stat: '', amount: 0 }])}
        style={{ ...addBtnStyle, fontSize: 10 }}>+ effect</button>
    </div>
  );
}

function parseRecordNumbers(text: string): Record<string, number> {
  const next: Record<string, number> = {};
  for (const part of text.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.lastIndexOf(':');
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const n = Number(trimmed.slice(colon + 1).trim());
    if (key && Number.isFinite(n)) next[key] = n;
  }
  return next;
}

function RecordNumberField({ label, value, placeholder, testId, onChange }: {
  label: string; value: Record<string, number>; placeholder: string; testId: string;
  onChange: (next: Record<string, number>) => void;
}) {
  const text = Object.entries(value).map(([k, v]) => `${k}:${v}`).join(', ');
  return (
    <label style={labelStyle}>{label}
      <input style={inputStyle} data-testid={testId} value={text} placeholder={placeholder}
        onChange={(e) => onChange(parseRecordNumbers(e.target.value))} />
      <div style={hintStyle}>Comma-separated key:number pairs.</div>
    </label>
  );
}

function CsvField({ label, value, placeholder, testId, onChange }: {
  label: string; value: string[]; placeholder: string; testId: string; onChange: (next: string[]) => void;
}) {
  return (
    <label style={labelStyle}>{label}
      <input style={inputStyle} data-testid={testId} value={value.join(', ')} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
    </label>
  );
}
