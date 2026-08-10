# Changelog

## 0.6.38

- Fixed consecutive Battle Tempo rolls that produced the same Opening Note sometimes rendering without the new note text in chat.
- Every Opening Note roll now receives a unique per-turn instance identifier in both the chat message and the Opening Note effect, forcing Foundry/chat renderers to treat repeated results as a new note event without changing the visible presentation.

## 0.6.37

- Rebuilt the SoW Journals compendium from the latest Foundry exports supplied for the main Symphonies of War journal and SoW Traits.
- Added the SoW Tips, Credits and Changelog journal to the module.
- Verified the main journal contains all six published backgrounds, the full equipment page, archetypes, and general/skill feats.
- Rebuilt and validated the revised Guiding Note text and the requested document links for Crescendo Strike, Shattering Crescendo, Whirling Crescendo, Ricochet Tempo, Vitalizing Strike, Parrying Tempo, and Vibrating Crescendo.
- Added journal/link validation so stale or incomplete journal packs fail the build before release.

## 0.6.36

- Added a production Foundry VTT manifest for GitHub installation and automatic updates.
- Added the stable release-manifest URL and version-specific download URL for `sersufer/pf2e-symphonies-of-war`.
- Added repository, readme, changelog, and issue-tracker metadata.
- Declared `socket: true`, matching the module's `module.pf2e-symphonies-of-war` socket traffic.
- Pinned Foundry compatibility to the actually tested V13 build, 13.351.
- Added an explicit PF2e system manifest while retaining PF2e 7.12.x compatibility metadata.
- Added manifest validation and a GitHub Actions release workflow that publishes the exact assets Foundry expects.

## 0.6.35

- Updated Guiding Note wording and added the no-allies self-Step fallback to its level 1 runtime flow.
- Added missing PF2e document links to Crescendo Strike, Shattering Crescendo, Whirling Crescendo, Ricochet Tempo, Vitalizing Strike, Parrying Tempo, and Vibrating Crescendo.
- Replaced the bundled main journal with the latest supplied seven-page export and added the supplied SoW Traits journal.
- Audited all 47 archetype feat links in the journal against the generated SoW Feats pack, correcting Marching Troupe and Attuned Companion.

## 0.6.34

- Added direct PF2e and Symphonies of War document links across the Virtuoso class features and actions identified during journal formatting.
- Replaced the Greater Momentum and Peerless Momentum Pathbuilder placeholder descriptions with the published rules text.
- Bolded the 3+, 5+, and 7+ Crescendo Strike thresholds.
- Replaced the generated one-page rules journal with the user-formatted five-page journal export.
- Linked every entry in both Virtuoso feat tables to its SoW Feats compendium document.
- Added startup description refresh coverage for existing embedded copies of the changed SoW items.

## 0.6.33

- Implemented Crescendo Strike's 7+ Combo Chain threshold with PF2e's native AdjustDegreeOfSuccess rule so a success is prepared and resolved as a critical success.
- Kept the 5+ Clumsy threshold aligned with the upgraded degree of success, producing Clumsy 2 when the 7+ upgrade turns a success into a critical success.
- Corrected Overture Draw's one-action wording from “stow a one 1-handed item” to “stow one 1-handed item.”
- Added validation that rejects the obsolete physical `packs/sow-archetypes` directory as well as the old manifest entry.
- Restored the complete development/reproducibility tree in the distributable release: `tools/`, `src/`, and `docs/` remain packaged alongside the runtime module.

## 0.6.32

- Replaced the obsolete one-option Finale dropdown with a single native PF2e `Crescendo Strike` toggle.
- Cadence-specific Final Cadences remain standalone activities in the Actions section.
- Migrates old embedded Finale RollOptions by removing merged-selector fields and predicates directly on the base Finale option.

## 0.6.31

- Linked Marching Troupe directly to PF2e's official Follow the Expert exploration activity.
- Kept only Crescendo Strike in the merged Finale selector above Strikes.
- Moved Shattering, Shatter-point, Soothing, Vibrating, and Whirling Crescendo to explicit one-action Use controls in the actor Actions section.
- Added migration normalization that removes the legacy merged Finale RollOption from cadence-specific Final Cadence actions on existing actors.

## 0.6.30

- Presented Overture Draw as a variable one-or-two-action activity, matching PF2e's variable-action visual language while retaining a valid minimum action value internally.

## 0.6.29

- Organized SoW Feats/Class into numeric level folders and alphabetized the other compendium groups.
- Added the bundled Virtuoso class icon and applied it to both Virtuoso and Virtuoso Dedication.
- Fixed native Finale Crescendo Strike so the 5+ Combo Chain threshold applies Clumsy 1/2 immediately after the Strike result.
- Added visible spacing classes for Frequency, Trigger, Requirements, degree-of-success blocks, and Overture Draw action-cost alternatives.
- Reworked Giant Hyena Support Benefit to the concise Companion Compendia presentation, with a one-round effect, linked frightened condition, and automatic 1d6/2d6 selection for normal versus nimble/savage companions.

## 0.6.28

- Registered Acoustic (Wind), Acoustic (String), and Acoustic (Percussion) through PF2e's module homebrew manifest so weapon preparation recognizes them before compendium items are loaded.
- Removed duplicated `Traits:` metadata from all generated equipment descriptions while preserving native PF2e trait fields.
- Rebuilt all six backgrounds from the published v1.1 PDF wording, with bold attribute/skill names and linked granted skill feats; Acoustic Seer remains the only rare background and does not grant a skill feat.
- Reworded Giant Hyena Support Benefit to explain the 1d6/2d6 behavior directly and linked the official Frightened condition.
- Added embedded-item migrations for legacy equipment descriptions, background descriptions, and the old Giant Hyena support effect text.
- Merged the collaborator-provided icon map into the current manifest while preserving the newer Call Position and Strike the Pose icon IDs.
- Re-applied icon mappings from each document's final slug, fixing custom icons for archetype Composition copies.

## 0.6.27

- Normalized PF2e description spacing for triggers, requirements, frequencies, and degree-of-success blocks.
- Removed duplicated Traits/Prerequisites metadata from generated action descriptions.
- Added Fatigued condition linking to Unyielding Stamina.
- Split Marching Troupe into two prerequisite entries.
- Added Call Position and Strike the Pose as granted Signature Formation activities.
- Improved Overture Draw variable-action formatting and cadence-label emphasis.

# 0.6.26

- Hardened native PF2e action detection so weapon-assisted Disarm, Grapple, Shove, and Trip resolve by their `action:*` roll option instead of the maneuver weapon slug.
- Opening Note, Pass the Beat, Flowing Sweep, Resonant Disarm, and Adaptive Measure now share the corrected native-action resolver.
- Success-dependent Signature Motifs now require an explicit PF2e success/critical success instead of treating checks with no outcome as successful.
- Mending Hymn no longer completes Healing Interlude from a healing chat card alone; actual HP restoration is required.

## 0.6.25

- Simplified Triumphant Chorus to require only Triumphant Chord and updated Sliced Cadenza to make combined damage optional.
- Enforced a different Tuned Arsenal trait for every repeated copy, with filtered choices, warnings, and duplicate cleanup.
- Added base-PF2e Demoralize detection for Captivating Solo's Magnetic Verse.
- Made Double Cadenza roll successful damage automatically and apply qualifying Opening Note benefits without confirmation.
- Added target-specific Constant Refrain handling and a safe TokenMark-based draggable effect.
- Added Sliced Cadenza combined-versus-separate damage resolution and removed Double Cadenza's flourish restriction while that feat is present.

## 0.6.24

- Apply `assets/icons/icon-map.json` as a live runtime layer, not only during pack generation.
- Ship a complete 257-entry icon map.
- Add Reload Bundled Map and Clear World Overrides controls.
- Validate every generated document icon against the manifest.

## 0.6.23

- Added a distributable `assets/icons` tree and a canonical `icon-map.json` consumed by the pack generator.
- Added a GM-only Icon Manager under Module Settings for browsing, uploading, previewing, applying, and exporting icon overrides.
- Added persistent package-storage uploads for local testing without modifying the installed module directory.
- Reapplies saved icon overrides to module compendiums and embedded actor items after module updates.
- Added documentation distinguishing bundled module assets, world-local uploads, Foundry core icons, and PF2e system icons.


## 0.6.22

- Reordered the module compendiums under a manual `Symphonies of War` folder tree, with SoW Journals at the root and the requested Character Building order.
- Merged all archetype feats into SoW Feats and added PF2e-style internal feat folders, including nested folders for each Symphonies of War archetype.
- Added Class, Archetype, and Companion folders to SoW Actions; nine action-granting archetype feats now grant separate activities from the Archetype folder.
- Reduced SoW Companions to Giant Frilled Lizard and Giant Hyena; moved their activities to SoW Actions/Companion and their reusable effects to SoW Companion Effects.
- Removed duplicated Traits and Prerequisites lines from generated feat descriptions while preserving PF2e metadata and Requirements text.
- Added an active-GM migration for existing world compendium folders and embedded feats that still contain legacy duplicated metadata.

## 0.6.21

- Moved Heroic Cadence and Resonant Disarm controls out of Bonus Feats by granting dedicated Free Action and one-action activity items.
- Added migration support for existing actors and kept feat/action grant relationships intact.
- Audited level-3 progression, Rhythmic Expertise, Rhythmic Flow, Quickening Tempo, Pass the Beat, and Will Expertise.
- Replaced obsolete `flags.system.rulesSelections` references with PF2e's canonical `flags.pf2e.rulesSelections` path and migrated existing selections.

## 0.6.20

- Added a visible and changeable Opening Note selector for Technical Precision.
- Reworked Double Cadenza to publish both PF2e attack rolls, expose damage controls, and offer the applicable Opening Note benefit after qualifying hits.
- Added Athletics and Acrobatics choices for both Disarm and Trip in Flowing Sweep.
- Made Measured Step resolve without an activation chat card and added a visible Supporting Harmony reminder effect.
- Added a manual Heroic Cadence helper that grants and preserves one chain while locking further completion gains for the turn.
- Added a prepared Resonant Disarm action helper using PF2e's native Disarm roll.

## 0.6.19

- Moves official PF2e condition links into the exact rule sentences that apply them.
- Places reusable Symphonies of War effect links beside the relevant outcome or benefit instead of collecting them in a footer.
- Removes the generated “Draggable effects and conditions” section from feat and action descriptions.
- Refreshes embedded Symphonies of War descriptions that still use the legacy footer when an active GM loads the world.

## 0.6.18

- Made runtime Staggering Strike penalties source-aware.
- Replaced the unsafe generic Staggering Strike claim with an explicit manual source-check toggle.
- Corrected Jarring Motif failure durations to one minute.
- Registered Finale, Upbeat, and Virtuoso for class trait displays.
- Rebuilt and revalidated all compendiums.

## 0.6.17

- Registered Finale, Upbeat, Virtuoso, and three Acoustic family traits with published descriptions.
- Reorganized compendiums into nested Foundry folders.
- Added optional PF2e Companion Compendia integration for Giant Frilled Lizard and Giant Hyena.
- Added draggable official conditions and reusable SoW effects to feat and action descriptions.
- Cleaned the generated journal and archived obsolete release notes.

## 0.6.16

- Restored Tuned Arsenal's visible current selection and reselection workflow.
