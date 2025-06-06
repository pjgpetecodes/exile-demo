export class Door {
    constructor(data) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.x = data.x;
        this.y = data.y;
        this.z = (_a = data.z) !== null && _a !== void 0 ? _a : 0;
        this.type = data.type;
        this.palette = (_b = data.palette) !== null && _b !== void 0 ? _b : 0;
        this.rotation = (_c = data.rotation) !== null && _c !== void 0 ? _c : 1;
        this.name = (_d = data.name) !== null && _d !== void 0 ? _d : "";
        this.doorID = (_e = data.doorID) !== null && _e !== void 0 ? _e : -1;
        this.locked = (_f = data.locked) !== null && _f !== void 0 ? _f : false;
        this.open = (_g = data.open) !== null && _g !== void 0 ? _g : false;
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
    updateAnimation(doorOpenSound, doorCloseSound) {
        // Only animate horizontal, unlocked doors
        if (!this.animating || this.type !== "door_horizontal" || this.locked)
            return;
        // Initialize animation state if needed
        if (typeof this._originalX === "undefined") {
            this._originalX = this.x;
        }
        if (typeof this._animationDirection === "undefined") {
            this._animationDirection = "open";
        }
        if (typeof this._closeDelay === "undefined") {
            this._closeDelay = 0;
        }
        if (!('animationOffset' in this)) {
            this.animationOffset = 0;
        }
        // Animate open (slide left)
        if (this._animationDirection === "open") {
            if (this.animationOffset > -70) {
                this.animationOffset -= 1.5;
                this.x = this._originalX + this.animationOffset;
                // Play door open sound at the start of opening
                if (this.animationOffset === -1.5) {
                    try {
                        doorOpenSound.currentTime = 0;
                        doorOpenSound.play();
                    }
                    catch (_a) { }
                }
            }
            else {
                // Fully open, start close delay
                this._animationDirection = "wait";
                this._closeDelay = 0;
            }
        }
        // Wait before closing
        else if (this._animationDirection === "wait") {
            this._closeDelay += 1 / 60;
            if (this._closeDelay >= 2) { // 2 seconds
                this._animationDirection = "close";
            }
        }
        // Animate close (slide right)
        else if (this._animationDirection === "close") {
            if (this.animationOffset < 0) {
                // Play door close sound at the start of closing
                if (this.animationOffset === -70) {
                    try {
                        doorCloseSound.currentTime = 0;
                        doorCloseSound.play();
                    }
                    catch (_b) { }
                }
                this.animationOffset += 1.5;
                if (this.animationOffset > 0)
                    this.animationOffset = 0;
                this.x = this._originalX + this.animationOffset;
            }
            else {
                // Done closing
                this.animating = false;
                this.animationOffset = 0;
                this.x = this._originalX;
                // Clean up animation state
                delete this._animationDirection;
                delete this._closeDelay;
                delete this._originalX;
            }
        }
    }
}
