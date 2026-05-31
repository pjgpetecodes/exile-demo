// Centralized UI event wiring for the designer panel.
export function bindWorldDesignerEventHandlers(context: any) {
    const {
        refs,
        state,
        host,
        paletteCount,
        colorAliasNames,
        CATEGORY_LABELS,
        clamp,
        normalizeRotation,
        normalizeSpriteTranslation,
        categorySupportsTranslation,
        isTeleporterCompositeType,
        isButtonCompositeType,
        getSingleEditableSelection,
        getCustomSpriteDefinitionById,
        runMutation,
        updateSelectionFromInspectorState,
        setCurrentType,
        renderSpritePickerGrid,
        persistDesignerUiState,
        applyEntityRotationWithTeleporterSync,
        renderCurrentSpritePreview,
        getSelectedItems,
        refreshModifierSnapInteraction,
        setSnapOffsets,
        setSnapOffsetsFromPosition,
        refreshPanel,
        setStatus,
        setViewportExpanded,
        createNewPalette,
        cloneSelectedPalette,
        deleteSelectedPalette,
        savePaletteDesigner,
        restoreEditModeSnapshot,
        refreshPaletteDesigner,
        invalidateOverviewBase,
        openSavePreview,
        openPngImportModal,
        deleteSelection,
        duplicateSelection,
        reorderSelections,
        focusSelection,
        convertSelection,
        focusOnCurrentWorldPosition,
        moveLiveAstronautToViewCenter,
        placeAtWorld,
        setAstronautStartToViewCenter,
        openSpriteSheetNormalizationPreview,
        closeModal,
        modalConfirmActionRef,
        closeContextMenu,
        handleOverviewMouseDown,
        handleOverviewMouseMove,
        handleOverviewMouseUp,
        getCanvasPoint,
        screenToWorld,
        getEntityAt,
        openContextMenu,
        openEmptyContextMenu,
        handleCanvasMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseLeave,
        handleCanvasMouseUp,
        handleKeyDown,
        handleKeyUp,
        handleWindowMouseDown,
        handleWindowBeforeUnload,
        resizeExpandedViewport,
        applyDesignerOverlayZoomCompensation
    } = context;

    refs.activeToggle.addEventListener('click', () => {
        context.setDesignerActive(!state.active);
    });
    refs.paletteDesignerToggle.addEventListener('click', () => {
        state.paletteDesignerOpen = !state.paletteDesignerOpen;
        refreshPanel();
    });
    refs.paletteFlyoutClose.addEventListener('click', () => {
        state.paletteDesignerOpen = false;
        refreshPanel();
    });
    refs.paletteList.addEventListener('change', () => {
        state.selectedPaletteIndex = clamp(Number(refs.paletteList.value) || 0, 0, paletteCount - 1);
        refreshPaletteDesigner();
        persistDesignerUiState();
    });
    refs.palettePreviewTypeSelect.addEventListener('change', () => {
        state.palettePreviewType = refs.palettePreviewTypeSelect.value;
        refreshPaletteDesigner();
        persistDesignerUiState();
    });
    refs.paletteNewButton.addEventListener('click', createNewPalette);
    refs.paletteCloneButton.addEventListener('click', cloneSelectedPalette);
    refs.paletteDeleteButton.addEventListener('click', () => {
        void deleteSelectedPalette();
    });
    refs.paletteAddMappingButton.addEventListener('click', () => {
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex];
        if (!paletteDefinition) return;
        paletteDefinition.push({
            from: colorAliasNames[0] ?? 'White',
            to: colorAliasNames[0] ?? 'White'
        });
        refreshPaletteDesigner();
    });
    refs.paletteSaveButton.addEventListener('click', () => {
        void savePaletteDesigner();
    });

    refs.modeSelect.addEventListener('change', () => {
        state.mode = refs.modeSelect.value;
        if (state.mode === 'edit' && restoreEditModeSnapshot()) {
            setStatus('Restored the authored world state for editing.', 'neutral');
        }
        state.liveResumeSnapshot = null;
        refreshPanel();
    });
    refs.toolSelect.addEventListener('change', () => {
        state.tool = refs.toolSelect.value;
        refreshPanel();
    });
    refs.categorySelect.addEventListener('change', () => {
        state.category = refs.categorySelect.value;
        setCurrentType(state.typeByCategory[state.category]);
        refreshPanel();
    });
    refs.typeSelect.addEventListener('change', () => {
        if (
            isTeleporterCompositeType(refs.typeSelect.value) ||
            isButtonCompositeType(refs.typeSelect.value)
        ) {
            setCurrentType(refs.typeSelect.value);
            return;
        }
        const selection = getSingleEditableSelection();
        if (selection) {
            if (selection.category === 'custom') {
                const definition = getCustomSpriteDefinitionById(refs.typeSelect.value);
                if (!definition) {
                    return;
                }
                runMutation('Updated custom sprite type.', () => {
                    selection.entity.customSpriteId = definition.id;
                    selection.entity.type = definition.name;
                    state.typeByCategory.custom = definition.id;
                });
                updateSelectionFromInspectorState();
                return;
            }
            runMutation('Updated sprite type.', () => {
                selection.entity.type = refs.typeSelect.value;
                state.typeByCategory[selection.category] = refs.typeSelect.value;
            });
            updateSelectionFromInspectorState();
            return;
        }
        setCurrentType(refs.typeSelect.value);
    });
    refs.spritePicker.addEventListener('toggle', () => {
        state.spritePickerOpen = refs.spritePicker.open;
    });
    refs.spritePickerFilter.addEventListener('input', () => {
        state.spritePickerFilter = refs.spritePickerFilter.value;
        if (state.spritePickerFilter.trim().length > 0) {
            refs.spritePickerCategoryFilter.value = 'all';
        }
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.spritePickerCategoryFilter.addEventListener('change', () => {
        state.spritePickerCategoryFilter = refs.spritePickerCategoryFilter.value;
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.rotationSelect.addEventListener('change', () => {
        const rotation = normalizeRotation(Number(refs.rotationSelect.value));
        const selection = getSingleEditableSelection();
        if (selection) {
            runMutation('Updated rotation.', () => {
                applyEntityRotationWithTeleporterSync(selection.entity, rotation);
                if (selection.category === 'creatures') {
                    selection.entity.state = selection.entity.state ?? {};
                    selection.entity.state.authoredRotation = rotation;
                }
                if ('defaultRotation' in selection.entity) {
                    selection.entity.defaultRotation = rotation;
                }
            });
            updateSelectionFromInspectorState();
            return;
        }
        state.rotation = rotation;
        renderCurrentSpritePreview();
    });
    refs.translationSelect.addEventListener('change', () => {
        const translation = normalizeSpriteTranslation(refs.translationSelect.value);
        const selection = getSingleEditableSelection();
        if (selection && categorySupportsTranslation(selection.category)) {
            runMutation('Updated translation.', () => {
                selection.entity.translation = translation;
            });
            updateSelectionFromInspectorState();
            return;
        }
        state.translation = translation;
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.paletteSelect.addEventListener('change', () => {
        const palette = clamp(Number(refs.paletteSelect.value), 0, paletteCount - 1);
        const selections = getSelectedItems();
        if (selections.length > 1) {
            const paletteTargets = selections
                .map((selection: any) => selection.entity)
                .filter((entity: any): entity is { palette?: number } =>
                    !!entity &&
                    typeof entity === 'object' &&
                    'palette' in entity
                );
            if (paletteTargets.length > 0) {
                runMutation('Updated selected palettes.', () => {
                    for (const target of paletteTargets) {
                        target.palette = palette;
                    }
                });
                updateSelectionFromInspectorState();
                return;
            }
        }
        const selection = getSingleEditableSelection();
        if (selection) {
            runMutation('Updated palette.', () => {
                selection.entity.palette = palette;
            });
            updateSelectionFromInspectorState();
            return;
        }
        state.palette = palette;
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
    });
    refs.snapCheckbox.addEventListener('change', () => {
        state.snapToGrid = refs.snapCheckbox.checked;
        persistDesignerUiState();
    });
    refs.objectSnapCheckbox.addEventListener('change', () => {
        state.objectSnapEnabled = refs.objectSnapCheckbox.checked;
        state.activeObjectSnapMode = state.objectSnapEnabled ? 'dock' : 'none';
        if (!state.objectSnapEnabled) {
            state.objectSnapGuides = [];
        } else {
            refreshModifierSnapInteraction();
        }
        persistDesignerUiState();
    });
    refs.snapOffsetXInput.addEventListener('change', () => {
        setSnapOffsets(Number(refs.snapOffsetXInput.value) || 0, state.snapOffsetY);
        refs.snapOffsetXInput.value = String(state.snapOffsetX);
        persistDesignerUiState();
    });
    refs.snapOffsetYInput.addEventListener('change', () => {
        setSnapOffsets(state.snapOffsetX, Number(refs.snapOffsetYInput.value) || 0);
        refs.snapOffsetYInput.value = String(state.snapOffsetY);
        persistDesignerUiState();
    });
    refs.snapOffsetCaptureButton.addEventListener('click', () => {
        const sourceSelection = getSelectedItems()[0];
        if (sourceSelection) {
            setSnapOffsetsFromPosition(sourceSelection.entity);
            refreshPanel();
            setStatus('Aligned the snap grid offset to the current selection.', 'neutral');
            return;
        }

        const viewCenter = {
            x: Math.round(state.camera.x + host.canvas.width / 2),
            y: Math.round(state.camera.y + host.canvas.height / 2)
        };
        setSnapOffsetsFromPosition(viewCenter);
        refreshPanel();
        setStatus('Aligned the snap grid offset to the current view center.', 'neutral');
    });
    refs.nudgeInput.addEventListener('change', () => {
        state.nudgeAmount = clamp(Number(refs.nudgeInput.value) || 1, 1, 64);
        refs.nudgeInput.value = String(state.nudgeAmount);
    });
    refs.showCollisionCheckbox.addEventListener('change', () => {
        state.showCollisionOverlay = refs.showCollisionCheckbox.checked;
    });
    refs.showCreatureOverlaysCheckbox.addEventListener('change', () => {
        state.showCreatureOverlays = refs.showCreatureOverlaysCheckbox.checked;
        host.setShowCreatureOverlays(state.showCreatureOverlays);
        persistDesignerUiState();
    });
    refs.showSpriteOutlineCheckbox.addEventListener('change', () => {
        host.setShowSpriteOutlines(refs.showSpriteOutlineCheckbox.checked);
    });
    refs.showPerformanceHudCheckbox.addEventListener('change', () => {
        host.setPerformanceHudEnabled(refs.showPerformanceHudCheckbox.checked);
    });
    const applyBulletImpactAudioSettingsFromControls = () => {
        const current = host.getBulletImpactAudioSettings();
        const alternateChance = clamp(Number(refs.bulletImpactAlternateChanceInput.value) || 0, 0, 1);
        const volume = clamp(Number(refs.bulletImpactVolumeInput.value) || 0, 0, 1);
        host.setBulletImpactAudioSettings({
            primary: refs.bulletImpactPrimarySelect.value === 'bulletExplosion2' ? 'bulletExplosion2' : 'bulletExplosion',
            alternate: refs.bulletImpactAlternateSelect.value === 'bulletExplosion2' ? 'bulletExplosion2' : 'bulletExplosion',
            alternateChance,
            volume
        });
        const updated = host.getBulletImpactAudioSettings();
        refs.bulletImpactPrimarySelect.value = updated.primary;
        refs.bulletImpactAlternateSelect.value = updated.alternate;
        refs.bulletImpactAlternateChanceInput.value = updated.alternateChance.toFixed(2);
        refs.bulletImpactVolumeInput.value = updated.volume.toFixed(2);
        if (
            current.primary !== updated.primary ||
            current.alternate !== updated.alternate ||
            current.alternateChance !== updated.alternateChance ||
            current.volume !== updated.volume
        ) {
            persistDesignerUiState();
        }
    };
    refs.bulletImpactPrimarySelect.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.bulletImpactAlternateSelect.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.bulletImpactAlternateChanceInput.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.bulletImpactVolumeInput.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.windEnabledCheckbox.addEventListener('change', () => {
        host.setWindRuntimeToggle('windEnabled', refs.windEnabledCheckbox.checked);
        persistDesignerUiState();
    });
    refs.windEmittersEnabledCheckbox.addEventListener('change', () => {
        host.setWindRuntimeToggle('emittersEnabled', refs.windEmittersEnabledCheckbox.checked);
        persistDesignerUiState();
    });
    refs.windSurfaceEnabledCheckbox.addEventListener('change', () => {
        host.setWindRuntimeToggle('surfaceWindEnabled', refs.windSurfaceEnabledCheckbox.checked);
        persistDesignerUiState();
    });
    refs.windVfxEnabledCheckbox.addEventListener('change', () => {
        host.setWindRuntimeToggle('windVfxEnabled', refs.windVfxEnabledCheckbox.checked);
        persistDesignerUiState();
    });
    refs.magnifierCheckbox.addEventListener('change', () => {
        state.magnifierEnabled = refs.magnifierCheckbox.checked;
        if (!state.magnifierEnabled) {
            state.lastPointerCanvas = null;
        }
        persistDesignerUiState();
    });
    refs.disablePreviewCollisionCheckbox.addEventListener('change', () => {
        state.disableCollisionInPreview = refs.disablePreviewCollisionCheckbox.checked;
    });
    for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[string, HTMLInputElement]>) {
        checkbox.addEventListener('change', () => {
            state.layerVisibility[category] = checkbox.checked;
            invalidateOverviewBase();
        });
    }
    refs.savePreviewButton.addEventListener('click', openSavePreview);
    refs.pngImportButton.addEventListener('click', openPngImportModal);
    refs.deleteButton.addEventListener('click', deleteSelection);
    refs.duplicateButton.addEventListener('click', duplicateSelection);
    refs.sendToBackButton.addEventListener('click', () => reorderSelections(false));
    refs.bringToFrontButton.addEventListener('click', () => reorderSelections(true));
    refs.focusButton.addEventListener('click', focusSelection);
    refs.convertButton.addEventListener('click', convertSelection);
    refs.focusAstronautButton.addEventListener('click', () => {
        focusOnCurrentWorldPosition();
        setStatus('Centered view on the astronaut.', 'neutral');
    });
    refs.moveAstronautButton.addEventListener('click', () => {
        moveLiveAstronautToViewCenter();
    });
    refs.expandViewportCheckbox.addEventListener('change', () => {
        setViewportExpanded(refs.expandViewportCheckbox.checked);
    });
    refs.soundEnabledCheckbox.addEventListener('change', () => {
        host.setSoundEnabled(refs.soundEnabledCheckbox.checked);
        persistDesignerUiState();
    });
    refs.addAtCenterButton.addEventListener('click', () => {
        runMutation(`Placed new ${CATEGORY_LABELS[state.category].toLowerCase()} at the view center.`, () => {
            placeAtWorld(
                state.camera.x + host.canvas.width / 2,
                state.camera.y + host.canvas.height / 2
            );
        });
        updateSelectionFromInspectorState();
    });
    refs.setAstronautStartButton.addEventListener('click', () => {
        setAstronautStartToViewCenter();
    });
    refs.normalizeSpriteSheetButton.addEventListener('click', () => {
        void openSpriteSheetNormalizationPreview();
    });
    refs.modalClose.addEventListener('click', () => closeModal());
    refs.modalConfirm.addEventListener('click', () => {
        if (modalConfirmActionRef.get()) {
            void modalConfirmActionRef.get()!();
        }
    });
    refs.modal.addEventListener('click', (event: MouseEvent) => {
        if (event.target === refs.modal) {
            closeModal();
        }
    });
    refs.contextMenu.addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
    });
    refs.contextMenu.addEventListener('mousedown', (event: MouseEvent) => {
        event.stopPropagation();
    });
    refs.overviewCanvas.addEventListener('mousedown', handleOverviewMouseDown);
    refs.overviewCanvas.addEventListener('mousemove', handleOverviewMouseMove);
    refs.overviewCanvas.addEventListener('mouseleave', () => {
        state.overviewDragging = false;
        state.overviewHoverWorld = null;
    });
    refs.overviewCanvas.addEventListener('mouseup', handleOverviewMouseUp);
    host.canvas.addEventListener('contextmenu', (event: MouseEvent) => {
        if (state.active && state.mode === 'edit') {
            event.preventDefault();
            if (state.suppressContextMenuOnce) {
                state.suppressContextMenuOnce = false;
                closeContextMenu();
                return;
            }
            const point = getCanvasPoint(event);
            const world = screenToWorld(point.x, point.y);
            const hit = getEntityAt(world.x, world.y);
            if (hit) {
                openContextMenu(hit, event);
            } else {
                openEmptyContextMenu(event, world);
            }
        }
    });
    host.canvas.addEventListener('mousedown', handleCanvasMouseDown);
    host.canvas.addEventListener('mousemove', handleCanvasMouseMove);
    host.canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('resize', resizeExpandedViewport);
    window.addEventListener('resize', applyDesignerOverlayZoomCompensation);
    window.visualViewport?.addEventListener('resize', applyDesignerOverlayZoomCompensation);
    window.visualViewport?.addEventListener('scroll', applyDesignerOverlayZoomCompensation);
    window.addEventListener('beforeunload', handleWindowBeforeUnload);
}
