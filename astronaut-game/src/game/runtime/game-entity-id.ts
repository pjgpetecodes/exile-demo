export let nextEntityId = 1;

export function assignEntityId<T>(obj: T): T {
    (obj as { entityId?: number }).entityId = nextEntityId++;
    return obj;
}
