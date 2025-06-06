import { Door } from './door.js';

export class Button {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    active: boolean;
    linkedDoors?: number[]; // Array of doorIDs
    collision: boolean;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.active = data.active ?? false;
        this.linkedDoors = data.linkedDoors ?? [];
        this.collision = data.collision !== undefined ? data.collision : true;
    }

    // Activate the button and unlock all linked doors by doorID
    activate(doors: Door[]) {
        this.active = true;
        if (this.linkedDoors && Array.isArray(this.linkedDoors)) {
            for (const doorID of this.linkedDoors) {
                const door = doors.find(d => d.doorID === doorID);
                if (door) door.unlock();
            }
        }
    }
}