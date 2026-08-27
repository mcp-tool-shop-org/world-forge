import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyGodotUiOptions,
  applyUnrealUiOptions,
  runGodotExport,
  runUnrealExport,
  runEngineExport,
  DEFAULT_GODOT_OPTIONS,
  DEFAULT_UNREAL_OPTIONS,
  type ExportCallbacks,
  type ExportEnv,
  type ExportStatus,
} from '../export-handlers.js';
import { SAMPLE_WORLDS } from '../../templates/samples.js';

const chapel = SAMPLE_WORLDS[2].project;

function makeCallbacks() {
  let status: ExportStatus | null = null;
  let errors: string[] = [];
  return {
    cb: {
      setErrors: (e: string[]) => { errors = e; },
      setWarnings: () => { /* ignore */ },
      setStatus: (s: ExportStatus) => { status = s; },
      markExported: () => { /* ignore */ },
    } satisfies ExportCallbacks,
    getStatus: () => status,
    getErrors: () => errors,
  };
}

describe('F-6fa18661: Godot/Unreal UI options mutate the pack, not just the sidecar', () => {
  it('includeWorldTscn:false drops worldSceneTscn from the content pack', () => {
    const pack = applyGodotUiOptions(
      { worldSceneTscn: '[gd_scene]', entities: { all: [], byZone: {} }, transitions: [] },
      { ...DEFAULT_GODOT_OPTIONS, includeWorldTscn: false },
    );
    expect(pack.worldSceneTscn).toBeUndefined();
  });

  it('entityScenePrefix rewrites entity sceneTemplate paths', () => {
    const pack = applyGodotUiOptions(
      {
        worldSceneTscn: 'x',
        entities: {
          all: [{ sceneTemplate: 'res://entities/npc/npc_generic.tscn' }],
          byZone: { z1: [{ sceneTemplate: 'res://entities/npc/npc_generic.tscn' }] },
        },
        transitions: [{ sceneTemplate: 'res://transitions/warp.tscn' }],
      },
      {
        ...DEFAULT_GODOT_OPTIONS,
        entityScenePrefix: 'res://npcs/',
        transitionScenePrefix: 'res://doors/',
      },
    );
    const entities = pack.entities as { all: Array<{ sceneTemplate: string }> };
    expect(entities.all[0].sceneTemplate).toBe('res://npcs/npc/npc_generic.tscn');
    const transitions = pack.transitions as Array<{ sceneTemplate: string }>;
    expect(transitions[0].sceneTemplate).toBe('res://doors/warp.tscn');
  });

  it('includeStreamingHints:false empties Unreal Connections', () => {
    const pack = applyUnrealUiOptions(
      {
        Meta: {},
        Connections: [{ FromZoneId: 'a', ToZoneId: 'b' }],
        Actors: { All: [{ BlueprintTag: 'BP_NPC_Generic' }], ByZone: {} },
      },
      { ...DEFAULT_UNREAL_OPTIONS, includeStreamingHints: false, blueprintPathPrefix: '/Game/Custom/' },
    );
    expect(pack.Connections).toEqual([]);
    const meta = pack.Meta as { BlueprintPathPrefix: string };
    expect(meta.BlueprintPathPrefix).toBe('/Game/Custom/');
    const actors = pack.Actors as { All: Array<{ BlueprintPath: string }> };
    expect(actors.All[0].BlueprintPath).toBe('/Game/Custom/BP_NPC_Generic');
  });

  it('runGodotExport with includeWorldTscn:false omits worldSceneTscn in the downloaded bundle', async () => {
    let last: unknown = null;
    const env: ExportEnv = { downloadJson: (_f, data) => { last = data; return null; } };
    const h = makeCallbacks();
    await runGodotExport(chapel, h.cb, env, { ...DEFAULT_GODOT_OPTIONS, includeWorldTscn: false });
    expect(h.getStatus()).toBe('exported');
    const bundle = last as { contentPack: Record<string, unknown> };
    expect(bundle.contentPack.worldSceneTscn).toBeUndefined();
  });
});

describe('F-38ec48e4: export handlers never reject', () => {
  let h: ReturnType<typeof makeCallbacks>;

  beforeEach(() => { h = makeCallbacks(); });

  it('serialize throw is mapped to invalid + errors and the promise resolves', async () => {
    const env: ExportEnv = {
      downloadJson: () => { throw new Error('circular'); },
    };
    await expect(runEngineExport(chapel, h.cb, env)).resolves.toBeUndefined();
    expect(h.getStatus()).toBe('invalid');
    expect(h.getErrors()[0]).toContain('Failed to serialize export bundle');
  });

  it('Unreal serialize throw does not reject', async () => {
    const env: ExportEnv = { downloadJson: () => { throw new Error('boom'); } };
    await expect(runUnrealExport(chapel, h.cb, env)).resolves.toBeUndefined();
    expect(h.getStatus()).toBe('invalid');
    expect(h.getErrors()[0]).toContain('Failed to serialize Unreal export bundle');
  });
});
