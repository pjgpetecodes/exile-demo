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
