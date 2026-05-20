# Exile Demo World Designer Guide

## Overview

The world designer is an in-app editor for building and maintaining the playable world. It can place and edit:

- world items / map blocks
- buttons
- doors
- creatures
- collectables
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

The designer now remembers its UI state in browser storage, including the active tool, mode, category, sprite choice, palette, camera, and viewport expansion.

## What the designer saves

When you save, the editor writes back to:

- `world_map.json`
- `buttons.json`
- `doors.json`
- `creatures.json`
- `collectables.json`
- `astronaut_start.json`

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
5. Choose a sprite type
6. Click in the world to place it

You can also use:

- **Place at view center**
- drag a sprite directly from the sprite grid onto the world

## 2. Select and edit an existing item

1. Switch to **Select / move**
2. Click an object in the world
3. Change values in either:
   - the top controls for type / palette / rotation
   - the inspector for detailed editing

Selected items can be:

- moved by dragging
- nudged with arrow keys
- duplicated
- deleted
- rotated

## 3. Use the sprite picker

The designer now includes:

- a live sprite preview
- a sprite grid picker in a collapsed accordion

You can:

- choose a sprite by name from the dropdown
- open the **Choose from sprite grid** accordion
- click a sprite in the grid to select it
- drag a sprite from the grid onto the world to place it

## 4. Move around the world

### Main view

- **right mouse drag** = pan camera
- **Center on astronaut** = recenters the editor on the live astronaut
- **Focus selection** = centers the camera on the current selection
- **Expand viewport to window** = temporarily grows the game viewport to fill the browser window while keeping the same world center

### Overview map

- **left mouse drag** = move the main editor camera

## 5. Set the astronaut start position

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

## 6. Preview mode

Switch the mode from **Edit** to **Preview** to inspect the world without editing.

Useful preview toggles:

- **Sound enabled**
- **Expand viewport to window**
- **Show collision outlines**
- **Show sprite outlines (F)**
- **Disable collision during preview**
- per-layer visibility toggles

## 7. Save workflow

Saving uses a review step.

1. Click **Preview before save**
2. Review the changed JSON
3. Click **Save changes**

If you save while working from a temporary live astronaut position, the designer now resumes from that same live position after save.

If you explicitly changed the astronaut start marker, that updated start position is still saved normally.

The designer validates some common mistakes before save, including missing button-to-door links.

## Linking buttons to doors

Buttons and doors are linked by numeric IDs.

### Step-by-step tutorial

1. Place or select a **door**
2. In the inspector, set **Door ID**
3. Place or select a **button**
4. In the button inspector, set **Linked door IDs (comma separated)**
5. Save

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
