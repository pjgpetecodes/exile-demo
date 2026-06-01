import { drawGameLoopDebugHud } from './game-loop-runtime-debug-hud.js';
import { resolveAstronautAnimationPose } from './game-loop-runtime-animation.js';
import {
    drawBlackBackgroundHighlights,
    drawMutedSoundIndicator,
    drawWorldEntityTightBoundingBoxes
} from './game-loop-runtime-overlays.js';

export interface GameLoopRuntimeContext {
    [key: string]: any;
}

export async function runGameLoopRuntime(context: GameLoopRuntimeContext) {
    const swallowAutoplayRejection = () => {};
    let {
        CHUNK_SYNC_INTERVAL_FRAMES,
        MAP_HEIGHT,
        MAP_WIDTH,
        MOVEMENT_SETTINGS,
        SPRITE_COL_FLY_DIAGONAL,
        SPRITE_COL_FLY_DOWN,
        SPRITE_COL_FLY_FLOAT,
        SPRITE_COL_FLY_RIGHT,
        SPRITE_COL_STAND,
        SPRITE_COL_WALK_END,
        SPRITE_COL_WALK_RIGHT1,
        SPRITE_COL_WALK_RIGHT2,
        SPRITE_COL_WALK_START,
        SPRITE_ROW,
        SPRITE_SCALE,
        STARFIELD_HEIGHT,
        TELEPORT_ANIM_FRAMES,
        activeAstronautCollisionProfile,
        applyAstronautDamage,
        applyButtonTeleporterLinks,
        applyGravity,
        applyLandingMomentum,
        applySurfaceWindCarryToAstronaut,
        astronaut,
        astronautBoundingBoxes,
        astronautRenderer,
        astronautSpriteSource,
        blockInstanceRotatedBoundingBoxes,
        bulletImpactParticles,
        buttonEntities,
        buttonOnSound,
        buttonPressTimestamps,
        canAstronautFitCollisionProfile,
        canvas,
        checkAstronautCollisions,
        chunkActivityManager,
        chunkSyncFrameCounter,
        computeAstronautWindAcceleration,
        computeLandingImpactDamage,
        creatureEntities,
        creatureRuntime,
        ctx,
        currentAstronautChunkActivity,
        currentAstronautRenderState,
        doorCloseSound,
        doorDestructionEffects,
        doorEntities,
        doorOpenSound,
        downPressed,
        drawCreatureOverlays,
        drawDoorDestructionEffects,
        drawEntities,
        drawMap,
        drawTeleporterPads,
        drawWorldBoundingBoxOverlay,
        emitJetpackDots,
        facingLeft,
        filterTeleporterPadsFromBlocks,
        findSpriteRectByType,
        flyDir,
        flyDownFacingLeft,
        flyDownMode,
        flyDownTransitionStep,
        flyDownTransitionTimer,
        flyDownTransitioning,
        flyDownTravelDir,
        flyHoldTimer,
        flySwitchStep,
        flySwitchTimer,
        flySwitching,
        gameAudio,
        gameState,
        getAnyBlockAtWorld,
        getAstronautCollisionOffsets,
        getAstronautControlModifiers,
        getAstronautFacingDirectionForFlyPose,
        getBlackBackgroundBlocks,
        getCameraOffset,
        getChunkActivityForEntityPosition,
        getChunkActivityForWorldPosition,
        getCreatureProjectileCollectables,
        getCurrentAstronautCollisionProfile,
        getDesignerRenderableCollectables,
        getDirectDownTransitionSequence,
        getEffectiveViewportState,
        getEffectiveWindToggles,
        getEntityPreviewSheet,
        getHeldMovementModifiers,
        getHorizontalTravelDirection,
        getMapBlocksBehindAstronaut,
        getMapBlocksMaskAstronaut,
        getRenderableCollectables,
        getRenderableMapBlocks,
        getSolidBlockAtWorld,
        getSoundEnabled,
        getSpriteRectFromMap,
        getSpriteTranslationOffset,
        getTeleporterPadKeySet,
        getWalkSpeed,
        getFacingLeft,
        getLeftPressed,
        getRightPressed,
        getUpPressed,
        getDownPressed,
        getTransformedSpriteCanvas,
        handleAstronautMovement,
        handleCollectableInteractions,
        heldCollectable,
        hideBlackBackgroundBlocks,
        isDesignerOpen,
        isGameLoopRunning,
        keys,
        lastAstronautWindAcceleration,
        lastFlyFlipSprite,
        lastFlySpriteCol,
        layDownVerticalFlipToggled,
        leftPressed,
        mapBlocks,
        mapLoaded,
        mouseScreen,
        mouseWorld,
        normalizeSpriteTranslation,
        performanceTracker,
        popLatestTeleportLocation,
        prevKeys,
        projectileImpactEffects,
        proneForcedByGeometry,
        pronePoseActive,
        remappedSpriteSheets,
        rememberLastFlyPose,
        rememberSound,
        resetFlyDownAnimationState,
        resetFlySwitchAnimationState,
        resolveAstronautCollectableCollisions,
        resolveAstronautCreatureCollisions,
        rightPressed,
        saveSnapshotInProgress,
        scheduleNextFrame,
        setAstronautCollisionProfile,
        showBlackBackgroundBlocks,
        showCreatureOverlays,
        showTightBoundingBoxes,
        showWorldBoundingBoxes,
        simulationFrameCounter,
        spawnWindParticlesNearAstronaut,
        spriteMap,
        spriteSheet,
        startTeleportToLocation,
        syncButtonStatesToDoors,
        syncMapChunksForViewport,
        teleportAnimFrame,
        teleportFlipSprite,
        teleportFlipVertical,
        teleportLocations,
        teleportPhase,
        teleportSlot,
        teleportSpriteCol,
        teleportTarget,
        teleporterEntities,
        teleporting,
        upPressed,
        updateAndDrawBulletImpactParticles,
        updateAndDrawJetpackDots,
        updateAndDrawStars,
        updateAndDrawThrowGuide,
        updateAndDrawWindParticles,
        updateAstronautEnergyRecovery,
        updateCollectablePhysics,
        updateCreatureSounds,
        updateDoorDestructionEffects,
        updateHeldCollectablePosition,
        updateProjectileImpactEffects,
        updateTeleporterPadTeleporting,
        updateThrowAngle,
        walkAnimFrame,
        walkAnimTimer,
        walkSpeed,
        windDebugToggles,
        windParticles,
        windSettings,
        worldDesigner,
        worldMapBoundingBoxes,
        worldMapRotatedBoundingBoxes
    } = context;
    const teleportAnimFrameCount = Number.isFinite(TELEPORT_ANIM_FRAMES) && TELEPORT_ANIM_FRAMES > 0
        ? TELEPORT_ANIM_FRAMES
        : 12;

    try {

    if (isGameLoopRunning) {
        return;
    }

    isGameLoopRunning = true;

    try {
        if (!gameState.isRunning || !mapLoaded) return;

        const frameNow = performance.now();
        const frameTiming = performanceTracker.startFrame(frameNow);
        const performanceInstrumentationEnabled = frameTiming.enabled;
        const frameStartMs = frameTiming.frameStartMs;
        const frameTimeMs = frameTiming.frameTimeMs;
        let updateWorkMs = 0;
        let mapDrawMs = 0;
        let drawPhaseMs = 0;

        ctx!.imageSmoothingEnabled = false;
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        const camera = getCameraOffset();
        const effectiveViewport = getEffectiveViewportState();
        chunkActivityManager.updateFrame({
            camera,
            viewportWidth: effectiveViewport.width,
            viewportHeight: effectiveViewport.height,
            zoom: effectiveViewport.zoom,
            now: frameNow
        });
        chunkSyncFrameCounter += 1;
        const designerChunkSyncRequired = worldDesigner?.isActive() === true;
        const shouldSyncChunksThisFrame = designerChunkSyncRequired
            || (chunkSyncFrameCounter % CHUNK_SYNC_INTERVAL_FRAMES === 0);
        if (!saveSnapshotInProgress && shouldSyncChunksThisFrame) {
            syncMapChunksForViewport(
                camera,
                effectiveViewport.width,
                effectiveViewport.height,
                effectiveViewport.prefetchRadiusChunks,
                effectiveViewport.zoom,
                designerChunkSyncRequired
            );
        }
        currentAstronautChunkActivity = getChunkActivityForWorldPosition(
            astronaut.position,
            frameNow
        );

        // Update mouse world position
        mouseWorld.x = Math.round(mouseScreen.x + camera.x);
        mouseWorld.y = Math.round(mouseScreen.y + camera.y);

    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    // Declare spriteCol/flipSprite/flipVertical only ONCE at the top of gameLoop
    let spriteCol = SPRITE_COL_STAND;
    let flipSprite = (typeof getFacingLeft === 'function' ? getFacingLeft() : facingLeft);
    let flipVertical = false;
    pronePoseActive = false;

    // --- Teleport memory logic ---
    if (!isDesignerOpen() && keys['r'] && !prevKeys['r']) {
        // Save up to 6 locations, overwrite oldest if full
        if (teleportLocations.length < 6) {
            teleportLocations.push({ x: astronaut.position.x, y: astronaut.position.y });
        } else {
            teleportLocations[teleportSlot] = { x: astronaut.position.x, y: astronaut.position.y };
        }
        teleportSlot = (teleportSlot + 1) % 6;
        // Play remember sound
        try {
            rememberSound.currentTime = 0;
            void rememberSound.play().catch(swallowAutoplayRejection);
        } catch {}
    }
    if (
        !isDesignerOpen() &&
        keys['t'] &&
        !prevKeys['t'] &&
        typeof startTeleportToLocation === 'function' &&
        typeof popLatestTeleportLocation === 'function'
    ) {
        startTeleportToLocation(popLatestTeleportLocation());
    }

    updateAstronautEnergyRecovery(frameNow);

    // --- Draw twinkling stars ---
        const drawPhaseStartMs = performanceInstrumentationEnabled ? performance.now() : 0;
        updateAndDrawStars(
            ctx!,
            camera,
            canvas,
            MAP_WIDTH,
            STARFIELD_HEIGHT,
            frameNow
        );

    // --- Draw map blocks ---
    const layerVisibility = worldDesigner?.isActive()
        ? worldDesigner.getLayerVisibility()
        : {
            world: true,
            buttons: true,
            doors: true,
            creatures: true,
            collectables: true
        };
    const designerActive = worldDesigner?.isActive() === true;
    const creatureProjectileDrawables = layerVisibility.creatures
        ? getCreatureProjectileCollectables()
        : [];
    const collectablesToDraw = layerVisibility.collectables
        ? (
            worldDesigner?.isActive() && !worldDesigner.isPreviewMode()
                ? getDesignerRenderableCollectables()
                : getRenderableCollectables()
        )
        : [];
    const currentHeldCollectable = typeof context.getHeldCollectable === 'function'
        ? context.getHeldCollectable()
        : heldCollectable;
    const heldCollectableDrawables = currentHeldCollectable ? [currentHeldCollectable] : [];
    const mapBlocksToDraw = !layerVisibility.world
        ? []
        : getRenderableMapBlocks(hideBlackBackgroundBlocks);
    let mapBlocksBehindAstronaut = !layerVisibility.world
        ? []
        : getMapBlocksBehindAstronaut(hideBlackBackgroundBlocks);
    let mapBlocksMaskAstronaut = !layerVisibility.world
        ? []
        : getMapBlocksMaskAstronaut();
    const teleporterPadKeys = getTeleporterPadKeySet();
    if (teleporterPadKeys.size > 0) {
        mapBlocksBehindAstronaut = filterTeleporterPadsFromBlocks(
            mapBlocksBehindAstronaut,
            teleporterPadKeys
        );
        mapBlocksMaskAstronaut = filterTeleporterPadsFromBlocks(
            mapBlocksMaskAstronaut,
            teleporterPadKeys
        );
    }
    const blackBackgroundBlocksToHighlight = showBlackBackgroundBlocks && !hideBlackBackgroundBlocks
        ? getBlackBackgroundBlocks()
        : [];

    const hasRenderableSpriteSheets = Array.isArray(remappedSpriteSheets) && remappedSpriteSheets.length > 0;
    if (hasRenderableSpriteSheets || (spriteSheet && spriteSheet.complete)) {
        if (layerVisibility.doors) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, doorEntities, frameNow);
        }
        // Draw map blocks (replace mapBlocks with mapBlocksToDraw in overlays below as well)
        // Patch: temporarily override mapBlocks for drawMap by monkey-patching global (not ideal, but drawMap uses global)
        // Instead, draw overlays and highlights using mapBlocksToDraw, but call drawMap as usual
        // --- Draw overlays and highlights using mapBlocksToDraw ---
        // --- Highlight all black_background blocks if enabled ---
        if (showBlackBackgroundBlocks) {
            drawBlackBackgroundHighlights({
                ctx: ctx!,
                camera,
                blocks: blackBackgroundBlocksToHighlight,
                boundingBoxes: blockInstanceRotatedBoundingBoxes,
                spriteScale: SPRITE_SCALE
            });
        }
        // Draw map blocks (drawMap uses global mapBlocks, so black_background blocks will be hidden only if not present in mapBlocks)
        // To hide, we need to patch drawMap to accept a blocks array, or temporarily monkey-patch global. For now, just draw overlays using mapBlocksToDraw.
        if (performanceInstrumentationEnabled) {
            const mapDrawStart = performance.now();
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksBehindAstronaut, frameNow);
            mapDrawMs += performance.now() - mapDrawStart;
        } else {
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksBehindAstronaut, frameNow);
        }
        if (layerVisibility.world && !designerActive) {
            drawTeleporterPads(ctx!, camera, frameNow, {
                ignoreKeyRequirement: designerActive
            });
        }
        if (layerVisibility.buttons) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, buttonEntities, frameNow);
        }
        if (layerVisibility.creatures) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureEntities, frameNow);
            if (showCreatureOverlays) {
                drawCreatureOverlays(ctx!, camera);
            }
        }
        if (layerVisibility.collectables) {
            drawEntities(
                ctx!,
                camera,
                spriteMap,
                remappedSpriteSheets,
                SPRITE_SCALE,
                collectablesToDraw,
                frameNow
            );
        }
        if (layerVisibility.doors && doorDestructionEffects.length > 0) {
            drawDoorDestructionEffects(ctx!, camera);
        }
    }

    if (worldDesigner?.isActive()) {
        astronautRenderer.drawAstronautInWorld(ctx!, camera, { spriteCol, flipSprite, flipVertical });
        if (mapBlocksMaskAstronaut.length > 0) {
            if (performanceInstrumentationEnabled) {
                const mapDrawStart = performance.now();
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                mapDrawMs += performance.now() - mapDrawStart;
            } else {
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
            }
        }
        if (layerVisibility.world) {
            drawTeleporterPads(ctx!, camera, frameNow, {
                ignoreKeyRequirement: designerActive
            });
        }
        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }
        if (layerVisibility.creatures && projectileImpactEffects.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, projectileImpactEffects, frameNow);
        }
        if (bulletImpactParticles.length > 0) {
            updateAndDrawBulletImpactParticles(layerVisibility.creatures ? ctx! : null, camera);
        }
        if (windParticles.length > 0) {
            updateAndDrawWindParticles(layerVisibility.world ? ctx! : null, camera);
        }
        if (heldCollectableDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, heldCollectableDrawables, frameNow);
        }
        if (layerVisibility.doors && doorDestructionEffects.length > 0) {
            drawDoorDestructionEffects(ctx!, camera);
        }
        worldDesigner.render(ctx!);
        if (performanceInstrumentationEnabled) {
            drawPhaseMs = performance.now() - drawPhaseStartMs;
        }
        performanceTracker.finalizeFrame(
            frameNow,
            frameStartMs,
            frameTimeMs,
            updateWorkMs,
            mapDrawMs,
            drawPhaseMs
        );
        prevKeys = { ...keys };
        return;
    }

    // --- Controls: Upward and horizontal movement ---
    const updatePhaseStartMs = performanceInstrumentationEnabled ? performance.now() : 0;
    const movementStartX = gameState.astronaut.position.x;
    const movementStartY = gameState.astronaut.position.y;
    const movementModifiers = getHeldMovementModifiers();
    const astronautControlModifiers = getAstronautControlModifiers(frameNow);
    const proneIntentActive = !!keys['Shift'];
    const hasThrustInput = !!(keys['q'] || keys['w'] || keys['p'] || keys['ArrowUp'] || keys['l']);
    const boosterActive = !!(keys['@'] && hasThrustInput && astronaut.energy > 0);
    const boosterScale = boosterActive ? MOVEMENT_SETTINGS.jetpackBoosterMultiplier : 1;
    if (boosterActive) {
        astronaut.energy = Math.max(0, astronaut.energy - MOVEMENT_SETTINGS.jetpackBoosterEnergyCostPerFrame);
        astronaut.nextEnergyRegenAtMs = frameNow + MOVEMENT_SETTINGS.astronautEnergyRegenIntervalMs;
    }
    handleAstronautMovement(keys, !proneIntentActive, {
        walkSpeedScale: movementModifiers.walkSpeedScale * astronautControlModifiers.walkSpeedScale,
        flightControlScale: movementModifiers.flightControlScale * astronautControlModifiers.flightControlScale * boosterScale
    });
    const readCurrentControlState = () => ({
        leftPressed: typeof getLeftPressed === 'function' ? getLeftPressed() : context.leftPressed,
        rightPressed: typeof getRightPressed === 'function' ? getRightPressed() : context.rightPressed,
        facingLeft: typeof getFacingLeft === 'function' ? getFacingLeft() : context.facingLeft,
        upPressed: typeof getUpPressed === 'function' ? getUpPressed() : context.upPressed,
        downPressed: typeof getDownPressed === 'function' ? getDownPressed() : context.downPressed,
        walkSpeed: typeof getWalkSpeed === 'function' ? getWalkSpeed() : context.walkSpeed
    });
    let currentControlState = readCurrentControlState();
    let movementTargetX = astronaut.position.x;
    let movementTargetY = astronaut.position.y;
    astronaut.position.x = movementStartX;
    astronaut.position.y = movementStartY;
    const nextAstronautCollisionProfile = getCurrentAstronautCollisionProfile();
    if (gameState.astronaut.isLanded && nextAstronautCollisionProfile !== activeAstronautCollisionProfile) {
        const previousOffsets = getAstronautCollisionOffsets(activeAstronautCollisionProfile);
        const nextOffsets = getAstronautCollisionOffsets(nextAstronautCollisionProfile);
        movementTargetY += previousOffsets.bottom - nextOffsets.bottom;
    }
    setAstronautCollisionProfile(nextAstronautCollisionProfile);
    activeAstronautCollisionProfile = nextAstronautCollisionProfile;

    // --- Door animation update ---
    for (const door of doorEntities) {
        door.updateAnimation(doorOpenSound, doorCloseSound);
    }

    // Clear all velocities if landed and not walking
    if (
        gameState.astronaut.isLanded &&
        currentControlState.walkSpeed === 0 &&
        !proneIntentActive
    ) {
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
    }

    // Prevent diagonal takeoff: if landed and only up is pressed, clear horizontal velocity
    if (
        gameState.astronaut.isLanded &&
        currentControlState.upPressed &&
        !currentControlState.leftPressed &&
        !currentControlState.rightPressed
    ) {
        astronaut.velocity.x = 0;
    }

    // --- Gravity ---
    applyGravity(
        astronaut,
        gameState.gravity * movementModifiers.gravityScale,
        (currentControlState.downPressed ? MOVEMENT_SETTINGS.flyDownTerminalVelocity : MOVEMENT_SETTINGS.fallTerminalVelocity) * movementModifiers.terminalVelocityScale
    );
    const windAcceleration = computeAstronautWindAcceleration(frameNow, movementModifiers.effectiveWeight);
    astronaut.velocity.x += windAcceleration.x;
    astronaut.velocity.y += windAcceleration.y;
    applySurfaceWindCarryToAstronaut(frameNow);
    lastAstronautWindAcceleration = windAcceleration;
    const wasLanded = gameState.astronaut.isLanded;
    const horizontalVelocityBeforeResolution = astronaut.velocity.x;
    const verticalVelocityBeforeResolution = astronaut.velocity.y;

    // --- Move astronaut by velocity with collision detection ---
    let nextX = movementTargetX;
    let nextY = movementTargetY;
    if (!gameState.astronaut.isLanded) {
        nextX += astronaut.velocity.x;
        nextY += astronaut.velocity.y;
    }

    const collisionState = checkAstronautCollisions(
        buttonEntities,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        movementStartX,
        movementStartY,
        nextX,
        nextY,
        gameState
    );

    gameState.astronaut.position.x = collisionState.nextX;
    gameState.astronaut.position.y = collisionState.nextY;
    astronaut.velocity.x = collisionState.velocityX;
    astronaut.velocity.y = collisionState.velocityY;
    gameState.astronaut.isLanded = collisionState.isLanded;
    gameState.astronaut.isFlying = !collisionState.isLanded;
    const canFitStandProfile = canAstronautFitCollisionProfile(
        'stand',
        gameState.astronaut.position.x,
        gameState.astronaut.position.y,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    );
    const proneCollisionProfile = layDownVerticalFlipToggled ? 'prone_up' : 'prone_down';
    const canFitProneProfile = canFitStandProfile
        ? false
        : canAstronautFitCollisionProfile(
            proneCollisionProfile,
            gameState.astronaut.position.x,
            gameState.astronaut.position.y,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
    const horizontalSqueezeIntent = !!(keys['q'] || keys['w'] || Math.abs(collisionState.velocityX) > 0.05);
    const upwardHeadBumpIntent = !!(keys['p'] || keys['ArrowUp'] || astronaut.velocity.y < -0.05);
    proneForcedByGeometry = !collisionState.isLanded
        && !canFitStandProfile
        && canFitProneProfile
        && horizontalSqueezeIntent
        && !upwardHeadBumpIntent;
    if (!wasLanded && collisionState.isLanded) {
        const carriedHorizontalMotion = collisionState.nextX - movementStartX;
        const landingMomentumSource = Math.abs(carriedHorizontalMotion) > Math.abs(horizontalVelocityBeforeResolution)
            ? carriedHorizontalMotion
            : horizontalVelocityBeforeResolution;
        const landedOnFeet =
            activeAstronautCollisionProfile === 'stand' &&
            !proneIntentActive &&
            !proneForcedByGeometry;
        const landingImpactDamage = landedOnFeet
            ? 0
            : computeLandingImpactDamage(
                Math.max(0, verticalVelocityBeforeResolution),
                Math.abs(landingMomentumSource),
                Math.hypot(windAcceleration.x, windAcceleration.y)
            );
        if (landingImpactDamage > 0) {
            applyAstronautDamage(landingImpactDamage, frameNow);
            gameAudio.playAstronautImpactSound();
        }
        applyLandingMomentum(landingMomentumSource);
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
        resetFlyDownAnimationState();
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
        lastFlySpriteCol = SPRITE_COL_STAND;
        currentControlState = readCurrentControlState();
        lastFlyFlipSprite = currentControlState.facingLeft;
    }

    const collidedButton = collisionState.touchedButton;
    const doorCollision = collisionState.touchedDoor;

    if (collidedButton && Array.isArray(collidedButton.linkedDoors)) {
        const now = performance.now();
        const lastPress = buttonPressTimestamps.get(collidedButton) || 0;
        if (now - lastPress > 500) {
            for (const doorID of collidedButton.linkedDoors) {
                const door = doorEntities.find((d: any) => d.doorID === doorID);
                if (door) {
                    door.locked = !door.locked;
                }
            }
            applyButtonTeleporterLinks(teleporterEntities, collidedButton.linkedTeleporters, collidedButton.teleporterMode);
            syncButtonStatesToDoors();
            buttonPressTimestamps.set(collidedButton, now);
            try {
                buttonOnSound.currentTime = 0;
                void buttonOnSound.play().catch(swallowAutoplayRejection);
            } catch {}
        }
    }

    if (
        doorCollision &&
        doorCollision.type === "door_horizontal" &&
        !doorCollision.locked &&
        !doorCollision.animating
    ) {
        doorCollision.animating = true;
        if (typeof (doorCollision as any)._originalX === "undefined") {
            (doorCollision as any)._originalX = doorCollision.x;
        }
        (doorCollision as any)._animationDirection = "open";
        (doorCollision as any)._animationTimer = 0;
        (doorCollision as any)._closeDelay = 0;
    }

    simulationFrameCounter++;
    creatureRuntime.updateCreatures(frameNow, simulationFrameCounter);
    updateCreatureSounds(frameNow);
    updateProjectileImpactEffects();
    updateDoorDestructionEffects();
    resolveAstronautCreatureCollisions();
    updateThrowAngle();
    handleCollectableInteractions();
    updateHeldCollectablePosition();
    updateTeleporterPadTeleporting(frameNow, simulationFrameCounter);
    resolveAstronautCollectableCollisions(
        gameState.astronaut.position.x - movementStartX,
        gameState.astronaut.position.y - movementStartY
    );
    updateCollectablePhysics(frameNow, simulationFrameCounter);
    // Emergency teleports can be triggered by damage during runtime updates.
    // Re-sync teleport state from shared context before render/update writes.
    teleporting = context.teleporting;
    teleportPhase = context.teleportPhase;
    teleportAnimFrame = context.teleportAnimFrame;
    teleportTarget = context.teleportTarget;
    teleportSpriteCol = context.teleportSpriteCol;
    teleportFlipSprite = context.teleportFlipSprite;
    teleportFlipVertical = context.teleportFlipVertical;
    spawnWindParticlesNearAstronaut(frameNow);
    updateHeldCollectablePosition();
    if (performanceInstrumentationEnabled) {
        updateWorkMs = performance.now() - updatePhaseStartMs;
    }

    // Ensure astronaut position is always integer pixels
    gameState.astronaut.position.x = Math.round(gameState.astronaut.position.x);
    gameState.astronaut.position.y = Math.round(gameState.astronaut.position.y);

    // --- Jetpack dots emission (world coordinates) ---
    emitJetpackDots({
        upPressed: currentControlState.upPressed,
        downPressed: currentControlState.downPressed,
        leftPressed: currentControlState.leftPressed,
        rightPressed: currentControlState.rightPressed,
        facingLeft: currentControlState.facingLeft,
        astronaut,
        spriteSheet,
        spriteMap,
        SPRITE_ROW,
        SPRITE_COL_STAND,
        SPRITE_SCALE,
        walkAnimFrame,
        walkAnimTimer,
        canvas
    });

    // --- Jetpack dots update and render (draw relative to camera) ---
    updateAndDrawJetpackDots(ctx!, camera, MAP_HEIGHT);

    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    // REMOVE this duplicate declaration:
    // let spriteCol = SPRITE_COL_STAND;
    // let flipSprite = facingLeft;
    // let flipVertical = false; // <-- add this

    const performanceSnapshot = performanceTracker.getSnapshot();
    drawGameLoopDebugHud({
        ctx: ctx!,
        gameState,
        controlState: {
            leftPressed: currentControlState.leftPressed,
            rightPressed: currentControlState.rightPressed,
            upPressed: currentControlState.upPressed,
            downPressed: currentControlState.downPressed,
            walkSpeed: currentControlState.walkSpeed,
            spriteCol,
            walkAnimFrame,
            walkAnimTimer,
            flyHoldTimer,
            flyDir,
            flySwitching,
            flySwitchStep
        },
        worldState: {
            mapBlocks,
            mouseWorld,
            frameNow,
            currentAstronautChunkActivity,
            hideBlackBackgroundBlocks,
            lastAstronautWindAcceleration
        },
        dependencies: {
            spriteScale: SPRITE_SCALE,
            blockInstanceRotatedBoundingBoxes,
            getRenderableMapBlocks,
            getAnyBlockAtWorld,
            getEffectiveWindToggles,
            chunkActivityManager,
            getChunkActivityForEntityPosition,
            windSettings,
            windDebugToggles,
            doorEntities,
            buttonEntities,
            creatureEntities,
            performanceTracker,
            performanceSnapshot
        }
    });
    // --- Draw world coordinate bounding boxes for each block in green if enabled ---
    if (showWorldBoundingBoxes) {
        drawWorldBoundingBoxOverlay(ctx!, camera);
    }

    // --- Highlight all black_background blocks if enabled ---
    if (showBlackBackgroundBlocks) {
        drawBlackBackgroundHighlights({
            ctx: ctx!,
            camera,
            blocks: mapBlocks,
            boundingBoxes: blockInstanceRotatedBoundingBoxes,
            spriteScale: SPRITE_SCALE
        });
    }

    ({
        spriteCol,
        flipSprite,
        flipVertical,
        pronePoseActive,
        walkAnimFrame,
        walkAnimTimer,
        flyHoldTimer,
        flyDir,
        flySwitching,
        flySwitchStep,
        flySwitchTimer,
        flyDownTransitioning,
        flyDownTransitionStep,
        flyDownTransitionTimer,
        flyDownTravelDir,
        flyDownFacingLeft,
        flyDownMode
    } = resolveAstronautAnimationPose({
        state: {
            spriteCol,
            flipSprite,
            flipVertical,
            pronePoseActive,
            walkAnimFrame,
            walkAnimTimer,
            flyHoldTimer,
            flyDir,
            flySwitching,
            flySwitchStep,
            flySwitchTimer,
            flyDownTransitioning,
            flyDownTransitionStep,
            flyDownTransitionTimer,
            flyDownTravelDir,
            flyDownFacingLeft,
            flyDownMode
        },
        gameState,
        keys,
        controls: {
            downPressed: currentControlState.downPressed,
            upPressed: currentControlState.upPressed,
            walkSpeed: currentControlState.walkSpeed,
            facingLeft: currentControlState.facingLeft,
            proneForcedByGeometry,
            layDownVerticalFlipToggled
        },
        constants: {
            SPRITE_COL_FLY_RIGHT,
            SPRITE_COL_FLY_DIAGONAL,
            SPRITE_COL_FLY_FLOAT,
            SPRITE_COL_FLY_DOWN,
            SPRITE_COL_STAND,
            SPRITE_COL_WALK_START,
            SPRITE_COL_WALK_END
        },
        helpers: {
            getHorizontalTravelDirection,
            getDirectDownTransitionSequence,
            getAstronautFacingDirectionForFlyPose,
            resetFlyDownAnimationState,
            resetFlySwitchAnimationState,
            rememberLastFlyPose
        }
    }));

    const isLayingDownPose = pronePoseActive;
    if (isLayingDownPose) {
        // Tab toggles vertical orientation while in prone mode.
    } else {
        layDownVerticalFlipToggled = false;
    }

    currentAstronautRenderState = {
        spriteCol,
        flipSprite,
        flipVertical
    };

    // --- Teleport animation rendering ---
    if (teleporting) {
        const canRenderTeleportSprite = !!(spriteSheet && spriteSheet.complete);
        if (canRenderTeleportSprite) {
            const spriteRect = getSpriteRectFromMap(SPRITE_ROW, teleportSpriteCol);
            const SPRITE_W = spriteRect.w;
            const SPRITE_H = spriteRect.h;
            const drawW = 32 * SPRITE_SCALE;
            const drawH = 32 * SPRITE_SCALE;
            ctx!.save();
            ctx!.translate(canvas.width / 2, canvas.height / 2);
            if (teleportFlipSprite) ctx!.scale(-1, 1);
            if (teleportFlipVertical) ctx!.scale(1, -1);

            // Render random bits of the sprite for a more "teleport" effect
            const totalBits = 32; // number of random bits per frame
            let visibleBits = totalBits;
            if (teleportPhase === 'out') {
                visibleBits = Math.max(2, Math.floor(totalBits * (1 - teleportAnimFrame / teleportAnimFrameCount)));
            } else if (teleportPhase === 'in') {
                visibleBits = Math.max(2, Math.floor(totalBits * (teleportAnimFrame / teleportAnimFrameCount)));
            }
            for (let i = 0; i < visibleBits; ++i) {
                // Randomly pick a region of the sprite
                const bitW = SPRITE_W / 8;
                const bitH = SPRITE_H / 8;
                const sx = spriteRect.x + Math.floor(Math.random() * (SPRITE_W - bitW));
                const sy = spriteRect.y + Math.floor(Math.random() * (SPRITE_H - bitH));
                const dx = -drawW / 2 + ((sx - spriteRect.x) / SPRITE_W) * drawW;
                const dy = -drawH / 2 + ((sy - spriteRect.y) / SPRITE_H) * drawH;
                ctx!.drawImage(
                    spriteSheet,
                    sx, sy, bitW, bitH,
                    dx, dy, bitW * SPRITE_SCALE, bitH * SPRITE_SCALE
                );
            }
            ctx!.restore();
            if (mapBlocksMaskAstronaut.length > 0) {
                if (performanceInstrumentationEnabled) {
                    const mapDrawStart = performance.now();
                    drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                    mapDrawMs += performance.now() - mapDrawStart;
                } else {
                    drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                }
            }
            if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
                drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
            }
        }
        teleportAnimFrame++;

        if (teleportPhase === 'out' && teleportAnimFrame >= teleportAnimFrameCount) {
            // Move astronaut after 0.5 second
            if (teleportTarget) {
                astronaut.position.x = teleportTarget.x;
                astronaut.position.y = teleportTarget.y;
                astronaut.velocity.x = 0; // Clear velocity on teleport
                astronaut.velocity.y = 0; // Clear velocity on teleport
                // If teleporting into the air (not on ground), set isFlying so gravity applies
                // We'll check for ground below the feet
                const astronautOffsets = getAstronautCollisionOffsets();
                const feetY = teleportTarget.y + astronautOffsets.bottom;
                const blockBelow = getSolidBlockAtWorld(
                    teleportTarget.x,
                    feetY + 1,
                    spriteMap,
                    SPRITE_SCALE,
                    mapBlocks,
                    doorEntities,
                    buttonEntities
                );
                if (!blockBelow) {
                    astronaut.isLanded = false;
                    astronaut.isFlying = true;
                }
            }
            teleportPhase = 'in';
            teleportAnimFrame = 0;
        } else if (teleportPhase === 'in' && teleportAnimFrame >= teleportAnimFrameCount) {
            astronaut.energy = Math.min(
                astronaut.maxEnergy,
                astronaut.energy + 1
            );
            teleporting = false;
            teleportPhase = 'none';
            teleportTarget = null;
        }

        if (canRenderTeleportSprite) {
            if (performanceInstrumentationEnabled) {
                drawPhaseMs = performance.now() - drawPhaseStartMs;
            }
            performanceTracker.finalizeFrame(
                frameNow,
                frameStartMs,
                frameTimeMs,
                updateWorkMs,
                mapDrawMs,
                drawPhaseMs
            );
            prevKeys = { ...keys };
            return;
        }
    }

    // --- Render astronaut at center of screen with correct animation ---
    if (astronautSpriteSource || hasRenderableSpriteSheets || (spriteSheet && spriteSheet.complete)) {
        updateAndDrawThrowGuide(ctx!, camera);
        const renderNow = performance.now();
        astronautRenderer.drawAstronautAtScreenCenter(
            ctx!,
            canvas.width,
            canvas.height,
            { spriteCol, flipSprite, flipVertical },
            renderNow,
            (astronautContext: any, { spriteRect, drawW, drawH }: any) => {
                if (!showTightBoundingBoxes) {
                    return;
                }
                let spriteName = spriteRect.name ?? '';
                if (!astronautBoundingBoxes[spriteName]) {
                    switch (spriteCol) {
                        case SPRITE_COL_FLY_RIGHT:
                            spriteName = "fly_right";
                            break;
                        case SPRITE_COL_FLY_DIAGONAL:
                            spriteName = "fly_diagonal";
                            break;
                        case SPRITE_COL_FLY_FLOAT:
                            spriteName = "fly_float";
                            break;
                        case SPRITE_COL_FLY_DOWN:
                            spriteName = "fly_down";
                            break;
                        case SPRITE_COL_STAND:
                            spriteName = "stand";
                            break;
                        case SPRITE_COL_WALK_START:
                            spriteName = "walk_right1";
                            break;
                        case SPRITE_COL_WALK_RIGHT1:
                            spriteName = "walk_right2";
                            break;
                        case SPRITE_COL_WALK_RIGHT2:
                            spriteName = "walk_right3";
                            break;
                        default:
                            break;
                    }
                }
                const bbox = astronautBoundingBoxes[spriteName];
                if (bbox) {
                    astronautContext.save();
                    astronautContext.strokeStyle = 'red';
                    astronautContext.lineWidth = 2;
                    const scale = SPRITE_SCALE;
                    const x = -drawW / 2 + bbox.minX * scale;
                    const y = -drawH / 2 + bbox.minY * scale;
                    const w = bbox.width * scale;
                    const h = bbox.height * scale;
                    astronautContext.strokeRect(x, y, w, h);
                    astronautContext.restore();
                }
            }
        );

        if (mapBlocksMaskAstronaut.length > 0) {
            if (performanceInstrumentationEnabled) {
                const mapDrawStart = performance.now();
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                mapDrawMs += performance.now() - mapDrawStart;
            } else {
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
            }
        }
        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }

        // --- Draw tight bounding boxes for world map sprites with collision ---
        if (showTightBoundingBoxes && spriteSheet && spriteSheet.complete) {
            drawWorldEntityTightBoundingBoxes({
                ctx: ctx!,
                camera,
                entities: [...mapBlocks, ...doorEntities, ...buttonEntities],
                spriteScale: SPRITE_SCALE,
                blockInstanceRotatedBoundingBoxes,
                worldMapBoundingBoxes,
                worldMapRotatedBoundingBoxes,
                findSpriteRectByType,
                getEntityPreviewSheet,
                getTransformedSpriteCanvas,
                getSpriteTranslationOffset,
                normalizeSpriteTranslation
            });
        }

        if (heldCollectableDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, heldCollectableDrawables, frameNow);
        }

        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }
        if (layerVisibility.creatures && projectileImpactEffects.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, projectileImpactEffects, frameNow);
        }
        if (bulletImpactParticles.length > 0) {
            updateAndDrawBulletImpactParticles(layerVisibility.creatures ? ctx! : null, camera);
        }
        if (windParticles.length > 0) {
            updateAndDrawWindParticles(layerVisibility.world ? ctx! : null, camera);
        }

        if (!getSoundEnabled()) {
            drawMutedSoundIndicator(ctx!, canvas);
        }
    }

    if (performanceInstrumentationEnabled) {
        drawPhaseMs = performance.now() - drawPhaseStartMs;
    }
    performanceTracker.finalizeFrame(
        frameNow,
        frameStartMs,
        frameTimeMs,
        updateWorkMs,
        mapDrawMs,
        drawPhaseMs
    );
    prevKeys = { ...keys };
    } finally {
        isGameLoopRunning = false;
        if (gameState.isRunning && mapLoaded) {
            scheduleNextFrame();
        }
    }
    } finally {
        context.activeAstronautCollisionProfile = activeAstronautCollisionProfile;
        context.chunkSyncFrameCounter = chunkSyncFrameCounter;
        context.currentAstronautChunkActivity = currentAstronautChunkActivity;
        context.currentAstronautRenderState = currentAstronautRenderState;
        context.flyDir = flyDir;
        context.flyDownFacingLeft = flyDownFacingLeft;
        context.flyDownMode = flyDownMode;
        context.flyDownTransitionStep = flyDownTransitionStep;
        context.flyDownTransitionTimer = flyDownTransitionTimer;
        context.flyDownTransitioning = flyDownTransitioning;
        context.flyDownTravelDir = flyDownTravelDir;
        context.flyHoldTimer = flyHoldTimer;
        context.flySwitchStep = flySwitchStep;
        context.flySwitchTimer = flySwitchTimer;
        context.flySwitching = flySwitching;
        context.isGameLoopRunning = isGameLoopRunning;
        context.lastAstronautWindAcceleration = lastAstronautWindAcceleration;
        context.lastFlyFlipSprite = lastFlyFlipSprite;
        context.lastFlySpriteCol = lastFlySpriteCol;
        context.layDownVerticalFlipToggled = layDownVerticalFlipToggled;
        context.prevKeys = prevKeys;
        context.proneForcedByGeometry = proneForcedByGeometry;
        context.pronePoseActive = pronePoseActive;
        context.simulationFrameCounter = simulationFrameCounter;
        context.teleportAnimFrame = teleportAnimFrame;
        context.teleportPhase = teleportPhase;
        context.teleportSlot = teleportSlot;
        context.teleportTarget = teleportTarget;
        context.teleporting = teleporting;
        context.walkAnimFrame = walkAnimFrame;
        context.walkAnimTimer = walkAnimTimer;
    }
}
