const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
// The synthetic BBC sound path is serviced from the v-sync IRQ, i.e. 50 Hz.
const TICK_RATE = 50;
const MAX_SECONDS = 6;
const MIN_SECONDS = 0.12;
const RAW_DISTANCE = 0;
const PREVIEW_DISTANCE = 8;
const OUTPUT_DIR = path.resolve(__dirname, '..', 'src', 'assets', 'bbc-reference-audio');
const ASM_PATH = path.resolve(__dirname, '..', '..', 'original_source.asm');
const ASM2_PATH = path.resolve(__dirname, '..', '..', 'original_source2.asm');
const SAMPLE_BIN_PATH = path.resolve(__dirname, '..', 'src', 'assets', 'bbc-reference-audio', 'EXILESR_1900_1900.bin');
const PSG_CLOCK = 4000000;
const SILENT_TICKS_TO_END = 8;
const SAMPLE_PLAYBACK_RATE = 7812;
const SN76489_VOLUME_TABLE = [
  1.0,
  0.794328,
  0.630957,
  0.501187,
  0.398107,
  0.316228,
  0.251189,
  0.199526,
  0.158489,
  0.125893,
  0.1,
  0.079433,
  0.063096,
  0.050119,
  0.039811,
  0,
];

const PITCH_THRESHOLDS = [0x00, 0x40, 0x84, 0xB6];
const PITCH_OFFSETS = [0xE0, 0x10, 0x4A, 0x80];

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function parseHexBytes(text) {
  return Array.from(text.matchAll(/\$([0-9A-Fa-f]{2})/g), (match) => parseInt(match[1], 16));
}

function sanitizeSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80) || 'sound';
}

function toHex(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function descriptorToHex(descriptor) {
  return descriptor.map(toHex).join('-');
}

function extractLookupTable(lines) {
  const startIndex = lines.findIndex((line) => /^\s*\.sound_data_big_lookup_table\b/.test(line));
  if (startIndex === -1) {
    throw new Error('Could not find .sound_data_big_lookup_table in original_source.asm');
  }

  const table = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\./.test(line) && !/^\s*\.L/.test(line)) {
      break;
    }
    if (/\bequb\b/i.test(line)) {
      table.push(...parseHexBytes(line));
    }
  }

  if (table.length !== 208) {
    throw new Error(`Expected 208 lookup bytes, found ${table.length}`);
  }

  return table;
}

function findNearestLabel(lines, index) {
  for (let i = index; i >= 0; i -= 1) {
    const match = lines[i].match(/^\s*\.([A-Za-z0-9_]+)\b/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function stripAsmComment(line) {
  const commentIndex = line.indexOf(';');
  if (commentIndex === -1) {
    return '';
  }
  return line.slice(commentIndex + 1).trim();
}

function collectNearbyComments(lines, index) {
  const comments = [];
  for (let i = index - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (comments.length > 0) {
        break;
      }
      continue;
    }
    if (!trimmed.startsWith(';')) {
      break;
    }
    comments.unshift(trimmed.replace(/^;\s?/, ''));
    if (comments.length >= 3) {
      break;
    }
  }
  return comments;
}

function inferTitle(label, comments, descriptor) {
  const commentText = comments.join(' ').toLowerCase();
  const labelText = (label || '').toLowerCase();

  const patterns = [
    ['teleport', 'teleport'],
    ['remember', 'remember'],
    ['whistle 1', 'whistle-1'],
    ['whistle 2', 'whistle-2'],
    ['explosion', 'explosion'],
    ['grenade', 'grenade'],
    ['pain', 'pain'],
    ['scream', 'scream'],
    ['plasma', 'plasma'],
    ['icer', 'icer'],
    ['pistol', 'pistol'],
    ['chatter', 'chatter'],
    ['lightning', 'lightning'],
    ['collect', 'collect'],
    ['pickup', 'pickup'],
    ['door', 'door'],
    ['switch', 'switch'],
    ['beam', 'beam'],
    ['alarm', 'alarm'],
    ['beep', 'beep'],
  ];

  for (const [needle, replacement] of patterns) {
    if (commentText.includes(needle) || labelText.includes(needle.replace(/\s+/g, '_'))) {
      return replacement;
    }
  }

  if (label && !/^L[0-9A-F]+$/i.test(label)) {
    return sanitizeSlug(label);
  }

  return `sound-${descriptorToHex(descriptor).toLowerCase()}`;
}

function extractCallsites(lines) {
  const callsites = [];

  for (let i = 0; i < lines.length; i += 1) {
    const jsrMatch = lines[i].match(/\bJSR\s+(play_sound2?|play_low_beep)\b/i);
    if (!jsrMatch) {
      continue;
    }

    let j = i + 1;
    while (j < lines.length && (!lines[j].trim() || /^\s*;/.test(lines[j]))) {
      j += 1;
    }

    if (j >= lines.length || !/\bequb\b/i.test(lines[j])) {
      continue;
    }

    const descriptor = parseHexBytes(lines[j]).slice(0, 4);
    if (descriptor.length !== 4) {
      continue;
    }

    const kind = jsrMatch[1].toLowerCase() === 'play_low_beep'
      ? 'play_sound'
      : jsrMatch[1].toLowerCase();
    const label = findNearestLabel(lines, i);
    const comments = [
      ...collectNearbyComments(lines, i),
      stripAsmComment(lines[i]),
      stripAsmComment(lines[j]),
    ].filter(Boolean);
    const runtimeModified = lines.slice(Math.max(0, i - 8), i).some((line) => /sound_data_big_lookup_table\+207/i.test(line));
    const title = inferTitle(label, comments, descriptor);
    const descriptorHex = descriptorToHex(descriptor);
    const stem = `${String(i + 1).padStart(5, '0')}-${title}__${descriptorHex}`;

    callsites.push({
      index: callsites.length,
      asmLine: i + 1,
      dataLine: j + 1,
      kind,
      label,
      comments,
      title,
      runtimeModified,
      descriptor,
      descriptorHex,
      stem,
      jsrLine: lines[i].trim(),
      dataLineText: lines[j].trim(),
    });
  }

  return callsites;
}

function createEngine(lookupTable, kind, descriptor, distanceUnits) {
  const baseChannel = kind === 'play_sound2' ? 0 : 3;
  const state = {
    duration: new Uint8Array(8),
    durationLow: new Uint8Array(8),
    tableIndex: new Uint8Array(8),
    channelCounters: new Uint8Array(8),
    auxCounters: new Uint8Array(8),
    auxPointers: new Uint8Array(8),
    distance: new Uint8Array(4),
  };

  state.distance[baseChannel] = distanceUnits << 4;
  state.tableIndex[baseChannel] = descriptor[0];
  state.duration[baseChannel] = descriptor[1] & 0xF0;
  state.durationLow[baseChannel] = descriptor[1] & 0x0F;

  state.tableIndex[baseChannel + 4] = descriptor[2];
  state.duration[baseChannel + 4] = descriptor[3] & 0xF0;
  state.durationLow[baseChannel + 4] = descriptor[3] & 0x0F;

  return {
    state,
    baseChannel,
    lookupTable,
    tonePhase: 0,
    noisePhase: 0,
    noiseLfsr: 0xACE1,
    toneRegister: 0x40,
    noiseControl: 0x00,
    amplitude: 0,
  };
}

function processSound(engine, slot) {
  const {
    duration,
    durationLow,
    tableIndex,
    channelCounters,
    auxCounters,
    auxPointers,
  } = engine.state;

  if (durationLow[slot] === 0) {
    return { active: false, value: duration[slot] };
  }

  let y = tableIndex[slot];
  let counter = channelCounters[slot];

  if (counter === 0) {
    let aux = auxCounters[slot];
    if (aux === 0) {
      durationLow[slot] = (durationLow[slot] - 1) & 0xFF;
      if (durationLow[slot] === 0) {
        return { active: false, value: duration[slot] };
      }
    }

    y = (y + 1) & 0xFF;
    let tableValue = engine.lookupTable[y];

    if ((tableValue & 0x80) !== 0) {
      aux = (aux - 1) & 0xFF;
      auxCounters[slot] = aux;
      if ((aux & 0x80) !== 0) {
        aux = tableValue & 0x7F;
        auxCounters[slot] = aux;
        y = (y + 1) & 0xFF;
        auxPointers[slot] = y;
      }
      y = auxPointers[slot];
      tableValue = engine.lookupTable[y];
    }

    channelCounters[slot] = tableValue;
    y = (y + 1) & 0xFF;
    tableIndex[slot] = y;
  }

  duration[slot] = (duration[slot] + engine.lookupTable[y]) & 0xFF;
  channelCounters[slot] = (channelCounters[slot] - 1) & 0xFF;

  return { active: true, value: duration[slot] };
}

function convertPitchToRegister(accumulator) {
  let region = 0;
  if (accumulator >= PITCH_THRESHOLDS[3]) {
    region = 3;
  } else if (accumulator >= PITCH_THRESHOLDS[2]) {
    region = 2;
  } else if (accumulator >= PITCH_THRESHOLDS[1]) {
    region = 1;
  }

  let a = (accumulator - PITCH_OFFSETS[region]) & 0xFF;
  let used = 0x04;

  for (let y = region - 1; y >= 0; y -= 1) {
    const carry = (a & 0x80) !== 0 ? 1 : 0;
    a = (a << 1) & 0xFF;
    used = ((used << 1) & 0xFF) | carry;
  }

  const lowNibble = a & 0x0F;

  used >>= 1;
  a = ((used & 0x01) << 7) | (a >> 1);
  used >>= 1;
  a = ((used & 0x01) << 7) | (a >> 1);
  a >>= 1;
  a >>= 1;

  const highBits = a & 0x3F;
  return ((highBits << 4) | lowNibble) & 0x3FF;
}

function updateTick(engine) {
  const volumeSlot = engine.baseChannel;
  const pitchSlot = engine.baseChannel + 4;

  const volumeResult = processSound(engine, volumeSlot);
  const pitchResult = processSound(engine, pitchSlot);
  const active = volumeResult.active || pitchResult.active;

  if (!pitchResult.active || !volumeResult.active) {
    engine.amplitude = 0;
    return active;
  }

  const pitchRegister = convertPitchToRegister(pitchResult.value);
  const rawVolume = (engine.state.duration[volumeSlot] - engine.state.distance[engine.baseChannel]) & 0x1FF;
  const clamped = engine.state.duration[volumeSlot] >= engine.state.distance[engine.baseChannel]
    ? (engine.state.duration[volumeSlot] - engine.state.distance[engine.baseChannel])
    : 0;
  const volumeNibble = ((clamped ^ 0xFF) >> 4) & 0x0F;
  engine.amplitude = SN76489_VOLUME_TABLE[volumeNibble];

  if (engine.baseChannel === 0) {
    engine.noiseControl = pitchRegister & 0x0F;
  } else {
    engine.toneRegister = Math.max(1, pitchRegister);
  }

  void rawVolume;
  return active;
}

function renderEngine(engine) {
  const maxTicks = Math.ceil(MAX_SECONDS * TICK_RATE);
  const minTicks = Math.ceil(MIN_SECONDS * TICK_RATE);
  const samples = [];
  let silentTicks = 0;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    const active = updateTick(engine);
    const tickSamples = SAMPLE_RATE / TICK_RATE;

    for (let s = 0; s < tickSamples; s += 1) {
      let sample = 0;
      if (engine.amplitude > 0) {
        if (engine.baseChannel === 0) {
          sample = renderNoiseSample(engine) * engine.amplitude;
        } else {
          sample = renderToneSample(engine) * engine.amplitude;
        }
      }
      samples.push(sample);
    }

    if (!active || engine.amplitude === 0) {
      silentTicks += 1;
      if (tick >= minTicks && silentTicks >= SILENT_TICKS_TO_END) {
        break;
      }
    } else {
      silentTicks = 0;
    }
  }

  applyFadeOut(samples, Math.floor(SAMPLE_RATE * 0.01));
  normalizeSamples(samples);
  return samples;
}

function renderToneSample(engine) {
  const frequency = PSG_CLOCK / (32 * Math.max(engine.toneRegister, 1));
  engine.tonePhase += frequency / SAMPLE_RATE;
  if (engine.tonePhase >= 1) {
    engine.tonePhase -= Math.floor(engine.tonePhase);
  }
  return engine.tonePhase < 0.5 ? 0.8 : -0.8;
}

function renderNoiseSample(engine) {
  const rateSelector = engine.noiseControl & 0x03;
  const whiteNoise = (engine.noiseControl & 0x04) !== 0;
  const divisors = [16, 32, 64, 64];
  const shiftFrequency = PSG_CLOCK / (32 * divisors[rateSelector]);
  engine.noisePhase += shiftFrequency / SAMPLE_RATE;

  while (engine.noisePhase >= 1) {
    engine.noisePhase -= 1;
    const feedback = whiteNoise
      ? ((engine.noiseLfsr ^ (engine.noiseLfsr >> 1)) & 0x01)
      : (engine.noiseLfsr & 0x01);
    engine.noiseLfsr = (engine.noiseLfsr >> 1) | (feedback << 15);
  }

  return (engine.noiseLfsr & 0x01) ? 0.8 : -0.8;
}

function applyFadeOut(samples, fadeSamples) {
  const start = Math.max(0, samples.length - fadeSamples);
  for (let i = start; i < samples.length; i += 1) {
    const scale = (samples.length - i) / Math.max(1, samples.length - start);
    samples[i] *= scale;
  }
}

function normalizeSamples(samples) {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak === 0) {
    return;
  }
  const scale = 0.92 / peak;
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] *= scale;
  }
}

function writeWavFile(filePath, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + (i * 2));
  }

  fs.writeFileSync(filePath, buffer);
}

function ensureCleanOutput(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const directory of ['raw', 'preview', 'named', 'sampled', 'composite']) {
    fs.rmSync(path.join(outputDir, directory), { recursive: true, force: true });
    fs.mkdirSync(path.join(outputDir, directory), { recursive: true });
  }
  for (const fileName of ['README.txt', 'manifest.json', 'named-manifest.json', 'sampled-manifest.json', 'composite-manifest.json']) {
    fs.rmSync(path.join(outputDir, fileName), { force: true });
  }
}

function writeReadme(outputDir, manifest) {
  const lines = [
    'BBC reference audio renders',
    '',
    `Generated from: ${path.relative(outputDir, ASM_PATH).replace(/\\/g, '/')}`,
    `Calls rendered: ${manifest.length}`,
    '',
    'Contents:',
    '- raw/: dry source renders with no BBC distance attenuation',
    '- preview/: mid-distance renders using BBC-style distance attenuation',
    '- named/: hand-picked, human-friendly exports for the clearest recoverable BBC effects',
    '- sampled/: WAVs reconstructed from the EXILESR SRAM sample binary when present',
    '- composite/: event-level reference WAVs built by sequencing atomic BBC renders',
    '- manifest.json: metadata for each callsite and output file',
    '- named-manifest.json: metadata for the named exports',
    '- sampled-manifest.json: metadata for the extracted sample-backed sounds',
    '- composite-manifest.json: metadata for the event-level composite renders',
    '',
    'Important limits:',
    '- These WAVs are generated from the inline synthetic sound descriptors in original_source.asm.',
    '- If EXILESR_1900_1900.bin is present, the sampled/ folder is reconstructed from its embedded SRAM sample table and nibble-packed sample data.',
    '- Chatter song callsites are flagged in the manifest because the source mutates one lookup-table byte at runtime before playback.',
    '',
  ];

  fs.writeFileSync(path.join(outputDir, 'README.txt'), lines.join('\n'));
}

function buildNamedExports() {
  return [
    {
      fileName: 'remember.wav',
      descriptorHex: '17-E3-2F-72',
      preferredTitle: 'remember',
      note: 'Middle beep used when remembering a teleport position in original_source2.asm:7651.',
    },
    {
      fileName: 'teleport.wav',
      descriptorHex: '29-C2-37-F3',
      preferredTitle: 'teleport',
      note: 'Object teleporting sound from original_source2.asm:11818-11820.',
    },
    {
      fileName: 'teleport_transition.wav',
      descriptorHex: '33-F3-63-F3',
      preferredTitle: 'teleport-transition',
      note: 'Object changing position in teleport from original_source2.asm:5178-5179.',
    },
    {
      fileName: 'get.wav',
      descriptorHex: '72-A5-7B-85',
      preferredTitle: 'get',
      note: 'Collectable pickup sound from original_source2.asm:13073-13075.',
    },
    {
      fileName: 'ouch_1.wav',
      descriptorHex: '33-03-2D-24',
      preferredTitle: 'ouch-1',
      note: 'First scream sound from original_source2.asm:6530-6532.',
    },
    {
      fileName: 'ouch_2.wav',
      descriptorHex: '33-03-2B-25',
      preferredTitle: 'ouch-2',
      note: 'Second scream sound from original_source2.asm:6533-6534.',
    },
    {
      fileName: 'whistle_1.wav',
      descriptorHex: 'B0-24-B6-B3',
      preferredTitle: 'whistle-1',
      note: 'Whistle one sound from original_source2.asm:7715-7717.',
    },
    {
      fileName: 'whistle_2.wav',
      descriptorHex: 'B0-24-B6-E2',
      preferredTitle: 'whistle-2',
      note: 'Whistle two sound from original_source2.asm:7703-7705.',
    },
    {
      fileName: 'grenade.wav',
      descriptorHex: '57-07-CB-82',
      preferredTitle: 'grenade',
      note: 'Active grenade sound from original_source2.asm:11644-11649.',
    },
    {
      fileName: 'plasma.wav',
      descriptorHex: '5D-04-FF-05',
      preferredTitle: 'plasma',
      note: 'Low beep used for firing the plasma gun in original_source2.asm:7820-7821.',
    },
    {
      fileName: 'icer.wav',
      descriptorHex: '3D-04-3D-D3',
      preferredTitle: 'icer',
      note: 'Icer firing sound from original_source2.asm:7822-7824.',
    },
    {
      fileName: 'pistol.wav',
      descriptorHex: '3D-04-3D-04',
      preferredTitle: 'pistol',
      note: 'Pistol firing sound from original_source2.asm:7826-7828.',
    },
    {
      fileName: 'middle_beep.wav',
      descriptorHex: '17-E3-2F-72',
      preferredTitle: 'middle-beep',
      note: 'General middle beep helper from original_source2.asm:3953-3956.',
    },
    {
      fileName: 'high_beep.wav',
      descriptorHex: '17-82-13-F2',
      preferredTitle: 'high-beep',
      note: 'General high beep helper from original_source2.asm:3958-3961.',
    },
    {
      fileName: 'low_beep.wav',
      descriptorHex: '5D-04-FF-05',
      preferredTitle: 'low-beep',
      note: 'General low beep helper from original_source2.asm:3963-3966.',
    },
    {
      fileName: 'squeal.wav',
      descriptorHex: '33-03-2D-84',
      preferredTitle: 'squeal',
      note: 'General squeal helper from original_source2.asm:3968-3970.',
    },
    {
      fileName: 'mushroom.wav',
      descriptorHex: '33-F3-1D-03',
      preferredTitle: 'mushroom',
      note: 'Mushroom collision sound from original_source2.asm:11096-11105.',
    },
    {
      fileName: 'switch_pressed.wav',
      descriptorHex: '3D-04-11-D4',
      preferredTitle: 'switch-pressed',
      note: 'Switch pressed sound from original_source2.asm:12750-12751.',
    },
  ];
}

function selectCallsiteByDescriptor(callsites, descriptorHex, preferredTitle) {
  const matches = callsites.filter((callsite) => callsite.descriptorHex === descriptorHex);
  if (matches.length === 0) {
    return null;
  }
  return matches.find((match) => match.title === preferredTitle) || matches[0];
}

function writeNamedExports(outputDir, callsites) {
  const namedExports = [];

  for (const entry of buildNamedExports()) {
    const match = selectCallsiteByDescriptor(callsites, entry.descriptorHex, entry.preferredTitle);
    if (!match) {
      continue;
    }

    const sourcePath = path.join(outputDir, 'raw', `${match.stem}__raw.wav`);
    const destinationPath = path.join(outputDir, 'named', entry.fileName);
    fs.copyFileSync(sourcePath, destinationPath);

    namedExports.push({
      ...entry,
      sourceAsmLine: match.asmLine,
      sourceKind: match.kind,
      sourceDescriptorHex: match.descriptorHex,
      sourceRawFile: `raw/${path.basename(sourcePath)}`,
      namedFile: `named/${entry.fileName}`,
    });
  }

  fs.writeFileSync(
    path.join(outputDir, 'named-manifest.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceFiles: [
        path.relative(outputDir, ASM_PATH).replace(/\\/g, '/'),
        fs.existsSync(ASM2_PATH) ? path.relative(outputDir, ASM2_PATH).replace(/\\/g, '/') : null,
      ].filter(Boolean),
      namedExports,
    }, null, 2)}\n`,
  );

  return namedExports;
}

function decodeSampleRuns(sampleBytes) {
  const states = [];

  for (const byte of sampleBytes) {
    if (byte === 0) {
      break;
    }

    const low = byte & 0x0F;
    if (low === 0x0F) {
      for (let i = 0; i < byte; i += 1) {
        states.push(0);
      }
      continue;
    }

    const high = byte >> 4;
    for (let i = 0; i < high; i += 1) {
      states.push(0);
    }
    for (let i = 0; i < low; i += 1) {
      states.push(1);
    }
  }

  return states;
}

function upsampleSampleStates(states) {
  const outputLength = Math.max(1, Math.round(states.length * SAMPLE_RATE / SAMPLE_PLAYBACK_RATE));
  const samples = new Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = Math.min(states.length - 1, Math.floor((i * SAMPLE_PLAYBACK_RATE) / SAMPLE_RATE));
    samples[i] = states[sourceIndex];
  }

  let mean = 0;
  for (const sample of samples) {
    mean += sample;
  }
  mean /= samples.length;

  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = samples[i] - mean;
  }

  applyFadeOut(samples, Math.floor(SAMPLE_RATE * 0.005));
  normalizeSamples(samples);
  return samples;
}

function parseEmbeddedSampleBin() {
  if (!fs.existsSync(SAMPLE_BIN_PATH)) {
    return null;
  }

  const data = fs.readFileSync(SAMPLE_BIN_PATH);
  const marker = Buffer.from('/ExileMC\r', 'binary');
  const markerIndex = data.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Could not locate /ExileMC marker in EXILESR_1900_1900.bin');
  }

  const tocStart = markerIndex + marker.length;
  const sampleRegion = data.subarray(tocStart);
  const toc = [];
  for (let i = 0; i < 14; i += 2) {
    toc.push(sampleRegion[i] | (sampleRegion[i + 1] << 8));
  }

  return { tocStart, sampleRegion, toc };
}

function buildSampledExports() {
  return [
    {
      id: 0,
      fileName: 'welcome_to_the_land_of_the_exile.wav',
      label: 'Welcome to the land of the exile',
      note: 'Sample ID 0, played at original_source.asm:12076-12081.',
    },
    {
      id: 1,
      fileName: 'pain_1.wav',
      label: 'Pain 1',
      note: 'Sample ID 1, one of the random pain sounds from original_source.asm:6124-6129.',
    },
    {
      id: 2,
      fileName: 'pain_2.wav',
      label: 'Pain 2',
      note: 'Sample ID 2, one of the random pain sounds from original_source.asm:6124-6129.',
    },
    {
      id: 3,
      fileName: 'pain_3.wav',
      label: 'Pain 3',
      note: 'Sample ID 3, one of the random pain sounds from original_source.asm:6124-6129.',
    },
    {
      id: 4,
      fileName: 'pain_4.wav',
      label: 'Pain 4',
      note: 'Sample ID 4, one of the random pain sounds from original_source.asm:6124-6129.',
    },
    {
      id: 5,
      fileName: 'destroy.wav',
      label: 'Destroy',
      note: 'Sample ID 5 (DESTROY), played at original_source.asm:11820-11822.',
    },
    {
      id: 6,
      fileName: 'alien_die.wav',
      label: 'Alien die',
      note: 'Sample ID 6 (ALIEN DIE), played at original_source.asm:11774-11776.',
    },
  ];
}

function writeSampledExports(outputDir) {
  const parsed = parseEmbeddedSampleBin();
  if (!parsed) {
    return [];
  }

  const { sampleRegion, toc } = parsed;
  const exports = [];

  for (const entry of buildSampledExports()) {
    const start = toc[entry.id];
    const next = entry.id < toc.length - 1 ? toc[entry.id + 1] : sampleRegion.length;
    const rawBytes = sampleRegion.subarray(start, next);
    const terminatorIndex = rawBytes.indexOf(0);
    const encodedBytes = terminatorIndex === -1 ? rawBytes : rawBytes.subarray(0, terminatorIndex + 1);
    const states = decodeSampleRuns(encodedBytes);
    const samples = upsampleSampleStates(states);
    const outputPath = path.join(outputDir, 'sampled', entry.fileName);

    writeWavFile(outputPath, samples);

    exports.push({
      ...entry,
      tableIndex: `0x${toc[entry.id].toString(16).toUpperCase().padStart(4, '0')}`,
      runtimeAddress: `0x${(0x8100 + toc[entry.id]).toString(16).toUpperCase().padStart(4, '0')}`,
      encodedBytes: encodedBytes.length,
      decodedSamplesAt7812Hz: states.length,
      renderedSeconds: Number((samples.length / SAMPLE_RATE).toFixed(3)),
      file: `sampled/${entry.fileName}`,
    });
  }

  fs.writeFileSync(
    path.join(outputDir, 'sampled-manifest.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceFile: path.relative(outputDir, SAMPLE_BIN_PATH).replace(/\\/g, '/'),
      samplePlaybackRate: SAMPLE_PLAYBACK_RATE,
      tableOfContents: toc.map((value, id) => ({
        id,
        tableIndex: `0x${value.toString(16).toUpperCase().padStart(4, '0')}`,
        runtimeAddress: `0x${(0x8100 + value).toString(16).toUpperCase().padStart(4, '0')}`,
      })),
      sampledExports: exports,
    }, null, 2)}\n`,
  );

  return exports;
}

function mixCompositeLayers(layers, sourceMap) {
  const totalLength = layers.reduce((max, layer) => {
    const key = `${layer.sourceType}:${layer.fileName}`;
    const source = sourceMap.get(key);
    if (!source) {
      throw new Error(`Missing composite source ${key}`);
    }
    return Math.max(max, Math.round(layer.offsetSeconds * SAMPLE_RATE) + source.samples.length);
  }, 0);

  const mix = new Array(Math.max(1, totalLength)).fill(0);

  for (const layer of layers) {
    const key = `${layer.sourceType}:${layer.fileName}`;
    const source = sourceMap.get(key);
    const offsetSamples = Math.round(layer.offsetSeconds * SAMPLE_RATE);
    const gain = typeof layer.gain === 'number' ? layer.gain : 1;

    for (let i = 0; i < source.samples.length; i += 1) {
      mix[offsetSamples + i] += source.samples[i] * gain;
    }
  }

  normalizeSamples(mix);
  return mix;
}

function buildCompositeExports() {
  return [
    {
      fileName: 'teleport_composite.wav',
      label: 'Teleport composite',
      note: 'Reference composite for the BBC teleport event: start teleport cue, then the reposition cue 16 ticks later (~0.32s at 50Hz).',
      sources: [
        { sourceType: 'named', fileName: 'teleport.wav', offsetSeconds: 0, gain: 0.95 },
        { sourceType: 'named', fileName: 'teleport_transition.wav', offsetSeconds: 16 / 50, gain: 0.85 },
      ],
    },
    {
      fileName: 'mushroom_contact_composite.wav',
      label: 'Mushroom contact composite',
      note: 'Reference wrapper for the BBC mushroom interaction cue used for tile collision and mushroom-ball burst.',
      sources: [
        { sourceType: 'named', fileName: 'mushroom.wav', offsetSeconds: 0, gain: 1 },
      ],
    },
  ];
}

function writeCompositeExports(outputDir, namedExports, sampledExports) {
  const sourceMap = new Map();

  for (const entry of [...namedExports, ...sampledExports]) {
    sourceMap.set(`${entry.sourceType}:${entry.fileName}`, entry);
  }

  const compositeExports = [];

  for (const definition of buildCompositeExports()) {
    const samples = mixCompositeLayers(definition.sources, sourceMap);
    const outputPath = path.join(outputDir, 'composite', definition.fileName);
    writeWavFile(outputPath, samples);

    compositeExports.push({
      fileName: definition.fileName,
      label: definition.label,
      note: definition.note,
      renderedSeconds: Number((samples.length / SAMPLE_RATE).toFixed(3)),
      file: `composite/${definition.fileName}`,
      sources: definition.sources.map((source) => ({
        ...source,
        file: `${source.sourceType}/${source.fileName}`,
      })),
    });
  }

  fs.writeFileSync(
    path.join(outputDir, 'composite-manifest.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      sampleRate: SAMPLE_RATE,
      compositeExports,
    }, null, 2)}\n`,
  );

  return compositeExports;
}

function main() {
  const lines = readLines(ASM_PATH);
  const lookupTable = extractLookupTable(lines);
  const callsites = extractCallsites(lines);

  ensureCleanOutput(OUTPUT_DIR);

  const renderedCallsites = callsites.map((callsite) => {
    const rawSamples = renderEngine(createEngine(lookupTable, callsite.kind, callsite.descriptor, RAW_DISTANCE));
    const previewSamples = renderEngine(createEngine(lookupTable, callsite.kind, callsite.descriptor, PREVIEW_DISTANCE));
    const rawFileName = `${callsite.stem}__raw.wav`;
    const previewFileName = `${callsite.stem}__preview.wav`;

    writeWavFile(path.join(OUTPUT_DIR, 'raw', rawFileName), rawSamples);
    writeWavFile(path.join(OUTPUT_DIR, 'preview', previewFileName), previewSamples);

    return {
      ...callsite,
      sourceType: 'raw',
      fileName: rawFileName,
      samples: rawSamples,
      rawFile: `raw/${rawFileName}`,
      previewFile: `preview/${previewFileName}`,
      rawSeconds: Number((rawSamples.length / SAMPLE_RATE).toFixed(3)),
      previewSeconds: Number((previewSamples.length / SAMPLE_RATE).toFixed(3)),
    };
  });

  const manifest = renderedCallsites.map(({ samples, ...entry }) => entry);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sampleRate: SAMPLE_RATE,
    tickRate: TICK_RATE,
    outputMode: {
      raw: { distanceUnits: RAW_DISTANCE, description: 'No distance attenuation.' },
      preview: { distanceUnits: PREVIEW_DISTANCE, description: 'Mid-distance attenuation using the BBC distance value scaled by 16.' },
    },
    lookupTableLength: lookupTable.length,
    callsites: manifest,
  }, null, 2)}\n`);

  const namedExports = writeNamedExports(OUTPUT_DIR, renderedCallsites).map((entry) => ({
    ...entry,
    sourceType: 'named',
    samples: renderedCallsites.find((callsite) => callsite.descriptorHex === entry.sourceDescriptorHex && callsite.rawFile === entry.sourceRawFile)?.samples
      || renderedCallsites.find((callsite) => callsite.descriptorHex === entry.sourceDescriptorHex)?.samples,
  }));
  const sampledExports = writeSampledExports(OUTPUT_DIR).map((entry) => ({
    ...entry,
    sourceType: 'sampled',
    samples: (() => {
      const samplePath = path.join(OUTPUT_DIR, entry.file);
      const buffer = fs.readFileSync(samplePath);
      const sampleCount = (buffer.length - 44) / 2;
      const samples = new Array(sampleCount);
      for (let i = 0; i < sampleCount; i += 1) {
        samples[i] = buffer.readInt16LE(44 + (i * 2)) / 32767;
      }
      return samples;
    })(),
  }));
  writeCompositeExports(OUTPUT_DIR, namedExports, sampledExports);
  writeReadme(OUTPUT_DIR, manifest);

  console.log(`Rendered ${manifest.length} BBC sound callsites to ${OUTPUT_DIR}`);
}

main();
