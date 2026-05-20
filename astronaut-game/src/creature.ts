import { PaletteCycleSettings } from './types/index.js';

export class Creature {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    state: any;
    paletteCycle?: PaletteCycleSettings;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.state = data.state ?? {};
        this.paletteCycle = data.paletteCycle;
    }

    // Example: move creature (simple random walk)
    move() {
        // Implement autonomous movement logic here
    }
}
