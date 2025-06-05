export class Button {
    constructor(data) {
        var _a, _b, _c, _d;
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = (_a = data.palette) !== null && _a !== void 0 ? _a : 0;
        this.rotation = (_b = data.rotation) !== null && _b !== void 0 ? _b : 1;
        this.active = (_c = data.active) !== null && _c !== void 0 ? _c : false;
        this.linkedDoors = (_d = data.linkedDoors) !== null && _d !== void 0 ? _d : [];
    }
    // Activate the button and unlock all linked doors by doorID
    activate(doors) {
        this.active = true;
        if (this.linkedDoors && Array.isArray(this.linkedDoors)) {
            for (const doorID of this.linkedDoors) {
                const door = doors.find(d => d.doorID === doorID);
                if (door)
                    door.unlock();
            }
        }
    }
}
export class Door {
    constructor(data) {
        var _a, _b, _c, _d, _e, _f;
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = (_a = data.palette) !== null && _a !== void 0 ? _a : 0;
        this.rotation = (_b = data.rotation) !== null && _b !== void 0 ? _b : 1;
        this.name = (_c = data.name) !== null && _c !== void 0 ? _c : "";
        this.doorID = (_d = data.doorID) !== null && _d !== void 0 ? _d : -1;
        this.locked = (_e = data.locked) !== null && _e !== void 0 ? _e : false;
        this.open = (_f = data.open) !== null && _f !== void 0 ? _f : false;
        this.animating = false;
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
