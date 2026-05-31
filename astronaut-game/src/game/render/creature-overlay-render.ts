import { Creature } from '../../entities/creature.js';
import { Position } from '../../types/index.js';

type EntityCollisionBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

type RenderedEntityWorldSprite = {
    canvas: { width: number; height: number };
    drawX: number;
    drawY: number;
} | null;

type CreatureOverlayRendererOptions = {
    getCreatureEntities: () => Creature[];
    getRenderedEntityWorldSprite: (entity: Creature) => RenderedEntityWorldSprite;
    getEntityCollisionBounds: (entity: Creature) => EntityCollisionBounds;
    getEntityRect: (x: number, y: number, bounds: EntityCollisionBounds) => { left: number; top: number; right: number; bottom: number };
    spriteScale: number;
};

export function createCreatureOverlayRenderer(options: CreatureOverlayRendererOptions) {
    function drawCreatureOverlays(context: CanvasRenderingContext2D, camera: Position) {
        const now = performance.now();
        for (const creature of options.getCreatureEntities()) {
            const damageFlashUntil = typeof creature.state?.damageFlashUntil === 'number'
                ? Number(creature.state.damageFlashUntil)
                : 0;
            if (creature.damageFlash && damageFlashUntil > now) {
                const rendered = options.getRenderedEntityWorldSprite(creature);
                const bounds = options.getEntityCollisionBounds(creature);
                const rect = options.getEntityRect(creature.x, creature.y, bounds);
                const screenX = (rendered?.drawX ?? rect.left) - camera.x;
                const screenY = (rendered?.drawY ?? rect.top) - camera.y;
                const width = (rendered?.canvas.width ?? (rect.right - rect.left + 1) / options.spriteScale) * options.spriteScale;
                const height = (rendered?.canvas.height ?? (rect.bottom - rect.top + 1) / options.spriteScale) * options.spriteScale;
                context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                context.lineWidth = 2;
                context.strokeRect(screenX - 1, screenY - 1, width + 2, height + 2);
            }
        }
    }

    return {
        drawCreatureOverlays
    };
}
