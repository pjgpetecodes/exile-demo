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