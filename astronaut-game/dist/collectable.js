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
