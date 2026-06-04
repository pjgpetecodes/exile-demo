import { MapBlock } from '../../world/map.js';
import type { Position, TeleporterSaveData } from '../../types/index.js';
import type { DesignerCategory, Rect, Selection } from '../core/world-designer-types.js';

type HitCandidate = { category: DesignerCategory; entity: any };

export function createWorldDesignerSelectionGeometry(context: any) {
    const getHitCandidates = (): HitCandidate[] => {
        const data = context.host.getRawWorldData();
        const candidates: HitCandidate[] = [];

        for (const collectable of [...data.collectables].reverse()) {
            if ('creatureProjectile' in collectable && collectable.creatureProjectile) {
                continue;
            }
            candidates.push({ category: 'collectables', entity: collectable });
        }
        for (const creature of [...data.creatures].reverse()) {
            candidates.push({ category: 'creatures', entity: creature });
        }
        for (const customSprite of [...context.getCustomSpriteInstances()].reverse()) {
            candidates.push({ category: 'custom', entity: customSprite });
        }
        for (const button of [...data.buttons].reverse()) {
            candidates.push({ category: 'buttons', entity: button });
        }
        for (const door of [...data.doors].reverse()) {
            candidates.push({ category: 'doors', entity: door });
        }
        for (const block of [...data.worldMap].reverse()) {
            candidates.push({ category: 'world', entity: block });
        }

        return candidates;
    };

    const getEntityAt = (worldX: number, worldY: number) => {
        const visibleLayers = context.getLayerVisibility();
        for (const candidate of getHitCandidates()) {
            if (!visibleLayers[candidate.category]) continue;
            const rect = context.getEntityRect(candidate.entity, candidate.category);
            if (
                worldX >= rect.left &&
                worldX <= rect.right &&
                worldY >= rect.top &&
                worldY <= rect.bottom
            ) {
                return candidate;
            }
        }
        return null;
    };

    const getSelectionBounds = (selections: Selection[]) => {
        const rects = selections.map((selection) => context.getEntityRect(selection.entity, selection.category));
        return {
            left: Math.min(...rects.map((rect) => rect.left)),
            top: Math.min(...rects.map((rect) => rect.top)),
            right: Math.max(...rects.map((rect) => rect.right)),
            bottom: Math.max(...rects.map((rect) => rect.bottom)),
            width: Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left)),
            height: Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.top))
        };
    };

    const getTeleporterSelectionRect = (teleporter: TeleporterSaveData): Rect | null => {
        const base = context.findWorldBlockByExactPosition(teleporter.baseX, teleporter.baseY, 'teleporter');
        if (base) {
            return context.getEntityRect(base, 'world');
        }
        const pad = context.findWorldBlockByExactPosition(teleporter.padX, teleporter.padY, 'teleporter_pad');
        if (pad) {
            return context.getEntityRect(pad, 'world');
        }
        return null;
    };

    const getSelectionVisuals = (selections: Selection[]) => {
        const visuals: Array<{ rect: Rect; isPrimary: boolean }> = [];
        const handledTeleporters = new Set<string>();
        const primarySelection = context.getPrimarySelection();
        const primaryTeleporterId = primarySelection?.category === 'world'
            ? (context.findTeleporterForWorldBlock(primarySelection.entity as MapBlock)?.id ?? null)
            : null;

        for (const selection of selections) {
            if (selection.category === 'world') {
                const teleporter = context.findTeleporterForWorldBlock(selection.entity as MapBlock);
                if (teleporter) {
                    if (handledTeleporters.has(teleporter.id)) {
                        continue;
                    }
                    handledTeleporters.add(teleporter.id);
                    visuals.push({
                        rect: getTeleporterSelectionRect(teleporter) ?? context.getEntityRect(selection.entity, selection.category),
                        isPrimary: primaryTeleporterId === teleporter.id
                    });
                    continue;
                }
            }

            visuals.push({
                rect: context.getEntityRect(selection.entity, selection.category),
                isPrimary: primarySelection ? context.areSameSelection(selection, primarySelection) : false
            });
        }

        return visuals;
    };

    const getSelectionsInRect = (start: Position, end: Position) => {
        const visibleLayers = context.getLayerVisibility();
        const marqueeRect = context.normalizeRect(start, end);
        return getHitCandidates()
            .filter((candidate) => visibleLayers[candidate.category])
            .filter((candidate) => context.rectsIntersect(marqueeRect, context.getEntityRect(candidate.entity, candidate.category)));
    };

    return {
        getHitCandidates,
        getEntityAt,
        getSelectionBounds,
        getSelectionVisuals,
        getSelectionsInRect
    };
}
