// visual.ts — tileset, tile, layer, and visual overlay types

/** A set of tiles for a biome or style. */
export interface Tileset {
  id: string;
  name: string;
  tileWidth: number;
  tileHeight: number;
  imagePath?: string;
  imageWidth?: number;
  imageHeight?: number;
  tiles: TileDefinition[];
}

/** A single tile within a tileset. */
export interface TileDefinition {
  id: string;
  tilesetId: string;
  row: number;
  col: number;
  tags: string[];
  walkable: boolean;
  opacity: number;
}

/** A layer of tile placements on the map. */
export interface TileLayer {
  id: string;
  name: string;
  zIndex: number;
  tiles: TilePlacement[];
}

/** A single tile placed at a grid position. */
export interface TilePlacement {
  tileId: string;
  gridX: number;
  gridY: number;
}

/** A decorative or interactive object that can be placed on the map. */
export interface PropDefinition {
  id: string;
  name: string;
  imagePath?: string;
  width: number;
  height: number;
  tags: string[];
  walkable: boolean;
  interactable: boolean;
}

/** A placed prop instance. */
export interface PropPlacement {
  propId: string;
  gridX: number;
  gridY: number;
  zoneId?: string;
}

/** A mood/atmosphere overlay applied to zones. */
export interface AmbientLayer {
  id: string;
  name: string;
  zoneIds: string[];
  type: 'fog' | 'rain' | 'dust' | 'glow' | 'shadow' | 'custom';
  intensity: number;
  color?: string;
}

/**
 * A depth layer for 2.5D rendering. Distinct from AmbientLayer (which is mood/atmosphere).
 * Higher `depth` = further behind the gameplay plane. `scrollFactor` controls parallax speed
 * relative to the camera (1.0 = locked to gameplay plane, 0.5 = half-speed, 0.0 = static).
 */
export interface ParallaxLayer {
  id: string;
  /** Depth ordering: higher = further back. Must be unique within a zone. */
  depth: number;
  /** Reference to an AssetEntry id (kind = background or sprite). */
  assetRef: string;
  /** Parallax scroll factor (0.0 static, 1.0 locked to camera). */
  scrollFactor: number;
}
