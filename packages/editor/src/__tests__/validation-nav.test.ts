// validation-nav.test.ts — verify validation issue navigation routes
import { describe, it, expect } from 'vitest';
import { classifyError, buildsSubTabFor, isRefError, type Domain } from '../panels/validation-helpers.js';
import type { ValidationError } from '@world-forge/schema';

/** Mirrors the ExportModal handleGoToFirstIssue routing logic. */
function routeToTab(err: ValidationError): string {
  const p = err.path;
  if (p.match(/^zones\.[^.]+/)) return 'map';
  if (p.startsWith('entityPlacements') || p.startsWith('itemPlacements') || p.startsWith('spawnPoints') || p.startsWith('connections') || p.startsWith('landmarks')) return 'map';
  if (p.startsWith('playerTemplate')) return 'player';
  if (p.startsWith('buildCatalog')) return 'builds';
  if (p.startsWith('progressionTrees')) return 'trees';
  if (p.startsWith('dialogues')) return 'dialogue';
  if (p.startsWith('assetPacks') || p.startsWith('assets')) return 'assets';
  return 'map'; // fallback
}

describe('classifyError', () => {
  it('classifies zone paths as world', () => {
    expect(classifyError({ path: 'zones.z1', message: '' })).toBe('world');
  });
  it('classifies entity paths', () => {
    expect(classifyError({ path: 'entityPlacements.e1', message: '' })).toBe('entities');
  });
  it('classifies asset paths', () => {
    expect(classifyError({ path: 'assets.a1.kind', message: '' })).toBe('assets');
  });
  it('classifies assetPack paths', () => {
    expect(classifyError({ path: 'assetPacks.p1', message: '' })).toBe('packs');
  });
  it('classifies dialogue paths', () => {
    expect(classifyError({ path: 'dialogues.d1', message: '' })).toBe('dialogue');
  });
  it('classifies build catalog paths', () => {
    expect(classifyError({ path: 'buildCatalog.archetypes', message: '' })).toBe('builds');
  });
  it('classifies progression paths', () => {
    expect(classifyError({ path: 'progressionTrees.t1', message: '' })).toBe('progression');
  });
});

describe('ExportModal go-to-first-issue routing', () => {
  it('routes asset errors to assets tab', () => {
    expect(routeToTab({ path: 'assets.a1.kind', message: '' })).toBe('assets');
  });
  it('routes assetPack errors to assets tab', () => {
    expect(routeToTab({ path: 'assetPacks.p1', message: '' })).toBe('assets');
  });
  it('routes zone errors to map tab', () => {
    expect(routeToTab({ path: 'zones.z1.neighbors', message: '' })).toBe('map');
  });
  it('routes entity errors to map tab', () => {
    expect(routeToTab({ path: 'entityPlacements.e1', message: '' })).toBe('map');
  });
  it('routes spawn errors to map tab', () => {
    expect(routeToTab({ path: 'spawnPoints', message: '' })).toBe('map');
  });
  it('routes landmark errors to map tab', () => {
    expect(routeToTab({ path: 'landmarks.l1', message: '' })).toBe('map');
  });
  it('routes player errors to player tab', () => {
    expect(routeToTab({ path: 'playerTemplate.hp', message: '' })).toBe('player');
  });
  it('routes build catalog errors to builds tab', () => {
    expect(routeToTab({ path: 'buildCatalog.archetypes', message: '' })).toBe('builds');
  });
  it('routes dialogue errors to dialogue tab', () => {
    expect(routeToTab({ path: 'dialogues.d1', message: '' })).toBe('dialogue');
  });
  it('routes progression errors to trees tab', () => {
    expect(routeToTab({ path: 'progressionTrees.t1', message: '' })).toBe('trees');
  });
});

describe('buildsSubTabFor', () => {
  it('routes archetypes', () => {
    expect(buildsSubTabFor('buildCatalog.archetypes.a1')).toBe('archetypes');
  });
  it('routes backgrounds', () => {
    expect(buildsSubTabFor('buildCatalog.backgrounds.b1')).toBe('backgrounds');
  });
  it('routes traits', () => {
    expect(buildsSubTabFor('buildCatalog.traits.t1')).toBe('traits');
  });
  it('routes disciplines', () => {
    expect(buildsSubTabFor('buildCatalog.disciplines.d1')).toBe('disciplines');
  });
  it('routes crossTitles to combos', () => {
    expect(buildsSubTabFor('buildCatalog.crossTitles.c1')).toBe('combos');
  });
  it('defaults to config', () => {
    expect(buildsSubTabFor('buildCatalog')).toBe('config');
  });
});

describe('isRefError', () => {
  it('detects backgroundId ref', () => {
    expect(isRefError({ path: 'zones.z1.backgroundId', message: '' })).toBe(true);
  });
  it('detects portraitId ref', () => {
    expect(isRefError({ path: 'entityPlacements.e1.portraitId', message: '' })).toBe(true);
  });
  it('does not flag non-ref paths', () => {
    expect(isRefError({ path: 'zones.z1.name', message: '' })).toBe(false);
  });
});
