/**
 * copy-assets.ts — plan copying authored image bytes into a Godot project.
 *
 * convert-assets / convert-tile-layers / convert-props stamp res:// dest paths
 * and report lossless "direct path mapping". This is the file channel that
 * actually materializes those bytes under --out so Texture2D ExtResources
 * resolve. Color-only tilesets (no imagePath) are skipped — do not invent
 * textures for them.
 */

import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { WorldProject } from '@world-forge/schema';
import type { GodotAssetBinding } from './convert-assets.js';
import { tilesetTexturePath } from './convert-tile-layers.js';
import { propTexturePath } from './convert-props.js';
import type { FidelityEntry } from './fidelity.js';

export interface GodotAssetCopy {
    /** Absolute path of the readable authored file. */
    sourceAbs: string;
    /** Destination relative to the Godot project root (res:// stripped). */
    destRel: string;
    /** Stamped res:// path, matching Texture2D ExtResource / asset godotPath. */
    godotPath: string;
}

/** Convert a `res://...` path into a project-relative path; reject `..`. */
export function resourcePathToRel(resourcePath: string): string {
    const stripped = resourcePath.replace(/^res:\/\//, '');
    const parts = stripped.split(/[/\\]/).filter((p) => p.length > 0 && p !== '.' && p !== '..');
    return parts.join('/');
}

/** True for http(s)/data/file/other scheme:// URIs. Windows `C:\` is local. */
export function isRemoteAssetUri(path: string): boolean {
    const p = path.trim();
    if (/^(https?|data|file|ftp):/i.test(p)) return true;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return true;
    return false;
}

function isReadableFile(abs: string): boolean {
    try {
        return existsSync(abs) && statSync(abs).isFile();
    } catch {
        return false;
    }
}

function resolveAuthored(baseDir: string, path: string): string {
    return isAbsolute(path) ? path : resolve(baseDir, path);
}

interface PlannedSource {
    id: string;
    domain: FidelityEntry['domain'];
    fieldPath: string;
    sourcePath: string;
    godotPath: string;
}

export function planAuthoredAssetCopies(args: {
    assets: GodotAssetBinding[];
    tilesets: NonNullable<WorldProject['tilesets']>;
    props: NonNullable<WorldProject['props']>;
    baseDir: string;
}): { copies: GodotAssetCopy[]; fidelity: FidelityEntry[] } {
    const copies: GodotAssetCopy[] = [];
    const fidelity: FidelityEntry[] = [];
    const seenDest = new Set<string>();

    const sources: PlannedSource[] = [];

    for (const a of args.assets) {
        sources.push({
            id: a.id,
            domain: 'assets',
            fieldPath: `assets.${a.id}.path`,
            sourcePath: a.sourcePath,
            godotPath: a.godotPath,
        });
    }
    for (const ts of args.tilesets) {
        // Color-only tilesets have no imagePath — do not invent a texture file.
        if (!ts.imagePath) continue;
        sources.push({
            id: ts.id,
            domain: 'tiles',
            fieldPath: `tilesets.${ts.id}.imagePath`,
            sourcePath: ts.imagePath,
            godotPath: tilesetTexturePath(ts.id, ts.imagePath),
        });
    }
    for (const p of args.props) {
        if (!p.imagePath) continue;
        sources.push({
            id: p.id,
            domain: 'props',
            fieldPath: `props.${p.id}.imagePath`,
            sourcePath: p.imagePath,
            godotPath: propTexturePath(p.id, p.imagePath),
        });
    }

    for (const src of sources) {
        const destRel = resourcePathToRel(src.godotPath);
        if (!destRel) {
            fidelity.push({
                level: 'approximated',
                domain: src.domain,
                severity: 'warning',
                entityId: src.id,
                fieldPath: src.fieldPath,
                message: `Asset "${src.id}" dest path ${src.godotPath} is not a copyable project-relative path.`,
                reason: 'res:// dest collapsed to empty after stripping; refusing to write outside the project root.',
            });
            continue;
        }
        if (isRemoteAssetUri(src.sourcePath)) {
            fidelity.push({
                level: 'approximated',
                domain: src.domain,
                severity: 'warning',
                entityId: src.id,
                fieldPath: src.fieldPath,
                message: `Asset "${src.id}" image was not copied — path is a URI (${src.sourcePath}), not a local file.`,
                reason: 'Remote/URI textures cannot be materialized into --out; Godot Texture2D ExtResources need bytes on disk.',
            });
            continue;
        }
        const abs = resolveAuthored(args.baseDir, src.sourcePath);
        if (!isReadableFile(abs)) {
            fidelity.push({
                level: 'approximated',
                domain: src.domain,
                severity: 'warning',
                entityId: src.id,
                fieldPath: src.fieldPath,
                message: `Asset "${src.id}" image was not copied — local path "${src.sourcePath}" is missing or unreadable.`,
                reason: 'Authored path did not resolve to a readable file relative to the project JSON (or as an absolute path).',
            });
            continue;
        }
        if (seenDest.has(destRel)) continue;
        seenDest.add(destRel);
        copies.push({ sourceAbs: abs, destRel, godotPath: src.godotPath });
    }

    return { copies, fidelity };
}
