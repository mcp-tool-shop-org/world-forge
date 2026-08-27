/**
 * convert-assets.ts — AssetEntry → Godot asset manifest.
 *
 * Maps World Forge asset entries to Godot resource paths. Godot expects:
 * - Sprites/portraits → res://assets/sprites/ or res://assets/portraits/
 * - Backgrounds → res://assets/backgrounds/
 * - Tilesets → res://assets/tilesets/
 * - Icons → res://assets/icons/
 *
 * The actual image files aren't generated (they're authored externally), but
 * the manifest establishes the binding between entity/zone asset refs and the
 * file system paths Godot will load at runtime.
 */

import type { WorldProject, AssetKind, AssetProvenance } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

const KIND_TO_DIR: Record<AssetKind, string> = {
    sprite: 'res://assets/sprites',
    portrait: 'res://assets/portraits',
    background: 'res://assets/backgrounds',
    tileset: 'res://assets/tilesets',
    icon: 'res://assets/icons',
};

/** Directory used when AssetEntry.kind is not in KIND_TO_DIR (runtime-unknown). */
export const FALLBACK_ASSET_DIR = 'res://assets/misc';

export interface GodotAssetBinding {
    /** World Forge asset ID (stable key). */
    id: string;
    /** Asset kind (sprite, portrait, background, tileset, icon). */
    kind: AssetKind;
    /** Human-readable label. */
    label: string;
    /** Original path/URI from World Forge. */
    sourcePath: string;
    /** Target path in Godot project. */
    godotPath: string;
    /** Tags for filtering. */
    tags: string[];
    /** Optional pack membership. */
    packId?: string;
    /** Authored asset version, copied through when present. */
    version?: string;
    /** Authored provenance (source/author/license/createdAt), copied through when present. */
    provenance?: AssetProvenance;
}

export interface ConvertAssetsResult {
    assets: GodotAssetBinding[];
    fidelity: FidelityEntry[];
}

/**
 * Derive a Godot filename from a source path's basename, falling back to
 * `${id}.png` when the path has no extension. Shared with convert-tile-layers
 * so atlas ExtResource paths and asset-manifest godotPath agree.
 */
export function deriveGodotFilename(id: string, sourcePath: string): string {
    const parts = sourcePath.replace(/\\/g, '/').split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.includes('.')) {
        return lastPart;
    }
    return `${id}.png`;
}

export function convertAssets(project: WorldProject): ConvertAssetsResult {
    const fidelity: FidelityEntry[] = [];
    const assets: GodotAssetBinding[] = [];

    for (const entry of project.assets) {
        const knownDir = KIND_TO_DIR[entry.kind];
        const unknownKind = knownDir === undefined;
        const dir = knownDir ?? FALLBACK_ASSET_DIR;
        const filename = deriveGodotFilename(entry.id, entry.path);
        const godotPath = `${dir}/${filename}`;

        const binding: GodotAssetBinding = {
            id: entry.id,
            kind: entry.kind,
            label: entry.label,
            sourcePath: entry.path,
            godotPath,
            tags: entry.tags.slice(),
            packId: entry.packId,
        };
        if (entry.version !== undefined) binding.version = entry.version;
        if (entry.provenance) binding.provenance = { ...entry.provenance };

        assets.push(binding);

        if (unknownKind) {
            fidelity.push({
                level: 'approximated',
                domain: 'assets',
                severity: 'warning',
                entityId: entry.id,
                fieldPath: `assets.${entry.id}.kind`,
                message: `Asset "${entry.id}" has unknown kind "${String(entry.kind)}" — mapped to ${godotPath}.`,
                reason: `KIND_TO_DIR has no entry for "${String(entry.kind)}"; used fallback directory ${FALLBACK_ASSET_DIR}.`,
            });
        } else {
            fidelity.push({
                level: 'lossless',
                domain: 'assets',
                severity: 'info',
                entityId: entry.id,
                fieldPath: `assets.${entry.id}`,
                message: `Asset "${entry.id}" (${entry.kind}) mapped to ${godotPath}.`,
                reason: 'Direct path mapping with kind-based directory; version and provenance copied when authored.',
            });
        }
    }

    return { assets, fidelity };
}
