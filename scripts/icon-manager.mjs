const MODULE_ID = "pf2e-symphonies-of-war";
const ICON_SETTING = "iconOverrides";
const ICON_DEFAULTS_SETTING = "iconBundledDefaults";
const ICON_DEFAULTS_VERSION_SETTING = "iconBundledDefaultsVersion";
const ICON_MAP_PATH = `modules/${MODULE_ID}/assets/icons/icon-map.json`;
const ICON_TEMPLATE = `modules/${MODULE_ID}/templates/icon-manager.hbs`;
let bundledIconCache = {};
let bundledIconCacheLoaded = false;

const ICON_PACKS = Object.freeze([
  "sow-actions",
  "sow-feats",
  "sow-backgrounds",
  "sow-class-features",
  "sow-classes",
  "sow-companions",
  "sow-equipment",
  "sow-effects",
  "sow-companion-effects",
]);

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function packName(pack) {
  return pack?.metadata?.name ?? pack?.collection?.split(".").at(-1) ?? "";
}

function documentSlug(document) {
  return String(document?.system?.slug ?? document?.slug ?? slugify(document?.name));
}

function iconKey(pack, document) {
  return `${packName(pack)}.${documentSlug(document)}`;
}

function overrideKeyFromSource(item) {
  const source = String(
    item?._stats?.compendiumSource
      ?? item?.getFlag?.("core", "sourceId")
      ?? item?.flags?.core?.sourceId
      ?? "",
  );
  const match = source.match(/^Compendium\.pf2e-symphonies-of-war\.([^.]+)\.Item\.[^.]+$/);
  if (!match) return null;
  return `${match[1]}.${documentSlug(item)}`;
}

function readSettingObject(key) {
  const value = game.settings.get(MODULE_ID, key);
  return foundry.utils.deepClone(value && typeof value === "object" ? value : {});
}

function readOverrides() {
  return readSettingObject(ICON_SETTING);
}

function readBundledDefaults() {
  return readSettingObject(ICON_DEFAULTS_SETTING);
}

function imagePathFromUpload(result) {
  return result?.path ?? result?.url ?? result?.file ?? result?.storagePath ?? null;
}

function safeFileName(pack, slug, file) {
  const extension = String(file.name ?? "").match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "webp";
  return `${pack}-${slug}.${extension}`;
}

async function loadBundledIconMap({ refresh = false } = {}) {
  if (bundledIconCacheLoaded && !refresh) return foundry.utils.deepClone(bundledIconCache);
  try {
    const separator = ICON_MAP_PATH.includes("?") ? "&" : "?";
    const response = await fetch(`${ICON_MAP_PATH}${separator}t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    bundledIconCache = data?.icons && typeof data.icons === "object" ? foundry.utils.deepClone(data.icons) : {};
    bundledIconCacheLoaded = true;
  } catch (error) {
    console.warn("Symphonies of War | Could not read the bundled icon map.", error);
    if (!bundledIconCacheLoaded) bundledIconCache = {};
  }
  return foundry.utils.deepClone(bundledIconCache);
}

function resolvedIcon(overrides, bundled, defaults, key) {
  return overrides[key] ?? bundled[key] ?? defaults[key] ?? null;
}

function classProgressionUpdate(document, overrides, bundled, defaults) {
  if (document?.type !== "class" || documentSlug(document) !== "virtuoso") return null;
  const update = { _id: document.id };
  let changed = false;
  for (const [entryId, entry] of Object.entries(document.system?.items ?? {})) {
    const icon = resolvedIcon(overrides, bundled, defaults, `sow-class-features.${slugify(entry.name)}`);
    if (!icon || entry.img === icon) continue;
    update[`system.items.${entryId}.img`] = icon;
    changed = true;
  }
  return changed ? update : null;
}

async function updatePackIcons(overrides, bundled, defaults) {
  if (!game.user?.isActiveGM) return;

  for (const name of ICON_PACKS) {
    const pack = game.packs?.get(`${MODULE_ID}.${name}`);
    if (!pack) continue;

    const documents = await pack.getDocuments();
    const updates = documents
      .map((document) => {
        const key = iconKey(pack, document);
        return { document, icon: resolvedIcon(overrides, bundled, defaults, key) };
      })
      .filter(({ document, icon }) => icon && document.img !== icon)
      .map(({ document, icon }) => ({ _id: document.id, img: icon }));
    if (name === "sow-classes") {
      for (const document of documents) {
        const progressionUpdate = classProgressionUpdate(document, overrides, bundled, defaults);
        if (progressionUpdate) {
          const existing = updates.find((entry) => entry._id === document.id);
          if (existing) Object.assign(existing, progressionUpdate);
          else updates.push(progressionUpdate);
        }
      }
    }
    if (!updates.length) continue;

    const wasLocked = pack.locked;
    try {
      if (wasLocked) await pack.configure({ locked: false });
      await pack.documentClass.updateDocuments(updates, { pack: pack.collection });
    } catch (error) {
      console.warn(`Symphonies of War | Could not apply icon overrides to ${name}.`, error);
    } finally {
      if (wasLocked) {
        try {
          await pack.configure({ locked: true });
        } catch (error) {
          console.warn(`Symphonies of War | Could not relock ${name}.`, error);
        }
      }
    }
  }
}

async function updateEmbeddedIcons(overrides, bundled, defaults) {
  if (!game.user?.isActiveGM) return;

  for (const actor of game.actors ?? []) {
    const updates = [];
    for (const item of actor.items ?? []) {
      const key = overrideKeyFromSource(item);
      const icon = key ? resolvedIcon(overrides, bundled, defaults, key) : null;
      const update = icon && item.img !== icon ? { _id: item.id, img: icon } : null;
      const progressionUpdate = classProgressionUpdate(item, overrides, bundled, defaults);
      if (update || progressionUpdate) updates.push({ ...(update ?? { _id: item.id }), ...(progressionUpdate ?? {}) });
    }
    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates, { render: false });
    }
  }
}

export async function captureBundledIconDefaults() {
  if (!game.user?.isActiveGM) return;
  const moduleVersion = game.modules?.get(MODULE_ID)?.version ?? "unknown";
  const capturedVersion = game.settings.get(MODULE_ID, ICON_DEFAULTS_VERSION_SETTING);
  if (capturedVersion === moduleVersion && Object.keys(readBundledDefaults()).length) return;

  const defaults = {};
  for (const name of ICON_PACKS) {
    const pack = game.packs?.get(`${MODULE_ID}.${name}`);
    if (!pack) continue;
    for (const document of await pack.getDocuments()) {
      defaults[iconKey(pack, document)] = document.img;
    }
  }
  await game.settings.set(MODULE_ID, ICON_DEFAULTS_SETTING, defaults);
  await game.settings.set(MODULE_ID, ICON_DEFAULTS_VERSION_SETTING, moduleVersion);
}

export async function applyIconOverrides({ refreshBundled = true } = {}) {
  const overrides = readOverrides();
  const defaults = readBundledDefaults();
  const bundled = await loadBundledIconMap({ refresh: refreshBundled });
  if (!Object.keys(defaults).length && !Object.keys(bundled).length && !Object.keys(overrides).length) return;
  await updatePackIcons(overrides, bundled, defaults);
  await updateEmbeddedIcons(overrides, bundled, defaults);
}

export function applyIconOverrideToItemSource(item) {
  const key = overrideKeyFromSource(item);
  if (!key) return false;
  const icon = resolvedIcon(readOverrides(), bundledIconCache, readBundledDefaults(), key);
  if (!icon || item.img === icon) return false;
  item.updateSource?.({ img: icon });
  return true;
}

export async function refreshEmbeddedIcon(item) {
  if (!item?.parent || item.parent.documentName !== "Actor") return;
  const key = overrideKeyFromSource(item);
  const bundled = await loadBundledIconMap();
  const icon = key ? resolvedIcon(readOverrides(), bundled, readBundledDefaults(), key) : null;
  if (!icon || item.img === icon) return;
  await item.update({ img: icon }, { render: false });
}

const FormApplication = foundry.appv1?.api?.FormApplication ?? globalThis.FormApplication;

class SymphoniesIconManager extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "sow-icon-manager",
      classes: ["pf2e-symphonies-of-war", "sow-icon-manager-window"],
      title: "Symphonies of War Icon Manager",
      template: ICON_TEMPLATE,
      width: 980,
      height: 760,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  async getData() {
    const overrides = readOverrides();
    const defaults = readBundledDefaults();
    const bundled = await loadBundledIconMap({ refresh: true });
    const entries = [];

    for (const name of ICON_PACKS) {
      const pack = game.packs?.get(`${MODULE_ID}.${name}`);
      if (!pack) continue;
      const documents = await pack.getDocuments();
      for (const document of documents) {
        const key = iconKey(pack, document);
        const override = overrides[key] ?? "";
        const bundledIcon = bundled[key] ?? defaults[key] ?? document.img;
        entries.push({
          key,
          name: document.name,
          slug: documentSlug(document),
          type: document.type,
          pack: name,
          packLabel: pack.title ?? name,
          override,
          bundledIcon,
          displayIcon: override || bundledIcon,
          search: `${document.name} ${documentSlug(document)} ${name} ${document.type}`.toLowerCase(),
        });
      }
    }

    entries.sort((a, b) => a.packLabel.localeCompare(b.packLabel) || a.name.localeCompare(b.name));
    return { entries };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0] ?? html;

    root.querySelector("#sow-icon-search")?.addEventListener("input", (event) => {
      const query = String(event.currentTarget.value ?? "").trim().toLowerCase();
      for (const row of root.querySelectorAll(".sow-icon-row")) {
        row.hidden = query && !String(row.dataset.search ?? "").includes(query);
      }
    });

    root.addEventListener("input", (event) => {
      const input = event.target.closest?.(".sow-icon-row__path");
      if (!input) return;
      const row = input.closest(".sow-icon-row");
      const preview = row?.querySelector(".sow-icon-row__preview");
      if (preview) preview.src = input.value.trim() || input.placeholder;
    });

    root.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-action]");
      if (!button) return;
      event.preventDefault();
      const action = button.dataset.action;
      if (action === "browse-icon") void this.#browseIcon(button);
      else if (action === "upload-icon") void this.#uploadIcon(button);
      else if (action === "clear-icon") this.#clearIcon(button);
      else if (action === "save-icons") void this.#saveIcons(root);
      else if (action === "reload-bundled-icons") void this.#reloadBundledIcons();
      else if (action === "clear-world-overrides") void this.#clearWorldOverrides();
      else if (action === "export-icons") void this.#exportIcons(root);
    });
  }

  async #browseIcon(button) {
    const row = button.closest(".sow-icon-row");
    const input = row?.querySelector(".sow-icon-row__path");
    if (!input) return;
    const FilePicker = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
    const picker = new FilePicker({
      type: "image",
      current: input.value.trim() || input.placeholder,
      callback: (path) => {
        input.value = path;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
    });
    await picker.browse(input.value.trim() || input.placeholder);
    picker.render(true);
  }

  async #uploadIcon(button) {
    const row = button.closest(".sow-icon-row");
    const input = row?.querySelector(".sow-icon-row__path");
    if (!row || !input) return;

    const pickerInput = document.createElement("input");
    pickerInput.type = "file";
    pickerInput.accept = "image/*";
    pickerInput.addEventListener("change", async () => {
      const sourceFile = pickerInput.files?.[0];
      if (!sourceFile) return;
      const FilePicker = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
      if (!FilePicker?.uploadPersistent) {
        ui.notifications.error("This Foundry version does not provide persistent package uploads.");
        return;
      }

      const fileName = safeFileName(row.dataset.pack, row.dataset.slug, sourceFile);
      const file = new File([sourceFile], fileName, { type: sourceFile.type, lastModified: sourceFile.lastModified });
      button.disabled = true;
      try {
        let result;
        try {
          result = await FilePicker.uploadPersistent(MODULE_ID, "icons", file, {}, { notify: false });
        } catch (_error) {
          result = await FilePicker.uploadPersistent(MODULE_ID, "", file, {}, { notify: true });
        }
        const path = imagePathFromUpload(result);
        if (!path) throw new Error("Foundry did not return the uploaded file path.");
        input.value = path;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (error) {
        console.error("Symphonies of War | Icon upload failed", error);
        ui.notifications.error("The icon could not be uploaded. Check the console and your file-upload permissions.");
      } finally {
        button.disabled = false;
      }
    }, { once: true });
    pickerInput.click();
  }

  #clearIcon(button) {
    const row = button.closest(".sow-icon-row");
    const input = row?.querySelector(".sow-icon-row__path");
    if (!input) return;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  #collectOverrides(root) {
    return Object.fromEntries(
      [...root.querySelectorAll(".sow-icon-row")]
        .map((row) => [row.dataset.iconKey, row.querySelector(".sow-icon-row__path")?.value.trim()])
        .filter(([, value]) => Boolean(value)),
    );
  }

  async #saveIcons(root) {
    const overrides = this.#collectOverrides(root);
    await game.settings.set(MODULE_ID, ICON_SETTING, overrides);
    await applyIconOverrides({ refreshBundled: true });
    ui.notifications.info(`Saved ${Object.keys(overrides).length} Symphonies of War icon override(s).`);
    this.render(false);
  }

  async #reloadBundledIcons() {
    await applyIconOverrides({ refreshBundled: true });
    ui.notifications.info("Reloaded assets/icons/icon-map.json and applied its icons.");
    this.render(false);
  }

  async #clearWorldOverrides() {
    const confirmed = await Dialog.confirm({
      title: "Clear Symphonies of War Icon Overrides",
      content: "<p>Remove every world-level icon override and restore the bundled icon map?</p>",
      yes: () => true,
      no: () => false,
      defaultYes: false,
    });
    if (!confirmed) return;
    await game.settings.set(MODULE_ID, ICON_SETTING, {});
    await applyIconOverrides({ refreshBundled: true });
    ui.notifications.info("Cleared world icon overrides and restored the bundled icon map.");
    this.render(false);
  }

  async #exportIcons(root) {
    const icons = this.#collectOverrides(root);
    const manifest = JSON.stringify({ schemaVersion: 1, icons }, null, 2);
    foundry.utils.saveDataToFile(manifest, "application/json", "symphonies-of-war-icon-map.json");
  }

  async _updateObject() {}
}

export function registerIconManager() {
  game.settings.register(MODULE_ID, ICON_SETTING, {
    name: "Symphonies of War icon overrides",
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, ICON_DEFAULTS_SETTING, {
    name: "Symphonies of War bundled icon defaults",
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, ICON_DEFAULTS_VERSION_SETTING, {
    name: "Symphonies of War bundled icon defaults version",
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  game.settings.registerMenu(MODULE_ID, "iconManager", {
    name: "Symphonies of War Icon Manager",
    label: "Open Icon Manager",
    hint: "Choose, upload, preview, and export custom icons for Symphonies of War documents.",
    icon: "fa-solid fa-icons",
    type: SymphoniesIconManager,
    restricted: true,
  });
}

export function openIconManager() {
  return new SymphoniesIconManager().render(true);
}
