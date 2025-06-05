export class Button {
    constructor(data) {
        var _a, _b, _c;
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = (_a = data.palette) !== null && _a !== void 0 ? _a : 0;
        this.rotation = (_b = data.rotation) !== null && _b !== void 0 ? _b : 1;
        this.active = (_c = data.active) !== null && _c !== void 0 ? _c : false;
        this.linkedDoorName = data.linkedDoorName;
    }
    // Example: activate the button and unlock linked door
    activate(doors) {
        this.active = true;
        if (this.linkedDoorName) {
            const door = doors.find(d => d.name === this.linkedDoorName);
            if (door)
                door.unlock();
        }
    }
}
export class Door {
    constructor(data) {
        var _a, _b, _c, _d, _e;
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = (_a = data.palette) !== null && _a !== void 0 ? _a : 0;
        this.rotation = (_b = data.rotation) !== null && _b !== void 0 ? _b : 1;
        this.name = (_c = data.name) !== null && _c !== void 0 ? _c : "";
        this.locked = (_d = data.locked) !== null && _d !== void 0 ? _d : false;
        this.open = (_e = data.open) !== null && _e !== void 0 ? _e : false;
        this.animating = false;
        // Assign palette_locked and palette_unlocked even if they are 0
        this.palette_locked = data.palette_locked !== undefined ? data.palette_locked : null;
        this.palette_unlocked = data.palette_unlocked !== undefined ? data.palette_unlocked : null;
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
    constructor(data) {
        var _a, _b, _c;
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = (_a = data.palette) !== null && _a !== void 0 ? _a : 0;
        this.rotation = (_b = data.rotation) !== null && _b !== void 0 ? _b : 1;
        this.state = (_c = data.state) !== null && _c !== void 0 ? _c : {};
    }
    // Example: move creature (simple random walk)
    move() {
        // Implement autonomous movement logic here
    }
}
export class Collectable {
    constructor(data) {
        var _a, _b, _c, _d;
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = (_a = data.palette) !== null && _a !== void 0 ? _a : 0;
        this.rotation = (_b = data.rotation) !== null && _b !== void 0 ? _b : 1;
        this.collected = (_c = data.collected) !== null && _c !== void 0 ? _c : false;
        this.name = (_d = data.name) !== null && _d !== void 0 ? _d : "";
    }
    collect() {
        this.collected = true;
    }
}
