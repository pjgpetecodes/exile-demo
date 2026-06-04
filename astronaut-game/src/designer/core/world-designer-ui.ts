export function parseDoorIds(value: string) {
    return value
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry));
}

export function parseStringIds(value: string) {
    return [...new Set(
        value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
    )];
}

export function parsePaletteCyclePalettes(value: string, paletteCount: number) {
    return [...new Set(
        value
            .split(',')
            .map((entry) => Number(entry.trim()))
            .filter((entry) => Number.isFinite(entry) && entry >= 0 && entry < paletteCount)
            .map((entry) => Math.round(entry))
    )];
}

export function isFormTarget(target: EventTarget | null) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
}

export function createDesignerStyles() {
    const style = document.createElement('style');
    style.dataset.designerStyle = 'true';
    style.textContent = `
        .world-designer-panel {
            position: fixed;
            top: 8px;
            right: 8px;
            width: 360px;
            max-height: calc(100vh - 16px);
            overflow: auto;
            z-index: 9999;
            background: rgba(10, 16, 22, 0.94);
            color: #f1f5f9;
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            font: 14px/1.4 system-ui, sans-serif;
            padding: 12px;
            backdrop-filter: blur(10px);
        }
        .world-designer-drag-handle {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            cursor: move;
            user-select: none;
        }
        .world-designer-drag-title {
            flex: 1 1 auto;
        }
        .world-designer-drag-active {
            user-select: none;
        }
        .world-designer-panel h2,
        .world-designer-panel h3 {
            margin: 0 0 8px;
            font-size: 13px;
        }
        .world-designer-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .world-designer-grid-wide {
            grid-column: 1 / -1;
        }
        .world-designer-section {
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            margin-top: 10px;
            padding-top: 10px;
        }
        .world-designer-accordion {
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.78);
            border: 1px solid rgba(148, 163, 184, 0.2);
            overflow: hidden;
        }
        .world-designer-accordion summary {
            cursor: pointer;
            padding: 10px 12px;
            color: #f8fafc;
            user-select: none;
            list-style: none;
            font-weight: 600;
        }
        .world-designer-accordion summary::-webkit-details-marker {
            display: none;
        }
        .world-designer-accordion summary::before {
            content: '▸';
            display: inline-block;
            margin-right: 8px;
            transition: transform 0.15s ease;
        }
        .world-designer-accordion[open] summary::before {
            transform: rotate(90deg);
        }
        .world-designer-accordion-body {
            padding: 0 12px 12px;
        }
        .world-designer-accordion-body > :first-child {
            margin-top: 0;
        }
        .world-designer-accordion-body > :last-child {
            margin-bottom: 0;
        }
        .world-designer-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 8px;
        }
        .world-designer-field input,
        .world-designer-field select,
        .world-designer-field textarea,
        .world-designer-panel button {
            font: inherit;
        }
        .world-designer-field input,
        .world-designer-field select,
        .world-designer-field textarea {
            width: 100%;
            box-sizing: border-box;
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            padding: 6px 8px;
        }
        .world-designer-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        .world-designer-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .world-designer-panel button,
        .world-designer-modal-card button {
            border-radius: 6px;
            border: 1px solid rgba(96, 165, 250, 0.22);
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
            color: #f8fafc;
            padding: 7px 12px;
            cursor: pointer;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 12px rgba(2, 6, 23, 0.22);
            transition: transform 0.08s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .world-designer-panel button:hover,
        .world-designer-modal-card button:hover {
            background: linear-gradient(180deg, rgba(51, 65, 85, 0.98), rgba(30, 41, 59, 0.98));
            border-color: rgba(96, 165, 250, 0.4);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 6px 16px rgba(2, 6, 23, 0.28);
        }
        .world-designer-panel button:active,
        .world-designer-modal-card button:active {
            transform: translateY(1px);
        }
        .world-designer-panel button:disabled,
        .world-designer-modal-card button:disabled {
            opacity: 0.45;
            cursor: default;
            transform: none;
            box-shadow: none;
        }
        .world-designer-modal-card .world-designer-button-primary,
        .world-designer-modal-card .world-designer-button-secondary,
        .world-designer-modal-card .world-designer-button-subtle {
            border-color: rgba(96, 165, 250, 0.22);
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
            color: #f8fafc;
        }
        .world-designer-button-primary {
            background: linear-gradient(180deg, rgba(14, 165, 233, 0.96), rgba(2, 132, 199, 0.96));
            border-color: rgba(125, 211, 252, 0.5);
            color: #eff6ff;
        }
        .world-designer-button-primary:hover {
            background: linear-gradient(180deg, rgba(56, 189, 248, 0.98), rgba(14, 165, 233, 0.98));
        }
        .world-designer-button-secondary {
            background: linear-gradient(180deg, rgba(37, 99, 235, 0.18), rgba(15, 23, 42, 0.98));
        }
        .world-designer-button-subtle {
            background: rgba(15, 23, 42, 0.7);
        }
        .world-designer-status {
            margin-top: 6px;
            padding: 6px 8px;
            border-radius: 6px;
            background: rgba(30, 41, 59, 0.6);
        }
        .world-designer-status.success {
            background: rgba(20, 83, 45, 0.7);
        }
        .world-designer-status.error {
            background: rgba(127, 29, 29, 0.8);
        }
        .world-designer-overview {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: #020617;
        }
        .world-designer-shortcuts {
            margin: 0;
            padding-left: 16px;
        }
        .world-designer-summary {
            color: #cbd5e1;
            margin-bottom: 6px;
        }
        .world-designer-sprite-preview {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .world-designer-sprite-canvas {
            width: 72px;
            height: 72px;
            flex: 0 0 auto;
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background:
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                rgba(2, 6, 23, 0.95);
            background-position: 0 0, 8px 8px, 0 0;
            background-size: 16px 16px;
            image-rendering: pixelated;
        }
        .world-designer-sprite-meta {
            min-width: 0;
            color: #cbd5e1;
            word-break: break-word;
        }
        .world-designer-sprite-picker {
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(148, 163, 184, 0.2);
            overflow: hidden;
        }
        .world-designer-sprite-picker summary {
            cursor: pointer;
            padding: 8px 10px;
            color: #f8fafc;
            user-select: none;
            list-style: none;
        }
        .world-designer-sprite-picker summary::-webkit-details-marker {
            display: none;
        }
        .world-designer-sprite-picker summary::before {
            content: '▸';
            display: inline-block;
            margin-right: 8px;
            transition: transform 0.15s ease;
        }
        .world-designer-sprite-picker[open] summary::before {
            transform: rotate(90deg);
        }
        .world-designer-sprite-picker-body {
            max-height: 280px;
            overflow-x: hidden;
            overflow-y: auto;
            padding: 0 8px 8px;
            box-sizing: border-box;
            min-width: 0;
        }
        .world-designer-sprite-picker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
            gap: 8px;
            width: 100%;
            min-width: 0;
        }
        .world-designer-sprite-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            width: 100%;
            box-sizing: border-box;
            padding: 6px;
            min-width: 0;
            text-align: center;
            overflow: hidden;
        }
        .world-designer-sprite-option.selected {
            border-color: rgba(56, 189, 248, 0.9);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
            background: rgba(14, 116, 144, 0.25);
        }
        .world-designer-sprite-option.dragging {
            opacity: 0.55;
            cursor: grabbing;
        }
        .world-designer-sprite-option-label {
            width: 100%;
            font-size: 11px;
            color: #cbd5e1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .world-designer-modal {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(2, 6, 23, 0.7);
        }
        .world-designer-modal.open {
            display: flex;
        }
        .world-designer-modal-card {
            width: min(92vw, 900px);
            max-height: 88vh;
            overflow: auto;
            border-radius: 12px;
            background: #0f172a;
            color: #f8fafc;
            border: 1px solid rgba(148, 163, 184, 0.35);
            padding: 16px;
            font: 12px/1.4 system-ui, sans-serif;
        }
        .world-designer-modal-card.world-designer-modal-card-import {
            width: min(96vw, 1380px);
            max-height: 92vh;
        }
        .world-designer-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
        }
        .world-designer-import-layout {
            display: grid;
            grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
            gap: 18px;
            align-items: start;
        }
        .world-designer-import-sidebar,
        .world-designer-import-main {
            min-width: 0;
        }
        .world-designer-import-card {
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(15, 23, 42, 0.55);
            padding: 12px;
            margin-bottom: 12px;
        }
        .world-designer-import-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        }
        .world-designer-import-tab {
            border-radius: 999px;
            padding: 8px 14px;
        }
        .world-designer-import-tab.selected {
            border-color: rgba(56, 189, 248, 0.9);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
            background: rgba(8, 47, 73, 0.75);
        }
        .world-designer-import-paths {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
        }
        .world-designer-import-path {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding: 12px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.24);
            background: rgba(15, 23, 42, 0.72);
            text-align: left;
        }
        .world-designer-import-path strong {
            font-size: 13px;
        }
        .world-designer-import-path span {
            color: #cbd5e1;
        }
        .world-designer-import-path.selected {
            border-color: rgba(56, 189, 248, 0.9);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
            background: rgba(8, 47, 73, 0.75);
        }
        .world-designer-import-card:last-child {
            margin-bottom: 0;
        }
        .world-designer-import-progress {
            display: grid;
            gap: 8px;
            margin-top: 8px;
        }
        .world-designer-import-progress[hidden] {
            display: none;
        }
        .world-designer-import-progress progress {
            width: 100%;
            height: 12px;
            accent-color: #38bdf8;
        }
        .world-designer-import-progress-actions {
            display: flex;
            justify-content: flex-end;
        }
        .world-designer-import-toolbar {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
        }
        .world-designer-import-zoom-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        .world-designer-import-zoom-label {
            color: #cbd5e1;
            min-width: 70px;
        }
        .world-designer-png-preview-frame {
            margin: 8px 0;
            max-height: 70vh;
            min-height: 420px;
            overflow: auto;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            background:
                linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
                linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
                rgba(2, 6, 23, 0.95);
            background-position: 0 0, 8px 8px, 0 0;
            background-size: 16px 16px;
        }
        .world-designer-png-preview-canvas {
            display: block;
            image-rendering: pixelated;
            cursor: crosshair;
        }
        .world-designer-png-preview-frame.busy,
        .world-designer-import-card.busy {
            opacity: 0.68;
        }
        @media (max-width: 1080px) {
            .world-designer-import-layout {
                grid-template-columns: 1fr;
            }
            .world-designer-png-preview-frame {
                min-height: 320px;
            }
        }
        .world-designer-context-menu {
            position: fixed;
            z-index: 10001;
            display: none;
            min-width: 220px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.96);
            border: 1px solid rgba(148, 163, 184, 0.35);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
            padding: 6px;
            font: 12px/1.4 system-ui, sans-serif;
        }
        .world-designer-context-menu.open {
            display: block;
        }
        .world-designer-context-menu button {
            display: block;
            width: 100%;
            text-align: left;
            margin: 0;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #f8fafc;
            padding: 8px 10px;
        }
        .world-designer-context-menu button:hover {
            background: rgba(51, 65, 85, 0.95);
        }
        .world-designer-context-toggle-action {
            white-space: nowrap;
        }
        .world-designer-context-toggle-check {
            display: inline-block;
            width: 14px;
            margin-right: 8px;
            color: #38bdf8;
            text-align: center;
        }
        .world-designer-context-menu button:disabled {
            opacity: 0.45;
            cursor: default;
        }
        .world-designer-context-menu hr {
            border: 0;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            margin: 6px 0;
        }
        .world-designer-context-submenu {
            margin: 2px 0;
        }
        .world-designer-context-submenu > summary {
            display: block;
            border-radius: 6px;
            color: #f8fafc;
            padding: 8px 10px;
            cursor: pointer;
            list-style: none;
            user-select: none;
        }
        .world-designer-context-submenu > summary::-webkit-details-marker {
            display: none;
        }
        .world-designer-context-submenu > summary:hover {
            background: rgba(51, 65, 85, 0.95);
        }
        .world-designer-context-submenu > summary::after {
            content: '▸';
            float: right;
            color: #cbd5e1;
        }
        .world-designer-context-submenu[open] > summary::after {
            content: '▾';
        }
        .world-designer-context-submenu-body {
            display: grid;
            gap: 4px;
            max-height: 220px;
            overflow: auto;
            padding: 4px 0 4px 12px;
        }
        .world-designer-context-palette-option {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            text-align: left;
            margin: 0;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #f8fafc;
            padding: 6px 8px;
        }
        .world-designer-context-palette-option:hover {
            background: rgba(51, 65, 85, 0.95);
        }
        .world-designer-context-palette-option.selected {
            background: rgba(14, 116, 144, 0.25);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
        }
        .world-designer-context-palette-canvas {
            width: 36px;
            height: 36px;
            flex: 0 0 auto;
            border-radius: 4px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background:
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                rgba(2, 6, 23, 0.95);
            background-position: 0 0, 6px 6px, 0 0;
            background-size: 12px 12px;
            image-rendering: pixelated;
        }
        .world-designer-context-palette-label {
            color: #cbd5e1;
        }
        .world-designer-pre {
            margin: 8px 0 12px;
            padding: 10px;
            overflow: auto;
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.25);
            max-height: 240px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .world-designer-hidden {
            display: none !important;
        }
        .world-designer-flyout {
            position: fixed;
            top: 8px;
            right: 384px;
            width: 420px;
            max-height: calc(100vh - 16px);
            overflow: auto;
            z-index: 9998;
            background: rgba(10, 16, 22, 0.96);
            color: #f1f5f9;
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            padding: 12px;
            backdrop-filter: blur(10px);
            font: 12px/1.4 system-ui, sans-serif;
        }
        .world-designer-flyout-hidden {
            display: none !important;
        }
        .world-designer-palette-preview {
            width: 100%;
            height: 120px;
        }
        .world-designer-palette-list {
            min-height: 160px;
        }
        .world-designer-palette-mappings {
            display: grid;
            gap: 8px;
        }
        .world-designer-palette-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
            gap: 8px;
            align-items: end;
        }
        `;
    document.head.appendChild(style);
    return style;
}

