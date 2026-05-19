import { Position } from './types/index.js';

export class Collectable {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    collected: boolean;
    name: string;
    weight: number;
    storable: boolean;
    affectsAstronaut: boolean;
    collision: boolean;
    held: boolean;
    stored: boolean;
    isGrounded: boolean;
    velocity: Position;
    entityId?: number;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.collected = data.collected ?? false;
        this.name = data.name ?? "";
        this.weight = data.weight ?? 0;
        this.storable = data.storable ?? false;
        this.affectsAstronaut = data.affectsAstronaut ?? true;
        this.collision = data.collision ?? true;
        this.held = data.held ?? false;
        this.stored = data.stored ?? false;
        this.isGrounded = data.isGrounded ?? false;
        this.velocity = data.velocity ?? { x: 0, y: 0 };
    }

    collect() {
        this.collected = true;
    }

    hold() {
        this.held = true;
        this.stored = false;
        this.velocity = { x: 0, y: 0 };
    }

    store() {
        this.held = false;
        this.stored = true;
        this.velocity = { x: 0, y: 0 };
    }

    release(x: number, y: number, velocity: Position = { x: 0, y: 0 }) {
        this.held = false;
        this.stored = false;
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.isGrounded = false;
    }
}
