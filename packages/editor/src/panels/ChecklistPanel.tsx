// ChecklistPanel.tsx — first-run guided checklist

import { useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, type RightTab, type EditorTool } from '../store/editor-store.js';

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

  const steps: Step[] = useMemo(() => [
    {
      id: 'district', label: 'Create a district', description: 'Group zones into a named region.',
      isComplete: project.districts.length > 0, tab: 'map',
    },
    {
      id: 'zone', label: 'Add a zone', description: 'Use the Zone tool to create a named location.',
      isComplete: project.zones.length > 0, tab: 'map', tool: 'zone-paint',
    },
    {
      id: 'spawn', label: 'Place a spawn point', description: 'Set where players start.',
      isComplete: project.spawnPoints.length > 0, tab: 'map', tool: 'spawn',
    },
    {
      id: 'player', label: 'Create a player template', description: 'Set up the player\'s starting stats and gear.',
      isComplete: project.playerTemplate !== undefined, tab: 'player',
    },
    {
      id: 'npc', label: 'Add a speaking NPC', description: 'Add a character the player can talk to.',
      isComplete: project.entityPlacements.some((e) => e.dialogueId),
      tab: 'dialogue',
    },
    {
      id: 'export', label: 'Export your world', description: 'Generate a pack for AI RPG Engine.',
      isComplete: hasExported, tab: 'issues',
    },
  ], [project, hasExported]);

  const completed = steps.filter((s) => s.isComplete).length;
  const allDone = completed === steps.length;

  const handleClick = (step: Step) => {
    setRightTab(step.tab);
    if (step.tool) setTool(step.tool);
  };

  return (
    <div>
      <div style={headerStyle}>Getting Started</div>
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
