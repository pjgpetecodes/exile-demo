import { Button } from '../../entities/button.js';
import { Collectable } from '../../entities/collectable.js';
import { Creature } from '../../entities/creature.js';
import { Door } from '../../entities/door.js';
import type { MapBlock } from '../../world/map.js';
import type { PaletteCycleSettings, TeleporterDestinationMode } from '../../types/index.js';
import type { SpriteTranslation } from '../../shared/utilities.js';
import type {
    ButtonSaveData,
    CollectableSaveData,
    CustomSpriteDefinition,
    CustomSpriteInstance,
    DesignerCategory,
    DesignerState,
    DoorSaveData,
    Selection
} from '../core/world-designer-types.js';

type WorldDesignerEntityConversionContext = {
    state: DesignerState;
    spriteTypes: string[];
    categoryLabels: Record<DesignerCategory, string>;
    buttonDefaultPressOffset: number;
    buttonDefaultBoxOffsetX: number;
    buttonDefaultBoxOffsetY: number;
    getPaletteCount: () => number;
    getCategoryArray: (category: DesignerCategory) => any[];
    setSelections: (selections: Selection[], primarySelection?: Selection | null) => void;
    getCustomSpriteDefinitionForInstance: (instance: CustomSpriteInstance) => CustomSpriteDefinition | null;
    getNextDoorId: () => number;
    normalizeRotation: (value: number | undefined) => number;
    normalizeSpriteTranslation: (value: string | undefined) => SpriteTranslation;
    categorySupportsTranslation: (category: DesignerCategory) => boolean;
    getDoorTypeFromSourceType: (sourceType: string) => string | null;
    invertButtonOffset: (x: number, y: number, rotation: number) => { x: number; y: number };
    deepClone: <T>(value: T) => T;
    getDefaultCollectableWeight: (type: string, radioactive?: boolean) => number;
    getDefaultCollectablePaletteCycle: (
        type: string,
        palette: number,
        paletteCount: number,
        radioactive?: boolean
    ) => PaletteCycleSettings | undefined;
    getDefaultDestructibleEnabled: (category: 'world' | 'doors', type: string) => boolean;
    getDefaultDestructibleHealth: (category: 'world' | 'doors', type: string) => number;
    getDefaultDestructionSource: (category: 'world' | 'doors', type: string) => string;
};

export function createWorldDesignerEntityConversion(context: WorldDesignerEntityConversionContext) {
    const {
        state,
        spriteTypes,
        categoryLabels,
        buttonDefaultPressOffset,
        buttonDefaultBoxOffsetX,
        buttonDefaultBoxOffsetY,
        getPaletteCount,
        getCategoryArray,
        setSelections,
        getCustomSpriteDefinitionForInstance,
        getNextDoorId,
        normalizeRotation,
        normalizeSpriteTranslation,
        categorySupportsTranslation,
        getDoorTypeFromSourceType,
        invertButtonOffset,
        deepClone,
        getDefaultCollectableWeight,
        getDefaultCollectablePaletteCycle,
        getDefaultDestructibleEnabled,
        getDefaultDestructibleHealth,
        getDefaultDestructionSource
    } = context;

    function getPreferredButtonTypes() {
        const fallbackType = spriteTypes[0] ?? 'button';
        const capType = spriteTypes.includes('button')
            ? 'button'
            : fallbackType;
        const boxType = spriteTypes.includes('button_box')
            ? 'button_box'
            : capType;
        return { capType, boxType };
    }

    function getDefaultButtonPalettePair() {
        const paletteCount = getPaletteCount();
        const defaultCapPalette = paletteCount > 9 ? 9 : Math.max(0, paletteCount - 1);
        const defaultBoxPalette = paletteCount > 8 ? 8 : defaultCapPalette;
        return {
            capPalette: defaultCapPalette,
            boxPalette: defaultBoxPalette
        };
    }

    function getEffectiveButtonDefaultOverrides() {
        const paletteDefaults = getDefaultButtonPalettePair();
        return {
            capPalette: state.buttonDefaults.capPalette ?? paletteDefaults.capPalette,
            boxPalette: state.buttonDefaults.boxPalette ?? paletteDefaults.boxPalette,
            capClosedOffsetX: state.buttonDefaults.capClosedOffsetX ?? 0,
            capClosedOffsetY: state.buttonDefaults.capClosedOffsetY ?? 0,
            capOpenOffsetX: state.buttonDefaults.capOpenOffsetX ?? buttonDefaultPressOffset,
            capOpenOffsetY: state.buttonDefaults.capOpenOffsetY ?? 0
        };
    }

    function applyButtonDefaultRelativeOffsets(boxOffsetX: number, boxOffsetY: number) {
        const defaults = getEffectiveButtonDefaultOverrides();
        return {
            capClosedOffsetX: boxOffsetX + defaults.capClosedOffsetX,
            capClosedOffsetY: boxOffsetY + defaults.capClosedOffsetY,
            capOpenOffsetX: boxOffsetX + defaults.capOpenOffsetX,
            capOpenOffsetY: boxOffsetY + defaults.capOpenOffsetY
        };
    }

    function getButtonCapLocalOffsets(button: ButtonSaveData | Button, open: boolean) {
        const closed = {
            x: button.capClosedOffsetX ?? 0,
            y: button.capClosedOffsetY ?? 0
        };
        const openOffsets = {
            x: button.capOpenOffsetX ?? (button.pressOffset ?? 2),
            y: button.capOpenOffsetY ?? 0
        };
        return open ? openOffsets : closed;
    }

    function getButtonCapOffsetsRelativeToBox(button: ButtonSaveData | Button, open: boolean) {
        const cap = getButtonCapLocalOffsets(button, open);
        return {
            x: cap.x - (button.boxOffsetX ?? buttonDefaultBoxOffsetX),
            y: cap.y - (button.boxOffsetY ?? buttonDefaultBoxOffsetY)
        };
    }

    function setButtonDefaultOverridesFromButton(button: Button) {
        const closedRelative = getButtonCapOffsetsRelativeToBox(button, false);
        const openRelative = getButtonCapOffsetsRelativeToBox(button, true);
        state.buttonDefaults = {
            capPalette: button.palette ?? 0,
            boxPalette: button.boxPalette ?? 0,
            capClosedOffsetX: closedRelative.x,
            capClosedOffsetY: closedRelative.y,
            capOpenOffsetX: openRelative.x,
            capOpenOffsetY: openRelative.y
        };
    }

    function resetButtonDefaultOverrides() {
        state.buttonDefaults = {
            capPalette: null,
            boxPalette: null,
            capClosedOffsetX: null,
            capClosedOffsetY: null,
            capOpenOffsetX: null,
            capOpenOffsetY: null
        };
    }

    function createButtonEntity(config: {
        x: number;
        y: number;
        type?: string;
        palette?: number;
        boxType?: string;
        boxPalette?: number;
        rotation?: number;
        collision?: boolean;
        active?: boolean;
        linkedDoors?: number[];
        linkedTeleporters?: string[];
        teleporterMode?: TeleporterDestinationMode;
        paletteCycle?: PaletteCycleSettings;
        pressOffset?: number;
        boxOffsetX?: number;
        boxOffsetY?: number;
        capClosedOffsetX?: number;
        capClosedOffsetY?: number;
        capOpenOffsetX?: number;
        capOpenOffsetY?: number;
    }) {
        const { capType, boxType } = getPreferredButtonTypes();
        const defaultButtonOverrides = getEffectiveButtonDefaultOverrides();
        const boxOffsetX = config.boxOffsetX ?? buttonDefaultBoxOffsetX;
        const boxOffsetY = config.boxOffsetY ?? buttonDefaultBoxOffsetY;
        const defaultCapOffsets = applyButtonDefaultRelativeOffsets(boxOffsetX, boxOffsetY);
        const capClosedOffsetX = config.capClosedOffsetX ?? defaultCapOffsets.capClosedOffsetX;
        const capClosedOffsetY = config.capClosedOffsetY ?? defaultCapOffsets.capClosedOffsetY;
        const capOpenOffsetX = config.capOpenOffsetX ?? defaultCapOffsets.capOpenOffsetX;
        const capOpenOffsetY = config.capOpenOffsetY ?? defaultCapOffsets.capOpenOffsetY;
        return new Button({
            x: config.x,
            y: config.y,
            type: config.type ?? capType,
            palette: config.palette ?? defaultButtonOverrides.capPalette,
            boxType: config.boxType ?? boxType,
            boxPalette: config.boxPalette ?? defaultButtonOverrides.boxPalette,
            rotation: normalizeRotation(config.rotation ?? state.rotation),
            linkedDoors: config.linkedDoors ?? [],
            linkedTeleporters: config.linkedTeleporters ?? [],
            teleporterMode: config.teleporterMode ?? 'toggle',
            collision: config.collision !== false,
            active: config.active ?? false,
            pressOffset: config.pressOffset ?? (capOpenOffsetX - capClosedOffsetX),
            boxOffsetX,
            boxOffsetY,
            capClosedOffsetX,
            capClosedOffsetY,
            capOpenOffsetX,
            capOpenOffsetY,
            paletteCycle: config.paletteCycle ? deepClone(config.paletteCycle) : undefined
        });
    }

    function createCustomSpriteInstance(definition: CustomSpriteDefinition, x: number, y: number): CustomSpriteInstance {
        return {
            x: Math.round(x),
            y: Math.round(y),
            type: definition.name,
            customSpriteId: definition.id
        };
    }

    function buildButtonEntityFromCustomSpriteInstance(instance: CustomSpriteInstance) {
        const definition = getCustomSpriteDefinitionForInstance(instance);
        if (!definition) {
            throw new Error('This custom sprite definition is missing.');
        }
        const capMember = definition.members.find((member) => member.data.type === 'button');
        const boxMember = definition.members.find((member) => member.data.type === 'button_box');
        if (!capMember || !boxMember) {
            throw new Error('Custom sprite needs one "button" part and one "button_box" part before it can convert to a button.');
        }
        const capData = capMember.data as ButtonSaveData | MapBlock | CollectableSaveData;
        const boxData = boxMember.data as ButtonSaveData | MapBlock | DoorSaveData | CollectableSaveData;
        const rotation = normalizeRotation(capData.rotation);
        const localBoxOffset = invertButtonOffset(
            boxMember.offsetX - capMember.offsetX,
            boxMember.offsetY - capMember.offsetY,
            rotation
        );
        const buttonDefaults = state.buttonDefaults;
        const closedCapOffsetX = -localBoxOffset.x;
        const closedCapOffsetY = -localBoxOffset.y;
        const defaultOpenTravel = buttonDefaultPressOffset + 5;
        const capTravelX = localBoxOffset.x < 0 ? defaultOpenTravel : -defaultOpenTravel;
        const capOpenOffsetX = buttonDefaults.capOpenOffsetX ?? (closedCapOffsetX + capTravelX);
        const capOpenOffsetY = buttonDefaults.capOpenOffsetY ?? closedCapOffsetY;
        return createButtonEntity({
            x: Math.round(instance.x + boxMember.offsetX),
            y: Math.round(instance.y + boxMember.offsetY),
            type: capData.type,
            palette: typeof buttonDefaults.capPalette === 'number'
                ? buttonDefaults.capPalette
                : (typeof capData.palette === 'number' ? capData.palette : undefined),
            boxType: boxData.type,
            boxPalette: typeof buttonDefaults.boxPalette === 'number'
                ? buttonDefaults.boxPalette
                : (typeof boxData.palette === 'number' ? boxData.palette : undefined),
            rotation,
            collision: ('collision' in capData ? capData.collision !== false : true) && ('collision' in boxData ? boxData.collision !== false : true),
            active: false,
            linkedDoors: [],
            paletteCycle: capData.paletteCycle ? deepClone(capData.paletteCycle) : undefined,
            pressOffset: capOpenOffsetX - (buttonDefaults.capClosedOffsetX ?? closedCapOffsetX),
            boxOffsetX: 0,
            boxOffsetY: 0,
            capClosedOffsetX: buttonDefaults.capClosedOffsetX ?? closedCapOffsetX,
            capClosedOffsetY: buttonDefaults.capClosedOffsetY ?? closedCapOffsetY,
            capOpenOffsetX,
            capOpenOffsetY
        });
    }

    function canConvertCustomSpriteToButton(instance: CustomSpriteInstance) {
        const definition = getCustomSpriteDefinitionForInstance(instance);
        return !!definition &&
            definition.members.some((member) => member.data.type === 'button') &&
            definition.members.some((member) => member.data.type === 'button_box');
    }

    function createDoorEntity(config: {
        x: number;
        y: number;
        type?: string;
        palette?: number;
        rotation?: number;
        translation?: SpriteTranslation;
        collision?: boolean;
        paletteCycle?: PaletteCycleSettings;
    }) {
        const doorId = getNextDoorId();
        const configuredType = typeof config.type === 'string' ? config.type.trim() : '';
        const type = configuredType.length > 0
            ? configuredType
            : (state.typeByCategory.doors as 'door_horizontal' | 'door_vertical');
        return new Door({
            x: config.x,
            y: config.y,
            z: 0,
            type,
            palette: config.palette ?? state.palette,
            rotation: normalizeRotation(config.rotation ?? state.rotation),
            translation: normalizeSpriteTranslation(config.translation),
            name: `${type}_${doorId}`,
            doorID: doorId,
            locked: false,
            open: false,
            collision: config.collision !== false,
            palette_locked: null,
            palette_unlocked: null,
            destructible: getDefaultDestructibleEnabled('doors', type),
            destructionHealth: getDefaultDestructibleHealth('doors', type),
            destructionSource: getDefaultDestructionSource('doors', type),
            paletteCycle: config.paletteCycle ? deepClone(config.paletteCycle) : undefined
        });
    }

    function getConvertTargetCategory(selection: Selection): DesignerCategory | null {
        if (selection.category === 'custom') {
            return canConvertCustomSpriteToButton(selection.entity as CustomSpriteInstance) ? 'buttons' : null;
        }
        if (selection.category === 'world') {
            if (state.category === 'buttons' || state.category === 'doors' || state.category === 'collectables' || state.category === 'creatures') {
                return state.category;
            }
            return 'collectables';
        }
        if (selection.category === 'collectables') {
            if (state.category === 'buttons' || state.category === 'doors' || state.category === 'world' || state.category === 'creatures') {
                return state.category;
            }
            return 'world';
        }
        if (selection.category === 'buttons' || selection.category === 'doors') {
            if (state.category === 'world' || state.category === 'collectables') {
                return state.category;
            }
        }
        if (selection.category === 'creatures') {
            if (state.category === 'world' || state.category === 'collectables') {
                return state.category;
            }
        }
        return null;
    }

    function getConvertActionLabel(selection: Selection): string {
        const target = getConvertTargetCategory(selection);
        if (!target) {
            return 'Convert';
        }
        return `Convert to ${categoryLabels[target].toLowerCase().replace(/^[a-z]/, (letter) => letter.toUpperCase())}`;
    }

    function getConvertActionMessage(targetCategory: DesignerCategory) {
        const label = categoryLabels[targetCategory].toLowerCase();
        return `Converted selection to ${label.endsWith('s') ? label : `a ${label}`}.`;
    }

    function getConvertTargetCategories(selection: Selection): DesignerCategory[] {
        if (selection.category === 'custom') {
            return canConvertCustomSpriteToButton(selection.entity as CustomSpriteInstance) ? ['buttons'] : [];
        }
        if (selection.category === 'world') {
            return ['collectables', 'creatures', 'buttons', 'doors'];
        }
        if (selection.category === 'collectables') {
            return ['world', 'creatures', 'buttons', 'doors'];
        }
        if (selection.category === 'buttons' || selection.category === 'doors' || selection.category === 'creatures') {
            return ['world', 'collectables'];
        }
        return [];
    }

    function convertSelectionToCategory(selection: Selection, targetCategory: DesignerCategory) {
        if (selection.category === targetCategory) {
            return;
        }
        const sourceArray = getCategoryArray(selection.category);
        const sourceIndex = sourceArray.indexOf(selection.entity);
        if (sourceIndex >= 0) {
            sourceArray.splice(sourceIndex, 1);
        }

        if (targetCategory === 'collectables') {
            const block = selection.entity as MapBlock;
            const blockPalette = typeof block.palette === 'number' ? block.palette : 0;
            const collectable = new Collectable({
                x: block.x,
                y: block.y,
                type: block.type,
                palette: blockPalette,
                rotation: normalizeRotation(block.rotation),
                name: block.type,
                weight: getDefaultCollectableWeight(block.type),
                pickupEnabled: true,
                storable: true,
                affectsAstronaut: true,
                collision: block.collision !== false,
                collected: false,
                paletteCycle: block.paletteCycle
                    ? deepClone(block.paletteCycle)
                    : getDefaultCollectablePaletteCycle(block.type, blockPalette, getPaletteCount())
            });
            getCategoryArray('collectables').push(collectable);
            setSelections([{ category: 'collectables', entity: collectable }]);
            return;
        }

        if (targetCategory === 'world') {
            const sourceEntity = selection.entity as Collectable | Button | Door | Creature;
            const block: MapBlock = {
                x: sourceEntity.x,
                y: sourceEntity.y,
                type: sourceEntity.type,
                palette: sourceEntity.palette ?? 0,
                rotation: normalizeRotation((sourceEntity as Collectable).defaultRotation ?? sourceEntity.rotation) as MapBlock['rotation'],
                translation: 'translation' in sourceEntity && typeof sourceEntity.translation === 'string'
                    ? normalizeSpriteTranslation(sourceEntity.translation)
                    : 'center',
                collision: sourceEntity.collision !== false,
                maskAstronaut: sourceEntity.collision === false,
                paletteCycle: sourceEntity.paletteCycle ? deepClone(sourceEntity.paletteCycle) : undefined
            };
            getCategoryArray('world').push(block);
            setSelections([{ category: 'world', entity: block }]);
            return;
        }

        const basePalette = typeof selection.entity.palette === 'number' ? selection.entity.palette : state.palette;
        const baseRotation = normalizeRotation(selection.entity.rotation);
        const baseCollision = 'collision' in selection.entity ? selection.entity.collision !== false : true;
        const basePaletteCycle = 'paletteCycle' in selection.entity ? selection.entity.paletteCycle : undefined;

        if (selection.category === 'custom' && targetCategory === 'buttons') {
            const button = buildButtonEntityFromCustomSpriteInstance(selection.entity as CustomSpriteInstance);
            getCategoryArray('buttons').push(button);
            setSelections([{ category: 'buttons', entity: button }]);
            return;
        }

        if (targetCategory === 'buttons') {
            const button = createButtonEntity({
                x: selection.entity.x,
                y: selection.entity.y,
                rotation: baseRotation,
                collision: baseCollision,
                active: false,
                linkedDoors: [],
                paletteCycle: basePaletteCycle
            });
            getCategoryArray('buttons').push(button);
            setSelections([{ category: 'buttons', entity: button }]);
            return;
        }

        if (targetCategory === 'doors') {
            const sourceType = typeof selection.entity.type === 'string' ? selection.entity.type : '';
            const resolvedDoorType = getDoorTypeFromSourceType(sourceType);
            const convertedDoorType = selection.category === 'world'
                ? sourceType
                : (resolvedDoorType ?? sourceType);
            const sourceTranslation = categorySupportsTranslation(selection.category)
                ? normalizeSpriteTranslation(selection.entity.translation)
                : 'center';
            const door = createDoorEntity({
                x: selection.entity.x,
                y: selection.entity.y,
                type: convertedDoorType || undefined,
                palette: basePalette,
                rotation: baseRotation,
                translation: sourceTranslation,
                collision: baseCollision,
                paletteCycle: basePaletteCycle
            });
            getCategoryArray('doors').push(door);
            setSelections([{ category: 'doors', entity: door }]);
            return;
        }

        if (targetCategory === 'creatures') {
            const creature = new Creature({
                x: selection.entity.x,
                y: selection.entity.y,
                type: selection.entity.type,
                palette: basePalette,
                rotation: baseRotation,
                translation: 'translation' in selection.entity && typeof selection.entity.translation === 'string'
                    ? normalizeSpriteTranslation(selection.entity.translation)
                    : 'center',
                state: {},
                paletteCycle: basePaletteCycle ? deepClone(basePaletteCycle) : undefined
            });
            getCategoryArray('creatures').push(creature);
            setSelections([{ category: 'creatures', entity: creature }]);
        }
    }

    return {
        getEffectiveButtonDefaultOverrides,
        setButtonDefaultOverridesFromButton,
        resetButtonDefaultOverrides,
        createButtonEntity,
        createCustomSpriteInstance,
        canConvertCustomSpriteToButton,
        getButtonCapOffsetsRelativeToBox,
        createDoorEntity,
        getConvertTargetCategory,
        getConvertActionLabel,
        getConvertActionMessage,
        getConvertTargetCategories,
        convertSelectionToCategory
    };
}
