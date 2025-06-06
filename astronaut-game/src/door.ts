export class Door {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    name: string;
    doorID: number;
    locked: boolean;
    open: boolean;
    animating: boolean;
    palette_locked: number | null;
    palette_unlocked: number | null;
    collision: boolean;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.name = data.name ?? "";
        this.doorID = data.doorID ?? -1;
        this.locked = data.locked ?? false;
        this.open = data.open ?? false;
        this.animating = false;
        this.palette_locked = data.palette_locked !== undefined ? data.palette_locked : null;
        this.palette_unlocked = data.palette_unlocked !== undefined ? data.palette_unlocked : null;
        this.collision = data.collision !== undefined ? data.collision : true;
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
}
