// entity-renderer.test.ts — tests for EntityRenderer fallback behavior (I-004)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pixi.js before importing the module under test
vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) { this.children.push(child); }
    removeChildren() { this.children = []; }
  }
  class MockGraphics {
    calls: string[] = [];
    circle() { this.calls.push('circle'); return this; }
    rect() { this.calls.push('rect'); return this; }
    moveTo() { this.calls.push('moveTo'); return this; }
    lineTo() { this.calls.push('lineTo'); return this; }
    closePath() { this.calls.push('closePath'); return this; }
    fill() { this.calls.push('fill'); return this; }
  }
  class MockText {
    text: string;
    style: unknown;
    position = { set: vi.fn() };
    constructor(opts: { text: string; style: unknown }) {
      this.text = opts.text;
      this.style = opts.style;
    }
  }
  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { EntityRenderer } from '../entity-renderer.js';
import type { EntityPlacement } from '@world-forge/schema';

describe('EntityRenderer', () => {
  let renderer: EntityRenderer;
  const zonePositions = new Map([['zone-1', { x: 0, y: 0 }]]);

  beforeEach(() => {
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
});
