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