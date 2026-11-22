import { describe, it, expect, vi } from 'vitest';
import {
  COMMAND_REGISTRY,
  getCommandById,
  getCommandsForSurface,
  runCommand,
  type CommandContext,
} from '../command-registry.js';
import { SPEED_PANEL_ACTIONS, getContextMenuActions } from '../speed-panel-actions.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import { emptySelection } from '../store/editor-store.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { HitResult } from '../hit-testing.js';

describe('editor command registry (Part 4)', () => {
  it('every registered command defines id, title, category, keywords, when, disabledReason, and run with unique ids', () => {
    expect(COMMAND_REGISTRY.length).toBe(43);
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

  it('every command shown by Speed Panel, right-click context menu, hotkeys, and Tool Palette exists in COMMAND_REGISTRY', () => {
    for (const action of SPEED_PANEL_ACTIONS) {
      const cmd = getCommandById(action.id);
      expect(cmd, `Missing registry entry for Speed Panel action "${action.id}"`).toBeDefined();
      expect(cmd!.surfaces).toContain('speed-panel');
    }

    const hits: Array<HitResult | null> = [
      null,
      { type: 'zone', id: 'zone-entrance' },
      { type: 'entity', id: 'npc-keeper' },
      { type: 'connection', id: 'zone-entrance::zone-cellar' },
      { type: 'landmark', id: 'lm-altar' },
      { type: 'spawn', id: 'sp-default' },
      { type: 'encounter', id: 'enc-cellar' },
    ];
    for (const hit of hits) {
      const menuItems = getContextMenuActions(hit, minimalProject);
      for (const item of menuItems) {
        const cmd = getCommandById(item.id);
        expect(cmd, `Missing registry entry for context-menu item "${item.id}"`).toBeDefined();
        expect(cmd!.surfaces).toContain('context-menu');
      }
    }

    for (const binding of HOTKEY_BINDINGS) {
      const cmd = getCommandById(binding.action);
      expect(cmd, `Missing registry entry for hotkey action "${binding.action}"`).toBeDefined();
      expect(cmd!.surfaces).toContain('hotkey');
    }

    const toolCommands = getCommandsForSurface('tool-palette');
    for (const toolItem of TOOL_PALETTE_TOOLS) {
      const cmd = toolCommands.find((c) => c.tool === toolItem.id);
      expect(cmd, `Missing registry entry for tool palette tool "${toolItem.id}"`).toBeDefined();
      expect(cmd!.toolLabel).toBe(toolItem.label);
      expect(cmd!.toolKey).toBe(toolItem.key);
      expect(cmd!.toolIcon).toBe(toolItem.icon);
    }
  });

  it('every registry command with a hotkeyId matches a binding in HOTKEY_BINDINGS', () => {
    const bindingActions = new Set(HOTKEY_BINDINGS.map((b) => b.action));
    const commandsWithHotkey = COMMAND_REGISTRY.filter((c) => c.hotkeyId !== undefined);
    expect(commandsWithHotkey.length).toBeGreaterThan(0);

    for (const cmd of commandsWithHotkey) {
      expect(
        bindingActions.has(cmd.hotkeyId!),
        `Command "${cmd.id}" declares hotkeyId "${cmd.hotkeyId}" missing from HOTKEY_BINDINGS`,
      ).toBe(true);
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
