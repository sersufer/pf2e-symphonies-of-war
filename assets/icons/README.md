# Symphonies of War icons

This directory contains icons that are distributed with the module.

Use one of the category folders and keep file names lowercase and stable, for example:

```text
assets/icons/actions/double-cadenza.webp
assets/icons/feats/tuned-arsenal.webp
assets/icons/effects/measured-step-supporting-harmony.webp
```

Permanent assignments are stored in `icon-map.json`. Keys use the format
`<pack>.<slug>` and values use a Foundry path:

```json
{
  "schemaVersion": 1,
  "icons": {
    "sow-actions.double-cadenza": "modules/pf2e-symphonies-of-war/assets/icons/actions/double-cadenza.webp"
  }
}
```

The in-world Icon Manager can be used for testing and staging. Its saved paths
are world overrides, not part of the distributable module ZIP. Export its
manifest, copy custom image files into this directory, replace the paths with
`modules/pf2e-symphonies-of-war/assets/icons/...`, and rebuild the packs before
publishing a release.
