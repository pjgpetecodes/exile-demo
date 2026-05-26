# BBC source audio and sound reference

This note documents what can be reconstructed directly from `original_source.asm`, what cannot, and how to turn the embedded BBC sound data into usable modern reference assets later without changing game code.

## Primary source locations

- Object / handler catalog, including teleport beam, explosion, whistle 1, and whistle 2 object identities: `original_source.asm:408-531`
- Sound chip command tables and per-channel sound state: `original_source.asm:2821-2867`
- Global volume flag and toggle: `original_source.asm:3100-3120`
- Main sound update path (`process_sound`, pitch conversion, distance attenuation, chip writes): `original_source.asm:3212-3408`
- Sound start logic (`play_sound`, `play_sound2`) and inline 4-byte sound descriptors: `original_source.asm:3411-3536`
- Main lookup table that drives the sound descriptors: `original_source.asm:7435-7450`
- Optional sample playback path (`IF SRAM`): `original_source.asm:9944-10122`

## How the BBC sound system works

### 1. The game writes directly to the BBC sound chip registers

The source defines register-command nybbles for four logical outputs: noise control, tone 1 frequency, tone 2 frequency, tone 3 frequency, plus matching volume commands (`original_source.asm:2825-2835`). The interrupt-time sound code processes active channels, converts the game’s internal pitch value to the chip’s frequency format, then writes frequency and volume bytes to `$FE4F` / `$FE40` via `push_sound_to_chip` (`original_source.asm:3212-3408`).

### 2. A `JSR play_sound` call embeds the sound data inline

`play_sound` and `play_sound2` do not take a pointer argument in registers. Instead, they recover the return address from the stack, treat the next 4 bytes after the `JSR` as sound data, then rewrite the return address so execution resumes after those 4 bytes (`original_source.asm:3411-3438`).

That makes every inline sequence such as:

```asm
JSR play_sound
equb $33,$F3,$63,$F3
```

a self-contained sound definition in the code stream (`original_source.asm:4766-4767`).

### 3. The 4-byte sound descriptor is split into two halves

When a sound starts, the routine consumes bytes 0..3 like this (`original_source.asm:3489-3511`):

- byte 0 -> first-half lookup-table index
- byte 1 high nybble -> first-half `sound_duration`
- byte 1 low nybble -> first-half `sound_duration_low`
- byte 2 -> second-half lookup-table index
- byte 3 high nybble -> second-half `sound_duration`
- byte 3 low nybble -> second-half `sound_duration_low`

What is certain from the code:

- bytes 0 and 2 are table indexes into `sound_data_big_lookup_table` (`original_source.asm:3489-3498`, `original_source.asm:7435-7450`)
- bytes 1 and 3 are split into upper and lower nybbles and stored as separate per-channel state (`original_source.asm:3497-3505`)
- the lower-nybble state counts down and a zero value ends that half of the sound (`original_source.asm:3339-3355`)

### 4. The lookup table describes how pitch evolves over time

`process_sound` walks `sound_data_big_lookup_table`, updates counters, and adds table values into the channel accumulator (`original_source.asm:3336-3388`). Bytes with bit 7 set are treated specially: the high bit is stripped and the value becomes a reloadable counter before the next table byte is used (`original_source.asm:3357-3375`). This means the table is not just raw pitches; it is a compact control stream for stepped pitch movement.

One important limit: the table is not perfectly static. `chatter` rewrites `sound_data_big_lookup_table+207` immediately before playing its song (`original_source.asm:11936-11944`). So some sounds are parameterized by runtime state and should be rendered through emulation, not by assuming the table is immutable.

### 5. Distance affects both whether a sound starts and how loud it is

Before starting a sound, `play_sound` computes distance from the screen centre and rejects sounds at or beyond `$10` (`original_source.asm:3439-3446`). After a sound is accepted, the distance is stored per channel and later subtracted from the channel state before the volume nybble is written (`original_source.asm:3484-3487`, `original_source.asm:3307-3321`).

For reference-asset generation, this means:

- a **dry source render** should ignore distance attenuation
- a **behavior-faithful preview render** can apply the same distance-based volume reduction

### 6. `play_sound2` prefers the noise channel

`play_sound2` enters `play_sound` with carry set (`original_source.asm:3411-3418`). That path first tries channel 0 (`original_source.asm:3447-3452`), and channel 0 maps to the noise register / noise volume command pair (`original_source.asm:2825-2835`). In practice, this is the path used for obviously noisy effects such as explosions and the discharge device (`original_source.asm:10609-10610`, `original_source.asm:12129-12130`).

## What is realistically extractable from `original_source.asm`

### Extractable now

From this file alone, we can reliably extract:

- inline 4-byte sound descriptors attached to explicit call sites
- the `sound_data_big_lookup_table`
- the exact playback algorithm for the synthetic sound path
- the chip register mapping and the noise-vs-tone channel split
- the distance-culling / attenuation behavior
- nearby labels and comments that identify many sounds by gameplay purpose

That is enough to build a deterministic **reference renderer** for the synthetic BBC effects.

### Not fully extractable from this file alone

The `IF SRAM` path is different. `smp_play` reads a sample table of contents from `$8100`, points into external sample bytes, and decodes nybbles as runs of silence and non-silence (`original_source.asm:9976-9985`, `original_source.asm:10044-10107`). The decoder behavior is present, but the actual sample payload bytes are not embedded in the visible source here.

So, from `original_source.asm` alone, we **cannot** recover:

- the actual PCM-ish sample payloads used by the SRAM/sample path
- exact analogue characteristics of the original BBC hardware output chain
- any authoritative modern asset names beyond what current project files already call them

## Actionable reference table

| BBC event / context | BBC source evidence | Embedded bytes | Notes for later asset work |
|---|---|---:|---|
| Teleport beam object exists | `original_source.asm:411-412`, `original_source.asm:498-499`, `original_source.asm:10278-10285` | n/a | Object mapping confirms a dedicated teleport-beam object / handler path. |
| Player teleporting noise | `original_source.asm:4765-4767` | `33 F3 63 F3` | Strong candidate for the modern teleport effect. |
| Store-teleport / remember action | `original_source.asm:7206-7207` | `3D 04 11 D4` | Useful reference for the modern “remember” action. |
| Whistle 2 activate | `original_source.asm:7265-7273` | `B0 24 B6 E2` | Explicitly tied to whistle 2. |
| Whistle 1 activate/deactivate path | `original_source.asm:7275-7283` | `B0 24 B6 B3` | Explicitly tied to whistle 1. |
| Explosion pre-squeal | `original_source.asm:10591-10593` | `57 07 43 F6` | Played before the explosion object is spawned. |
| Explosion / discharge noisy burst | `original_source.asm:10608-10610`, `original_source.asm:12126-12130` | `17 03 11 04` | `play_sound2` path; noise-channel-oriented. |
| Plasma weapon | `original_source.asm:3529-3531`, `original_source.asm:7384-7385` | `5D 04 FF 05` | Reuses `play_low_beep`. |
| Icer weapon | `original_source.asm:7387-7388` | `3D 04 3D D3` | Explicit weapon-fire sound. |
| Pistol weapon | `original_source.asm:7390-7392` | `3D 04 3D 04` | Explicit weapon-fire sound. |
| Grenade claxon | `original_source.asm:10963-10969` | `57 07 CB 82` | Hazard / warning reference. |
| Energy capsule flashing | `original_source.asm:11019-11026` | `05 F2 FF C5` | Hazard / pickup pulse reference. |
| Pain / scream pair | `original_source.asm:6128-6134` | `33 03 2D 24`, `33 03 2B 25` | Good candidates to compare against current `ouch_*.wav`. |
| Chatter song (runtime-modified) | `original_source.asm:11936-11944` | `33 F3 CD 82` | Must be rendered with runtime table mutation in place. |

## Cross-reference to the current modern project

Today’s web game uses pre-rendered `.wav` files rather than BBC-style synthesis:

- `astronaut-game/src/constants.ts:30-75` defines the static audio assets (`remember.wav`, `teleport.wav`, `button_on.wav`, `door_open.wav`, `door_close.wav`, `get.wav`, `save.wav`, `ouch_*.wav`) and the global mute toggle.
- `astronaut-game/src/assets/creature-sound-manifest.ts:1-19` is the current manifest list for named sound assets.
- `astronaut-game/src/game.ts:1361-1382` plays `rememberSound` when storing a teleport location and `teleportSound` when teleporting.
- `astronaut-game/src/game.ts:2757-2777` and `astronaut-game/src/game.ts:3512-3560` show the current runtime playback helpers and distance-scaled creature playback.
- `astronaut-game/src/game.ts:4171-4191` shows current collectable ambient sounds and a reuse of the `teleport` asset when timed objects expire.
- `astronaut-game/src/door.ts:59-110` plays modern door open/close samples during animation.

Practical implication: the current codebase already has the right **shape** for modern assets (named files + manifest + runtime helpers), but it does **not** model the BBC chip. So the right next step is to generate reference audio offline, then decide which current `.wav` assets should be replaced or supplemented. Where this note does not name a BBC equivalent yet (for example the current door/button assets), that should stay unmapped until a specific BBC call site is identified.

## Practical path to usable modern reference assets

1. **Parse the synthetic descriptors**  
   Scan `original_source.asm` for `JSR play_sound` / `JSR play_sound2` followed immediately by `equb` data. Record:
   - asm label
   - line number
   - 4-byte descriptor
   - nearby comment / handler name

2. **Export the lookup table verbatim**  
   Copy `sound_data_big_lookup_table` exactly as data (`original_source.asm:7435-7450`). Do not flatten it into guessed notes; the playback code interprets it procedurally.

3. **Implement an offline BBC-reference renderer**  
   Emulate only what the source proves:
   - `play_sound` / `play_sound2` descriptor loading
   - `process_sound`
   - the 8-bit-to-10-bit pitch conversion (`original_source.asm:3243-3304`)
   - SN76489-style register writes for three tone channels plus one noise channel
   - optional distance attenuation as a separate render mode

4. **Render two outputs for each effect**
   - **raw/reference**: no distance attenuation, normalized level
   - **in-context preview**: with BBC-style attenuation and noise/tone balance preserved

5. **Name outputs by source, not by guesswork**
   Use names like:
   - `teleporting-noise__33-F3-63-F3.wav`
   - `whistle-2__B0-24-B6-E2.wav`
   - `grenade-claxon__57-07-CB-82.wav`

6. **Only map to current asset names after listening**
   For example, compare:
   - BBC teleport references against `teleport.wav`
   - BBC store-teleport reference against `remember.wav`
   - BBC pain references against `ouch_1.wav` / `ouch_2.wav`

7. **Treat sample-backed sounds as a separate follow-up**
   If later work needs the SRAM sample path, locate the external sample blob / disc image data referenced via `$8100`. Without that data, only the decoder can be reconstructed, not the sample content.

## Recommended next documentation/data artifact

If a follow-up docs-only pass is wanted, the most useful artifact would be a generated markdown table under `docs/bbc-source/` listing **every** inline `play_sound` / `play_sound2` call with:

- bytes
- label
- nearby comment
- likely gameplay event
- whether it uses `play_sound` or `play_sound2`
- whether the lookup table is known to be modified at runtime
