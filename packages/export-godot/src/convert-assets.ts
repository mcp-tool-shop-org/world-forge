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

import type { WorldProject, AssetEntry, AssetKind } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

const KIND_TO_DIR: Record<AssetKind, string> = {
    sprite: 'res://assets/sprites',
    portrait: 'res://assets/portraits',
    background: 'res://assets/backgrounds',
    tileset: 'res://assets/tilesets',
    icon: 'res://assets/icons',
};

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
}

export interface ConvertAssetsResult {
    assets: GodotAssetBinding[];
    fidelity: FidelityEntry[];
}

export function convertAssets(project: WorldProject): ConvertAssetsResult {
    const fidelity: FidelityEntry[] = [];
    const assets: GodotAssetBinding[] = [];

    for (const entry of project.assets) {
        const dir = KIND_TO_DIR[entry.kind];
        // Derive filename from the original path or use the asset ID.
        const filename = deriveFilename(entry);
        const godotPath = `${dir}/${filename}`;

        assets.push({
            id: entry.id,
            kind: entry.kind,
            label: entry.label,
            sourcePath: entry.path,
            godotPath,
            tags: entry.tags.slice(),
            packId: entry.packId,
        });

        fidelity.push({
            level: 'lossless',
            domain: 'assets',
            severity: 'info',
            entityId: entry.id,
            fieldPath: `assets.${entry.id}`,
            message: `Asset "${entry.id}" (${entry.kind}) mapped to ${godotPath}.`,
            reason: 'Direct path mapping with kind-based directory.',
        });
    }

    return { assets, fidelity };
}

function deriveFilename(entry: AssetEntry): string {
    // Try to extract filename from the source path.
    const parts = entry.path.replace(/\\/g, '/').split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.includes('.')) {
        return lastPart;
    }
    // Fallback: use asset ID with a generic extension.
    return `${entry.id}.png`;
}
