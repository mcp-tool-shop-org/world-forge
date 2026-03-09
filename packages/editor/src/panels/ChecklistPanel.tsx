// ChecklistPanel.tsx — first-run guided checklist (mode-adaptive)

import { useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, type RightTab, type EditorTool } from '../store/editor-store.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import { getModeProfile } from '../mode-profiles.js';
import { useKitStore } from '../kits/index.js';
import { scanDependencies } from '@world-forge/schema';

interface Step {
  id: string;
  label: string;
  description: string;
  isComplete: boolean;
  tab: RightTab;
  tool?: EditorTool;
}

export function ChecklistPanel() {
  const { project } = useProjectStore();
  const { hasExported, setRightTab, setTool, dismissChecklist } = useEditorStore();
  const activeKitId = useEditorStore((s) => s.activeKitId);
  const { kits } = useKitStore();

  const profile = useMemo(() => getModeProfile(project.mode), [project.mode]);
  const activeKit = useMemo(() => activeKitId ? kits.find((k) => k.id === activeKitId) : undefined, [activeKitId, kits]);

  const steps: Step[] = useMemo(() => {
    // Kit guideHints take priority, then ModeProfile guideOverrides, then defaults
    const kitHints = activeKit?.guideHints ?? {};
    const ov = profile.guideOverrides;
    const hint = (key: string) => kitHints[key] ?? ov[key];
    return [
    {
      id: 'district',
      label: hint('district')?.label ?? 'Create a district',
      description: hint('district')?.description ?? 'Group zones into a named region.',
      isComplete: project.districts.length > 0, tab: 'map',
    },
    {
      id: 'zone',
      label: hint('zone')?.label ?? 'Add a zone',
      description: hint('zone')?.description ?? 'Use the Zone tool to create a named location.',
      isComplete: project.zones.length > 0, tab: 'map', tool: 'zone-paint',
    },
    {
      id: 'spawn',
      label: hint('spawn')?.label ?? 'Place a spawn point',
      description: hint('spawn')?.description ?? 'Set where players start.',
      isComplete: project.spawnPoints.length > 0, tab: 'map', tool: 'spawn',
    },
    {
      id: 'player',
      label: hint('player')?.label ?? 'Create a player template',
      description: hint('player')?.description ?? 'Set up the player\'s starting stats and gear.',
      isComplete: project.playerTemplate !== undefined, tab: 'player',
    },
    {
      id: 'npc',
      label: hint('npc')?.label ?? 'Add a speaking NPC',
      description: hint('npc')?.description ?? 'Add a character the player can talk to.',
      isComplete: project.entityPlacements.some((e) => e.dialogueId),
      tab: 'dialogue',
    },
    {
      id: 'export', label: 'Export your world', description: 'Generate a pack for AI RPG Engine.',
      isComplete: hasExported, tab: 'issues',
    },
  ];
  }, [project, hasExported, profile, activeKit]);

  const completed = steps.filter((s) => s.isComplete).length;
  const allDone = completed === steps.length;

  const handleClick = (step: Step) => {
    setRightTab(step.tab);
    if (step.tool) setTool(step.tool);
  };

  return (
    <div>
      <div style={headerStyle}>Getting Started</div>
      {activeKit?.source === 'imported' && (
        <div style={{ fontSize: 10, color: '#58a6ff', marginBottom: 6 }}>
          Using imported kit: {activeKit.name}
        </div>
      )}
      {useEditorStore((s) => s.projectBundleSource) === 'imported' && (
        <div style={{ fontSize: 10, color: '#58a6ff', marginBottom: 6 }}>
          Imported from project bundle
        </div>
      )}
      <DependencyHealthStep project={project} setRightTab={setRightTab} />
      {profile.modeTip && (
        <div style={{ fontSize: 11, color: '#58a6ff', marginBottom: 8, fontStyle: 'italic' }}>
          {profile.icon} {profile.modeTip}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 12 }}>
        {allDone
          ? 'All steps complete! Your world is ready.'
          : `${completed} of ${steps.length} steps complete`}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#21262d', borderRadius: 2, marginBottom: 12 }}>
        <div style={{ height: 4, background: '#238636', borderRadius: 2, width: `${(completed / steps.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map((step) => (
          <div
            key={step.id}
            onClick={() => handleClick(step)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
              borderRadius: 4, cursor: 'pointer',
              background: step.isComplete ? 'transparent' : '#0d1117',
              border: `1px solid ${step.isComplete ? 'transparent' : '#30363d'}`,
            }}
          >
            <span style={{
              fontSize: 14, lineHeight: '18px', flexShrink: 0,
              color: step.isComplete ? '#3fb950' : '#484f58',
            }}>
              {step.isComplete ? '\u2713' : '\u25CB'}
            </span>
            <div>
              <div style={{
                fontSize: 12, color: step.isComplete ? '#8b949e' : '#c9d1d9',
                textDecoration: step.isComplete ? 'line-through' : 'none',
              }}>
                {step.label}
              </div>
              <div style={{ fontSize: 10, color: '#484f58' }}>{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {allDone && (
        <button
          onClick={() => setRightTab('issues')}
          style={{ ...actionBtnStyle, background: '#238636', color: '#fff', marginTop: 12 }}
        >
          Go to Export
        </button>
      )}

      <button onClick={dismissChecklist} style={{ ...actionBtnStyle, marginTop: 8 }}>
        Dismiss Guide
      </button>

      {/* Hotkey reference */}
      <div style={{ ...headerStyle, marginTop: 16 }}>Keyboard Shortcuts</div>
      <table style={{ width: '100%', fontSize: 11, color: '#8b949e', borderCollapse: 'collapse' }}>
        <tbody>
          {HOTKEY_BINDINGS.filter((b, i, arr) =>
            // Deduplicate by action (e.g. Delete and Backspace both → 'delete')
            arr.findIndex((x) => x.action === b.action) === i
          ).map((b) => (
            <tr key={b.action} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: '3px 4px', fontFamily: 'monospace', color: '#58a6ff', whiteSpace: 'nowrap' }}>{b.label}</td>
              <td style={{ padding: '3px 4px' }}>{b.description}</td>
            </tr>
          ))}
          <tr style={{ borderBottom: '1px solid #21262d' }}>
            <td style={{ padding: '3px 4px', fontFamily: 'monospace', color: '#58a6ff', whiteSpace: 'nowrap' }}>Space</td>
            <td style={{ padding: '3px 4px' }}>Hold to pan canvas</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #21262d' }}>
            <td style={{ padding: '3px 4px', fontFamily: 'monospace', color: '#58a6ff', whiteSpace: 'nowrap' }}>Dbl-click</td>
            <td style={{ padding: '3px 4px' }}>Open details for clicked object</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 'bold', color: '#c9d1d9',
  borderBottom: '1px solid #30363d', paddingBottom: 6, marginBottom: 8,
};

const actionBtnStyle: React.CSSProperties = {
  width: '100%', padding: '6px 0', fontSize: 11, cursor: 'pointer',
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
  borderRadius: 4,
};

function DependencyHealthStep({ project, setRightTab }: { project: import('@world-forge/schema').WorldProject; setRightTab: (tab: RightTab) => void }) {
  const report = useMemo(() => scanDependencies(project), [project]);
  const { broken, mismatched, orphaned } = report.summary;
  const issues = broken + mismatched;

  if (issues === 0 && orphaned === 0) {
    return (
      <div style={{ fontSize: 10, color: '#3fb950', marginBottom: 6 }}>
        All references resolved
      </div>
    );
  }

  return (
    <>
      {issues > 0 && (
        <div
          onClick={() => setRightTab('deps')}
          style={{ fontSize: 10, color: '#d29922', marginBottom: 4, cursor: 'pointer' }}
        >
          {issues} broken reference{issues !== 1 ? 's' : ''} — open Deps tab to repair
        </div>
      )}
      {orphaned > 0 && (
        <div
          onClick={() => setRightTab('deps')}
          style={{ fontSize: 10, color: '#8b949e', marginBottom: 4, cursor: 'pointer' }}
        >
          {orphaned} orphaned asset{orphaned !== 1 ? 's' : ''} — review in Deps tab
        </div>
      )}
    </>
  );
}
