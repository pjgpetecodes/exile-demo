export class Button {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    active: boolean;
    linkedDoors?: number[]; // Array of doorIDs
    collision: boolean;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.active = data.active ?? false;
        this.linkedDoors = data.linkedDoors ?? [];
        this.collision = data.collision !== undefined ? data.collision : true;
    }

    // Activate the button and unlock all linked doors by doorID
    activate(doors: Door[]) {
        this.active = true;
        if (this.linkedDoors && Array.isArray(this.linkedDoors)) {
            for (const doorID of this.linkedDoors) {
                const door = doors.find(d => d.doorID === doorID);
                if (door) door.unlock();
            }
        }
    }
}

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

export class Creature {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    state: any;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.state = data.state ?? {};
    }

    // Example: move creature (simple random walk)
    move() {
        // Implement autonomous movement logic here
    }
}

export class Collectable {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    collected: boolean;
    name: string;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.collected = data.collected ?? false;
        this.name = data.name ?? "";
    }

    collect() {
        this.collected = true;
    }
}
