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
        this.collision = data.collision !== undefined ? data.collision : true;
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
