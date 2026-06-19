## Godot Engine Smoke Test
##
## Loads the World Forge generated .tscn headlessly and asserts the scene tree
## matches expected structure. Run via:
##   godot --headless --path <project_dir> --script res://smoke_load_world.gd
##
## Prints structured key=value output for the TypeScript runner to parse.
## Exits 0 on success, 1 on any assertion failure.

extends SceneTree

const SCENE_PATH := "res://world.tscn"

## Expected counts from the proof world "Dustwalk — Multi-Target Proof"
const EXPECTED_ZONES := 5
const EXPECTED_ENTITIES := 4
const EXPECTED_ITEMS := 3
const EXPECTED_SPAWN_POINTS := 2
const EXPECTED_TRANSITIONS := 1
const EXPECTED_NAV_LINKS := 4
const EXPECTED_TILE_LAYERS := 1
const EXPECTED_TILE_COUNT := 10
const EXPECTED_PROPS := 2
const EXPECTED_WALL_COLLISIONS := 2
const EXPECTED_MARKETS := 1
const EXPECTED_CRAFTING := 1

var _failures: Array[String] = []


func _assert(condition: bool, label: String, detail: String = "") -> void:
	if not condition:
		_failures.append(label + (": " + detail if detail else ""))
		print("FAIL: " + label + (": " + detail if detail else ""))
	else:
		print("PASS: " + label)


func _init() -> void:
	print("smoke_start")
	print("scene_path=" + SCENE_PATH)

	# 1. Load the scene resource
	var scene_res := load(SCENE_PATH)
	_assert(scene_res != null, "scene_loads", "Could not load " + SCENE_PATH)
	if scene_res == null:
		_finish()
		return

	_assert(scene_res is PackedScene, "scene_is_packed_scene")
	var packed: PackedScene = scene_res as PackedScene

	# 2. Instantiate the scene
	var root_node: Node = packed.instantiate()
	_assert(root_node != null, "scene_instantiates")
	if root_node == null:
		_finish()
		return

	_assert(root_node is Node2D, "root_is_node2d")
	print("root_name=" + root_node.name)

	# 3. Identify zones by metadata (robust against Camera2D / NavigationLinks,
	#    which are also Node2D children of the root).
	var zones: Array[Node] = []
	for child in root_node.get_children():
		if child.has_meta("zone_id"):
			zones.append(child)
	print("zone_count=" + str(zones.size()))
	_assert(zones.size() == EXPECTED_ZONES, "zone_count_matches",
		"expected %d, got %d" % [EXPECTED_ZONES, zones.size()])

	# 4. Verify zone IDs via metadata
	var zone_ids: Array[String] = []
	for zone in zones:
		var zid = zone.get_meta("zone_id", "")
		if zid != "":
			zone_ids.append(zid)
	print("zone_ids=" + ",".join(zone_ids))
	_assert(zone_ids.size() == EXPECTED_ZONES, "all_zones_have_id")

	# 5. Count entities (nodes in */Entities/* subtrees that are instances)
	# NOTE: In headless mode without actual packed scenes, instanced nodes
	# may appear as placeholder nodes. We count all children of Entities/
	# containers regardless of whether they resolved as proper instances.
	var entity_count := 0
	for zone in zones:
		var entities_container := zone.get_node_or_null("Entities")
		if entities_container:
			entity_count += entities_container.get_child_count()
	print("entity_count=" + str(entity_count))
	_assert(entity_count == EXPECTED_ENTITIES, "entity_count_matches",
		"expected %d, got %d" % [EXPECTED_ENTITIES, entity_count])

	# 6. Count items (nodes in */Items/* subtrees)
	var item_count := 0
	for zone in zones:
		var items_container := zone.get_node_or_null("Items")
		if items_container:
			item_count += items_container.get_child_count()
	print("item_count=" + str(item_count))
	_assert(item_count == EXPECTED_ITEMS, "item_count_matches",
		"expected %d, got %d" % [EXPECTED_ITEMS, item_count])

	# 7. Count spawn points (Marker2D in */SpawnPoints/* subtrees)
	var spawn_count := 0
	for zone in zones:
		var sp_container := zone.get_node_or_null("SpawnPoints")
		if sp_container:
			for sp in sp_container.get_children():
				if sp is Marker2D:
					spawn_count += 1
	print("spawn_point_count=" + str(spawn_count))
	_assert(spawn_count == EXPECTED_SPAWN_POINTS, "spawn_point_count_matches",
		"expected %d, got %d" % [EXPECTED_SPAWN_POINTS, spawn_count])

	# 8. Count transitions (nodes in */Transitions/* subtrees)
	var transition_count := 0
	for zone in zones:
		var trans_container := zone.get_node_or_null("Transitions")
		if trans_container:
			transition_count += trans_container.get_child_count()
	print("transition_count=" + str(transition_count))
	_assert(transition_count == EXPECTED_TRANSITIONS, "transition_count_matches",
		"expected %d, got %d" % [EXPECTED_TRANSITIONS, transition_count])

	# 9. Count navigation links
	var nav_container := root_node.get_node_or_null("NavigationLinks")
	var nav_link_count := 0
	if nav_container:
		for link in nav_container.get_children():
			if link is NavigationLink2D:
				nav_link_count += 1
	print("nav_link_count=" + str(nav_link_count))
	_assert(nav_link_count == EXPECTED_NAV_LINKS, "nav_link_count_matches",
		"expected %d, got %d" % [EXPECTED_NAV_LINKS, nav_link_count])

	# 10. Verify ext_resource references resolved (no missing packed scenes)
	# Entity nodes that are instances should be Node2D (from our fixtures).
	# If an ext_resource fails to resolve, the instance node will be null/missing.
	var resolved_instances := 0
	var missing_instances: Array[String] = []
	for zone in zones:
		var entities_container := zone.get_node_or_null("Entities")
		if entities_container:
			for ent in entities_container.get_children():
				# A resolved instance will have children or metadata from the fixture
				if ent.get_meta("entity_id", "") != "":
					resolved_instances += 1
				else:
					missing_instances.append(zone.name + "/Entities/" + ent.name)
		var trans_container := zone.get_node_or_null("Transitions")
		if trans_container:
			for trans in trans_container.get_children():
				if trans.get_meta("transition_id", "") != "":
					resolved_instances += 1
				else:
					missing_instances.append(zone.name + "/Transitions/" + trans.name)
	print("resolved_instances=" + str(resolved_instances))
	print("missing_instances=" + str(missing_instances.size()))
	_assert(missing_instances.size() == 0, "no_missing_ext_resources",
		"Unresolved: " + ", ".join(missing_instances) if missing_instances.size() > 0 else "")

	# 11. Check entity metadata preservation
	var entities_with_id := 0
	for zone in zones:
		var entities_container := zone.get_node_or_null("Entities")
		if entities_container:
			for ent in entities_container.get_children():
				if ent.get_meta("entity_id", "") != "":
					entities_with_id += 1
	print("entities_with_metadata=" + str(entities_with_id))
	_assert(entities_with_id == EXPECTED_ENTITIES, "entity_metadata_preserved",
		"expected %d with entity_id, got %d" % [EXPECTED_ENTITIES, entities_with_id])

	# 12. Playable scaffold — every zone has a StaticBody2D collision hull
	#     with a shape, so characters collide instead of falling through.
	var zones_with_collision := 0
	for zone in zones:
		var body := zone.get_node_or_null("Collision") as StaticBody2D
		if body != null:
			var cs := body.get_node_or_null("CollisionShape2D") as CollisionShape2D
			if cs != null and cs.shape != null:
				zones_with_collision += 1
	print("zones_with_collision=" + str(zones_with_collision))
	_assert(zones_with_collision == EXPECTED_ZONES, "all_zones_have_collision",
		"expected %d, got %d" % [EXPECTED_ZONES, zones_with_collision])

	# 13. Playable scaffold — every zone has a NavigationRegion2D with a
	#     navigation polygon, so NPCs/the player can path within the zone.
	var zones_with_nav := 0
	for zone in zones:
		var nav_region := zone.get_node_or_null("Navigation") as NavigationRegion2D
		if nav_region != null and nav_region.navigation_polygon != null:
			zones_with_nav += 1
	print("zones_with_nav=" + str(zones_with_nav))
	_assert(zones_with_nav == EXPECTED_ZONES, "all_zones_have_navmesh",
		"expected %d, got %d" % [EXPECTED_ZONES, zones_with_nav])

	# 14. Playable scaffold — the world has a framed Camera2D so the scene is
	#     visible the moment it opens (no black screen).
	var cam := root_node.get_node_or_null("Camera2D") as Camera2D
	_assert(cam != null, "world_has_camera")

	# 15. Wave B-2 — tile layers export as TileMapLayer nodes, each with a TileSet
	#     resource, and preserve their placement count as metadata.
	var tile_layers: Array[Node] = []
	for child in root_node.get_children():
		if child is TileMapLayer:
			tile_layers.append(child)
	print("tile_layer_count=" + str(tile_layers.size()))
	_assert(tile_layers.size() == EXPECTED_TILE_LAYERS, "tile_layer_count_matches",
		"expected %d, got %d" % [EXPECTED_TILE_LAYERS, tile_layers.size()])

	var layers_with_tileset := 0
	var total_tile_count := 0
	for tl in tile_layers:
		if tl.tile_set != null:
			layers_with_tileset += 1
		total_tile_count += int(tl.get_meta("tile_count", 0))
	_assert(layers_with_tileset == EXPECTED_TILE_LAYERS, "tile_layers_have_tileset",
		"expected %d, got %d" % [EXPECTED_TILE_LAYERS, layers_with_tileset])
	print("tile_count=" + str(total_tile_count))
	_assert(total_tile_count == EXPECTED_TILE_COUNT, "tile_count_matches",
		"expected %d, got %d" % [EXPECTED_TILE_COUNT, total_tile_count])

	# 15b. Wave B-3 (interiors) — non-walkable tiles export StaticBody2D collision
	#      (a "Collision" child of the TileMapLayer with one CollisionShape2D per
	#      solid cell), so wall tiles are solid in-engine.
	var wall_collisions := 0
	for tl in tile_layers:
		var body := tl.get_node_or_null("Collision") as StaticBody2D
		if body != null:
			for cs in body.get_children():
				if cs is CollisionShape2D and cs.shape != null:
					wall_collisions += 1
	print("wall_collision_count=" + str(wall_collisions))
	_assert(wall_collisions == EXPECTED_WALL_COLLISIONS, "tile_wall_collision_matches",
		"expected %d, got %d" % [EXPECTED_WALL_COLLISIONS, wall_collisions])

	# 16. Wave B-3 (interiors) — props export as Node2D children of a "Props"
	#     container, each preserving its prop_id metadata.
	var props_container := root_node.get_node_or_null("Props")
	var prop_count := 0
	var props_with_id := 0
	if props_container:
		prop_count = props_container.get_child_count()
		for pr in props_container.get_children():
			if pr.get_meta("prop_id", "") != "":
				props_with_id += 1
	print("prop_count=" + str(prop_count))
	_assert(prop_count == EXPECTED_PROPS, "prop_count_matches",
		"expected %d, got %d" % [EXPECTED_PROPS, prop_count])
	_assert(props_with_id == EXPECTED_PROPS, "props_have_metadata",
		"expected %d, got %d" % [EXPECTED_PROPS, props_with_id])

	# 17. Wave B-3 (town economy) — market nodes + crafting stations export as
	#     Node2D children of "Markets" / "CraftingStations" containers, each with
	#     its economy id metadata.
	var markets := root_node.get_node_or_null("Markets")
	var market_count := 0
	if markets:
		for m in markets.get_children():
			if m.get_meta("market_id", "") != "":
				market_count += 1
	print("market_count=" + str(market_count))
	_assert(market_count == EXPECTED_MARKETS, "market_count_matches",
		"expected %d, got %d" % [EXPECTED_MARKETS, market_count])

	var crafting := root_node.get_node_or_null("CraftingStations")
	var crafting_count := 0
	if crafting:
		for c in crafting.get_children():
			if c.get_meta("station_id", "") != "":
				crafting_count += 1
	print("crafting_count=" + str(crafting_count))
	_assert(crafting_count == EXPECTED_CRAFTING, "crafting_count_matches",
		"expected %d, got %d" % [EXPECTED_CRAFTING, crafting_count])

	# Cleanup
	root_node.queue_free()
	_finish()


func _finish() -> void:
	print("failures=" + str(_failures.size()))
	if _failures.size() > 0:
		print("smoke_verdict=FAIL")
		for f in _failures:
			print("  - " + f)
		quit(1)
	else:
		print("smoke_verdict=PASS")
		quit(0)
