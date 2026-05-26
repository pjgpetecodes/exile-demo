BBC reference audio renders

Generated from: ../../../../original_source.asm
Calls rendered: 49

Contents:
- raw/: dry source renders with no BBC distance attenuation
- preview/: mid-distance renders using BBC-style distance attenuation
- named/: hand-picked, human-friendly exports for the clearest recoverable BBC effects
- sampled/: WAVs reconstructed from the EXILESR SRAM sample binary when present
- composite/: event-level reference WAVs built by sequencing atomic BBC renders
- manifest.json: metadata for each callsite and output file
- named-manifest.json: metadata for the named exports
- sampled-manifest.json: metadata for the extracted sample-backed sounds
- composite-manifest.json: metadata for the event-level composite renders

Important limits:
- These WAVs are generated from the inline synthetic sound descriptors in original_source.asm.
- If EXILESR_1900_1900.bin is present, the sampled/ folder is reconstructed from its embedded SRAM sample table and nibble-packed sample data.
- Chatter song callsites are flagged in the manifest because the source mutates one lookup-table byte at runtime before playback.
