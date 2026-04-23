// entity-renderer.test.ts — tests for EntityRenderer fallback behavior (I-004)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track destroy calls across all mock children so tests can assert leak-free cleanup (INF-A-002).
const destroyCalls: Array<{ kind: string; opts: unknown }> = [];

// Mock pixi.js before importing the module under test
vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) { this.children.push(child); }
    removeChildren(): unknown[] {
      const removed = this.children;
      this.children = [];
      return removed;
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Container', opts }); }
  }
  class MockGraphics {
    calls: string[] = [];
    circle() { this.calls.push('circle'); return this; }
    rect() { this.calls.push('rect'); return this; }
    moveTo() { this.calls.push('moveTo'); return this; }
    lineTo() { this.calls.push('lineTo'); return this; }
    closePath() { this.calls.push('closePath'); return this; }
    fill() { this.calls.push('fill'); return this; }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Graphics', opts }); }
  }
  class MockText {
    text: string;
    style: unknown;
    position = { set: vi.fn() };
    constructor(opts: { text: string; style: unknown }) {
      this.text = opts.text;
      this.style = opts.style;
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Text', opts }); }
  }
  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { EntityRenderer } from '../entity-renderer.js';
import type { EntityPlacement } from '@world-forge/schema';

describe('EntityRenderer', () => {
  let renderer: EntityRenderer;
  const zonePositions = new Map([['zone-1', { x: 0, y: 0 }]]);

  beforeEach(() => {
    destroyCalls.length = 0;
    renderer = new EntityRenderer(32);
  });

  it('renders known roles without error', () => {
    const entities: EntityPlacement[] = [
      { entityId: 'npc-1', zoneId: 'zone-1', role: 'npc' },
      { entityId: 'enemy-1', zoneId: 'zone-1', role: 'enemy' },
      { entityId: 'merchant-1', zoneId: 'zone-1', role: 'merchant' },
    ];
    expect(() => renderer.update(entities, zonePositions)).not.toThrow();
    // 3 entities x 2 children each (graphic + label) = 6
    expect(renderer.container.children.length).toBe(6);
  });

  it('uses fallback color/shape for unknown roles (I-004)', () => {
    const entities: EntityPlacement[] = [
      { entityId: 'mystery-1', zoneId: 'zone-1', role: 'unknown-role' as EntityPlacement['role'] },
    ];
    // Should not throw even with an unrecognized role
    expect(() => renderer.update(entities, zonePositions)).not.toThrow();
    // Should still render graphic + label
    expect(renderer.container.children.length).toBe(2);
  });

  it('warns and skips entities whose zoneId has no position (IB-002)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entities: EntityPlacement[] = [
      { entityId: 'lost-1', zoneId: 'zone-missing', role: 'npc' },
    ];
    renderer.update(entities, zonePositions);
    expect(renderer.container.children.length).toBe(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/lost-1/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/zone-missing/);
    warnSpy.mockRestore();
  });

  it('warns per entity when multiple have missing zones (IB-017)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entities: EntityPlacement[] = [
      { entityId: 'ghost-a', zoneId: 'bad-zone-1', role: 'npc' },
      { entityId: 'ghost-b', zoneId: 'bad-zone-2', role: 'enemy' },
    ];
    renderer.update(entities, zonePositions);
    expect(renderer.container.children.length).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('clears previous children on each update', () => {
    const entities: EntityPlacement[] = [
      { entityId: 'npc-1', zoneId: 'zone-1', role: 'npc' },
    ];
    renderer.update(entities, zonePositions);
    expect(renderer.container.children.length).toBe(2);
    renderer.update([], zonePositions);
    expect(renderer.container.children.length).toBe(0);
  });

  it('destroys previous children on re-update to prevent leaks (INF-A-002)', () => {
    const first: EntityPlacement[] = [
      { entityId: 'npc-1', zoneId: 'zone-1', role: 'npc' },
      { entityId: 'enemy-1', zoneId: 'zone-1', role: 'enemy' },
    ];
    renderer.update(first, zonePositions);
    // First update: nothing to destroy (container was empty).
    expect(destroyCalls.length).toBe(0);
    expect(renderer.container.children.length).toBe(4); // 2 entities x (graphic+label)

    const second: EntityPlacement[] = [
      { entityId: 'npc-2', zoneId: 'zone-1', role: 'merchant' },
    ];
    renderer.update(second, zonePositions);
    // Second update should destroy all 4 previous children (2 Graphics + 2 Text)
    // and pass { children: true } to destroy recursively.
    const graphicsDestroyed = destroyCalls.filter((c) => c.kind === 'Graphics').length;
    const textDestroyed = destroyCalls.filter((c) => c.kind === 'Text').length;
    expect(graphicsDestroyed).toBe(2);
    expect(textDestroyed).toBe(2);
    for (const call of destroyCalls) {
      expect(call.opts).toEqual({ children: true });
    }
    // Bounded child count: after re-update, only the new entity's 2 children remain.
    expect(renderer.container.children.length).toBe(2);
  });

  it('keeps container child count bounded across many updates (INF-A-002)', () => {
    const entities: EntityPlacement[] = [
      { entityId: 'npc-1', zoneId: 'zone-1', role: 'npc' },
      { entityId: 'enemy-1', zoneId: 'zone-1', role: 'enemy' },
      { entityId: 'merchant-1', zoneId: 'zone-1', role: 'merchant' },
    ];
    for (let i = 0; i < 10; i++) {
      renderer.update(entities, zonePositions);
    }
    // 3 entities x 2 children = 6 regardless of update count
    expect(renderer.container.children.length).toBe(6);
  });

  it('destroy() clears the container and prevents subsequent render leaks (INF-A-009)', () => {
    const entities: EntityPlacement[] = [
      { entityId: 'npc-1', zoneId: 'zone-1', role: 'npc' },
      { entityId: 'enemy-1', zoneId: 'zone-1', role: 'enemy' },
    ];
    renderer.update(entities, zonePositions);
    expect(renderer.container.children.length).toBe(4);

    renderer.destroy();
    const containerDestroyed = destroyCalls.filter((c) => c.kind === 'Container');
    expect(containerDestroyed.length).toBe(1);
    expect(containerDestroyed[0].opts).toEqual({ children: true });

    // update() after destroy is a no-op that warns.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = renderer.container.children.length;
    renderer.update(entities, zonePositions);
    expect(renderer.container.children.length).toBe(before);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/destroyed/);
    warnSpy.mockRestore();

    // Idempotent.
    renderer.destroy();
    expect(destroyCalls.filter((c) => c.kind === 'Container').length).toBe(1);
  });
});
