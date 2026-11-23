import { describe, it, expect, vi } from 'vitest';
import {
  COMMAND_REGISTRY,
  getCommandById,
  getCommandsForSurface,
  runCommand,
  type CommandContext,
} from '../command-registry.js';
import { SPEED_PANEL_ACTIONS, getContextMenuActions } from '../speed-panel-actions.js';
import { HOTKEY_BINDINGS, matchHotkey } from '../hotkeys.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import { emptySelection } from '../store/editor-store.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { HitResult } from '../hit-testing.js';

const EXPECTED_SPEED_PANEL_IDS = [
  'new-zone',
  'fit-content',
  'edit-props',
  'delete',
  'duplicate',
  'assign-district',
  'place-entity',
  'place-encounter',
  'connect-from',
  'swap-direction',
  'add-secret-conn',
  'add-channel-conn',
  'add-warp-conn',
  'add-trail-conn',
  'merge-zones',
  'set-elevation',
  'open-review',
  'export-summary',
  'create-macro-from-recent',
];

const EXPECTED_HOTKEY_ACTION_IDS = [
  'search',
  'save',
  'copy',
  'paste',
  'duplicate',
  'undo',
  'redo',
  'select-all',
  'delete',
  'escape',
  'nudge-up',
  'nudge-down',
  'nudge-left',
  'nudge-right',
  'open-details',
  'apply-preset',
  'save-preset',
  'tool-select',
  'tool-zone',
  'tool-connection',
  'tool-entity',
  'tool-landmark',
  'tool-spawn',
  'tool-tile',
  'tool-prop',
  'tool-encounter',
  'tool-item',
];

const EXPECTED_TOOLS = [
  'select',
  'zone-paint',
  'connection',
  'entity-place',
  'landmark',
  'spawn',
  'tile-paint',
  'prop-place',
  'encounter-place',
  'item-place',
];

const ALL_HIT_SAMPLES: Array<HitResult | null> = [
  null,
  { type: 'zone', id: 'zone-entrance' },
  { type: 'entity', id: 'npc-keeper' },
  { type: 'connection', id: 'zone-entrance::zone-cellar' },
  { type: 'landmark', id: 'lm-altar' },
  { type: 'spawn', id: 'sp-default' },
  { type: 'encounter', id: 'enc-cellar' },
  { type: 'item', id: 'item-key' },
  { type: 'market', id: 'mkt-1' },
  { type: 'station', id: 'sta-1' },
  { type: 'building', id: 'bld-1' },
  { type: 'hub', id: 'hub-1' },
  { type: 'stronghold', id: 'str-1' },
  { type: 'prop', id: 'prop-1' },
  { type: 'tile', id: '1,2' },
];

describe('editor command registry (Part 4)', () => {
  it('every registered command defines id, title, category, keywords, when, disabledReason, and run with unique ids', () => {
    expect(COMMAND_REGISTRY.length).toBe(44);
    const seen = new Set<string>();
    for (const cmd of COMMAND_REGISTRY) {
      expect(typeof cmd.id).toBe('string');
      expect(cmd.id.length).toBeGreaterThan(0);
      expect(seen.has(cmd.id)).toBe(false);
      seen.add(cmd.id);

      expect(typeof cmd.title).toBe('string');
      expect(cmd.title.length).toBeGreaterThan(0);
      expect(typeof cmd.category).toBe('string');
      expect(Array.isArray(cmd.keywords)).toBe(true);
      expect(typeof cmd.when).toBe('function');
      expect(typeof cmd.disabledReason).toBe('function');
      expect(typeof cmd.run).toBe('function');
    }
  });

  it('every surface ID set matches COMMAND_REGISTRY independently and action.contextFilter agrees with cmd.when across all hit types', () => {
    expect(SPEED_PANEL_ACTIONS.map((a) => a.id)).toEqual(EXPECTED_SPEED_PANEL_IDS);
    expect(getCommandsForSurface('speed-panel').map((c) => c.id)).toEqual(EXPECTED_SPEED_PANEL_IDS);

    for (const action of SPEED_PANEL_ACTIONS) {
      const cmd = getCommandById(action.id)!;
      expect(cmd).toBeDefined();
      expect(cmd.surfaces).toContain('speed-panel');
      for (const hit of ALL_HIT_SAMPLES) {
        expect(
          action.contextFilter(hit),
          `contextFilter vs when mismatch for "${action.id}" on hit "${hit?.type ?? 'null'}"`,
        ).toBe(cmd.when({ hit }));
      }
    }

    for (const hit of ALL_HIT_SAMPLES) {
      const menuItems = getContextMenuActions(hit, minimalProject);
      expect(menuItems.length).toBeGreaterThan(0);
      expect(menuItems.length).toBeLessThanOrEqual(7);
      for (const item of menuItems) {
        const cmd = getCommandById(item.id);
        expect(cmd, `Missing registry entry for context-menu item "${item.id}"`).toBeDefined();
        expect(cmd!.surfaces).toContain('context-menu');
        expect(cmd!.when({ hit })).toBe(true);
      }
    }

    expect(HOTKEY_BINDINGS.length).toBe(29);
    const hotkeyActions = [...new Set(HOTKEY_BINDINGS.map((b) => b.action))];
    expect(hotkeyActions).toEqual(EXPECTED_HOTKEY_ACTION_IDS);

    expect(TOOL_PALETTE_TOOLS.map((t) => t.id)).toEqual(EXPECTED_TOOLS);
    const toolCommands = getCommandsForSurface('tool-palette');
    expect(toolCommands.map((c) => c.tool)).toEqual(EXPECTED_TOOLS);
  });

  it('every registry command with a hotkeyId owns its own binding and round-trips through matchHotkey', () => {
    const editProps = getCommandById('edit-props')!;
    expect(editProps.hotkeyId).toBeUndefined();

    const commandsWithHotkey = COMMAND_REGISTRY.filter((c) => c.hotkeyId !== undefined);
    expect(commandsWithHotkey.length).toBe(EXPECTED_HOTKEY_ACTION_IDS.length);

    for (const cmd of commandsWithHotkey) {
      expect(cmd.surfaces).toContain('hotkey');
      expect(cmd.hotkeyId).toBe(cmd.id);
      expect(cmd.hotkeyBindings && cmd.hotkeyBindings.length).toBeGreaterThan(0);

      for (const binding of cmd.hotkeyBindings!) {
        const syntheticEvent = {
          code: binding.key,
          ctrlKey: Boolean(binding.ctrl),
          metaKey: false,
          shiftKey: Boolean(binding.shift),
        } as unknown as KeyboardEvent;
        expect(matchHotkey(syntheticEvent)).toBe(cmd.id);
      }
    }
  });

  it('when(ctx), disabledReason(ctx), and run(ctx) report accurate preconditions and dispatch tool commands', () => {
    const editProps = getCommandById('edit-props')!;
    expect(editProps.when({ hit: null })).toBe(false);
    expect(editProps.disabledReason({ hit: null })).toBeTruthy();
    expect(editProps.when({ hit: { type: 'entity', id: 'npc-keeper' } })).toBe(true);
    expect(editProps.disabledReason({ hit: { type: 'entity', id: 'npc-keeper' } })).toBeNull();

    const mergeZones = getCommandById('merge-zones')!;
    const singleSelCtx: CommandContext = {
      hit: { type: 'zone', id: 'zone-entrance' },
      selection: { ...emptySelection(), zones: ['zone-entrance'] },
    };
    expect(mergeZones.when(singleSelCtx)).toBe(true);
    expect(mergeZones.disabledReason(singleSelCtx)).toBeTruthy();

    const twoSelCtx: CommandContext = {
      hit: { type: 'zone', id: 'zone-entrance' },
      selection: { ...emptySelection(), zones: ['zone-entrance', 'zone-cellar'] },
    };
    expect(mergeZones.disabledReason(twoSelCtx)).toBeNull();

    const setTool = vi.fn();
    expect(runCommand('tool-encounter', { setTool })).toEqual({
      executed: true,
      handled: true,
      action: 'tool-encounter',
    });
    expect(setTool).toHaveBeenCalledWith('encounter-place');
  });
});
