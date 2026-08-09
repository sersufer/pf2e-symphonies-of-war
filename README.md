# PF2e: Symphonies of War

**Symphonies of War** brings the Virtuoso class and the player options from *Symphonies of War* to Pathfinder Second Edition in Foundry VTT.

The module is designed to feel as close as possible to native PF2e content. Class features, feats, actions, equipment, companions, effects, traits, and journals are organized into Foundry compendiums and use PF2e automation where it can be implemented reliably.

## Compatibility

- **Foundry VTT:** 13
- **Pathfinder Second Edition:** 7.12.x
- **Current module version:** 0.6.36

## Installation

In Foundry VTT, open **Add-on Modules → Install Module** and paste the following manifest URL:

```text
https://github.com/sersufer/pf2e-symphonies-of-war/releases/latest/download/module.json
```

After installation, enable **PF2e: Symphonies of War** in your world.

## What is included

### Virtuoso class

The module includes the Virtuoso class, its class features, Core Cadences, feats, actions, effects, and class progression.

The currently tested implementation focuses on **levels 1 through 3**, including:

- Battle Tempo, Opening Notes, and Combo Chains.
- Guiding Note and Adaptive Measure.
- Crescendo Strike and cadence-specific Finale actions.
- All five Core Cadences and their Signature Motifs.
- All level 1 and level 2 Virtuoso feats.
- Quickening Tempo, Rhythmic Flow, Pass the Beat, and Will Expertise at level 3.
- Delay support for Battle Tempo.
- Automatic synchronization of early Virtuoso advancement for characters created with older module versions.

Some movement effects still require the player to move their token manually when the destination is a player choice.

### Archetypes and feats

The module also includes the archetypes and additional feats from *Symphonies of War*, organized in the **SoW Feats** compendium.

Included archetypes currently include:

- Beast Tamer
- Multi-Instrumentalist
- Musicologist
- Troupe Member
- Virtuoso archetype

Where an archetype feat grants a separate activity, the activity appears in **SoW Actions** and is granted to the character by the feat.

### Equipment

The **SoW Equipment** compendium contains the Acoustic Armory and the additional adventuring gear, alchemical items, and magic items from the supplement.

The module registers the following custom PF2e traits:

- Acoustic (Percussion)
- Acoustic (String)
- Acoustic (Wind)
- Finale
- Upbeat
- Virtuoso

### Animal companions

The module includes:

- Giant Frilled Lizard
- Giant Hyena

Their companion actions and reusable support effects are stored separately in the appropriate SoW Actions and SoW Companion Effects compendiums.

### Backgrounds

The **SoW Backgrounds** compendium contains the backgrounds from the supplement with PF2e-native boosts, skills, Lore skills, feats, and rarity where applicable.

### Journals

The **SoW Journals** compendium contains an in-Foundry reference for the module content, including the Virtuoso class, feats, archetypes, equipment, companions, backgrounds, and custom traits.

Where possible, names inside the journals link directly to the corresponding Foundry document or official PF2e action.

## Compendium organization

The module creates a **Symphonies of War** compendium folder with its content grouped under Character Building and Effects.

The main compendiums are:

- SoW Actions
- SoW Backgrounds
- SoW Class Features
- SoW Classes
- SoW Companions
- SoW Equipment
- SoW Feats
- SoW Effects
- SoW Companion Effects
- SoW Journals

Virtuoso class feats are additionally organized by level to make character creation and advancement easier to navigate.

## Automation and limitations

The module automates rules when Foundry and PF2e expose a reliable way to do so. In a few cases, player confirmation or manual movement is still preferable to forcing an unreliable automation.

Examples include:

- Choosing where to Step or Stride.
- Effects that depend on the exact position or reach of another token, such as some animal companion support benefits.
- Rules that require interpretation of player intent rather than a detectable PF2e event.

If an automation behaves unexpectedly, the underlying feats, actions, conditions, and effects remain available from the compendiums so the GM can resolve the rule manually.

## Feedback and bug reports

This module is still being actively tested. Reports from real games are especially useful for the Virtuoso's early-level action economy, Combo Chain tracking, Core Cadence triggers, and multiplayer reaction prompts.

Issues can be reported here:

```text
https://github.com/sersufer/pf2e-symphonies-of-war/issues
```

When reporting a problem, please include:

- Foundry VTT version.
- PF2e system version.
- Symphonies of War module version.
- The feat, action, or class feature involved.
- A short description of what happened and what you expected to happen.

## Credits

**Symphonies of War** © 2026 Arturo "Artuman" García.

- **Author, formatting, and layout:** Arturo "Artuman" García
- **Foundry VTT implementation:** Sergio "Sersurfer" Suñén

This product is published under the Community Content Agreement for Pathfinder Infinite and Starfinder Infinite. Paizo, the Paizo golem, Pathfinder, Starfinder, and related trademarks are property of Paizo Inc.
