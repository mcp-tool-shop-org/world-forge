// built-ins.ts — starter preset library

import type { RegionPreset, EncounterPreset } from './types.js';

// ── Region Presets ────────────────────────────────────────────

export const BUILTIN_REGION_PRESETS: RegionPreset[] = [
  {
    id: 'crypt-district',
    name: 'Crypt District',
    description: 'Undead-haunted tunnels with low morale and relentless pressure.',
    tags: ['undead', 'dungeon'],
    genre: 'fantasy',
    builtIn: true,
    regionTags: ['dark', 'cramped', 'undead'],
    controllingFaction: 'undead-horde',
    baseMetrics: { commerce: 5, morale: 15, safety: 10, stability: 20 },
    economyProfile: {
      supplyCategories: ['bones', 'cursed-relics'],
      scarcityDefaults: { weapons: 0.8, food: 0.9 },
    },
    factionPresences: [
      { factionId: 'undead-horde', influence: 85, alertLevel: 60 },
    ],
    pressureHotspots: [
      { pressureType: 'undead-surge', baseProbability: 0.7, tags: ['undead', 'swarm'] },
    ],
  },
  {
    id: 'market-ward',
    name: 'Market Ward',
    description: 'Bustling trade hub with high commerce and merchant guild oversight.',
    tags: ['trade', 'urban'],
    genre: 'fantasy',
    builtIn: true,
    regionTags: ['bustling', 'trade', 'crowded'],
    controllingFaction: 'merchant-guild',
    baseMetrics: { commerce: 90, morale: 65, safety: 55, stability: 70 },
    economyProfile: {
      supplyCategories: ['weapons', 'armor', 'potions', 'food', 'luxuries'],
      scarcityDefaults: { weapons: 0.2, food: 0.1 },
    },
    factionPresences: [
      { factionId: 'merchant-guild', influence: 75, alertLevel: 20 },
    ],
    pressureHotspots: [
      { pressureType: 'trade-dispute', baseProbability: 0.4, tags: ['economic', 'social'] },
    ],
  },
  {
    id: 'chapel-grounds',
    name: 'Chapel Grounds',
    description: 'Sacred ground with high morale, clergy influence, and divine unrest.',
    tags: ['sacred', 'religious'],
    genre: 'fantasy',
    builtIn: true,
    regionTags: ['sacred', 'quiet', 'holy'],
    controllingFaction: 'clergy',
    baseMetrics: { commerce: 25, morale: 85, safety: 75, stability: 80 },
    economyProfile: {
      supplyCategories: ['healing', 'holy-water', 'tomes'],
      scarcityDefaults: { weapons: 0.7, healing: 0.1 },
    },
    factionPresences: [
      { factionId: 'clergy', influence: 90, alertLevel: 10 },
    ],
    pressureHotspots: [
      { pressureType: 'divine-incursion', baseProbability: 0.3, tags: ['divine', 'miracle'] },
    ],
  },
  {
    id: 'smuggler-dock',
    name: 'Smuggler Dock',
    description: 'Shady waterfront controlled by smugglers with low safety and contraband trade.',
    tags: ['criminal', 'waterfront'],
    genre: 'fantasy',
    builtIn: true,
    regionTags: ['shady', 'waterfront', 'dangerous'],
    controllingFaction: 'smuggler-ring',
    baseMetrics: { commerce: 60, morale: 35, safety: 15, stability: 25 },
    economyProfile: {
      supplyCategories: ['contraband', 'weapons', 'poisons', 'information'],
      scarcityDefaults: { healing: 0.6, food: 0.4 },
    },
    factionPresences: [
      { factionId: 'smuggler-ring', influence: 70, alertLevel: 45 },
    ],
    pressureHotspots: [
      { pressureType: 'contraband-raid', baseProbability: 0.5, tags: ['criminal', 'violence'] },
    ],
  },
];

// ── Encounter Presets ─────────────────────────────────────────

export const BUILTIN_ENCOUNTER_PRESETS: EncounterPreset[] = [
  {
    id: 'boss-encounter',
    name: 'Boss Encounter',
    description: 'Guaranteed scripted boss fight. No cooldown.',
    tags: ['boss', 'combat'],
    builtIn: true,
    encounterType: 'boss',
    enemyIds: [],
    probability: 1.0,
    cooldownTurns: 0,
    encounterTags: ['boss', 'scripted'],
  },
  {
    id: 'hazard-encounter',
    name: 'Hazard Encounter',
    description: 'Environmental trap or obstacle. Moderate probability, short cooldown.',
    tags: ['hazard', 'environmental'],
    builtIn: true,
    encounterType: 'hazard',
    enemyIds: [],
    probability: 0.6,
    cooldownTurns: 2,
    encounterTags: ['environmental', 'trap'],
  },
  {
    id: 'discovery-encounter',
    name: 'Discovery Encounter',
    description: 'Lore reveal or hidden reward. Low probability, long cooldown.',
    tags: ['discovery', 'exploration'],
    builtIn: true,
    encounterType: 'discovery',
    enemyIds: [],
    probability: 0.4,
    cooldownTurns: 5,
    encounterTags: ['lore', 'reward'],
  },
];
