/**
 * convert-districts.test.ts — District → Godot district resource.
 */

import { describe, it, expect } from 'vitest';
import { convertDistricts } from '../convert-districts.js';
import type { WorldProject, District } from '@world-forge/schema';

function proj(districts: District[]): WorldProject {
    return { districts } as unknown as WorldProject;
}

describe('convertDistricts', () => {
    it('copies metrics/economy and stamps a .tres resourcePath', () => {
        const { districts } = convertDistricts(proj([{
            id: 'district-chapel',
            name: 'Chapel Quarter',
            zoneIds: ['zone-entrance'],
            tags: ['sacred'],
            controllingFaction: 'keepers',
            baseMetrics: { commerce: 30, morale: 40, safety: 60, stability: 50 },
            economyProfile: { supplyCategories: ['food'], scarcityDefaults: { food: 0.3 } },
        }]));
        expect(districts[0].resourcePath).toBe('res://world_data/districts/district-chapel.tres');
        expect(districts[0].displayName).toBe('Chapel Quarter');
        expect(districts[0].controllingFaction).toBe('keepers');
        expect(districts[0].baseMetrics.safety).toBe(60);
        expect(districts[0].economyProfile.supplyCategories).toEqual(['food']);
    });
});
