import {
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource
} from './destructibles.js';
import { PaletteCycleSettings } from './types/index.js';
import type { DestructionSourceRequirement } from './destructibles.js';

export class Door {
    x: number;
    y: number;
    z: number;
    type: string;
    palette: number;
    rotation: number;
    name: string;
    doorID: number;
    locked: boolean;
    open: boolean;
    defaultLocked: boolean;
    defaultOpen: boolean;
    animating: boolean;
    palette_locked: number | null;
    palette_unlocked: number | null;
    collision: boolean;
    paletteCycle?: PaletteCycleSettings;
    destructible: boolean;
    destructionHealth: number;
    destructionSource: DestructionSourceRequirement;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.z = data.z ?? 0;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.name = data.name ?? "";
        this.doorID = data.doorID ?? -1;
        this.locked = data.locked ?? false;
        this.open = data.open ?? false;
        this.defaultLocked = data.locked ?? false;
        this.defaultOpen = data.open ?? false;
        this.animating = false;
        this.palette_locked = data.palette_locked !== undefined ? data.palette_locked : null;
        this.palette_unlocked = data.palette_unlocked !== undefined ? data.palette_unlocked : null;
        this.collision = data.collision !== undefined ? data.collision : true;
        this.paletteCycle = data.paletteCycle;
        this.destructionHealth = typeof data.destructionHealth === 'number'
            ? Math.max(0.1, data.destructionHealth)
            : getDefaultDestructibleHealth('doors', this.type);
        this.destructionSource = typeof data.destructionSource === 'string'
            ? data.destructionSource
            : getDefaultDestructionSource('doors', this.type);
        this.destructible = typeof data.destructible === 'boolean'
            ? data.destructible
            : getDefaultDestructibleEnabled('doors', this.type);
    }

    unlock() {
        this.locked = false;
    }
    lock() {
        this.locked = true;
    }
    openDoor() {
        if (!this.locked) {
            this.open = true;
            this.animating = true;
        }
    }
    closeDoor() {
        this.open = false;
        this.animating = true;
    }

    updateAnimation(doorOpenSound: HTMLAudioElement, doorCloseSound: HTMLAudioElement) {
        // Only horizontal doors animate; lock state should not interrupt an animation already in progress
        if (!this.animating || this.type !== "door_horizontal") return;

        // Initialize animation state if needed
        if (typeof (this as any)._originalX === "undefined") {
            (this as any)._originalX = this.x;
        }
        if (typeof (this as any)._animationDirection === "undefined") {
            (this as any)._animationDirection = "open";
        }
        if (typeof (this as any)._closeDelay === "undefined") {
            (this as any)._closeDelay = 0;
        }
        if (!('animationOffset' in this)) {
            (this as any).animationOffset = 0;
        }

        // Animate open (slide left)
        if ((this as any)._animationDirection === "open") {
            if ((this as any).animationOffset > -70) {
                (this as any).animationOffset -= 1.5;
                this.x = (this as any)._originalX + (this as any).animationOffset;
                // Play door open sound at the start of opening
                if ((this as any).animationOffset === -1.5) {
                    try { doorOpenSound.currentTime = 0; doorOpenSound.play(); } catch {}
                }
            } else {
                // Fully open, start close delay
                (this as any)._animationDirection = "wait";
                (this as any)._closeDelay = 0;
            }
        }
        // Wait before closing
        else if ((this as any)._animationDirection === "wait") {
            (this as any)._closeDelay += 1 / 60;
            if ((this as any)._closeDelay >= 2) { // 2 seconds
                (this as any)._animationDirection = "close";
                (this as any)._closeSoundPlayed = false; // Reset sound flag when starting close
            }
        }
        // Animate close (slide right)
        else if ((this as any)._animationDirection === "close") {
            if ((this as any).animationOffset < 0) {
                // Play door close sound at the start of closing (when offset crosses -70)
                if ((this as any).animationOffset <= -70 && !(this as any)._closeSoundPlayed) {
                    try { doorCloseSound.currentTime = 0; doorCloseSound.play(); } catch {}
                    (this as any)._closeSoundPlayed = true;
                }
                (this as any).animationOffset += 1.5;
                if ((this as any).animationOffset > 0) (this as any).animationOffset = 0;
                this.x = (this as any)._originalX + (this as any).animationOffset;
            } else {
                // Done closing
                this.animating = false;
                (this as any).animationOffset = 0;
                this.x = (this as any)._originalX;
                // Clean up animation state
                delete (this as any)._animationDirection;
                delete (this as any)._closeDelay;
                delete (this as any)._originalX;
                delete (this as any)._closeSoundPlayed;
            }
        }
        // --- Update green world bounding box for this door ---
        if (typeof window !== 'undefined' && (window as any).spriteWorldBoundingBoxes) {
            const greenBoxes = (window as any).spriteWorldBoundingBoxes;
            const boxes = greenBoxes[this.type];
            if (boxes && Array.isArray(boxes)) {
                for (const box of boxes) {
                    // Use doorID for matching, fallback to entityId if present
                    if ((box.doorID !== undefined && box.doorID === this.doorID) || (box.entityId !== undefined && box.entityId === (this as any).entityId)) {
                        // Calculate offset from originalX
                        const offsetX = this.x - ((this as any)._originalX ?? this.x);
                        // Shift the bounding box by offsetX
                        const width = box.worldMaxX - box.worldMinX;
                        box.worldMinX = Math.round(this.x);
                        box.worldMaxX = Math.round(this.x + width);
                        // Optionally, update other properties if needed
                        break;
                    }
                }
            }
        }
    }
}
