import { describe, expect, it, vi } from 'vitest';

describe('createWorldDesignerPlacement', () => {
    it('syncs authored snapshot when a drag move commits', async () => {
        (globalThis as any).Audio = class AudioMock { };
        const { createWorldDesignerPlacement } = await import('../../../src/designer/placement/world-designer-placement.js');
        const collectable = { x: 100, y: 120, type: 'chest', palette: 0, rotation: 1 };
        const selection = { category: 'collectables', entity: collectable };

        const state: any = {
            camera: { x: 0, y: 0 },
            dragging: false,
            dragAnchorWorld: null,
            dragItems: [],
            dragStartSnapshot: null,
            objectSnapEnabled: false,
            activeObjectSnapMode: 'none',
            objectSnapGuides: [],
            lastPointerCanvas: null,
            snapToGrid: false,
            snapOffsetX: 0,
            snapOffsetY: 0,
            undoStack: [],
            redoStack: [],
            category: 'collectables',
            rotation: 1,
            palette: 0,
            translation: 'center',
            typeByCategory: { collectables: 'chest' },
            selectedItems: [selection],
            selection
        };

        const syncEditModeSnapshot = vi.fn();
        const afterWorldDataMutated = vi.fn();
        const updateDirtyState = vi.fn();
        const refreshPanel = vi.fn();
        const setStatus = vi.fn();

        const getSnapshot = () => ({
            worldData: {
                worldMap: [],
                buttons: [],
                doors: [],
                creatures: [],
                collectables: [{ x: collectable.x, y: collectable.y, type: collectable.type, palette: 0, rotation: 1 }],
                teleporters: [],
                astronautStart: { x: 0, y: 0 }
            },
            customSpriteDefinitions: [],
            customSpriteInstances: []
        });

        const placement = createWorldDesignerPlacement({
            state,
            historyLimit: 20,
            host: {
                canvas: { width: 800, height: 600 } as HTMLCanvasElement,
                clampCamera: (camera) => camera,
                afterWorldDataMutated
            },
            getCurrentType: () => 'chest',
            getCategoryArray: () => [],
            getRectAtPosition: (x, y) => ({ left: x, top: y, right: x + 32, bottom: y + 32, width: 32, height: 32 }),
            getEntityRect: (entity) => ({ left: entity.x, top: entity.y, right: entity.x + 32, bottom: entity.y + 32, width: 32, height: 32 }),
            getHitCandidates: () => [],
            getSnapshot,
            expandSelectionsWithLinkedTeleporters: (selections) => selections,
            applyEntityPositionWithTeleporterSync: (entity, x, y) => {
                entity.x = x;
                entity.y = y;
            },
            screenToWorld: (x, y) => ({ x, y }),
            refreshPanel,
            updateDirtyState,
            syncEditModeSnapshot,
            setStatus,
            snapshotsEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
            isTeleporterCompositeType: () => false,
            isButtonCompositeType: () => false,
            createTeleporterCompositeAt: () => null,
            createButtonEntity: () => ({}),
            getCustomSpriteDefinitionById: () => null,
            createCustomSpriteInstance: () => ({}),
            createDoorEntity: () => ({}),
            createCreatureEntity: () => ({}),
            createCollectableEntity: () => ({}),
            getDefaultCollectableWeight: () => 1,
            getDefaultCollectablePaletteCycle: () => null,
            getPaletteCount: () => 16,
            playMushroomPlacementSound: () => undefined,
            setSelections: () => undefined
        });

        placement.beginDrag({ x: 100, y: 120 }, [selection]);
        placement.updateDraggedItems({ x: 140, y: 160 });
        placement.completeDrag();

        expect(afterWorldDataMutated).toHaveBeenCalledTimes(1);
        expect(updateDirtyState).toHaveBeenCalledTimes(1);
        expect(syncEditModeSnapshot).toHaveBeenCalledTimes(1);
        expect(setStatus).toHaveBeenCalledWith(
            'Moved selected objects with the mouse. Use arrow keys for precise nudging.',
            'neutral'
        );
    }, 15000);
});
