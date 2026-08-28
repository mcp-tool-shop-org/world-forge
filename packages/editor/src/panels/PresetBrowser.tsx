import { useState, useEffect } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { usePresetStore, StoragePersistError } from '../presets/preset-store.js';
import { pushToast } from '../ui/Toast.js';
import type { RegionPreset, EncounterPreset } from '../presets/types.js';
import { buttonBase, buttonAccent } from '../ui/styles.js';
import { ConfirmButton } from './shared.js';
import {
  filterPresetsByMode,
  buildRegionPresetFromDistrict,
  buildEncounterPresetFromAnchor,
  rememberAppliedRegionPreset,
  rememberAppliedEncounterPreset,
} from '../preset-actions.js';

export { filterPresetsByMode } from '../preset-actions.js';

type SubTab = 'region' | 'encounter';

export function PresetBrowser() {
  const [subTab, setSubTab] = useState<SubTab>('region');
  const [applyMode, setApplyMode] = useState<'merge' | 'overwrite'>('merge');
  const [confirmTarget, setConfirmTarget] = useState<{ preset: RegionPreset | EncounterPreset; type: SubTab } | null>(null);

  const { project, applyRegionPreset, createEncounterFromPreset } = useProjectStore();
  const { selection } = useEditorStore();
  const { selectEncounter } = useEditorStore();
  const {
    regionPresets, encounterPresets, loadPresets,
    saveRegionPreset, deleteRegionPreset, duplicateRegionPreset,
    saveEncounterPreset, deleteEncounterPreset, duplicateEncounterPreset,
  } = usePresetStore();

  useEffect(() => {
    const result = loadPresets();
    if (result?.reset) {
      pushToast('Saved presets could not be read and were reset.', 'warning', 4000);
    }
  }, [loadPresets]);

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
    rememberAppliedRegionPreset(preset.id);
    setConfirmTarget(null);
  };

  const handleApplyEncounter = (preset: EncounterPreset) => {
    if (!selectedZoneId) return;
    const id = createEncounterFromPreset(selectedZoneId, preset);
    rememberAppliedEncounterPreset(preset.id);
    selectEncounter(id, false);
    setConfirmTarget(null);
  };

  const handleSaveRegionFromCurrent = () => {
    if (!selectedDistrict) return;
    try {
      saveRegionPreset(buildRegionPresetFromDistrict(project, selectedDistrict));
    } catch (err) {
      const msg = err instanceof StoragePersistError
        ? 'Could not save region preset — browser storage is full or blocked.'
        : (err instanceof Error ? err.message : 'Could not save region preset.');
      pushToast(msg, 'error', 4000);
    }
  };

  const handleSaveEncounterFromCurrent = () => {
    if (!selectedEnc) return;
    try {
      saveEncounterPreset(buildEncounterPresetFromAnchor(selectedEnc));
    } catch (err) {
      const msg = err instanceof StoragePersistError
        ? 'Could not save encounter preset — browser storage is full or blocked.'
        : (err instanceof Error ? err.message : 'Could not save encounter preset.');
      pushToast(msg, 'error', 4000);
    }
  };

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['region', 'encounter'] as SubTab[]).map((t) => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer',
            background: subTab === t ? 'var(--wf-bg-control)' : 'transparent',
            color: subTab === t ? 'var(--wf-accent)' : 'var(--wf-text-muted)',
            border: subTab === t ? '1px solid var(--wf-border-default)' : '1px solid transparent',
            borderRadius: 3,
          }}>
            {t === 'region' ? 'Region' : 'Encounter'}
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      {subTab === 'region' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--wf-text-muted)' }}>Mode:</span>
          {(['merge', 'overwrite'] as const).map((m) => (
            <button key={m} onClick={() => setApplyMode(m)} style={{
              fontSize: 10, padding: '2px 6px', cursor: 'pointer',
              background: applyMode === m ? 'var(--wf-success)' : 'var(--wf-bg-control)',
              color: applyMode === m ? '#fff' : 'var(--wf-text-muted)',
              border: '1px solid var(--wf-border-default)', borderRadius: 3,
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
        <div style={{ fontSize: 10, color: 'var(--wf-text-muted)', marginBottom: 6 }}>
          {hiddenRegionCount} hidden by mode
        </div>
      )}
      {subTab === 'encounter' && hiddenEncounterCount > 0 && (
        <div style={{ fontSize: 10, color: 'var(--wf-text-muted)', marginBottom: 6 }}>
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
          onDuplicate={() => {
            try { duplicateRegionPreset(p.id); }
            catch (err) {
              pushToast(err instanceof StoragePersistError
                ? 'Could not duplicate preset — browser storage is full or blocked.'
                : 'Could not duplicate preset.', 'error', 4000);
            }
          }}
          onDelete={!p.builtIn ? () => {
            try { deleteRegionPreset(p.id); }
            catch (err) {
              pushToast(err instanceof StoragePersistError
                ? 'Could not delete preset — browser storage is full or blocked.'
                : 'Could not delete preset.', 'error', 4000);
            }
          } : undefined}
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
          onDuplicate={() => {
            try { duplicateEncounterPreset(p.id); }
            catch {
              pushToast('Could not duplicate preset — browser storage is full or blocked.', 'error', 4000);
            }
          }}
          onDelete={!p.builtIn ? () => {
            try { deleteEncounterPreset(p.id); }
            catch {
              pushToast('Could not delete preset — browser storage is full or blocked.', 'error', 4000);
            }
          } : undefined}
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
        {builtIn && <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }} title="Built-in preset">&#128274;</span>}
        <strong style={{ fontSize: 12, color: 'var(--wf-text-primary)' }}>{name}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>{description}</div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {tags.map((t) => (
            <span key={t} style={tagChip}>{t}</span>
          ))}
        </div>
      )}
      {/* Preview */}
      <div style={{ fontSize: 10, color: 'var(--wf-text-muted)', marginBottom: 6 }}>
        {previewLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={onApply}
          disabled={!canApply}
          style={{
            ...smallBtn,
            background: isConfirming ? 'var(--wf-success)' : 'var(--wf-bg-control)',
            color: isConfirming ? '#fff' : canApply ? 'var(--wf-accent)' : 'var(--wf-text-muted)',
            cursor: canApply ? 'pointer' : 'not-allowed',
          }}
        >
          {isConfirming ? 'Confirm' : applyLabel}
        </button>
        <button onClick={onDuplicate} style={smallBtn}>Dup</button>
        {/* F-92ae872e: preset-store.ts has no undo/redo at all, so an
            unconfirmed delete here is genuinely, permanently irreversible —
            unlike most deletes in the app, which sit on the project undo
            stack. Reuses the same ConfirmButton this file's sibling modal
            (TemplateManager.tsx) and DistrictPanel.tsx already rely on for
            the same class of "library item" deletion, instead of a bare
            single-click onClick={onDelete}. */}
        {onDelete && (
          <ConfirmButton
            label="Del"
            onConfirm={onDelete}
            style={{ fontSize: 10, padding: '2px 8px', width: 'auto', marginTop: 0 }}
          />
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--wf-bg-panel)', border: '1px solid var(--wf-border-default)', borderRadius: 4,
  padding: 8, marginBottom: 6,
};
const tagChip: React.CSSProperties = {
  fontSize: 10, color: 'var(--wf-text-primary)', background: 'var(--wf-bg-hover)',
  borderRadius: 8, padding: '1px 6px',
};
const smallBtn: React.CSSProperties = {
  ...buttonBase, fontSize: 10, padding: '2px 8px', color: 'var(--wf-text-muted)',
};
const saveBtn: React.CSSProperties = {
  ...buttonAccent, display: 'block', width: '100%', fontSize: 11, padding: '4px 8px',
  marginBottom: 8,
};
