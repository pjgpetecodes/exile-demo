export class Button {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    active: boolean;
    linkedDoorName?: string;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.active = data.active ?? false;
        this.linkedDoorName = data.linkedDoorName;
    }

    // Example: activate the button and unlock linked door
    activate(doors: Door[]) {
        this.active = true;
        if (this.linkedDoorName) {
            const door = doors.find(d => d.name === this.linkedDoorName);
            if (door) door.unlock();
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
    locked: boolean;
    open: boolean;
    animating: boolean;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.name = data.name ?? "";
        this.locked = data.locked ?? false;
        this.open = data.open ?? false;
        this.animating = false;
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
