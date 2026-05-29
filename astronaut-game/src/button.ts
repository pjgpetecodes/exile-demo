import { Door } from './door.js';
import { PaletteCycleSettings, TeleporterDestinationMode } from './types/index.js';

type ButtonPart = {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    collision: boolean;
    cropLeftHalf?: boolean;
    cropRightHalf?: boolean;
};

function isTeleporterMode(value: unknown): value is TeleporterDestinationMode {
    return value === 'toggle' ||
        value === 'destination_a' ||
        value === 'destination_b' ||
        value === 'toggle_enabled' ||
        value === 'enable' ||
        value === 'disable';
}

export class Button {
    x: number;
    y: number;
    type: string;
    palette: number;
    boxType: string;
    boxPalette: number;
    rotation: number;
    active: boolean;
    defaultActive: boolean;
    linkedDoors?: number[]; // Array of doorIDs
    linkedTeleporters?: string[];
    teleporterMode: TeleporterDestinationMode;
    collision: boolean;
    pressOffset: number;
    boxOffsetX: number;
    boxOffsetY: number;
    capClosedOffsetX: number;
    capClosedOffsetY: number;
    capOpenOffsetX: number;
    capOpenOffsetY: number;
    paletteCycle?: PaletteCycleSettings;

    private static normalizeLegacyBoxOffsetX(value: unknown) {
        if (value === 8 || value === 4 || value === -8 || value === -12) {
            return 12;
        }
        return typeof value === 'number' ? value : 12;
    }

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type ?? 'button';
        this.palette = data.palette ?? 0;
        this.boxType = data.boxType ?? 'button_box';
        this.boxPalette = data.boxPalette ?? 0;
        this.rotation = data.rotation ?? 1;
        this.active = data.active ?? false;
        this.defaultActive = data.active ?? false;
        this.linkedDoors = data.linkedDoors ?? [];
        this.linkedTeleporters = Array.isArray(data.linkedTeleporters)
            ? data.linkedTeleporters.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
            : [];
        this.teleporterMode = isTeleporterMode(data.teleporterMode)
            ? data.teleporterMode
            : 'toggle';
        this.collision = data.collision !== undefined ? data.collision : true;
        this.pressOffset = data.pressOffset ?? 2;
        this.boxOffsetX = Button.normalizeLegacyBoxOffsetX(data.boxOffsetX);
        this.boxOffsetY = data.boxOffsetY ?? 0;
        this.capClosedOffsetX = data.capClosedOffsetX ?? 0;
        this.capClosedOffsetY = data.capClosedOffsetY ?? 0;
        this.capOpenOffsetX = data.capOpenOffsetX ?? this.pressOffset;
        this.capOpenOffsetY = data.capOpenOffsetY ?? 0;
        this.paletteCycle = data.paletteCycle;
    }

    private transformOffset(offsetX: number, offsetY: number) {
        if (this.rotation >= 1 && this.rotation <= 4) {
            const angle = ((this.rotation - 1) * Math.PI) / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: Math.round(offsetX * cos - offsetY * sin),
                y: Math.round(offsetX * sin + offsetY * cos)
            };
        }

        if (this.rotation === 5) {
            return { x: -offsetX, y: offsetY };
        }
        if (this.rotation === 6) {
            return { x: offsetX, y: -offsetY };
        }
        if (this.rotation === 7) {
            return { x: -offsetX, y: -offsetY };
        }
        if (this.rotation === 8) {
            return { x: -offsetY, y: -offsetX };
        }
        if (this.rotation === 9) {
            return { x: offsetY, y: offsetX };
        }

        return { x: offsetX, y: offsetY };
    }

    getCapPart(): ButtonPart {
        const localOffset = this.active
            ? { x: this.capOpenOffsetX, y: this.capOpenOffsetY }
            : { x: this.capClosedOffsetX, y: this.capClosedOffsetY };
        const pressedOffset = this.transformOffset(localOffset.x, localOffset.y);
        return {
            x: this.x + pressedOffset.x,
            y: this.y + pressedOffset.y,
            type: this.type,
            palette: this.palette,
            rotation: this.rotation,
            collision: this.collision,
            cropLeftHalf: true
        };
    }

    getBoxPart(): ButtonPart {
        const boxOffset = this.transformOffset(this.boxOffsetX, this.boxOffsetY);
        return {
            x: this.x + boxOffset.x,
            y: this.y + boxOffset.y,
            type: this.boxType,
            palette: this.boxPalette,
            rotation: this.rotation,
            collision: this.collision
        };
    }

    getRenderParts(): ButtonPart[] {
        return [this.getCapPart(), this.getBoxPart()];
    }

    getCollisionParts(): ButtonPart[] {
        return [this.getBoxPart(), this.getCapPart()];
    }

    toggle() {
        this.active = !this.active;
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
