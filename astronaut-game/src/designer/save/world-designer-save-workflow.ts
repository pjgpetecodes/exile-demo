import type {
    ControlRefs,
    DesignerState,
    PaletteDefinition,
    RawWorldData,
    SavePreviewFile,
    SavePreviewState,
    SpriteSheetNormalizationReport,
    WorldDesignerHost
} from '../core/world-designer-types.js';

type CreateWorldDesignerSaveWorkflowContext = {
    refs: ControlRefs;
    state: DesignerState;
    host: WorldDesignerHost;
    spriteTypes: string[];
    getPaletteCount: () => number;
    getAuthoredWorldSnapshot: () => RawWorldData;
    getWorldSnapshotForValidationAndSave: () => Promise<RawWorldData>;
    stableStringify: (value: unknown) => string;
    snapshotsEqual: (left: RawWorldData, right: RawWorldData) => boolean;
    paletteDefinitionsEqual: (left: PaletteDefinition[], right: PaletteDefinition[]) => boolean;
    deepClone: <T>(value: T) => T;
    serializeWorldData: (value: RawWorldData) => RawWorldData;
    syncPaletteCount: () => void;
    refreshSelectOptions: () => void;
    refreshPaletteDesigner: () => void;
    syncEditModeSnapshot: () => void;
    updateDirtyState: () => void;
    closeModal: () => void;
    setStatus: (message: string, tone?: DesignerState['statusTone']) => void;
    refreshPanel: () => void;
    setModalConfirmAction: (action: (() => void | Promise<void>) | null) => void;
};

const SAVE_FILE_LABELS: Record<keyof RawWorldData, string> = {
    worldMap: 'world_chunks/manifest.json (+ chunk files)',
    buttons: 'buttons.json',
    doors: 'doors.json',
    creatures: 'creatures.json',
    collectables: 'collectables.json',
    teleporters: 'teleporters.json',
    windEmitters: 'wind_emitters.json',
    windSettings: 'wind_settings.json',
    astronautStart: 'astronaut_start.json'
};
const PALETTE_FILE_LABEL = 'palettes.json';

function formatRgb(color: [number, number, number]) {
    return `${color[0]}, ${color[1]}, ${color[2]}`;
}

export function createWorldDesignerSaveWorkflow(context: CreateWorldDesignerSaveWorkflowContext) {
    const {
        refs,
        state,
        host,
        spriteTypes,
        getPaletteCount,
        getAuthoredWorldSnapshot,
        getWorldSnapshotForValidationAndSave,
        stableStringify,
        snapshotsEqual,
        paletteDefinitionsEqual,
        deepClone,
        serializeWorldData,
        syncPaletteCount,
        refreshSelectOptions,
        refreshPaletteDesigner,
        syncEditModeSnapshot,
        updateDirtyState,
        closeModal,
        setStatus,
        refreshPanel,
        setModalConfirmAction
    } = context;

    function buildSavePreview(snapshot: RawWorldData, options?: { strictTeleporterValidation?: boolean }): SavePreviewState {
        const errors: string[] = [];
        const strictTeleporterValidation = options?.strictTeleporterValidation !== false;
        const spriteTypeSet = new Set(spriteTypes);
        const paletteMax = getPaletteCount() - 1;
        const palettesChanged = !paletteDefinitionsEqual(state.paletteDefinitions, state.lastSavedPaletteDefinitions);

        const doorIds = new Set<number>();
        const duplicateDoorIds = new Set<number>();
        for (const door of snapshot.doors) {
            const doorID = door.doorID ?? -1;
            if (doorIds.has(doorID)) duplicateDoorIds.add(doorID);
            doorIds.add(doorID);
        }

        if (duplicateDoorIds.size > 0) {
            errors.push(`Duplicate door IDs: ${[...duplicateDoorIds].join(', ')}`);
        }

        const validateSpriteAndPalette = (
            categoryLabel: string,
            entry: { type: string; palette?: string | number },
            index: number
        ) => {
            if (!spriteTypeSet.has(entry.type)) {
                errors.push(`${categoryLabel} #${index + 1} uses unknown sprite type "${entry.type}".`);
            }
            if (typeof entry.palette === 'number' && (entry.palette < 0 || entry.palette > paletteMax)) {
                errors.push(`${categoryLabel} #${index + 1} uses palette ${entry.palette}, outside 0-${paletteMax}.`);
            }
        };

        snapshot.worldMap.forEach((entry, index) => validateSpriteAndPalette('World item', entry, index));
        snapshot.buttons.forEach((entry, index) => {
            validateSpriteAndPalette('Button', entry, index);
            for (const linkedDoor of entry.linkedDoors ?? []) {
                if (!doorIds.has(linkedDoor)) {
                    errors.push(`Button #${index + 1} links to missing door ID ${linkedDoor}.`);
                }
            }
        });
        snapshot.doors.forEach((entry, index) => validateSpriteAndPalette('Door', entry, index));
        snapshot.creatures.forEach((entry, index) => validateSpriteAndPalette('Creature', entry, index));
        snapshot.collectables.forEach((entry, index) => validateSpriteAndPalette('Collectable', entry, index));
        const teleporterIds = new Set<string>();
        const duplicateTeleporterIds = new Set<string>();
        for (const teleporter of snapshot.teleporters) {
            if (teleporterIds.has(teleporter.id)) {
                duplicateTeleporterIds.add(teleporter.id);
            }
            teleporterIds.add(teleporter.id);
        }
        if (duplicateTeleporterIds.size > 0) {
            errors.push(`Duplicate teleporter IDs: ${[...duplicateTeleporterIds].join(', ')}`);
        }
        snapshot.teleporters.forEach((teleporter, index) => {
            if (strictTeleporterValidation) {
                if (!snapshot.worldMap.some((block) => block.x === teleporter.baseX && block.y === teleporter.baseY && block.type === 'teleporter')) {
                    errors.push(`Teleporter #${index + 1} base sprite is missing at (${teleporter.baseX}, ${teleporter.baseY}).`);
                }
                if (!snapshot.worldMap.some((block) => block.x === teleporter.padX && block.y === teleporter.padY && block.type === 'teleporter_pad')) {
                    errors.push(`Teleporter #${index + 1} pad sprite is missing at (${teleporter.padX}, ${teleporter.padY}).`);
                }
            }
            if (!Number.isFinite(teleporter.destinationA.x) || !Number.isFinite(teleporter.destinationA.y)) {
                errors.push(`Teleporter #${index + 1} destination A must have numeric x and y.`);
            }
            if (teleporter.destinationB && (!Number.isFinite(teleporter.destinationB.x) || !Number.isFinite(teleporter.destinationB.y))) {
                errors.push(`Teleporter #${index + 1} destination B must have numeric x and y.`);
            }
            if (teleporter.activeDestinationIndex === 1 && !teleporter.destinationB) {
                errors.push(`Teleporter #${index + 1} is set to destination B but has no destination B.`);
            }
        });
        snapshot.buttons.forEach((entry, index) => {
            for (const linkedTeleporterId of entry.linkedTeleporters ?? []) {
                if (!teleporterIds.has(linkedTeleporterId)) {
                    errors.push(`Button #${index + 1} links to missing teleporter "${linkedTeleporterId}".`);
                }
            }
        });
        if (!Number.isFinite(snapshot.astronautStart.x) || !Number.isFinite(snapshot.astronautStart.y)) {
            errors.push('Astronaut start position must have numeric x and y values.');
        }

        const files: SavePreviewFile[] = (Object.keys(snapshot) as Array<keyof RawWorldData>).map((key) => {
            const currentJson = stableStringify(snapshot[key]);
            const previousJson = stableStringify(state.lastSavedSnapshot[key]);
            return {
                key,
                label: SAVE_FILE_LABELS[key],
                changed: currentJson !== previousJson,
                json: currentJson
            };
        });
        files.push({
            key: 'palettes',
            label: PALETTE_FILE_LABEL,
            changed: palettesChanged,
            json: stableStringify(state.paletteDefinitions)
        });

        return { files, errors };
    }

    async function renderSavePreview() {
        refs.modalConfirm.disabled = true;
        refs.modalBody.innerHTML = '<p>Preparing save preview…</p>';
        const snapshot = getAuthoredWorldSnapshot();
        const preview = buildSavePreview(snapshot, { strictTeleporterValidation: false });
        refs.modalBody.innerHTML = '';

        const summary = document.createElement('div');
        const changedFiles = preview.files.filter((file) => file.changed);
        summary.innerHTML = `
            <p>${changedFiles.length === 0 ? 'No asset files have changed.' : `The following file(s) will be updated: <strong>${changedFiles.map((file) => file.label).join(', ')}</strong>.`}</p>
            <p>Use this dialog as a pre-save review. If the JSON looks right, confirm the save.</p>
            <p>Full teleporter placement validation runs on save.</p>
        `;
        refs.modalBody.appendChild(summary);

        if (preview.errors.length > 0) {
            const errorTitle = document.createElement('h3');
            errorTitle.textContent = 'Validation issues';
            refs.modalBody.appendChild(errorTitle);

            const list = document.createElement('ul');
            for (const error of preview.errors) {
                const item = document.createElement('li');
                item.textContent = error;
                list.appendChild(item);
            }
            refs.modalBody.appendChild(list);
        }

        for (const file of preview.files) {
            if (!file.changed) continue;
            const title = document.createElement('h3');
            title.textContent = file.label;
            refs.modalBody.appendChild(title);

            const pre = document.createElement('pre');
            pre.className = 'world-designer-pre';
            pre.textContent = file.json;
            refs.modalBody.appendChild(pre);
        }

        refs.modalConfirm.disabled = preview.errors.length > 0 || changedFiles.length === 0;
    }

    function renderSpriteSheetNormalizationPreview(report: SpriteSheetNormalizationReport) {
        refs.modalBody.innerHTML = '';

        const summary = document.createElement('div');
        summary.innerHTML = `
            <p>This will rewrite <strong>sprite_sheet.png</strong> by snapping sprite pixels to the nearest proper color from <strong>colors.json</strong>.</p>
            <p>Only pixels inside the sprite rectangles from <strong>exile_sprites_map.json</strong> are touched. Grid lines and separators are left unchanged.</p>
            <p><strong>${report.changedPixels}</strong> of <strong>${report.scannedPixels}</strong> scanned sprite pixels will change across <strong>${report.changedSourceColors}</strong> off-palette source colors in <strong>${report.spriteCount}</strong> mapped sprite slots.</p>
        `;
        refs.modalBody.appendChild(summary);

        if (report.replacements.length > 0) {
            const title = document.createElement('h3');
            title.textContent = 'Most common replacements';
            refs.modalBody.appendChild(title);

            const list = document.createElement('ul');
            for (const replacement of report.replacements.slice(0, 12)) {
                const item = document.createElement('li');
                item.textContent = `${formatRgb(replacement.from)} -> ${replacement.toAlias} (${formatRgb(replacement.to)}) x ${replacement.count}`;
                list.appendChild(item);
            }
            refs.modalBody.appendChild(list);
        } else {
            const note = document.createElement('p');
            note.textContent = 'The sprite sheet already matches the proper palette colors in all mapped sprite areas.';
            refs.modalBody.appendChild(note);
        }

        refs.modalConfirm.disabled = report.changedPixels === 0;
    }

    async function saveFromPreview() {
        const snapshot = await getWorldSnapshotForValidationAndSave();
        const preview = buildSavePreview(snapshot, { strictTeleporterValidation: true });
        if (preview.errors.length > 0) {
            setStatus('Resolve the validation issues before saving.', 'error');
            await renderSavePreview();
            return;
        }
        const liveAstronautPosition = host.getFocusWorldPosition();
        const astronautStartChanged =
            snapshot.astronautStart.x !== state.lastSavedSnapshot.astronautStart.x ||
            snapshot.astronautStart.y !== state.lastSavedSnapshot.astronautStart.y;
        const palettesChanged = !paletteDefinitionsEqual(state.paletteDefinitions, state.lastSavedPaletteDefinitions);
        const worldChanged = !snapshotsEqual(snapshot, state.lastSavedSnapshot);
        try {
            if (palettesChanged) {
                await host.savePaletteDefinitions(state.paletteDefinitions, worldChanged ? snapshot : undefined);
                state.lastSavedPaletteDefinitions = deepClone(state.paletteDefinitions);
                syncPaletteCount();
                refreshSelectOptions();
                refreshPaletteDesigner();
            } else {
                await host.saveWorldData(snapshot);
            }
            state.lastSavedSnapshot = snapshot;
            if (state.mode === 'edit') {
                syncEditModeSnapshot();
            } else {
                state.editModeSnapshot = {
                    worldData: serializeWorldData(snapshot),
                    customSpriteDefinitions: deepClone(state.customSpriteDefinitions),
                    customSpriteInstances: deepClone(state.customSpriteInstances)
                };
            }
            if (!astronautStartChanged) {
                host.resetAstronautToPosition(liveAstronautPosition);
            }
            updateDirtyState();
            closeModal();
            setStatus(
                astronautStartChanged
                    ? 'Saved designer changes, including the astronaut start position.'
                    : 'Saved designer changes and restored the live astronaut to the current working position.',
                'success'
            );
            refreshPanel();
        } catch (error) {
            setStatus(
                error instanceof Error ? error.message : 'Failed to save world data.',
                'error'
            );
        }
    }

    async function normalizeSpriteSheetColors() {
        try {
            refs.modalConfirm.disabled = true;
            setStatus('Normalizing sprite sheet colors...', 'neutral');
            const report = await host.normalizeSpriteSheetColors();
            closeModal();
            setStatus(
                report.changedPixels === 0
                    ? 'sprite_sheet.png already matches the proper palette colors in mapped sprite areas.'
                    : `Normalized ${report.changedPixels} sprite pixel${report.changedPixels === 1 ? '' : 's'} in sprite_sheet.png. Grid lines were left untouched.`,
                'success'
            );
        } catch (error) {
            refs.modalConfirm.disabled = false;
            setStatus(
                error instanceof Error ? error.message : 'Failed to normalize sprite_sheet.png.',
                'error'
            );
        }
    }

    async function openSpriteSheetNormalizationPreview() {
        refs.modalTitle.textContent = 'Normalize sprite sheet colors';
        refs.modalConfirm.textContent = 'Normalize sprite sheet';
        refs.modalBody.innerHTML = '<p>Analyzing sprite_sheet.png...</p>';
        refs.modalConfirm.disabled = true;
        refs.modal.classList.add('open');
        setModalConfirmAction(() => normalizeSpriteSheetColors());

        try {
            const report = await host.previewSpriteSheetNormalization();
            renderSpriteSheetNormalizationPreview(report);
        } catch (error) {
            refs.modal.classList.remove('open');
            setModalConfirmAction(null);
            setStatus(
                error instanceof Error ? error.message : 'Failed to analyze sprite_sheet.png.',
                'error'
            );
        }
    }

    function openSavePreview() {
        state.savePreviewOpen = true;
        refs.modalTitle.textContent = 'Preview before save';
        refs.modalConfirm.textContent = 'Save changes';
        void renderSavePreview().catch((error) => {
            refs.modalBody.innerHTML = '';
            const message = error instanceof Error ? error.message : 'Failed to prepare save preview.';
            const summary = document.createElement('div');
            summary.innerHTML = `<p>${message}</p>`;
            refs.modalBody.appendChild(summary);
            refs.modalConfirm.disabled = true;
        });
        setModalConfirmAction(() => saveFromPreview());
        refs.modal.classList.add('open');
    }

    return {
        buildSavePreview,
        renderSavePreview,
        renderSpriteSheetNormalizationPreview,
        saveFromPreview,
        normalizeSpriteSheetColors,
        openSpriteSheetNormalizationPreview,
        openSavePreview
    };
}
