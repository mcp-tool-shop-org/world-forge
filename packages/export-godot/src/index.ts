// @world-forge/export-godot — planned Godot 4 export lane.
//
// Not yet implemented. The package is reserved in the monorepo so that when
// Fractured Road (or another Godot 4 game) needs a dedicated export pipeline,
// the workspace, name, and scoped npm slot are already in place.
//
// When this package is promoted from stub to v1.0.0 it should mirror the shape
// of @world-forge/export-ai-rpg and @world-forge/export-unreal:
//   - convert-zones / districts / entities / connections
//   - a Godot-aware coordinate transform (Y-down matches WF; pixel scale differs)
//   - .tres / .tscn-oriented output format
//   - fidelity report parity

export const STATUS = 'planned' as const;
