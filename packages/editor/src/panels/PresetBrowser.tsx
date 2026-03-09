import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { usePresetStore } from '../presets/preset-store.js';
import type { RegionPreset, EncounterPreset } from '../presets/types.js';
import type { AuthoringMode } from '@world-forge/schema';

type SubTab = 'region' | 'encounter';

/** Pure filter: keep presets matching the given mode (or with undefined modes). */
export function filterPresetsByMode<T extends { modes?: AuthoringMode[] }>(
  presets: T[],
  mode: AuthoringMode | undefined,
): T[] {
  if (!mode) return presets;
  return presets.filter((p) => !p.modes || p.modes.includes(mode));
}

export function PresetBrowser() {
  const [subTab, setSubTab] = useState<SubTab>('region');
  const [applyMode, setApplyMode] = useState<'merge' | 'overwrite'>('merge');
  const [confirmTarget, setConfirmTarget] = useState<{ preset: RegionPreset | EncounterPreset; type: SubTab } | null>(null);

  const { project, applyRegionPreset, createEncounterFromPreset } = useProjectStore();
  const { selection } = useEditorStore();
  const { selectEncounter } = useEditorStore();
  const {
    regionPresets, encounterPresets,
    saveRegionPreset, deleteRegionPreset, duplicateRegionPreset,
    saveEncounterPreset, deleteEncounterPreset, duplicateEncounterPreset,
  } = usePresetStore();

  const selectedZoneId = getSelectedZoneId(selection);

  // Mode-aware preset filtering
  const currentMode = project.mode;
  const filteredRegion = filterPresetsByMode(regionPresets, currentMode);
  const filteredEncounter = filterPresetsByMode(encounterPresets, currentMode);
  const hiddenRegionCount = regionPresets.length - filteredRegion.length;
  const hiddenEncounterCount = encounterPresets.length - filteredEncounter.length;

  // Find which district the selected zone belongs to
  const selectedDistrict = selectedZoneId
    ? project.districts.find((d) => d.zoneIds.includes(selectedZoneId))
    : null;

  // Selected encounter
  const selectedEnc = selection.encounters.length === 1
    ? project.encounterAnchors.find((e) => e.id === selection.encounters[0])
    : null;

  const handleApplyRegion = (preset: RegionPreset) => {
    if (!selectedDistrict) return;
    applyRegionPreset(selectedDistrict.id, preset, applyMode);
    setConfirmTarget(null);
  };

  const handleApplyEncounter = (preset: EncounterPreset) => {
    if (!selectedZoneId) return;
    const id = createEncounterFromPreset(selectedZoneId, preset);
    selectEncounter(id, false);
    setConfirmTarget(null);
  };

  const handleSaveRegionFromCurrent = () => {
    if (!selectedDistrict) return;
    const d = selectedDistrict;
    const factions = project.factionPresences
      .filter((f) => f.districtIds.includes(d.id))
      .map(({ districtIds: _, ...rest }) => rest);
    const hotspots = project.pressureHotspots
      .filter((h) => d.zoneIds.includes(h.zoneId))
      .map(({ id: _, zoneId: _z, ...rest }) => rest);
    saveRegionPreset({
      name: `${d.name} Preset`,
      description: `Saved from ${d.name}`,
      tags: [...d.tags],
      regionTags: [...d.tags],
      controllingFaction: d.controllingFaction,
      baseMetrics: { ...d.baseMetrics },
      economyProfile: { ...d.economyProfile },
      factionPresences: factions,
      pressureHotspots: hotspots,
    });
  };

  const handleSaveEncounterFromCurrent = () => {
    if (!selectedEnc) return;
    saveEncounterPreset({
      name: `${selectedEnc.encounterType} Preset`,
      description: `Saved from ${selectedEnc.id}`,
      tags: [...selectedEnc.tags],
      encounterType: selectedEnc.encounterType,
      enemyIds: [...selectedEnc.enemyIds],
      probability: selectedEnc.probability,
      cooldownTurns: selectedEnc.cooldownTurns,
      encounterTags: [...selectedEnc.tags],
    });
  };

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['region', 'encounter'] as SubTab[]).map((t) => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer',
            background: subTab === t ? '#21262d' : 'transparent',
            color: subTab === t ? '#58a6ff' : '#8b949e',
            border: subTab === t ? '1px solid #30363d' : '1px solid transparent',
            borderRadius: 3,
          }}>
            {t === 'region' ? 'Region' : 'Encounter'}
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      {subTab === 'region' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#8b949e' }}>Mode:</span>
          {(['merge', 'overwrite'] as const).map((m) => (
            <button key={m} onClick={() => setApplyMode(m)} style={{
              fontSize: 10, padding: '2px 6px', cursor: 'pointer',
              background: applyMode === m ? '#238636' : '#21262d',
              color: applyMode === m ? '#fff' : '#8b949e',
              border: '1px solid #30363d', borderRadius: 3,
            }}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Save current */}
      {subTab === 'region' && selectedDistrict && (
        <button onClick={handleSaveRegionFromCurrent} style={saveBtn}>
          Save &quot;{selectedDistrict.name}&quot; as Preset
        </button>
      )}
      {subTab === 'encounter' && selectedEnc && (
        <button onClick={handleSaveEncounterFromCurrent} style={saveBtn}>
          Save &quot;{selectedEnc.encounterType}&quot; as Preset
        </button>
      )}

      {/* Hidden by mode count */}
      {subTab === 'region' && hiddenRegionCount > 0 && (
        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
          {hiddenRegionCount} hidden by mode
        </div>
      )}
      {subTab === 'encounter' && hiddenEncounterCount > 0 && (
        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
          {hiddenEncounterCount} hidden by mode
        </div>
      )}

      {/* Preset list */}
      {subTab === 'region' && filteredRegion.map((p) => (
        <PresetCard
          key={p.id}
          name={p.name}
          description={p.description}
          tags={p.tags}
          builtIn={p.builtIn}
          canApply={!!selectedDistrict}
          applyLabel={selectedDistrict ? `Apply to ${selectedDistrict.name}` : 'Select a district zone'}
          onApply={() => {
            if (confirmTarget?.preset.id === p.id) {
              handleApplyRegion(p);
            } else {
              setConfirmTarget({ preset: p, type: 'region' });
            }
          }}
          isConfirming={confirmTarget?.preset.id === p.id}
          onDuplicate={() => duplicateRegionPreset(p.id)}
          onDelete={!p.builtIn ? () => deleteRegionPreset(p.id) : undefined}
          previewLines={[
            p.controllingFaction ? `Faction: ${p.controllingFaction}` : '',
            p.baseMetrics.commerce != null ? `Commerce: ${p.baseMetrics.commerce}` : '',
            p.baseMetrics.safety != null ? `Safety: ${p.baseMetrics.safety}` : '',
            p.pressureHotspots.length > 0 ? `Pressure: ${p.pressureHotspots.map((h) => h.pressureType).join(', ')}` : '',
          ].filter(Boolean)}
        />
      ))}

      {subTab === 'encounter' && filteredEncounter.map((p) => (
        <PresetCard
          key={p.id}
          name={p.name}
          description={p.description}
          tags={p.tags}
          builtIn={p.builtIn}
          canApply={!!selectedZoneId}
          applyLabel={selectedZoneId ? 'Place in zone' : 'Select a zone'}
          onApply={() => handleApplyEncounter(p)}
          isConfirming={false}
          onDuplicate={() => duplicateEncounterPreset(p.id)}
          onDelete={!p.builtIn ? () => deleteEncounterPreset(p.id) : undefined}
          previewLines={[
            `Type: ${p.encounterType}`,
            `Probability: ${p.probability}`,
            `Cooldown: ${p.cooldownTurns} turns`,
            p.encounterTags.length > 0 ? `Tags: ${p.encounterTags.join(', ')}` : '',
          ].filter(Boolean)}
        />
      ))}
    </div>
  );
}

// ── Reusable card ─────────────────────────────────────────────

function PresetCard({ name, description, tags, builtIn, canApply, applyLabel, onApply, isConfirming, onDuplicate, onDelete, previewLines }: {
  name: string;
  description: string;
  tags: string[];
  builtIn: boolean;
  canApply: boolean;
  applyLabel: string;
  onApply: () => void;
  isConfirming: boolean;
  onDuplicate: () => void;
  onDelete?: () => void;
  previewLines: string[];
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {builtIn && <span style={{ fontSize: 10, color: '#8b949e' }} title="Built-in preset">&#128274;</span>}
        <strong style={{ fontSize: 12, color: '#c9d1d9' }}>{name}</strong>
      </div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{description}</div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {tags.map((t) => (
            <span key={t} style={tagChip}>{t}</span>
          ))}
        </div>
      )}
      {/* Preview */}
      <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
        {previewLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={onApply}
          disabled={!canApply}
          style={{
            ...smallBtn,
            background: isConfirming ? '#238636' : '#21262d',
            color: isConfirming ? '#fff' : canApply ? '#58a6ff' : '#484f58',
            cursor: canApply ? 'pointer' : 'not-allowed',
          }}
        >
          {isConfirming ? 'Confirm' : applyLabel}
        </button>
        <button onClick={onDuplicate} style={smallBtn}>Dup</button>
        {onDelete && <button onClick={onDelete} style={{ ...smallBtn, color: '#f85149' }}>Del</button>}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
  padding: 8, marginBottom: 6,
};
const tagChip: React.CSSProperties = {
  fontSize: 10, color: '#c9d1d9', background: '#30363d',
  borderRadius: 8, padding: '1px 6px',
};
const smallBtn: React.CSSProperties = {
  fontSize: 10, padding: '2px 8px', cursor: 'pointer',
  background: '#21262d', color: '#8b949e',
  border: '1px solid #30363d', borderRadius: 3,
};
const saveBtn: React.CSSProperties = {
  display: 'block', width: '100%', fontSize: 11, padding: '4px 8px',
  cursor: 'pointer', background: '#21262d', color: '#58a6ff',
  border: '1px solid #30363d', borderRadius: 3, marginBottom: 8,
};
