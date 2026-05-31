import {
    PaletteDefinition,
    RawWorldData,
    SpriteSheetNormalizationReport
} from '../../designer/world-designer.js';

type GameDesignerSaveApiOptions = {
    applyPaletteDefinitions: (paletteDefinitions: PaletteDefinition[]) => void;
};

async function postDesignerSaveRequest(url: string, body: unknown) {
    try {
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    } catch {
        throw new Error('This save/normalize feature is only available when the local designer save server is running on port 3001. The deployed app can still load and play normally.');
    }
}

async function getDesignerSaveError(res: Response, fallbackMessage: string, unavailableMessage?: string) {
    let message = fallbackMessage;
    try {
        const text = await res.text();
        if (text) {
            try {
                const payload = JSON.parse(text) as { error?: string };
                if (payload?.error) {
                    message = payload.error;
                } else {
                    message = text;
                }
            } catch {
                message = text;
            }
        }
    } catch {
        message = fallbackMessage;
    }

    if (res.status === 404) {
        return unavailableMessage ?? 'This designer save feature is unavailable because the local save server is out of date. Restart the dev/save server on port 3001 and try again.';
    }

    return message;
}

async function postSpriteSheetNormalization(dryRun: boolean): Promise<SpriteSheetNormalizationReport> {
    const res = await postDesignerSaveRequest('http://localhost:3001/normalize-sprite-sheet', { dryRun });
    if (!res.ok) {
        throw new Error(await getDesignerSaveError(
            res,
            dryRun ? 'Failed to analyze sprite_sheet.png.' : 'Failed to normalize sprite_sheet.png.',
            'Sprite-sheet normalization is unavailable because the local save server is out of date. Restart the dev/save server on port 3001 and try again.'
        ));
    }

    const payload = await res.json() as { report: SpriteSheetNormalizationReport };
    return payload.report;
}

export function createGameDesignerSaveApi(options: GameDesignerSaveApiOptions) {
    async function saveWorldData(data: RawWorldData) {
        const res = await postDesignerSaveRequest('http://localhost:3001/save-world-data', data);
        if (!res.ok) {
            throw new Error(await getDesignerSaveError(res, 'Failed to save world data.'));
        }
        try {
            const payload = await res.clone().json() as { files?: string[] };
            const files = Array.isArray(payload.files) ? payload.files : [];
            if (!files.includes('teleporters.json')) {
                throw new Error('The local designer save server is out of date and did not save teleporters.json. Restart the save server on port 3001 and try again.');
            }
            if (!files.includes('wind_emitters.json') || !files.includes('wind_settings.json')) {
                throw new Error('The local designer save server is out of date and did not save wind_emitters.json / wind_settings.json. Restart the save server on port 3001 and try again.');
            }
        } catch (error) {
            if (
                error instanceof Error &&
                (error.message.includes('teleporters.json') || error.message.includes('wind_emitters.json'))
            ) {
                throw error;
            }
        }
    }

    async function savePaletteDefinitions(paletteDefinitions: PaletteDefinition[], worldData?: RawWorldData) {
        const res = await postDesignerSaveRequest('http://localhost:3001/save-designer-assets', {
            palettes: paletteDefinitions,
            ...(worldData ? { worldData } : {})
        });
        if (!res.ok) {
            throw new Error(await getDesignerSaveError(res, 'Failed to save palette data.'));
        }
        options.applyPaletteDefinitions(paletteDefinitions);
    }

    async function previewSpriteSheetNormalization() {
        return postSpriteSheetNormalization(true);
    }

    async function normalizeSpriteSheetColors() {
        return postSpriteSheetNormalization(false);
    }

    return {
        saveWorldData,
        savePaletteDefinitions,
        previewSpriteSheetNormalization,
        normalizeSpriteSheetColors
    };
}
