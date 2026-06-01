import { describe, expect, it, vi } from 'vitest';
import {
    blockBrowserShortcut,
    getInputKey,
    shouldBlockBrowserShortcut,
    shouldPreventGameplayDefault
} from '../../../src/game/input/game-input';

function makeKeyboardEventLike(partial: Partial<KeyboardEvent>): KeyboardEvent {
    return {
        key: '',
        code: '',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
        ...partial
    } as KeyboardEvent;
}

describe('game input normalization', () => {
    it('maps space and shifted quote keys correctly', () => {
        expect(getInputKey(makeKeyboardEventLike({ code: 'Space', key: ' ' }))).toBe(' ');
        expect(getInputKey(makeKeyboardEventLike({ code: 'Quote', key: '"', shiftKey: true }))).toBe('@');
        expect(getInputKey(makeKeyboardEventLike({ code: 'ArrowLeft', key: 'ArrowLeft' }))).toBe('q');
        expect(getInputKey(makeKeyboardEventLike({ code: 'ArrowRight', key: 'ArrowRight' }))).toBe('w');
        expect(getInputKey(makeKeyboardEventLike({ code: 'KeyQ', key: 'Q' }))).toBe('q');
    });

    it('blocks browser shortcuts for print/save hotkeys', () => {
        expect(shouldBlockBrowserShortcut(makeKeyboardEventLike({ ctrlKey: true, key: 'p', code: 'KeyP' }))).toBe(true);
        expect(shouldBlockBrowserShortcut(makeKeyboardEventLike({ metaKey: true, key: 'w', code: 'KeyW' }))).toBe(true);
        expect(shouldBlockBrowserShortcut(makeKeyboardEventLike({ ctrlKey: true, key: 'q', code: 'KeyQ' }))).toBe(false);
    });

    it('prevents default browser behavior for gameplay keys when designer is closed', () => {
        expect(shouldPreventGameplayDefault(makeKeyboardEventLike({ key: 'q', code: 'KeyQ' }), false)).toBe(true);
        expect(shouldPreventGameplayDefault(makeKeyboardEventLike({ key: 'ArrowLeft', code: 'ArrowLeft' }), false)).toBe(true);
        expect(shouldPreventGameplayDefault(makeKeyboardEventLike({ key: 'Tab', code: 'Tab' }), false)).toBe(true);
        expect(shouldPreventGameplayDefault(makeKeyboardEventLike({ key: 'q', code: 'KeyQ' }), true)).toBe(false);
    });

    it('actively blocks shortcut event propagation', () => {
        const event = makeKeyboardEventLike({ ctrlKey: true, key: 'w', code: 'KeyW' });
        expect(blockBrowserShortcut(event)).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopImmediatePropagation).toHaveBeenCalled();
    });
});
