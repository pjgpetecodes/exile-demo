import type { PaletteDefinition } from '../../designer/world-designer.js';

export function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

export async function fetchFreshJson<T>(url: string): Promise<T> {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

export function resolveColorAlias(
    color: string | [number, number, number],
    aliases: Record<string, [number, number, number]>
): [number, number, number] {
    if (typeof color === 'string') {
        return aliases[color] || [0, 0, 0];
    }
    return color;
}

export function mapPaletteDefinitions(
    definitions: PaletteDefinition[],
    aliases: Record<string, [number, number, number]>
) {
    return definitions.map((palette) =>
        palette.map(({ from, to }) => ({
            from: resolveColorAlias(from, aliases),
            to: resolveColorAlias(to, aliases)
        }))
    );
}
