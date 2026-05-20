import { PaletteCycleSettings, Position } from './types/index.js';

export class Collectable {
    x: number;
    y: number;
    type: string;
    palette: number;
    defaultRotation: number;
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
    astronautCollisionIgnoreFrames: number;
    entityId?: number;
    paletteCycle?: PaletteCycleSettings;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.defaultRotation = data.rotation ?? 1;
        this.rotation = this.defaultRotation;
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
        this.astronautCollisionIgnoreFrames = data.astronautCollisionIgnoreFrames ?? 0;
        this.paletteCycle = data.paletteCycle;
    }

    collect() {
        this.collected = true;
    }

    setHeldFacing(facingLeft: boolean) {
        this.rotation = facingLeft ? 5 : 1;
    }

    hold(facingLeft: boolean) {
        this.held = true;
        this.stored = false;
        this.velocity = { x: 0, y: 0 };
        this.astronautCollisionIgnoreFrames = 0;
        this.setHeldFacing(facingLeft);
    }

    store() {
        this.held = false;
        this.stored = true;
        this.velocity = { x: 0, y: 0 };
        this.astronautCollisionIgnoreFrames = 0;
    }

    release(x: number, y: number, velocity: Position = { x: 0, y: 0 }, astronautCollisionIgnoreFrames: number = 0) {
        this.held = false;
        this.stored = false;
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.isGrounded = false;
        this.astronautCollisionIgnoreFrames = astronautCollisionIgnoreFrames;
    }
}
