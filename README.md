# PF2e: Symphonies of War

Foundry VTT implementation of the **Virtuoso** class and the content from *Symphonies of War* for Pathfinder Second Edition.

## Compatibility

- Foundry VTT 13
- PF2e 7.12.x
- Module version: 0.6.34

## Build and validation

```bash
npm run build
npm run validate:runtime
npm run validate:packs
npm run check
```

The canonical content source is `src/content/symphonies-of-war-foundry.md`.

## Virtuoso status through level 3

- Battle Tempo, Opening Notes, Combo Chains, Guiding Note, Adaptive Measure, Delay support, the Crescendo Strike toggle, and standalone cadence Finale actions.
- Module activities use dedicated damage-safe sheet handlers; the obsolete SOW Action Use helper is not generated.
- Battle Tempo, Crescendo Strike and Pass the Beat are consolidated into single official entries.
- Finale, Upbeat, Virtuoso, and the three Acoustic family traits are registered with their published descriptions.
- Compendiums are organized under Symphonies of War. Character Building packs and ordinary subfolders use alphabetical order. SoW Actions contains Archetype, Class, and Companion folders. SoW Feats contains Archetype, Class, General, and Skill; Class is divided into numeric level folders and Archetype uses named subfolders.
- SoW Companions contains only Giant Frilled Lizard and Giant Hyena. Their actions live in SoW Actions/Companion, and their reusable effects live in SoW Companion Effects.
- Feat descriptions keep traits and prerequisites in PF2e metadata rather than repeating them in chat-card text. Official condition links and reusable SoW effects remain beside the rule text that applies them.
- Adaptive Measure uses a damage-free attack-modifier check against AC, and Battle Tempo includes Delay preservation.
- All five Core Cadences and their level-1 Signature Motifs.
- All level-1 Virtuoso feats. Tuned Arsenal uses PF2e's native weapon-trait preparation and prompts for a valid trait when the feat is added.
- Guiding Note always prepares Aid for the chosen ally and sends that ally a reaction prompt to Step.
- All level-2 Virtuoso feats, with automated rolls and effects where PF2e exposes a safe API.
- Quickening Tempo, Rhythmic Flow, Pass the Beat, and Will Expertise at level 3. Pass the Beat expires at the earlier of the ally's next turn ending or the Virtuoso's next turn starting.
- Embedded Virtuoso class advancement is synchronized for actors created with older module versions.
- Assisted movement remains manual for effects where the player chooses the destination, such as Sidestep Sync and the extended Step from Quickening Tempo.

## Custom icon workflow

The module contains a build-time icon map under `assets/icons/icon-map.json` and category folders under `assets/icons/`. GMs can open **Configure Settings → Module Settings → Symphonies of War Icon Manager** to preview, browse, upload, save, and export world-level icon overrides.

See `docs/PATCH-0.6.34.md`, `docs/RETEST-0.6.34.md`, `docs/VALIDATION-0.6.34.md`, and `docs/ICON-WORKFLOW.md`.
