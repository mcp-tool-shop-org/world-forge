// ScenePreview.tsx — HTML/CSS composed scene preview for a zone

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { assembleSceneData } from './scene-preview-utils.js';

const roleColors: Record<string, string> = {
  npc: '#4a9eff', enemy: '#ff4444', merchant: '#ffd700',
  'quest-giver': '#44ff44', companion: '#44ffaa', boss: '#ff2222',
};

const rarityColors: Record<string, string> = {
  common: '#8b949e', uncommon: '#3fb950', rare: '#58a6ff', legendary: '#d2a8ff',
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span style={{
      fontSize: 9, padding: '1px 4px', borderRadius: 2,
      background: '#30363d', color: '#8b949e', marginLeft: 4,
    }}>
      [{kind}]
    </span>
  );
}

function MissingLabel({ id }: { id: string }) {
  return (
    <span style={{ color: '#f85149', fontSize: 10 }}>Missing: {id}</span>
  );
}

export function ScenePreview({ zoneId }: { zoneId: string }) {
  const { project } = useProjectStore();
  const { showBackgrounds, showEntities, showLandmarks, showSpawns, showAmbient } = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);

  const data = assembleSceneData(zoneId, project);

  const hasContent = data.background || data.tileset || data.entities.length > 0 ||
    data.landmarks.length > 0 || data.items.length > 0 || data.spawns.length > 0 ||
    data.ambient.length > 0;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          fontSize: 11, color: '#8b949e', marginBottom: 4, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <span>{collapsed ? '▸' : '▾'} Scene Preview</span>
        <span style={{ fontSize: 10 }}>☀ {data.light}/10</span>
      </div>

      {!collapsed && (
        <div style={{
          position: 'relative', minHeight: 60,
          background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
          padding: 8, overflow: 'hidden',
        }}>
          {!hasContent && (
            <div style={{ color: '#484f58', fontSize: 11, textAlign: 'center', padding: 16 }}>
              No visual data bound to this zone
            </div>
          )}

          {/* Background layer */}
          {showBackgrounds && data.background && (
            <div style={{
              padding: '6px 8px', marginBottom: 4, borderRadius: 3,
              background: '#161b22',
              border: data.background.missing ? '1px solid #f85149' : '1px solid #30363d',
            }}>
              {data.background.missing ? (
                <MissingLabel id={data.background.id} />
              ) : (
                <span style={{ fontSize: 11, color: '#c9d1d9' }}>
                  {data.background.asset.label}<KindBadge kind="background" />
                </span>
              )}
            </div>
          )}

          {/* Tileset layer */}
          {showBackgrounds && data.tileset && (
            <div style={{
              padding: '6px 8px', marginBottom: 4, borderRadius: 3,
              background: '#161b22',
              border: data.tileset.missing ? '1px solid #f85149' : '1px solid #30363d',
            }}>
              {data.tileset.missing ? (
                <MissingLabel id={data.tileset.id} />
              ) : (
                <span style={{ fontSize: 11, color: '#c9d1d9' }}>
                  {data.tileset.asset.label}<KindBadge kind="tileset" />
                </span>
              )}
            </div>
          )}

          {/* Ambient overlay */}
          {showAmbient && data.ambient.map((al) => {
            const color = al.color ?? '#888888';
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return (
              <div key={al.id} style={{
                padding: '4px 8px', marginBottom: 4, borderRadius: 3,
                background: `rgba(${r},${g},${b},${al.intensity * 0.3})`,
                border: '1px solid #30363d',
              }}>
                <span style={{ fontSize: 10, color: '#8b949e' }}>
                  {al.name} ({al.type}, {Math.round(al.intensity * 100)}%)
                </span>
              </div>
            );
          })}

          {/* Entities */}
          {showEntities && data.entities.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {data.entities.map((e) => (
                <div key={e.placement.entityId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', fontSize: 11,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: roleColors[e.placement.role] ?? '#888',
                    flexShrink: 0,
                  }} />
                  <span style={{ color: '#c9d1d9' }}>
                    {e.placement.name ?? e.placement.entityId}
                  </span>
                  <span style={{ fontSize: 9, color: '#484f58' }}>{e.placement.role}</span>
                  {e.portrait && <KindBadge kind="portrait" />}
                  {e.missingPortrait && <MissingLabel id={e.placement.portraitId!} />}
                  {e.sprite && <KindBadge kind="sprite" />}
                  {e.missingSprite && <MissingLabel id={e.placement.spriteId!} />}
                </div>
              ))}
            </div>
          )}

          {/* Landmarks */}
          {showLandmarks && data.landmarks.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {data.landmarks.map((l) => (
                <div key={l.landmark.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', fontSize: 11,
                }}>
                  <span style={{
                    width: 8, height: 8, background: '#ffd700',
                    transform: 'rotate(45deg)', flexShrink: 0,
                  }} />
                  <span style={{ color: '#ffd700' }}>{l.landmark.name}</span>
                  {l.icon && <KindBadge kind="icon" />}
                  {l.missingIcon && <MissingLabel id={l.landmark.iconId!} />}
                </div>
              ))}
            </div>
          )}

          {/* Items */}
          {data.items.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {data.items.map((i) => (
                <div key={i.item.itemId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', fontSize: 11,
                }}>
                  <span style={{
                    width: 6, height: 6,
                    background: rarityColors[i.item.rarity ?? 'common'],
                    flexShrink: 0,
                  }} />
                  <span style={{ color: rarityColors[i.item.rarity ?? 'common'] }}>
                    {i.item.name ?? i.item.itemId}
                  </span>
                  {i.item.slot && (
                    <span style={{ fontSize: 9, color: '#484f58' }}>{i.item.slot}</span>
                  )}
                  {i.icon && <KindBadge kind="icon" />}
                  {i.missingIcon && <MissingLabel id={i.item.iconId!} />}
                </div>
              ))}
            </div>
          )}

          {/* Spawns */}
          {showSpawns && data.spawns.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {data.spawns.map((sp) => (
                <div key={sp.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', fontSize: 11,
                }}>
                  <span style={{
                    width: 8, height: 8, background: '#00ff88', flexShrink: 0,
                  }} />
                  <span style={{ color: '#00ff88' }}>SPAWN</span>
                  {sp.isDefault && <span style={{ fontSize: 9, color: '#ffd700' }}>★ default</span>}
                </div>
              ))}
            </div>
          )}

          {/* Connections summary */}
          {data.connections.length > 0 && (
            <div style={{
              fontSize: 10, color: '#484f58', borderTop: '1px solid #21262d',
              paddingTop: 4, marginTop: 4,
            }}>
              → {data.connections.map((c) =>
                c.condition ? `${c.zoneName} (${c.condition})` : c.zoneName,
              ).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
