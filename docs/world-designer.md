# Exile Demo World Designer Guide

## Overview

The world designer is an in-app editor for building and maintaining the playable world. It can place and edit:

- world items / map blocks
- buttons
- doors
- creatures
- collectables
- custom sprites
- astronaut start position

It saves back into the JSON files in `astronaut-game\src\assets`.

## Starting the designer

1. Open a terminal in `astronaut-game`
2. Run:

   ```bash
   npm install
   npm run dev
   ```

3. Open `http://localhost:3000`
4. Press **`** to show the designer

The designer starts hidden by default.

The designer now remembers its UI state in browser storage, including the active tool, mode, category, sprite choice, palette, camera, viewport expansion, palette-flyout selection, and which accordion sections you last left open.

The main designer sections and palette-remap section now start **collapsed by default** until you open them. The old large top block is now split into separate **Mode and sprite setup** and **Placement and actions** accordions so the core controls are easier to scan.

Custom sprite definitions and placed custom-sprite instances are also kept in browser storage. They are a designer-authoring aid and are not written to the JSON asset files until you convert them into normal runtime entities such as buttons or creatures.

## What the designer saves

When you save, the editor writes back to:

- `world_map.json`
- `buttons.json`
- `doors.json`
- `creatures.json`
- `collectables.json`
- `astronaut_start.json`
- `palettes.json`

## Designer layout

### Overview navigator

The overview is the zoomed-out map.

- move the mouse over it to preview the current 1:1 viewport
- **left-drag** in the overview to move the main editor camera

### Main world view

This is the full-size editable view.

- **left-drag** selected objects to move them
- drag on empty space to box-select multiple objects
- **right-drag** to pan the camera

### Inspector

When a single item is selected, the inspector shows editable properties such as:

- sprite type
- position
- rotation
- palette
- collision
- astronaut masking for world items
- item-specific settings

## Core workflows

## 1. Place a new item

1. Open the designer
2. Choose **Edit** mode
3. Choose **Place new**
4. Choose a category:
   - World items
   - Buttons
   - Doors
   - Creatures
   - Collectables
   - Custom sprites
5. Choose a sprite type
6. Click in the world to place it

The **Buttons** category is now a button-part authoring aid: placing from it drops normal sprite parts into the world instead of immediately creating a runtime button entity.

To author a live button visually:

1. place `button` and `button_box` as separate **World items**
2. arrange them until they look right
3. multi-select them
4. right-click and choose **Group as custom sprite**
5. select the resulting custom sprite and choose **Convert to button**

That conversion keeps the live `button` cap animated and derives its initial offsets / press direction from the grouped layout.

After conversion, use the button inspector to tune:

- **Button cap palette**
- **Closed cap offset X/Y (from box)**
- **Open cap offset X/Y (from box)**

Those offsets are authored in button-local space relative to the box, and the runtime still applies the button's rotation or flip to them.

The button inspector also includes a **defaults for new buttons and button conversions** section. Those defaults only affect buttons created after you change them; existing buttons keep their own saved cap palette, box palette, and cap offsets.

If you want to turn an existing world item or collectable into a **Door**, **Button**, or **Creature**, select it, choose the target from the main **Convert to** dropdown, and click **Convert**. The right-click context menu also exposes explicit convert actions. Converting into a creature now preserves the source sprite's authored translation, so offset pieces such as turrets keep their visual placement.

You can also use:

- **Place at view center**
- drag a sprite directly from the sprite grid onto the world

If **Snap rough placement to 32px grid** is enabled, you can tune the grid with **Grid offset X/Y**. Use **Use selection / view center** to align the snap origin to the current selection, or to the current camera center when nothing is selected.

If **Snap to nearby object edges** is enabled, placement and dragging can also lock a block to the nearest edge of a nearby object. The designer chooses the closest top/bottom or left/right edge match and shows a cyan guide on the snap target while it is active.

You can also use modifier keys whether that toggle is on or off:

- **Ctrl while dragging or placing** = dock the item flush against the nearest nearby edge
- **Alt while dragging or placing** = align matching edges such as top-to-top, bottom-to-bottom, left-to-left, or right-to-right
- **Ctrl+Alt while dragging or placing** = allow both behaviors and use the closest valid match

## 2. Select and edit an existing item

1. Switch to **Select / move**
2. Click an object in the world
3. Change values in either:
   - the top controls for type / palette / rotation / translation
   - the inspector for detailed editing

The top translation control now applies to both **world items** and **creatures**.

If you want to inspect creature health/energy feedback while tuning, enable **Show creature overlays** in **Preview toggles**.

Selected items can be:

- moved by dragging
- edge-snapped against nearby objects while dragging when **Snap to nearby object edges** is enabled
- temporarily docked/aligned with **Ctrl** / **Alt** even if the object-snap toggle is off
- nudged with arrow keys
- duplicated
- deleted
- sent to the back
- brought to the front
- rotated
- added to or removed from the current selection with **Shift+click**
- added with **Shift+drag** marquee selection

For **collectables**, the inspector also lets you control **Weight**, **Can be picked up**, **Storable**, and **Affects astronaut**.

For **creatures**, the inspector now exposes typed controls instead of relying on raw JSON as the primary workflow. The current first-pass creature controls cover:

- **Archetype**
- **Collision enabled**
- **Hostile**
- **Damage on contact**
- **Follows astronaut**
- **Follow range**
- **Movement mode** (`Ground`, `Fly`, `Hover`, `Turret`)
- **Fixed in place**
- **Speed**
- **Home X / Home Y**
- **Patrol min/max X**
- **Patrol min/max Y**
- **Hover amplitude**
- **Track range**
- **Fire mode** (`None`, `Bullets`, `Grenades`, `Energy pods`)
- **Homing bullets**
- **Fire cooldown**
- **Projectile speed**
- **Can eat wasps**
- **Can jump**
- **Jump strength**
- **Teleport home**
- **Teleport distance**
- **Push astronaut**
- **Can be picked up**
- **Storable**
- **Current damage**
- **Force required to kill**
- **Visible energy**
- **Damage flash visible**
- **Makes sound**
- **Sound**
- **Sound interval**
- **Sound randomness**
- **Sound range**
- **Sound volume**

There is still an **Advanced state JSON** accordion for temporary debugging/runtime state, but typed fields are now the main authoring path.

Creature sound choices come from the checked-in manifest at `astronaut-game\src\assets\creature-sound-manifest.ts`, so adding a new WAV for creature use should include an entry there. Runtime creature sound playback now uses those manifest entries with distance falloff from the creature to the astronaut, and active energy pods reuse the same managed sound path for their repeating bling / expiry cues.

The current creature runtime also supports a first-pass projectile layer driven by the authored **Fire mode**, **Homing bullets**, **Fire cooldown**, and **Projectile speed** fields:

- **Bullets** travel directly toward the astronaut, with optional homing adjustment.
- **Grenades** arc under gravity and explode on impact or expiry, applying area damage/force.
- **Energy pods** travel as projectiles first, then turn into pickup-only collectables when they hit the world or expire.

Additional runtime creature behavior now includes:

- archetype-driven movement for ground, flying, hovering, and fixed-turret creatures
- teleport-home fallback based on the authored home point and distance threshold
- pseudo-jump behavior for ground creatures with **Can jump**
- hostile contact damage / shove behavior
- wasp-eating predator behavior for creatures with **Can eat wasps**
- live creature pickup for **Can be picked up** creatures; they can be carried and dropped, but not stored
- optional creature overlays and damage-flash feedback during play

A cannon-style object should usually be authored as:

- a collectable
- **Collision enabled**
- **Can be picked up** off
- a higher **Weight**

## 3. Edit palettes

Use the **Palettes** button beside the normal palette selector to open the palette flyout.

Both the main designer panel and the palette flyout can now be dragged by their header bars.

In the flyout you can:

- select a palette index
- preview it against a chosen sprite
- add or remove remap rows
- create a new palette
- clone the selected palette
- save changes to `palettes.json`

Palette edits are global. Changing palette `N` updates every object using palette `N`.

Deleting a palette is blocked while any authored object still uses that palette index.

## 4. Use the sprite picker

The designer now includes:

- a live sprite preview
- a sprite grid picker in a collapsed accordion
- a text filter for narrowing sprite names in the grid
- a category filter for narrowing the grid to world items, buttons, doors, creatures, or collectables

You can:

- choose a sprite by name from the dropdown
- open the **Choose from sprite grid** accordion
- type in the filter box to narrow the grid
- use the category filter to narrow the grid by designer category
- when you type in the search box, the picker temporarily searches across the full sprite set again
- click a sprite in the grid to select it
- drag a sprite from the grid onto the world to place it

## 5. Move around the world

### Main view

- **right-click a placed object** = open a context-aware menu with grouped **Edit**, **Palette**, **Properties**, **Collectable**, **Convert**, and **Defaults** submenus depending on the item type, including actions such as collision toggles, astronaut masking, collectable flags, conversion between world items and collectables, **Group as custom sprite**, **Ungroup custom sprite**, button conversion from custom sprites, door/button default-state toggles, and layer-order actions such as **Send to back** and **Bring to front**
- **right-click empty space** = open a context menu to paste the copied selection there, set the astronaut start there, or move the live astronaut there
- **right mouse drag on empty space** = pan camera
- **Center on astronaut** = recenters the editor on the live astronaut
- **Focus selection** = centers the camera on the current selection
- **Expand viewport to window** = temporarily grows the game viewport to fill the browser window while keeping the same world center

### Overview map

- **left mouse drag** = move the main editor camera

## 6. Set the astronaut start position

There are two related concepts:

- the **live astronaut** position
- the **saved astronaut start** position

To move the live astronaut without changing the saved start:

1. move the camera to the place you want
2. click **Move live astronaut to view center**

To set the saved start:

1. move the camera to the place you want
2. click **Set astronaut start to view center**
3. save

The start point is shown with a visible **START** marker in both the main view and the overview.

## 7. Preview mode

Switch the mode from **Edit** to **Preview** to inspect the world without editing.

Useful preview toggles:

- **Sound enabled**
- **Expand viewport to window**
- **Show collision outlines**
- **Show sprite outlines (F)**
- **Show magnifier (X)**
- **Disable collision during preview**
- per-layer visibility toggles

The magnifier follows the mouse over the main canvas so you can inspect individual pixels more easily while authoring or previewing.

For **world items**, **Collision enabled** and **Mask astronaut** are separate controls. A decorative sprite can be non-colliding and still draw in front of the astronaut when masking is enabled. `black_background` items default to staying behind the astronaut unless you explicitly enable masking.

World items also support a separate **Translation** control. This shifts the visible sprite content to the **top**, **right**, **bottom**, or **left** edge of its 32x32 tile without changing the block's world position or its rotation/flip setting.

## 8. Save workflow

Saving uses a review step.

1. Click **Preview before save**
2. Review the changed JSON
3. Click **Save changes**

If you save while working from a temporary live astronaut position, the designer now resumes from that same live position after save.

If you explicitly changed the astronaut start marker, that updated start position is still saved normally.

The designer validates some common mistakes before save, including missing button-to-door links.

## 8a. Import a PNG draft

The designer includes **Import PNG draft** for rough world-item reconstruction from a PNG region.

### What it does

The importer **creates world blocks directly in the live designer state**.

It does **not** open a JSON-only review dialog first and it does **not** save files immediately.

The workflow is:

1. choose a PNG region
2. import a draft into the currently loaded world
3. inspect and clean up the result in the designer
4. use **Preview before save** to review the JSON
5. save only when you are happy with the draft

So the importer behaves like other designer edits:

- it mutates the current in-memory world
- it marks the world as having unsaved changes
- it can be adjusted further before save
- it only reaches the asset files after the normal save workflow

### Scope of the current importer

The current importer is intentionally conservative:

- it creates **world items only**
- it does **not** create buttons, doors, creatures, collectables, or astronaut start markers
- it uses the currently authored **world sprite set** as matching candidates
- it is meant for **draft cleanup**, not authoritative one-click conversion
- low-confidence matches should be reviewed before save

### Two separate import paths

The PNG importer now has two distinct paths:

1. **Single PNG** = import one PNG or one cropped section directly
2. **Chunk folder** = import an exported chunk set and rebuild a larger map section from it

Inside the modal, **Import** and **Chunk export** are now separate tabs so you can switch between those workflows without stacking everything vertically at once.

Use **Single PNG** when:

- you want to test a small area quickly
- you only need one cropped section from the full map
- you do not want to export chunks first

Use **Chunk folder** when:

- you want to rebuild a large area or the whole map
- you want safer staged testing with chunk row/column ranges
- you want to process the map in manageable sections instead of one huge pass

### Split a large PNG into import chunks

If a full-map PNG is too large to review comfortably in one pass, the import modal can now split the currently selected PNG crop into smaller chunk PNGs.

1. Choose **Single PNG**
2. Load a PNG and set a **tile-aligned** crop
3. Switch to the **Chunk export** tab
4. In **Split PNG into import chunks**, pick a chunk preset or enter a custom tile size
5. `4 x 4` is now available if you want very small test chunks
6. Click **Export chunks…**
7. Choose a destination folder in the browser

The exporter writes:

- one PNG per chunk
- stable machine-readable chunk filenames
- `png-import-chunks.manifest.json`

While export is running, the modal now shows a progress bar, progress text, and a **Cancel chunk export** action.

That exported folder is then ready for **Chunk folder** mode.

### Rebuild a larger map from a chunk folder

Choose **Chunk folder** in the same modal when you want the importer to walk an exported folder and reconstruct a larger combined draft.

1. Choose **Chunk folder**
2. Click **Choose folder…** and select a folder that contains the exported chunk PNGs and manifest
3. Optionally limit the run with:
   - chunk column / row ranges
   - **Max chunks** to process, which now counts only non-black chunk PNGs
4. Leave **Keep the world span matched to the selected chunk range** enabled unless you have a specific reason not to
5. Set **World left/top** to the origin for the full folder import area
6. Make sure you are on the **Import** tab
7. Either:
   - click **Preview blocks** if you want to review and adjust the reconstructed draft first, or
   - click **Try folder import now** if you want the importer to go straight through without manual preview vetting
8. If you used **Preview blocks**, review and fix the reconstructed draft before clicking **Import draft**

Chunk-folder mode now keeps the **full folder import width and height** even when you limit the chunk run. Limited test imports still place their chunks in the same positions they would occupy in the full map, relative to the **World left/top** origin you choose.

Long-running import work now also shows a progress bar and progress text, and both the single-file import preview path and the folder-import path can be cancelled from the modal while they are running. That includes both **Preview blocks** and **Try folder import now**.

Large chunk-folder imports are processed in internal batches, so they can exceed the single-PNG `4096`-tile pass limit.

### Full-map workflow

If your goal is to take one large source PNG and turn it into your in-game map, use this workflow:

1. Open **Import PNG draft**
2. Click **Single PNG**
3. Load the full-map PNG
4. Use **Snap crop to 32px tiles** so the source region is aligned cleanly
5. Open the **Chunk export** tab
6. In **Split PNG into import chunks**, keep the default **16 x 16** chunk size unless you need something smaller
7. Click **Export chunks…** and choose a folder
8. Click **Chunk folder**
9. Click **Choose folder…** and pick that exported folder
10. Make sure you are on the **Import** tab
11. Start with a small test range, for example just a few chunk rows/columns or a low **Max chunks** value
12. Set **World left/top** to where the exported crop should begin in the game world
13. Either click **Preview blocks** for a reviewed pass, or **Try folder import now** for a straight-through attempt
14. If you previewed, review the preview, fix obvious bad matches, and click **Import draft**
15. Repeat with larger ranges until you are happy, then import the full chunk range
16. Use **Preview before save** and then save once the rebuilt map looks correct

Recommended approach:

- first test a **small subset**
- confirm your world origin is correct
- then scale up to the full exported chunk range
- if chunk export feels heavy, prefer the default `16 x 16` size and leave **Skip fully empty / black chunk PNGs** enabled
- use `4 x 4` only when you want very fine-grained testing or debugging, because it creates many more files

This is the safest way to rebuild the whole map without waiting a long time only to discover that the origin, chunk range, or matching needs adjustment.

### Small-area workflow

If you only want to import one part of the overall map on its own:

1. Open **Import PNG draft**
2. Click **Single PNG**
3. Load the full PNG or a smaller PNG
4. Set the **PNG crop in the source image** to the area you want
5. Use **Snap crop to 32px tiles** if needed
6. Make sure you are on the **Import** tab
7. Set the target **World left/top/width/height**
8. Choose whether to:
   - replace only the target area, or
   - clear all existing world items and collectibles before importing
9. Click **Preview blocks**
10. Review and adjust the preview
11. Click **Import draft**

This path does **not** require chunk export first.

### Recommended chunk sizes

- **Default:** `16 x 16` tiles
- **Very small / debugging:** `4 x 4` tiles
- **Small / safest:** `8 x 8` tiles
- **Larger but still practical:** `24 x 16` or `16 x 24`

The hard importer limit is still higher than that, but smaller chunk sizes are much easier to preview, retry, and clean up.

### Step-by-step workflow

1. Click **Import PNG draft**
2. Choose **Single PNG** or **Chunk folder**
3. For **Single PNG**, either:
   - enter a browser-served PNG path such as `./src/assets/MAP-Exile-BC.png`, or
   - click **Browse…** and pick a local PNG file
4. If you browse to a local PNG, the importer fills the **PNG crop in the source image** fields from the file automatically, starting with the full image, and it also suggests a **Place matched blocks in the world** size that better matches the game’s rendered scale
5. Adjust the **PNG crop** in **image pixels** only if you want part of the PNG rather than the whole file. Use **Snap crop to 32px tiles** if the crop needs aligning to tile boundaries.
6. For **Chunk folder**, choose the exported folder and optionally narrow the run with chunk row / column ranges or **Max chunks**
7. Fill in the **world placement** fields in world coordinates. In **Single PNG** mode, the importer keeps the block count from the **source PNG tile grid** and maps it across the world rectangle you choose. In **Chunk folder** mode, **World left/top** is the origin for the exported crop and the importer keeps the selected chunk range aligned relative to that origin.
8. Click **Preview blocks** to generate the matched tile draft. In **Single PNG** mode, the importer can auto-align the source sampling grid when the sprite content suggests the crop is globally offset inside the 32px cells. **Chunk folder** mode stays locked to the exported chunk grid.
9. Watch the built-in progress bar while preview generation is running. It reports the current stage and estimated time left, and the controls are locked until the pass finishes.
10. Use the larger preview area to inspect the draft, and use **zoom in / zoom out / fit / 100%** controls if the section is too big or too small to review comfortably.
11. Click tiles in the preview to inspect or edit their **type**, **palette**, **rotation**, and **translation** before the draft touches the live world. The importer now seeds a best-fit translation automatically from the sampled sprite placement, so edge-aligned pieces often come in already shifted to the correct side.
12. Decide whether to keep **Replace existing world items inside the target world rectangle** enabled
13. Click **Import draft**

After import:

1. the designer inserts the generated blocks into the live world
2. the imported blocks become the current selection
3. the status line reports how many tiles were imported
4. if the matcher found weak matches, the status line warns you to review them before save

### Source rectangle vs target rectangle

- **Source rectangle** = the area to read from the PNG image
- **Target rectangle** = the world area to fill with generated blocks

The importer reads the block count from the source PNG region using 32px source tiles, then places that same block grid across the target world rectangle.

That means:

- a larger target rectangle makes the imported block layout appear larger in the world
- the source and target rectangles do **not** have to be the same size
- the importer is effectively remapping the source tile grid into the chosen world-space area

If you browse to a PNG file, you usually do **not** need to type the source width or source height manually for a full-image import, because the importer reads those from the selected file and also suggests a target world size that matches the game’s rendered scale more closely.

In **Chunk folder** mode, the target span is derived from the selected chunk range, and the importer uses the chunk metadata to keep that range in the right relative place inside the overall map.

### Replace vs append behavior

If **Replace existing world items inside the target world rectangle** is enabled:

- existing world blocks in that target area are removed first
- the imported draft becomes the new world-block content for that area

If it is disabled:

- the imported blocks are added on top of the current world data
- this is useful for experiments, but can create overlaps or duplicates

### How matching works

The importer does a local best-match pass:

1. it builds a candidate list from the currently authored world sprite set
2. it renders candidate sprite/palette/rotation combinations
3. it compares each target cell from the PNG against those candidates using the **visible non-black sprite content** by default, so black padding and in-tile placement do not dominate the score
4. it also tries to prefer the closest **palette** when the PNG colors line up with an authored palette, without making palette similarity override the structural match
5. it picks the closest candidate and creates a `world_map.json`-style block in memory

This is why no AI endpoint is required for the current version.

### How to review safely

Recommended workflow:

1. start with a **small region**
2. if needed, **export chunks** first and then test the folder importer on a limited range
3. click **Preview blocks**
4. fix obvious bad matches directly in the preview
5. use the tile **Translation** control when a matched world sprite needs to sit against one side of its 32x32 cell
6. import the reviewed draft
7. check the result visually in the designer
8. use **Preview before save** to inspect the resulting JSON
9. save only after cleanup

Large folder imports can extend the usable runtime world bounds automatically when the reconstructed draft reaches beyond the previous map size.

### What to expect

Best case:

- broad terrain shapes
- repeated structural tiles
- simple background regions

Less reliable:

- visually similar tiles
- decorative details
- mixed layers that read similarly in the PNG
- any semantics that are not obvious from flat pixels alone

## 9. Normalize sprite sheet colors

Use **Normalize sprite colors** when `sprite_sheet.png` contains near-miss colors such as `255,251,251` instead of `255,255,255`.

1. Click **Normalize sprite colors**
2. Review the confirmation summary
3. Click **Normalize sprite sheet**

This snaps sprite pixels in `sprite_sheet.png` to the nearest proper color from `colors.json`.

- it only touches sprite rectangles listed in `exile_sprites_map.json`
- it does **not** touch the atlas grid lines or separators
- it writes the updated `sprite_sheet.png` back through the local save server

## Linking buttons to doors

Buttons and doors are linked by numeric IDs.

### Step-by-step tutorial

1. Place or select a **door**
2. In the inspector, set **Door ID**
3. Place `button` and `button_box` as separate **World items**
4. Group them as a **Custom sprite**
5. Convert that custom sprite to a **button**
6. In the button inspector, set **Linked door IDs (comma separated)**
7. Save

### Example

- Door A has `Door ID = 3`
- Button has `Linked door IDs = 3`

When the button is activated, it will affect the door with ID `3`.

### Multiple doors

A single button can link to more than one door:

```text
3, 7, 9
```

### Notes

- the button stores an array of linked door IDs
- the designer validates links before save
- if a button points to a door ID that does not exist, the save preview should show an error

## Palette cycling / strobing

Sprites can optionally cycle through palettes on a timer.

For supported items, the inspector can expose:

- **Timed palette cycle**
- **Cycle palettes (comma separated)**
- **Cycle interval (seconds)**

### Teleporter pads

`teleporter_pad` has a built-in default strobe behavior.

That means the pad cycles through palettes automatically unless you explicitly override it.

## Multi-select

You can drag a box around a group of objects.

After multi-selecting:

- drag one selected object to move the whole group
- use duplicate / delete on the whole group
- use **Ctrl+C** and **Ctrl+V** to copy and paste the whole selection
- auto-pan can occur when dragging toward the edge of the screen

## Custom sprites and grouping

Custom sprites let you turn a placed arrangement of normal sprites into one reusable designer item.

1. Place the source pieces in the world, usually as **World items**
2. Multi-select the pieces
3. Right-click and choose **Group as custom sprite**
4. The designer replaces the loose pieces with one placed **Custom sprite**
5. Switch the category to **Custom sprites** to place more copies from the picker

You can right-click a custom sprite and choose **Ungroup custom sprite** at any time to restore the original pieces.

Custom sprites can also be:

- renamed from the inspector **Name** field
- deleted as a saved type from the inspector or the right-click menu

Deleting a custom sprite type removes all placed instances that use that saved custom sprite.

This is especially useful for buttons, where the `button` cap and `button_box` base can be authored visually first and only converted into a runtime button after the layout looks correct.

## Keyboard shortcuts

- **`** = show / hide designer
- **1** = select tool
- **2** = place tool
- **M** = toggle edit / preview
- **R** = rotate selection
- **Delete** = delete selection
- **Ctrl+C** = copy selection
- **Ctrl+V** = paste selection
- **Ctrl+D** = duplicate selection
- **Ctrl+M** = toggle sound on/off
- **Arrow keys** = nudge selection
- **Shift+Arrow** = larger nudge
- **G** = toggle grid snap
- **F** = toggle sprite outlines
- **X** = toggle magnifier
- **Alt+Enter** = toggle expanded viewport, even if the designer panel is hidden
- **Ctrl+S** = preview before save
- **Ctrl+Z** = undo
- **Ctrl+Y** or **Ctrl+Shift+Z** = redo

## Troubleshooting

### I changed something but it did not save

- use **Preview before save**
- confirm the expected JSON appears in the preview
- click **Save changes**

### A button does not affect a door

Check:

- the door has a valid **Door ID**
- the button has the matching **Linked door IDs**
- the change was saved

### I cannot find myself in the editor

Use **Center on astronaut**.

### I want to reposition the saved spawn point

Use **Set astronaut start to view center**, then save.

## Related docs

- [Game Guide](game.md)
- [Main README](../README.md)
