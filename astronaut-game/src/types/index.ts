export interface Position {
    x: number;
    y: number;
}

export interface Astronaut {
    position: Position;
    isFlying: boolean;
    isLanded: boolean;
    velocity: Position;
}

export interface GameState {
    astronaut: Astronaut;
    gravity: number;
    trail: Position[];
    isRunning?: boolean;
}