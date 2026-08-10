import {
  applyIconOverrideToItemSource,
  applyIconOverrides,
  captureBundledIconDefaults,
  openIconManager,
  refreshEmbeddedIcon,
  registerIconManager,
} from "./icon-manager.mjs";

const MODULE_ID = "pf2e-symphonies-of-war";
const FLAG = "battleTempo";

const EFFECT_UUIDS = {
  battleTempo: `Compendium.${MODULE_ID}.sow-effects.Item.e1QFS29ojwGg3kJB`,
  openingNote: `Compendium.${MODULE_ID}.sow-effects.Item.YYVoPJNhnVHY9ctQ`,
  comboChain: `Compendium.${MODULE_ID}.sow-effects.Item.vD0s3lFUWka9eiHb`,
  doubleCadenzaConstantRefrain: `Compendium.${MODULE_ID}.sow-effects.Item.CfSZDuVBtc8IhN0N`,
};
const LEGACY_SOW_ACTION_USE_UUID = `Compendium.${MODULE_ID}.sow-effects.Item.9n99ovcRlf1U4LAy`;
const LEGACY_DUPLICATE_ACTION_UUIDS = {
  battleTempo: `Compendium.${MODULE_ID}.sow-actions.Item.NPsQ06lzFK5hQZsW`,
  crescendoStrike: `Compendium.${MODULE_ID}.sow-actions.Item.12mbX7pf4t0ICLpa`,
  passTheBeat: `Compendium.${MODULE_ID}.sow-actions.Item.46d4sVfIzvk3fyNJ`,
};

const NOTES = {
  1: {
    name: "Ensnaring Hook",
    text: "An enemy within your reach becomes grabbed or restrained, or you succeed at an attempt to Disarm a foe.",
  },
  2: {
    name: "Discordant Chord",
    text: "An enemy within 30 feet becomes frightened or clumsy.",
  },
  3: {
    name: "Supporting Harmony",
    text: "You use the Guiding Note action.",
  },
  4: {
    name: "Percussive Drop",
    text: "An enemy within your reach becomes prone or is pushed from its space.",
  },
  5: {
    name: "Constant Refrain",
    text: "You gain a circumstance bonus to AC.",
  },
  6: {
    name: "Signature Motif",
    text: "Satisfy the requirement of your Core Cadence's unique note.",
  },
};

const SIGNATURE_MOTIFS = {
  "the-captivating-solo": ["Magnetic Verse", "Successfully use an action that requires a Charisma-based skill check against an enemy."],
  "the-clashing-duet": ["Discordant Barrage", "Make two melee Strikes, each with a different weapon. You must succeed in at least one of these Strikes."],
  "the-echoing-rondo": ["Echoing Strike", "Successfully hit an enemy with a thrown weapon Strike."],
  "the-mending-hymn": ["Healing Interlude", "Restore Hit Points to an ally or yourself. If everyone is at maximum Hit Points, hit an enemy with a melee Strike instead."],
  "the-vigorous-march": ["Iron Beat", "Successfully hit an enemy with a melee Strike using a shield."],
};

const ACTION_COMPLETES_NOTE = {
  disarm: 1,
  grapple: 1,
  shove: 4,
  trip: 4,
  demoralize: 2,
  "guiding-note": 3,
  "raise-a-shield": 5,
  "take-cover": 5,
  parry: 5,
  "twin-parry": 5,
  "dueling-parry": 5,
  "magnetic-verse": 6,
  "discordant-barrage": 6,
  "echoing-strike": 6,
  "healing-interlude": 6,
  "iron-beat": 6,
};

const CONDITION_COMPLETES_NOTE = {
  grabbed: { note: 1, range: "reach" },
  restrained: { note: 1, range: "reach" },
  frightened: { note: 2, range: 30 },
  clumsy: { note: 2, range: 30 },
  prone: { note: 4, range: "reach" },
};

const CHECK_ACTIONS = new Set(["demoralize", "disarm", "grapple", "trip", "shove"]);
const PASS_THE_BEAT_EFFECT_SLUG = "effect-pass-the-beat";
const processedMessages = new Set();
const comboGainQueues = new Map();
const shownGuidingNotePrompts = new Set();
let lastVirtuosoAction = null;

const TUNED_ARSENAL_TRAITS = Object.freeze(["disarm", "grapple", "parry", "shove", "trip"]);
const TUNED_ARSENAL_SELECTION_FLAG = "tunedArsenalTrait";
const TECHNICAL_PRECISION_NOTES = Object.freeze([1, 2, 3, 4, 5]);
const TECHNICAL_PRECISION_SELECTION_FLAG = "technicalPrecisionNote";
const VARIABLE_ACTION_COSTS = new Map([
  ["overture-draw", "1 or 2"],
]);

const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const ADAPTIVE_PROMPT_TIMEOUT_MS = 120_000;
const ADAPTIVE_ROLL_OPTION = `${MODULE_ID}:adaptive-measure`;
const ADAPTIVE_DAMAGE_BLOCK_MS = 5_000;
const pendingAdaptivePromptKeys = new Map();

// Level-1 Virtuoso compatibility layer. These slugs are normalized at runtime so
// existing worlds receive the same behavior even when the bundled LevelDB packs
// were created by an older generator.
const LEVEL_ONE_ACTION_FEATS = new Map([
  ["double-cadenza", { actions: 2 }],
  ["flowing-sweep", { actions: 1 }],
  ["measured-step", { actions: 1 }],
]);
const LEVEL_ONE_GRANTED_ACTIONS = new Map([
  ["heroic-cadence", { actionType: "free", actions: null }],
  ["resonant-disarm", { actionType: "action", actions: 1 }],
]);
const LEVEL_ONE_PASSIVE_FEATS = new Set([
  ...LEVEL_ONE_GRANTED_ACTIONS.keys(),
  "juggling-arsenal",
  "technical-precision",
  "tuned-arsenal",
]);
const LEVEL_ONE_ALL_SLUGS = new Set([...LEVEL_ONE_ACTION_FEATS.keys(), ...LEVEL_ONE_PASSIVE_FEATS]);

// Archetype feats with an action cost grant separate activity items. This keeps
// progression choices in SoW Feats and executable rules in SoW Actions.
const ARCHETYPE_GRANTED_ACTION_UUIDS = new Map([
  ["apex-instincts", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.hH0PDFWR7JhZH1dj"],
  ["overture-draw", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.eYGIzXg4iDZ7Wvpp"],
  ["rhythmic-parade", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.neWoHi1mJ7EzwHNz"],
  ["abrupt-tempo", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.aCl72o9HIaSbnkyq"],
  ["supportive-pitch", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.5PEm7n86mmtv17sS"],
  ["synchronized-chorus", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.4ljTOU7JyTDxIc3e"],
  ["discordant-disruption", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.Hfui5k8eHJq5l0cJ"],
  ["backing-track", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.ky1tufqT3HBmQDAc"],
  ["choreographed-surge", "Compendium.pf2e-symphonies-of-war.sow-actions.Item.pwSqyUAhPDYjDMy2"],
]);

const ARCHETYPE_EXTRA_GRANTED_ACTION_UUIDS = new Map([
  ["signature-formation", [
    "Compendium.pf2e-symphonies-of-war.sow-actions.Item.ejBihOLb06075LJO",
    "Compendium.pf2e-symphonies-of-war.sow-actions.Item.K5Pox5GCk8ox2kk6",
  ]],
]);

// Level-2 class feats. Action feats receive the same native PF2e Use control as
// the level-1 activities; passive feats are represented with Rule Elements and
// runtime hooks.
const LEVEL_TWO_ACTION_FEATS = new Map([
  ["deafening-clash", { actions: 2 }],
  ["heartbeat-dissonance", { actions: 1 }],
  ["jarring-motif", { actions: 1 }],
  ["staggering-display", { actions: 2 }],
  ["staggering-strike", { actions: 2 }],
]);
const LEVEL_TWO_PASSIVE_FEATS = new Set([
  "honed-cadence",
  "sidestep-sync",
  "vigorous-brace",
  "visceral-presence",
]);
const LEVEL_TWO_ALL_SLUGS = new Set([...LEVEL_TWO_ACTION_FEATS.keys(), ...LEVEL_TWO_PASSIVE_FEATS]);
const CRESCENDO_EXECUTION_OPTION = `${MODULE_ID}:crescendo-strike`;

// ── Adaptive Measure: passive immunity watcher ──
// PF2e exposes both permanent actor immunities and temporary Immunity rule elements
// through the prepared `system.attributes.immunities` collection. Action-specific
// temporary immunities (such as Demoralize immunity) are represented by embedded
// effects, so those are inspected separately and, when possible, matched to their origin.
const ACTION_IMMUNITY_MAP = {
  demoralize: {
    note: 2,
    effectSlugs: ["frightened"],
    immunityTypes: ["auditory", "emotion", "fear-effects", "frightened", "mental"],
    actionAliases: ["demoralize"],
    traits: ["auditory", "emotion", "fear", "mental"],
  },
  grapple: {
    note: 1,
    effectSlugs: ["grabbed", "restrained"],
    immunityTypes: ["grabbed", "restrained"],
    actionAliases: ["grapple"],
    traits: ["attack"],
  },
  disarm: {
    note: 1,
    effectSlugs: [],
    immunityTypes: ["disarm"],
    actionAliases: ["disarm"],
    traits: ["attack"],
  },
  trip: {
    note: 4,
    effectSlugs: ["prone"],
    immunityTypes: ["prone", "trip"],
    actionAliases: ["trip"],
    traits: ["attack"],
  },
  shove: {
    note: 4,
    effectSlugs: [],
    immunityTypes: ["shove"],
    actionAliases: ["shove"],
    traits: ["attack"],
  },
};


// Known Virtuoso actions that can satisfy an Opening Note without using one of
// PF2e's five standard skill actions. Profiles are separated by note because a
// single activity such as Staggering Strike or Sweeping Accelerato can satisfy
// different notes depending on the current roll.
const ACTION_NOTE_IMMUNITY_MAP = {
  "deafening-clash": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy"] },
  },
  "heartbeat-dissonance": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy", "mental"], traits: ["mental"] },
  },
  "staggering-display": {
    4: { effectSlugs: ["prone"], immunityTypes: ["prone", "mental", "auditory"], traits: ["auditory", "emotion", "mental"] },
  },
  "staggering-strike": {
    1: { effectSlugs: ["grabbed"], immunityTypes: ["grabbed", "restrained"] },
    4: { effectSlugs: ["prone"], immunityTypes: ["prone"] },
  },
  "gravity-chord": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy", "auditory"], traits: ["auditory"] },
  },
  "combative-spotlight": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy", "mental", "auditory"], traits: ["auditory", "emotion", "mental"] },
  },
  "oppressive-spotlight": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy", "mental", "auditory"], traits: ["auditory", "emotion", "mental"] },
  },
  "double-cadenza": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy"] },
  },
  "flowing-sweep": {
    1: { immunityTypes: ["disarm"], actionAliases: ["disarm"] },
    4: { effectSlugs: ["prone"], immunityTypes: ["prone", "trip"], actionAliases: ["trip"] },
  },
  "sweeping-accelerato": {
    2: { effectSlugs: ["clumsy"], immunityTypes: ["clumsy"] },
    4: { immunityTypes: ["shove", "forced-movement"], actionAliases: ["push", "shove"] },
  },
  "sidestep-sync": {
    4: { immunityTypes: ["shove", "forced-movement"], actionAliases: ["push", "shove"] },
  },
  "visceral-demoralize": {
    2: { effectSlugs: ["frightened"], immunityTypes: ["emotion", "fear-effects", "frightened", "mental", "visual"], traits: ["emotion", "fear", "mental", "visual"], actionAliases: ["demoralize", "visceral-demoralize"] },
  },
};

// Conservative textual inference for actions from other classes, spells, or
// modules. Only direct result wording is matched. Phrases that merely grant a
// later Grapple/Trip attempt are deliberately ignored so Adaptive Measure does
// not fire before the actual maneuver is rolled.
const NOTE_EFFECT_PATTERNS = {
  1: [
    { effectSlug: "grabbed", immunityTypes: ["grabbed"], pattern: /\b(?:becomes?|is|remains?)\s+grabbed\b|\bgrabbed by (?:you|the)\b/i },
    { effectSlug: "restrained", immunityTypes: ["restrained"], pattern: /\b(?:becomes?|is|remains?)\s+restrained\b/i },
    { effectSlug: null, immunityTypes: ["disarm"], actionAliases: ["disarm"], pattern: /\b(?:disarms?|disarm the|succeed(?:s|ed)? (?:at|on) (?:an? )?disarm)\b/i },
  ],
  2: [
    { effectSlug: "frightened", immunityTypes: ["frightened", "fear-effects"], pattern: /\b(?:becomes?|is|remains?)\s+frightened\b|\binflict(?:s|ed|ing)?\s+(?:the\s+)?frightened\b|\bfrightened value increases\b/i },
    { effectSlug: "clumsy", immunityTypes: ["clumsy"], pattern: /\b(?:becomes?|is|remains?)\s+clumsy\b|\binflict(?:s|ed|ing)?\s+(?:the\s+)?clumsy\b/i },
    { effectSlug: "stupefied", immunityTypes: ["stupefied"], requiresFeature: "cognitive-dissonance", pattern: /\b(?:becomes?|is|remains?)\s+stupefied\b|\binflict(?:s|ed|ing)?\s+(?:the\s+)?stupefied\b/i },
  ],
  4: [
    { effectSlug: "prone", immunityTypes: ["prone", "trip"], actionAliases: ["trip"], pattern: /\bfalls? prone\b|\bknocked prone\b|\b(?:becomes?|is)\s+prone\b/i },
    { effectSlug: null, immunityTypes: ["shove", "forced-movement"], actionAliases: ["push", "shove"], pattern: /\bpush(?:es|ed)?\s+(?:the\s+)?(?:target|enemy|foe|creature|it)\b/i },
  ],
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function adaptiveMeasureItem(actor) {
  return actor?.items?.find((item) => item.slug === "adaptive-measure") ?? null;
}

function immunityTestStatements(actionSlug, descriptor = null) {
  const mapping = descriptor ?? ACTION_IMMUNITY_MAP[actionSlug];
  if (!mapping) return [];
  const statements = new Set([
    `action:${actionSlug}`,
    `item:slug:${actionSlug}`,
    `origin:action:slug:${actionSlug}`,
    "item:type:effect",
  ]);
  for (const alias of mapping.actionAliases ?? []) {
    const aliasSlug = slugify(alias);
    if (!aliasSlug) continue;
    statements.add(`action:${aliasSlug}`);
    statements.add(`item:slug:${aliasSlug}`);
    statements.add(`origin:action:slug:${aliasSlug}`);
  }
  for (const trait of mapping.traits ?? []) {
    statements.add(`item:trait:${trait}`);
    statements.add(`origin:action:trait:${trait}`);
  }
  if (mapping.effectSlugs?.length) statements.add("item:type:condition");
  for (const slug of mapping.effectSlugs ?? []) statements.add(`item:slug:${slug}`);
  return [...statements];
}

function preparedImmunities(targetActor) {
  const collection = targetActor?.system?.attributes?.immunities ?? targetActor?.attributes?.immunities ?? [];
  return Array.isArray(collection) ? collection : [...collection];
}

function immunityLabel(immunity) {
  try {
    const label = immunity?.label;
    if (typeof label === "string" && label.trim()) return label.trim();
  } catch (_error) {
    // Some synthetic immunity objects expose a getter that can fail before i18n is ready.
  }
  const type = String(immunity?.type ?? "immunity");
  const localization = CONFIG.PF2E?.immunityTypes?.[type];
  return localization ? game.i18n.localize(localization) : type.replaceAll("-", " ");
}

function effectOriginMatches(effect, virtuoso) {
  const originUuid = effect?.system?.context?.origin?.actor
    ?? effect?.flags?.pf2e?.origin?.actor
    ?? effect?.flags?.pf2e?.origin?.uuid
    ?? null;
  if (!originUuid) return true;
  if (originUuid === virtuoso?.uuid || originUuid === virtuoso?.id) return true;
  const originActor = globalThis.fromUuidSync?.(originUuid);
  return !!originActor && (originActor.uuid === virtuoso?.uuid || originActor.id === virtuoso?.id);
}

function activeEffectText(effect) {
  const source = effect?._source ?? effect?.toObject?.() ?? {};
  const relevant = {
    name: effect?.name,
    slug: effect?.slug ?? effect?.system?.slug,
    rollOptionSlug: effect?.rollOptionSlug,
    description: source.system?.description?.value,
    rules: source.system?.rules,
    context: source.system?.context,
    flags: source.flags,
  };
  try {
    return JSON.stringify(relevant).toLowerCase();
  } catch (_error) {
    return `${effect?.name ?? ""} ${effect?.slug ?? ""}`.toLowerCase();
  }
}

function isActiveTemporaryEffect(effect) {
  if (!effect || effect.type !== "effect") return false;
  if (effect.system?.expired || effect.isExpired) return false;
  return true;
}

function findActionSpecificImmunityEffects(targetActor, actionSlug, virtuoso, descriptor = null) {
  const mapping = descriptor ?? ACTION_IMMUNITY_MAP[actionSlug];
  if (!mapping) return [];
  const aliases = new Set([actionSlug, ...(mapping.actionAliases ?? [])].map((value) => value.replaceAll("-", " ")));
  const results = [];

  for (const effect of targetActor?.itemTypes?.effect ?? []) {
    if (!isActiveTemporaryEffect(effect) || !effectOriginMatches(effect, virtuoso)) continue;
    const text = activeEffectText(effect);
    const mentionsAction = [...aliases].some((alias) => text.includes(alias) || text.includes(alias.replaceAll(" ", "-")));
    const mentionsImmunity = /immun|inmun|temporary immunity|temporarily immune/.test(text);
    if (!mentionsAction || !mentionsImmunity) continue;
    results.push({
      kind: "temporary-action-immunity",
      type: `${actionSlug}-immunity`,
      label: effect.name || `${actionSlug.replaceAll("-", " ")} immunity`,
      source: effect.system?.context?.origin?.item ?? effect.sourceId ?? null,
      effectUuid: effect.uuid,
    });
  }
  return results;
}

function checkTargetImmunity(targetActor, actionSlug, virtuoso = null, descriptor = null) {
  const mapping = descriptor ?? ACTION_IMMUNITY_MAP[actionSlug];
  if (!targetActor || !mapping) return null;
  const statements = immunityTestStatements(actionSlug, mapping);
  const detected = [];
  const seen = new Set();

  // This is the canonical PF2e location displayed on creature sheets. It includes
  // source immunities, trait-derived immunities, and active Immunity rule elements.
  for (const immunity of preparedImmunities(targetActor)) {
    const type = String(immunity?.type ?? "").toLowerCase();
    let applies = false;
    const hasPredicateTest = typeof immunity?.test === "function";
    if (hasPredicateTest) {
      try {
        applies = immunity.test(statements);
      } catch (_error) {
        applies = false;
      }
    }
    // Plain source objects do not expose Immunity#test. Action-specific custom IWR
    // types such as Trip immunity may also lack a usable standard predicate.
    const needsDirectFallback = !hasPredicateTest || ["disarm", "trip", "shove"].includes(type);
    if (!applies && needsDirectFallback && (mapping.immunityTypes ?? []).includes(type)) applies = true;
    if (!applies && type === "custom") {
      const customText = `${immunityLabel(immunity)} ${immunity?.source ?? ""}`.toLowerCase();
      applies = (mapping.actionAliases ?? [actionSlug]).some((alias) => customText.includes(alias.replaceAll("-", " ")));
    }
    if (!applies) continue;

    const key = `iwr:${type}:${immunity?.source ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    detected.push({
      kind: "prepared-immunity",
      type: type || "custom",
      label: immunityLabel(immunity),
      source: immunity?.source ?? null,
    });
  }

  // Source-specific temporary immunity effects (Demoralize, Bon Mot-style effects, etc.)
  // are not necessarily part of the generic IWR collection.
  for (const entry of findActionSpecificImmunityEffects(targetActor, actionSlug, virtuoso, mapping)) {
    const key = `effect:${entry.effectUuid ?? entry.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    detected.push(entry);
  }

  let applicable = detected;
  for (const group of mapping.alternativeGroups ?? []) {
    const normalized = new Set(group.map((value) => String(value).toLowerCase()));
    const detectedTypes = new Set(applicable.map((entry) => String(entry.type ?? "").toLowerCase()));
    const allBlocked = [...normalized].every((type) => detectedTypes.has(type));
    if (!allBlocked) applicable = applicable.filter((entry) => !normalized.has(String(entry.type ?? "").toLowerCase()));
  }

  return applicable.length > 0
    ? { immunities: applicable, note: mapping.note, descriptor: sanitizeAdaptiveDescriptor(mapping) }
    : null;
}

function adaptivePromptKey(virtuoso, target, actionSlug) {
  return [
    virtuoso?.uuid ?? "unknown-actor",
    target?.uuid ?? "unknown-target",
    actionSlug,
    game.combat?.id ?? "no-combat",
    game.combat?.round ?? "no-round",
    game.combat?.turn ?? "no-turn",
  ].join("|");
}

function adaptiveMessageData(message) {
  return message?.flags?.[MODULE_ID]?.adaptiveMeasure ?? null;
}

function isAdaptiveAuthority(actor) {
  const activeGM = game.users?.activeGM;
  return activeGM ? game.user.isActiveGM : !!actor?.isOwner;
}

function adaptiveWhisperRecipients(actor) {
  const recipients = new Set(ChatMessage.getWhisperRecipients("GM").map((user) => user.id));
  for (const user of game.users ?? []) {
    if (!user.isGM && actor?.testUserPermission?.(user, "OWNER")) recipients.add(user.id);
  }
  if (!recipients.size && game.user) recipients.add(game.user.id);
  return [...recipients];
}

function cleanAdaptivePromptKey(message) {
  const data = adaptiveMessageData(message);
  if (data?.key && pendingAdaptivePromptKeys.get(data.key) === message.id) {
    pendingAdaptivePromptKeys.delete(data.key);
  }
}

async function deleteAdaptivePromptMessage(message) {
  if (!message) return;
  cleanAdaptivePromptKey(message);
  if (message.isOwner || game.user.isGM) await message.delete();
}

async function clearPendingAdaptivePromptsForActor(actorUuid) {
  const messages = (game.messages?.contents ?? []).filter((message) => {
    const data = adaptiveMessageData(message);
    return data?.actorUuid === actorUuid && ["prompt", "choose-strike"].includes(data.state);
  });
  for (const message of messages) {
    try {
      await deleteAdaptivePromptMessage(message);
    } catch (error) {
      console.warn("Symphonies of War | Failed to clear Adaptive Measure prompt:", error);
    }
  }
}

function adaptivePromptStillValid(data, actor, target) {
  const expectedNote = Number(data?.openingNote ?? data?.descriptor?.note ?? ACTION_IMMUNITY_MAP[data?.actionSlug]?.note ?? 0);
  const current = actor ? state(actor) : null;
  const sameTurn = !data?.combatId || (
    game.combat?.id === data.combatId
    && game.combat?.round === data.round
    && game.combat?.turn === data.turn
  );
  return !!(
    actor
    && target
    && expectedNote >= 1
    && adaptiveMeasureItem(actor)
    && hasBattleTempo(actor)
    && current?.openingNote === expectedNote
    && !current.completed
    && sameTurn
    && Number(data?.expiresAt ?? Date.now() + 1) > Date.now()
  );
}

function adaptiveTargetTokenUuid(message) {
  return message?.flags?.pf2e?.context?.target?.token
    ?? message?.target?.token?.document?.uuid
    ?? message?.target?.token?.uuid
    ?? game.user?.targets?.first?.()?.document?.uuid
    ?? null;
}

function allAdaptiveStrikes(actor) {
  const roots = Array.isArray(actor?.system?.actions) ? actor.system.actions : [];
  return roots.flatMap((root, rootIndex) => {
    const usages = [{ strike: root, rootIndex, altUsage: null }];
    for (const [altUsage, strike] of (root?.altUsages ?? []).entries()) {
      usages.push({ strike, rootIndex, altUsage });
    }
    return usages;
  }).filter(({ strike }) => {
    const item = strike?.item;
    const isMelee = item?.isMelee ?? (item?.system?.range == null);
    const echoingThrown = isEchoingRondo(actor) && weaponHasTrait(item, "thrown");
    return !!item && strike?.ready !== false && (isMelee || echoingThrown);
  });
}

function adaptiveStrikeLabel(strike) {
  const modifier = Number(strike?.totalModifier ?? NaN);
  const modifierLabel = Number.isFinite(modifier) ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";
  return `${strike?.label ?? strike?.item?.name ?? "Melee Strike"}${modifierLabel}`;
}

function adaptiveStrikeSelectionContent(actor, target) {
  const strikes = allAdaptiveStrikes(actor);
  const buttons = strikes.map(({ strike, rootIndex, altUsage }) => {
    const image = escapeHtml(strike.item?.img ?? "icons/svg/sword.svg");
    const alt = altUsage == null ? "" : String(altUsage);
    return `<button type="button" data-sow-action="adaptive-measure-strike" data-actor-uuid="${escapeHtml(actor.uuid)}" data-root-index="${rootIndex}" data-alt-usage="${alt}" style="display:flex;align-items:center;justify-content:flex-start;gap:6px;text-align:left"><img src="${image}" width="24" height="24" style="border:0;flex:0 0 24px"><span>${escapeHtml(adaptiveStrikeLabel(strike))}</span></button>`;
  }).join("");

  if (!buttons) {
    return `<div><p><strong>No ready melee Strike is available.</strong></p><p>Ready or equip a melee weapon, then trigger Adaptive Measure again.</p></div><div class="message-buttons"><button type="button" data-sow-action="adaptive-measure-cancel">Close</button></div>`;
  }

  return `<div><p><strong>Adaptive Measure:</strong> choose the ${isEchoingRondo(actor) ? "melee or thrown" : "melee"} Strike to make immediately against <strong>${escapeHtml(target.name)}</strong>.</p><p><small>The selected Strike is rolled at MAP 0 and cannot deal damage.</small></p></div><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons}<button type="button" data-sow-action="adaptive-measure-cancel">Cancel</button></div>`;
}


function adaptiveActionLabels(actionSlug, message = null, item = null) {
  const labels = new Set([
    String(actionSlug ?? "").replaceAll("-", " "),
    String(item?.name ?? ""),
  ]);
  const title = message?.flags?.pf2e?.context?.title;
  if (typeof title === "string") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = title;
    labels.add(wrapper.textContent ?? title);
  }
  const known = {
    demoralize: "Demoralize",
    grapple: "Grapple",
    disarm: "Disarm",
    trip: "Trip",
    shove: "Shove",
  };
  if (known[actionSlug]) labels.add(known[actionSlug]);
  return [...labels]
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length >= 3);
}

function adaptiveApplicationElement(app) {
  const element = app?.element;
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

function isAdaptiveActionDialog(element, app, labels) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest("#chat-log") || element.matches(".actor.sheet, .actor-sheet")) return false;
  const constructorName = String(app?.constructor?.name ?? "").toLowerCase();
  const classText = `${element.className ?? ""} ${constructorName}`.toLowerCase();
  const dialogLike = classText.includes("dialog")
    || classText.includes("action")
    || classText.includes("popover")
    || element.matches('[role="dialog"], .window-app.dialog, .application.dialog, .application.window-app')
    || !!element.querySelector("button.roll, button[data-action='roll'], button[data-action='roll-check'], button[data-action='use-action'], button[data-action='use'], button[type='submit']");
  if (!dialogLike) return false;

  const title = String(
    app?.title
      ?? app?.options?.title
      ?? element.querySelector(".window-title, .window-header h4, header h1, header h2")?.textContent
      ?? "",
  ).toLowerCase();
  const bodyText = String(element.textContent ?? "").toLowerCase();
  const matchesAction = labels.some((label) => title.includes(label) || bodyText.includes(label));
  if (!matchesAction) return false;

  return !!element.querySelector(
    "button.roll, button[data-action='roll'], button[data-action='roll-check'], button[data-action='use-action'], button[data-action='use'], button[type='submit']",
  );
}

function closeAdaptiveSourceDialogs(actionSlug, message = null, item = null) {
  if (typeof document === "undefined") return;
  const labels = adaptiveActionLabels(actionSlug, message, item);
  if (!labels.length) return;

  const closeOnce = () => {
    const applications = new Set(Object.values(ui.windows ?? {}));
    const v2Instances = foundry?.applications?.instances;
    if (v2Instances?.values) {
      for (const app of v2Instances.values()) applications.add(app);
    }

    for (const app of applications) {
      const element = adaptiveApplicationElement(app);
      if (!isAdaptiveActionDialog(element, app, labels)) continue;
      try {
        app.close?.();
      } catch (error) {
        console.warn("Symphonies of War | Could not close the intercepted action dialog.", error);
      }
    }

    for (const element of document.querySelectorAll(
      '.application, .window-app, [role="dialog"], .roll-modifiers-dialog',
    )) {
      if (!isAdaptiveActionDialog(element, null, labels)) continue;
      const closeButton = element.querySelector(
        "button[data-action='close'], .window-header button.close, .window-header .close, a.header-button.close",
      );
      closeButton?.click();
    }
  };

  // PF2e closes its modifier dialog synchronously, while HUD/action-description
  // applications can finish their own callback a tick later. Run a few short passes
  // so the intercepted immune action never leaves its source window hanging open.
  queueMicrotask(closeOnce);
  setTimeout(closeOnce, 50);
  setTimeout(closeOnce, 200);
  setTimeout(closeOnce, 500);
  setTimeout(closeOnce, 1000);

  // Some PF2e action browsers render the action explanation after the roll callback
  // has already started. Observe late ApplicationV2 insertions briefly so the source
  // Demoralize/Trip/etc. window is closed even when it appears after interception.
  if (typeof MutationObserver !== "undefined" && document.body) {
    const observer = new MutationObserver(() => closeOnce());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 1500);
  }
}

function adaptiveOutcomeFromRoll(roll) {
  const degree = Number(roll?.options?.degreeOfSuccess ?? roll?.degreeOfSuccess ?? NaN);
  return ["criticalFailure", "failure", "success", "criticalSuccess"][degree] ?? null;
}

function adaptiveOutcomeLabel(outcome) {
  return {
    criticalFailure: "Critical Failure",
    failure: "Failure",
    success: "Success",
    criticalSuccess: "Critical Success",
  }[outcome] ?? "Result";
}

function sanitizeAdaptiveDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object") return null;
  const note = Number(descriptor.note ?? 0);
  return {
    note: Number.isInteger(note) && note >= 1 && note <= 6 ? note : null,
    effectSlugs: [...new Set((descriptor.effectSlugs ?? []).map((value) => String(value)))],
    immunityTypes: [...new Set((descriptor.immunityTypes ?? []).map((value) => String(value)))],
    actionAliases: [...new Set((descriptor.actionAliases ?? []).map((value) => String(value)))],
    traits: [...new Set((descriptor.traits ?? []).map((value) => String(value)))],
    alternativeGroups: (descriptor.alternativeGroups ?? []).map((group) => [...new Set((group ?? []).map((value) => String(value)))])
      .filter((group) => group.length > 1),
    signatureMotif: descriptor.signatureMotif == null ? null : String(descriptor.signatureMotif),
  };
}

function sanitizeAdaptiveImmunities(immunity) {
  return (immunity?.immunities ?? []).map((entry) => ({
    kind: String(entry.kind ?? "immunity"),
    type: String(entry.type ?? "custom"),
    label: String(entry.label ?? "Immunity"),
    source: entry.source == null ? null : String(entry.source),
    effectUuid: entry.effectUuid == null ? null : String(entry.effectUuid),
  }));
}

async function requestAdaptiveMeasurePrompt(
  virtuoso,
  target,
  actionSlug,
  immunity,
  { messageId = null, targetTokenUuid = null, descriptor = null } = {},
) {
  if (!virtuoso || !target || !isAdaptiveAuthority(virtuoso)) return false;
  if (virtuoso.getFlag(MODULE_ID, "adaptiveMeasure")) return false;
  const mapping = sanitizeAdaptiveDescriptor(descriptor ?? immunity?.descriptor ?? ACTION_IMMUNITY_MAP[actionSlug]);
  if (!mapping?.note) return false;

  const key = adaptivePromptKey(virtuoso, target, actionSlug);
  const existingMessageId = pendingAdaptivePromptKeys.get(key);
  const existingMessage = existingMessageId
    ? game.messages?.get(existingMessageId)
    : (game.messages?.contents ?? []).find((message) => {
        const data = adaptiveMessageData(message);
        return data?.key === key && ["prompt", "choose-strike"].includes(data.state);
      });
  if (existingMessage) {
    pendingAdaptivePromptKeys.set(key, existingMessage.id);
    return false;
  }
  pendingAdaptivePromptKeys.delete(key);

  const actionName = actionSlug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const noteName = NOTES[mapping?.note]?.name ?? "Opening Note";
  const immunities = sanitizeAdaptiveImmunities(immunity);
  const immunityNames = immunities.map((entry) => escapeHtml(entry.label)).join(", ");
  const feature = adaptiveMeasureItem(virtuoso);
  const featureLink = feature?.uuid ? `@UUID[${feature.uuid}]{Adaptive Measure}` : "<strong>Adaptive Measure</strong>";
  const content = `<div><p><strong>${escapeHtml(virtuoso.name)}</strong> may use ${featureLink}. <strong>${escapeHtml(target.name)}</strong> is immune to <strong>${escapeHtml(actionName)}</strong>, which would normally satisfy <em>${escapeHtml(noteName)}</em>.</p>${immunityNames ? `<p><small>Detected immunity: ${immunityNames}</small></p>` : ""}<p>Use Adaptive Measure?</p></div><div class="message-buttons"><button type="button" data-sow-action="adaptive-measure-yes" data-actor-uuid="${escapeHtml(virtuoso.uuid)}">Yes</button><button type="button" data-sow-action="adaptive-measure-no" data-actor-uuid="${escapeHtml(virtuoso.uuid)}">No</button></div>`;

  const adaptiveMeasure = {
    key,
    requestId: foundry.utils.randomID(16),
    state: "prompt",
    actorUuid: virtuoso.uuid,
    targetUuid: target.uuid,
    targetTokenUuid: targetTokenUuid ?? null,
    actionSlug,
    openingNote: mapping.note,
    descriptor: mapping,
    immunities,
    sourceMessageId: messageId,
    combatId: game.combat?.id ?? null,
    round: game.combat?.round ?? null,
    turn: game.combat?.turn ?? null,
    createdAt: Date.now(),
    expiresAt: Date.now() + ADAPTIVE_PROMPT_TIMEOUT_MS,
  };

  const prompt = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: virtuoso }),
    style: CONST.CHAT_MESSAGE_STYLES.OOC,
    content,
    whisper: adaptiveWhisperRecipients(virtuoso),
    flags: { [MODULE_ID]: { actorUuid: virtuoso.uuid, adaptiveMeasure } },
  });
  if (!prompt) return false;

  pendingAdaptivePromptKeys.set(key, prompt.id);
  setTimeout(async () => {
    const current = game.messages?.get(prompt.id);
    const data = adaptiveMessageData(current);
    if (!current || !["prompt", "choose-strike"].includes(data?.state)) return;
    const actor = await fromUuid(data.actorUuid);
    if (isAdaptiveAuthority(actor)) await deleteAdaptivePromptMessage(current);
  }, ADAPTIVE_PROMPT_TIMEOUT_MS);
  return true;
}

function queueAdaptiveMeasurePrompt(virtuoso, target, actionSlug, immunity, options = {}) {
  const descriptor = sanitizeAdaptiveDescriptor(options.descriptor ?? immunity?.descriptor ?? ACTION_IMMUNITY_MAP[actionSlug]);
  if (!descriptor?.note) return;
  const payload = {
    type: "adaptiveMeasurePromptRequest",
    userId: game.user.id,
    actorUuid: virtuoso.uuid,
    targetUuid: target.uuid,
    actionSlug,
    descriptor,
    immunities: sanitizeAdaptiveImmunities(immunity),
    messageId: options.messageId ?? null,
    targetTokenUuid: options.targetTokenUuid ?? null,
  };
  const activeGM = game.users?.activeGM;
  if (activeGM && !game.user.isActiveGM) {
    game.socket?.emit(SOCKET_CHANNEL, payload);
  } else {
    void requestAdaptiveMeasurePrompt(
      virtuoso,
      target,
      actionSlug,
      { immunities: payload.immunities, note: descriptor.note, descriptor },
      { ...options, descriptor },
    );
  }
}

async function handleAdaptivePromptRequest(payload) {
  if (!game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const virtuoso = await fromUuid(payload?.actorUuid);
  const target = await fromUuid(payload?.targetUuid);
  if (!requester || !virtuoso || !target || !virtuoso.testUserPermission?.(requester, "OWNER")) return;
  const descriptor = sanitizeAdaptiveDescriptor(payload?.descriptor ?? ACTION_IMMUNITY_MAP[payload.actionSlug]);
  if (!descriptor?.note) return;
  const immunity = checkTargetImmunity(target, payload.actionSlug, virtuoso, descriptor)
    ?? { immunities: payload.immunities ?? [], note: descriptor.note, descriptor };
  if (!immunity.immunities?.length) return;
  await requestAdaptiveMeasurePrompt(virtuoso, target, payload.actionSlug, immunity, {
    messageId: payload.messageId ?? null,
    targetTokenUuid: payload.targetTokenUuid ?? null,
    descriptor,
  });
}

async function handleAdaptiveChatDecision(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const message = game.messages?.get(payload?.messageId);
  const data = adaptiveMessageData(message);
  const user = game.users?.get(payload?.userId);
  const actor = data?.actorUuid ? await fromUuid(data.actorUuid) : null;
  const target = data?.targetUuid ? await fromUuid(data.targetUuid) : null;
  if (!message || !data || !user || !actor || !actor.testUserPermission?.(user, "OWNER")) return;

  if (!payload.accepted) {
    await deleteAdaptivePromptMessage(message);
    return;
  }
  if (!adaptivePromptStillValid(data, actor, target)) {
    await message.update({
      content: `<p><strong>Adaptive Measure is no longer available for this trigger.</strong></p>`,
      [`flags.${MODULE_ID}.adaptiveMeasure.state`]: "expired",
    });
    cleanAdaptivePromptKey(message);
    return;
  }

  await message.update({
    content: adaptiveStrikeSelectionContent(actor, target),
    [`flags.${MODULE_ID}.adaptiveMeasure.state`]: "choose-strike",
    [`flags.${MODULE_ID}.adaptiveMeasure.acceptedBy`]: user.id,
  });
}

async function requestAdaptiveChatDecision(message, accepted) {
  const data = adaptiveMessageData(message);
  if (!data) return;
  if (game.user.isActiveGM || (!game.users?.activeGM && message.isOwner)) {
    await handleAdaptiveChatDecision({
      messageId: message.id,
      userId: game.user.id,
      accepted,
    });
  } else {
    game.socket?.emit(SOCKET_CHANNEL, {
      type: "adaptiveMeasureChatDecision",
      messageId: message.id,
      userId: game.user.id,
      accepted,
    });
  }
}

function resolveAdaptiveStrike(actor, rootIndex, altUsage) {
  const root = actor?.system?.actions?.[Number(rootIndex)];
  if (!root) return null;
  const strike = altUsage == null || altUsage === "" ? root : root.altUsages?.[Number(altUsage)];
  if (!strike) return null;
  const item = strike.item;
  const isMelee = item?.isMelee ?? (item?.system?.range == null);
  const echoingThrown = isEchoingRondo(actor) && weaponHasTrait(item, "thrown");
  return strike.ready !== false && (isMelee || echoingThrown) ? strike : null;
}

async function adaptiveTargetToken(data, target) {
  if (data?.targetTokenUuid) {
    const tokenDocument = await fromUuid(data.targetTokenUuid);
    if (tokenDocument?.object) return tokenDocument.object;
  }
  return target?.getActiveTokens?.(true, true)?.[0] ?? null;
}

async function consumeAdaptivePrompt(message, userId) {
  if (message.isOwner || game.user.isGM) {
    await deleteAdaptivePromptMessage(message);
  } else {
    game.socket?.emit(SOCKET_CHANNEL, {
      type: "adaptiveMeasureDeletePrompt",
      messageId: message.id,
      userId,
    });
  }
}

async function rollAdaptiveStrikeWithoutDamage(strike, params) {
  const item = strike?.item;
  if (!item) return strike?.variants?.[0]?.roll({ ...params, createMessage: false });

  // Prevent the PF2e CheckRoll from ever being published as a damaging attack.
  // Rolling with createMessage:false is the important part: no chat automation can
  // react until we have rewritten the finished roll and create the sanitized message.
  const hadOwnProperty = Object.prototype.hasOwnProperty.call(item, "dealsDamage");
  const originalDescriptor = Object.getOwnPropertyDescriptor(item, "dealsDamage");
  let patched = false;
  try {
    Object.defineProperty(item, "dealsDamage", {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? false,
      get: () => false,
    });
    patched = true;
  } catch (error) {
    console.warn("Symphonies of War | Could not shadow weapon.dealsDamage; the unpublished-roll path remains active.", error);
  }

  try {
    const roll = await strike.variants?.[0]?.roll({ ...params, createMessage: false });
    if (roll?.options) roll.options.damaging = false;
    return roll;
  } finally {
    if (patched) {
      try {
        if (hadOwnProperty && originalDescriptor) Object.defineProperty(item, "dealsDamage", originalDescriptor);
        else delete item.dealsDamage;
      } catch (error) {
        console.warn("Symphonies of War | Could not restore weapon.dealsDamage after Adaptive Measure.", error);
      }
    }
  }
}

async function adaptiveMeasureCheck(actor, target, targetToken, strike) {
  const modifier = Number(strike?.totalModifier ?? 0);
  const ac = Number(target?.getStatistic?.("ac")?.dc?.value ?? target?.system?.attributes?.ac?.value ?? NaN);
  if (!Number.isFinite(ac)) throw new Error(`Could not determine ${target?.name ?? "target"}'s AC.`);

  const roll = await new Roll(`1d20 + ${modifier}`).evaluate();
  const die = Number(roll.dice?.[0]?.total ?? 0);
  const total = Number(roll.total ?? 0);
  let degree = total >= ac + 10 ? 3 : total >= ac ? 2 : total <= ac - 10 ? 0 : 1;
  if (die === 20) degree = Math.min(3, degree + 1);
  if (die === 1) degree = Math.max(0, degree - 1);
  const labels = ["Critical Failure", "Failure", "Success", "Critical Success"];
  const classes = ["critical-failure", "failure", "success", "critical-success"];
  const outcome = labels[degree];
  const weaponName = strike?.item?.name ?? strike?.label ?? "selected weapon";

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<section class="sow-card"><h3>Adaptive Measure</h3><p><strong>${escapeHtml(weaponName)}</strong> attack modifier (${modifier >= 0 ? "+" : ""}${modifier}) against <strong>${escapeHtml(target.name)}</strong> AC ${ac}.</p><p>Result: <strong class="${classes[degree]}">${outcome}</strong>. This is a module-controlled check and cannot deal damage.</p></section>`,
    flags: { [MODULE_ID]: { actorUuid: actor.uuid, adaptiveMeasureCheck: true, weaponId: strike?.item?.id ?? null, targetUuid: target.uuid, degree } },
  });

  return degree >= 2;
}

async function useAdaptiveMeasureStrike(message, button) {
  const data = adaptiveMessageData(message);
  const actor = data?.actorUuid ? await fromUuid(data.actorUuid) : null;
  const target = data?.targetUuid ? await fromUuid(data.targetUuid) : null;
  if (!data || data.state !== "choose-strike" || !actor || !target || !canEdit(actor)) {
    return ui.notifications.warn("Adaptive Measure is no longer available.");
  }
  if (!adaptivePromptStillValid(data, actor, target)) {
    return ui.notifications.warn("Adaptive Measure is no longer available for that trigger.");
  }
  if (actor.getFlag(MODULE_ID, "adaptiveMeasure")) {
    return ui.notifications.warn("Adaptive Measure already has a check pending.");
  }

  const strike = resolveAdaptiveStrike(actor, button.dataset.rootIndex, button.dataset.altUsage);
  if (!strike) return ui.notifications.warn("That melee Strike is no longer available.");
  const targetToken = await adaptiveTargetToken(data, target);
  if (!targetToken) return ui.notifications.warn("The target token is no longer available on the current scene.");

  await actor.setFlag(MODULE_ID, "adaptiveMeasure", {
    targetUuid: target.uuid,
    targetTokenUuid: targetToken.document?.uuid ?? data.targetTokenUuid ?? null,
    actionSlug: data.actionSlug,
    immunityTypes: (data.immunities ?? []).map((entry) => entry.type),
    armedAt: Date.now(),
    promptMessageId: message.id,
    combatId: data.combatId,
    round: data.round,
    turn: data.turn,
    strikeItemId: strike.item?.id ?? null,
  });
  await consumeAdaptivePrompt(message, game.user.id);

  try {
    const success = await adaptiveMeasureCheck(actor, target, targetToken, strike);
    await actor.unsetFlag(MODULE_ID, "adaptiveMeasure");
    await actor.unsetFlag(MODULE_ID, "adaptiveNoDamage").catch(() => {});
    if (success) {
      await gainCombo(actor, 1, { complete: true, reason: "Adaptive Measure check succeeded; the Opening Note is preserved." });
    } else {
      await post(actor, "Adaptive Measure", "<p>The check failed. No Combo Chain was gained.</p>");
    }
  } catch (error) {
    await actor.unsetFlag(MODULE_ID, "adaptiveMeasure").catch(() => {});
    await actor.unsetFlag(MODULE_ID, "adaptiveNoDamage").catch(() => {});
    console.error("Symphonies of War | Adaptive Measure check failed:", error);
    ui.notifications.error("Adaptive Measure could not roll the selected weapon check.");
  }
}

async function handleAdaptiveDeletePrompt(payload) {
  if (!game.user.isActiveGM) return;
  const message = game.messages?.get(payload?.messageId);
  const data = adaptiveMessageData(message);
  const user = game.users?.get(payload?.userId);
  const actor = data?.actorUuid ? await fromUuid(data.actorUuid) : null;
  if (!message || !data || !user || !actor || !actor.testUserPermission?.(user, "OWNER")) return;
  await deleteAdaptivePromptMessage(message);
}

async function onModuleSocket(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === "guidingNoteStepPrompt") {
    await handleGuidingNoteStepPrompt(payload);
    return;
  }
  if (payload.type === "guidingNoteStepResponse") {
    await handleGuidingNoteStepResponse(payload);
    return;
  }
  if (payload.type === "adaptiveMeasurePromptRequest") {
    await handleAdaptivePromptRequest(payload);
    return;
  }
  if (payload.type === "adaptiveMeasureChatDecision") {
    await handleAdaptiveChatDecision(payload);
    return;
  }
  if (payload.type === "adaptiveMeasureDeletePrompt") {
    await handleAdaptiveDeletePrompt(payload);
    return;
  }
  if (payload.type === "subclassFinaleRequest") {
    await handleSubclassFinaleRequest(payload);
    return;
  }
  if (payload.type === "whirlingStrikeRequest") {
    await handleWhirlingStrikeRequest(payload);
    return;
  }
  if (payload.type === "whirlingFinishRequest") {
    await handleWhirlingFinishRequest(payload);
    return;
  }
  if (payload.type === "whirlingDamageRequest") {
    await handleWhirlingDamageRequest(payload);
    return;
  }
  if (payload.type === "whirlingClearRequest") {
    await handleWhirlingClearRequest(payload);
    return;
  }
  if (payload.type === "ricochetManeuverRequest") {
    await handleRicochetManeuverRequest(payload);
    return;
  }
  if (payload.type === "vitalizingStrikeRequest") {
    await handleVitalizingStrikeRequest(payload);
    return;
  }
  if (payload.type === "levelTwoActionRequest") {
    await handleLevelTwoActionRequest(payload);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function registerTraits() {
  const localized = (key) => game.i18n.localize(key);
  const classTraits = {
    finale: localized("SOW.TraitFinale"),
    upbeat: localized("SOW.TraitUpbeat"),
    virtuoso: localized("SOW.TraitVirtuoso"),
  };
  const acousticTraits = {
    "acoustic-wind": localized("SOW.TraitAcousticWind"),
    "acoustic-string": localized("SOW.TraitAcousticString"),
    "acoustic-percussion": localized("SOW.TraitAcousticPercussion"),
  };
  const descriptions = {
    finale: localized("SOW.TraitDescriptionFinale"),
    upbeat: localized("SOW.TraitDescriptionUpbeat"),
    virtuoso: localized("SOW.TraitDescriptionVirtuoso"),
    "acoustic-wind": localized("SOW.TraitDescriptionAcousticWind"),
    "acoustic-string": localized("SOW.TraitDescriptionAcousticString"),
    "acoustic-percussion": localized("SOW.TraitDescriptionAcousticPercussion"),
  };

  for (const config of ["actionTraits", "classTraits", "featTraits", "effectTraits"]) {
    if (CONFIG.PF2E?.[config]) foundry.utils.mergeObject(CONFIG.PF2E[config], classTraits, { inplace: true });
  }
  for (const config of ["weaponTraits", "shieldTraits", "equipmentTraits"]) {
    if (CONFIG.PF2E?.[config]) foundry.utils.mergeObject(CONFIG.PF2E[config], acousticTraits, { inplace: true });
  }
  // Prepared Crescendo Strikes use these class traits as real strike traits.
  if (CONFIG.PF2E?.weaponTraits) {
    foundry.utils.mergeObject(CONFIG.PF2E.weaponTraits, classTraits, { inplace: true });
    if (!CONFIG.PF2E.weaponTraits.force) CONFIG.PF2E.weaponTraits.force = "PF2E.TraitForce";
  }
  if (CONFIG.PF2E?.traitsDescriptions) {
    foundry.utils.mergeObject(CONFIG.PF2E.traitsDescriptions, descriptions, { inplace: true });
  }
}

function actorFromSpeaker(speaker) {
  if (!speaker) return null;
  const tokenActor = speaker.token && canvas?.scene?.tokens?.get(speaker.token)?.actor;
  return tokenActor ?? game.actors?.get(speaker.actor) ?? null;
}

function actorIdentityId(actor) {
  return actor?.id ?? actor?._id ?? null;
}

function sameActorIdentity(first, second) {
  if (!first || !second) return false;
  const firstId = actorIdentityId(first);
  const secondId = actorIdentityId(second);
  if (firstId && secondId) return firstId === secondId;
  return !!first.uuid && first.uuid === second.uuid;
}

function actorMatchesReference(actor, { uuid = null, id = null } = {}) {
  if (!actor) return false;
  if (id && actorIdentityId(actor) === id) return true;
  return !!uuid && actor.uuid === uuid;
}

async function resolveActorReference({ uuid = null, id = null } = {}) {
  if (uuid) {
    const byUuid = await fromUuid(uuid).catch?.(() => null) ?? null;
    if (byUuid) return byUuid;
  }
  if (id) {
    const tokenActor = canvas?.tokens?.placeables?.find((token) => token.actor?.id === id)?.actor ?? null;
    if (tokenActor) return tokenActor;
    const worldActor = game.actors?.get(id) ?? null;
    if (worldActor) return worldActor;
  }
  return null;
}

function canEdit(actor) {
  return !!actor?.isOwner || game.user.isGM;
}

function features(actor) {
  return new Set(actor?.items?.filter((i) => i.type === "feat").map((i) => i.slug).filter(Boolean) ?? []);
}

function hasLeveledFeat(actor, slug, minimumLevel) {
  const feat = actor?.itemTypes?.feat?.find((item) => item.slug === slug) ?? null;
  return !!feat && actorLevel(actor) >= Number(minimumLevel ?? feat.system?.level?.value ?? 0);
}

function actorHasMeasuredFinale(actor) {
  return hasLeveledFeat(actor, "measured-finale", 16);
}

function actorHasEndlessMeasure(actor) {
  return actorHasMeasuredFinale(actor) && hasLeveledFeat(actor, "endless-measure", 18);
}

function maxChains(actor) {
  const slugs = features(actor);
  if (slugs.has("masterful-composition")) return 10;
  if (slugs.has("symphonic-composition")) return 9;
  if (slugs.has("advanced-composition")) return 7;
  if (slugs.has("dynamic-composition")) return 5;
  return 3;
}

function hasBattleTempo(actor) {
  return Boolean(effectForActor(actor, "battleTempo"));
}

function comboChainsFromEffect(actor) {
  const effect = effectForActor(actor, "comboChain");
  if (!effect) return null;
  const value = Number(effect.system?.badge?.value ?? 0);
  return Number.isFinite(value) ? clamp(value, 0, maxChains(actor)) : 0;
}

function state(actor) {
  const data = foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG) ?? {});
  // The editable Combo Chain badge is authoritative. This lets a player or GM
  // correct the resource manually without having to touch module flags.
  const badgeChains = comboChainsFromEffect(actor);
  const sowFlagChains = actor.flags?.pf2e?.sow?.chains;
  const flagChains = Number(data.chains ?? 0);
  const chains = badgeChains ?? (sowFlagChains != null ? Number(sowFlagChains) : flagChains);
  return {
    chains,
    completed: !!data.completed,
    preserveReset: !!data.preserveReset,
    openingNote: Number(data.openingNote ?? 0),
    openingNoteInstance: data.openingNoteInstance ?? null,
    satisfiedNotes: data.satisfiedNotes ?? {},
    battleOvertureCombat: data.battleOvertureCombat ?? null,
    rhythmRecoveryUsedDay: data.rhythmRecoveryUsedDay ?? null,
    passTheBeatAllyUuid: data.passTheBeatAllyUuid ?? null,
    passTheBeatAllyId: data.passTheBeatAllyId ?? null,
    passTheBeatTurnKey: data.passTheBeatTurnKey ?? null,
    passTheBeatProgress: data.passTheBeatProgress ?? null,
    retainedUntil: Number(data.retainedUntil ?? 0),
    finaleUsedTurnKey: data.finaleUsedTurnKey ?? null,
    delayPending: !!data.delayPending,
    delayRound: Number(data.delayRound ?? 0),
    delayCombatId: data.delayCombatId ?? null,
    heroicCadenceLocked: !!data.heroicCadenceLocked,
    heroicCadenceUsedTurnKey: data.heroicCadenceUsedTurnKey ?? null,
  };
}

async function setState(actor, patch) {
  const next = foundry.utils.mergeObject(state(actor), patch, { inplace: false });
  next.chains = clamp(Number(next.chains ?? 0), 0, maxChains(actor));
  await actor.setFlag(MODULE_ID, FLAG, next);
  // Also set a PF2e-accessible flag for DamageDice formula evaluation
  await actor.setFlag('pf2e', 'sow', { ...(actor.flags?.pf2e?.sow ?? {}), chains: next.chains });
  await syncComboEffect(actor, next.chains);
  if (next.openingNote) await syncOpeningEffect(actor, next.openingNote);
  return next;
}

async function sourceFromUuid(uuid) {
  const item = await fromUuid(uuid);
  if (!item) throw new Error(`Missing Symphonies of War item: ${uuid}`);
  const source = item.toObject();
  delete source._id;
  source._stats ??= {};
  source._stats.compendiumSource = uuid;
  return source;
}

const LEGACY_DRAGGABLE_LINK_FOOTER = /Draggable effects and conditions:/i;
const LEGACY_FEAT_METADATA_IN_DESCRIPTION = /<strong>\s*(?:Traits:?|Prerequisites?:?|Prerequisite:?)\s*<\/strong>/i;
const LEGACY_EQUIPMENT_TRAITS_IN_DESCRIPTION = /<strong>\s*Traits:?\s*<\/strong>/i;
const LEGACY_BACKGROUND_METADATA_IN_DESCRIPTION = /<strong>\s*(?:Attribute Boosts:?|Skill:?|Lore:?|Feat:?)\s*<\/strong>/i;
const LEGACY_HYENA_SUPPORT_DESCRIPTION = /(?:Confirm manually that the frightened target is within the hyena\'s reach|While the Giant Hyena Support Benefit is active|increase this effect\'s badge to 2|The effect checks the frightened condition automatically)/i;
const DESCRIPTION_REFRESH_0627_SLUGS = new Set([
  "overture-draw", "supportive-pitch", "marching-troupe", "signature-formation", "unyielding-stamina",
  "combative-spotlight", "gravity-chord", "heartbeat-dissonance", "jarring-motif", "oppressive-spotlight",
  "resonant-disarm", "staggering-display", "staggering-strike", "abrupt-tempo", "defiant-anthem",
  "deflective-beat", "interrupting-beat", "punishing-beat", "triumphant-chord", "unbreakable-measure",
  "measured-step", "relentless-cadenza", "sweeping-accelerato", "adaptive-measure", "guiding-note",
  "heroic-cadence", "rhythm-recovery", "ricochet-tempo", "shatter-point-crescendo", "shattering-crescendo",
  "soothing-crescendo", "vibrating-crescendo", "vitalizing-strike", "whirling-crescendo",
  "battle-tempo", "quickening-tempo", "pass-the-beat", "virtuoso-weapon-expertise", "battle-overture",
  "dynamic-composition", "harmonic-focus", "advanced-composition", "greater-momentum", "momentum",
  "symphonic-composition", "dissonant-intent", "peerless-momentum", "unending-resonance", "crescendo-strike", "parrying-tempo",
  "the-captivating-solo", "the-clashing-duet", "the-echoing-rondo", "the-mending-hymn", "the-vigorous-march",
]);

function symphoniesCompendiumSource(item) {
  const source = String(item?._stats?.compendiumSource ?? item?.sourceId ?? "");
  return source.startsWith(`Compendium.${MODULE_ID}.`) ? source : null;
}

let canonicalFeatDescriptionIndexPromise = null;

async function canonicalFeatDescription(item) {
  if (item?.type !== "feat") return null;
  const pack = game.packs?.get(`${MODULE_ID}.sow-feats`);
  if (!pack) return null;

  canonicalFeatDescriptionIndexPromise ??= pack.getIndex({ fields: ["name", "system.slug"] });
  const index = await canonicalFeatDescriptionIndexPromise;
  const slug = item.slug ?? item.system?.slug;
  const entry = index.find((candidate) => (slug && candidate.system?.slug === slug) || candidate.name === item.name);
  if (!entry) return null;
  const canonical = await pack.getDocument(entry._id);
  return String(canonical?.system?.description?.value ?? "") || null;
}

let canonicalHyenaSupportEffectPromise = null;

async function canonicalHyenaSupportEffectData() {
  canonicalHyenaSupportEffectPromise ??= (async () => {
    const pack = game.packs?.get(`${MODULE_ID}.sow-companion-effects`);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["system.slug"] });
    const entry = index.find((candidate) => candidate.system?.slug === "effect-giant-hyena-support-benefit");
    if (!entry) return null;
    const canonical = await pack.getDocument(entry._id);
    if (!canonical) return null;
    return {
      "system.description.value": String(canonical.system?.description?.value ?? ""),
      "system.duration": foundry.utils.deepClone(canonical.system?.duration ?? {}),
      "system.rules": foundry.utils.deepClone(canonical.system?.rules ?? []),
      "system.badge": foundry.utils.deepClone(canonical.system?.badge ?? null),
    };
  })();
  return canonicalHyenaSupportEffectPromise;
}

async function canonicalInlineDescription(item) {
  const description = String(item?.system?.description?.value ?? "");
  const slug = item?.slug ?? item?.system?.slug;
  const needsMeasuredStepLink = slug === "measured-step"
    && description.includes("Supporting Harmony")
    && !description.includes("Effect: Measured Step - Supporting Harmony");
  const hasDuplicatedItemMetadata = ["feat", "action"].includes(item?.type) && LEGACY_FEAT_METADATA_IN_DESCRIPTION.test(description);
  const hasLegacyEquipmentTraits = ["weapon", "shield", "equipment", "consumable"].includes(item?.type) && LEGACY_EQUIPMENT_TRAITS_IN_DESCRIPTION.test(description);
  const hasLegacyBackgroundMetadata = item?.type === "background" && LEGACY_BACKGROUND_METADATA_IN_DESCRIPTION.test(description);
  const needsHyenaSupportRefresh = item?.type === "effect" && slug === "effect-giant-hyena-support-benefit" && LEGACY_HYENA_SUPPORT_DESCRIPTION.test(description);
  const needs0627Refresh = DESCRIPTION_REFRESH_0627_SLUGS.has(slug);
  if (!LEGACY_DRAGGABLE_LINK_FOOTER.test(description) && !needsMeasuredStepLink && !hasDuplicatedItemMetadata && !hasLegacyEquipmentTraits && !hasLegacyBackgroundMetadata && !needsHyenaSupportRefresh && !needs0627Refresh) return null;
  const sourceUuid = symphoniesCompendiumSource(item);
  if (!sourceUuid) return null;
  try {
    const source = await sourceFromUuid(sourceUuid);
    const canonical = String(source.system?.description?.value ?? "");
    if (!canonical || LEGACY_DRAGGABLE_LINK_FOOTER.test(canonical)) return null;
    return canonical;
  } catch (error) {
    // Archetype feats moved from sow-archetypes to sow-feats in 0.6.22. Older
    // embedded items keep their original source UUID, so resolve those by slug
    // from the unified feat pack instead of treating them as unrepairable.
    const canonical = await canonicalFeatDescription(item).catch(() => null);
    if (canonical && !LEGACY_DRAGGABLE_LINK_FOOTER.test(canonical)) return canonical;
    console.warn(`Symphonies of War | Could not refresh the generated description for ${item.name}.`, error);
    return null;
  }
}


const virtuosoProgressionSyncLocks = new Set();
let canonicalVirtuosoClassPromise = null;

function virtuosoClassItem(actor) {
  const prepared = actor?.class;
  if (prepared?.slug === "virtuoso") return prepared;
  return actor?.items?.find?.((item) => item.type === "class" && item.slug === "virtuoso") ?? null;
}

async function canonicalVirtuosoClassData() {
  canonicalVirtuosoClassPromise ??= (async () => {
    const pack = game.packs.get(`${MODULE_ID}.sow-classes`);
    if (!pack) throw new Error("The Symphonies of War class compendium is unavailable.");
    const index = await pack.getIndex({ fields: ["name", "system.slug"] });
    const entry = index.find((candidate) => candidate.system?.slug === "virtuoso" || candidate.name === "Virtuoso");
    if (!entry) throw new Error("The Virtuoso class could not be found in the class compendium.");
    const document = await pack.getDocument(entry._id);
    if (!document) throw new Error("The Virtuoso class document could not be loaded.");
    const items = foundry.utils.deepClone(document.system?.items ?? {});
    for (const entry of Object.values(items)) {
      if (entry?.name === "Battle Tempo Training") entry.name = "Battle Tempo";
      if (entry?.name === "Crescendo Strike Training") entry.name = "Crescendo Strike";
    }
    return { items };
  })();
  return canonicalVirtuosoClassPromise;
}

function progressionFeatureUuid(item) {
  return item?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

async function syncVirtuosoClassProgression(actor, { removeAboveLevel = true } = {}) {
  if (!game.user.isActiveGM || !actor?.isOfType?.("character")) return;
  const classItem = virtuosoClassItem(actor);
  if (!classItem) return;
  if (virtuosoProgressionSyncLocks.has(actor.uuid)) return;

  virtuosoProgressionSyncLocks.add(actor.uuid);
  try {
    const canonical = await canonicalVirtuosoClassData();
    const canonicalItems = foundry.utils.deepClone(canonical.items ?? {});

    // Actors created with an older module keep an embedded copy of the old class
    // item. Refresh its advancement table so PF2e's native level-up workflow can
    // grant future class features normally.
    if (JSON.stringify(classItem.system?.items ?? {}) !== JSON.stringify(canonicalItems)) {
      await actor.updateEmbeddedDocuments("Item", [{ _id: classItem.id, "system.items": canonicalItems }], { render: false });
    }

    const level = actorLevel(actor);
    const allEntries = Object.values(canonicalItems).filter((entry) => entry?.uuid);
    const eligibleEntries = allEntries.filter((entry) => Number(entry.level ?? 1) <= level);
    const classFeatures = actor.itemTypes?.feat?.filter((item) => item.system?.category === "classfeature") ?? [];
    const existingUuids = new Set(classFeatures.map(progressionFeatureUuid).filter(Boolean));
    const existingNames = new Set(classFeatures.map((item) => item.name));
    const sources = [];

    for (const entry of eligibleEntries) {
      if (existingUuids.has(entry.uuid) || existingNames.has(entry.name)) continue;
      const source = await sourceFromUuid(entry.uuid);
      source.system ??= {};
      source.system.level ??= {};
      source.system.level.value = Number(entry.level ?? source.system.level.value ?? 1);
      source.system.location = classItem.id;
      sources.push(source);
      existingUuids.add(entry.uuid);
      existingNames.add(entry.name);
    }

    if (sources.length) {
      await actor.createEmbeddedDocuments("Item", sources, { render: false });
      console.info(`Symphonies of War | Restored ${sources.length} missing Virtuoso class feature(s) for ${actor.name}.`);
    }

    // Mirror PF2e's native level-down cleanup, but only for entries that belong
    // to this class progression. Manually selected class feats are never touched.
    if (removeAboveLevel) {
      const entryLevels = new Map(allEntries.map((entry) => [entry.uuid, Number(entry.level ?? 1)]));
      const deletions = classFeatures
        .filter((item) => {
          const sourceUuid = progressionFeatureUuid(item);
          const featureLevel = sourceUuid ? entryLevels.get(sourceUuid) : null;
          return featureLevel != null && featureLevel > level && item.system?.location === classItem.id && !item.grantedBy;
        })
        .map((item) => item.id);
      if (deletions.length) await actor.deleteEmbeddedDocuments("Item", deletions, { render: false });
    }
  } finally {
    virtuosoProgressionSyncLocks.delete(actor.uuid);
  }
}

const EFFECT_SLUG_ALIASES = Object.freeze({
  battleTempo: ["battle-tempo", "effect-battle-tempo"],
  openingNote: ["opening-note", "effect-opening-note"],
  comboChain: ["combo-chain", "effect-combo-chain"],
});

const OFFICIAL_EFFECT_NAMES = Object.freeze({
  "battle-tempo": "Battle Tempo",
  "effect-battle-tempo": "Battle Tempo",
  "opening-note": "Opening Note",
  "effect-opening-note": "Opening Note",
  "combo-chain": "Combo Chain",
  "effect-combo-chain": "Combo Chain",
});

function effectKindFromSlug(slug) {
  return Object.entries(EFFECT_SLUG_ALIASES).find(([, aliases]) => aliases.includes(slug))?.[0] ?? null;
}

function effectForActor(actor, kind) {
  const aliases = EFFECT_SLUG_ALIASES[kind] ?? [];
  const sourceUuid = EFFECT_UUIDS[kind];
  const candidates = (actor?.itemTypes?.effect ?? []).filter((effect) =>
    effect._stats?.compendiumSource === sourceUuid
    || effect.sourceId === sourceUuid
    || aliases.includes(effect.slug)
  );
  if (kind === "comboChain") {
    candidates.sort((left, right) => Number(right.system?.badge?.value ?? 0) - Number(left.system?.badge?.value ?? 0));
  }
  return candidates[0] ?? null;
}

async function ensureEffect(actor, uuid, slug) {
  const kind = effectKindFromSlug(slug);
  const aliases = kind ? EFFECT_SLUG_ALIASES[kind] : [slug];
  const existing = actor.itemTypes.effect.find((effect) =>
    effect._stats?.compendiumSource === uuid
    || effect.sourceId === uuid
    || aliases.includes(effect.slug)
  );
  if (existing) {
    const officialName = OFFICIAL_EFFECT_NAMES[existing.slug] ?? OFFICIAL_EFFECT_NAMES[slug];
    if (officialName && existing.name !== officialName) await existing.update({ name: officialName }, { render: false });
    return existing;
  }
  const source = await sourceFromUuid(uuid);
  const officialName = OFFICIAL_EFFECT_NAMES[slug];
  if (officialName) source.name = officialName;
  const created = await actor.createEmbeddedDocuments("Item", [source]);
  return created[0];
}

async function ensureBattleTempo(actor) {
  await ensureEffect(actor, EFFECT_UUIDS.battleTempo, "effect-battle-tempo");
  await ensureEffect(actor, EFFECT_UUIDS.comboChain, "effect-combo-chain");
}

function comboEffectRules(actor, chains) {
  const rules = [];
  const value = Number(chains ?? 0);
  if (value > 0) {
    // The generic option is what enables the native Finale checkbox. The
    // numbered option remains useful to predicates and debugging.
    rules.push({ key: "RollOption", option: COMBO_READY_OPTION });
    rules.push({ key: "RollOption", option: `${COMBO_READY_OPTION}:${value}` });
    for (let threshold = 1; threshold <= value; threshold += 1) {
      rules.push({ key: "RollOption", option: `combo-chain-at-least:${threshold}` });
    }
  }

  const current = state(actor);
  if (current.finaleUsedTurnKey === currentTurnKey()) {
    rules.push({ key: "RollOption", option: FINALE_USED_OPTION });
  }

  const resolving = actor.getFlag(MODULE_ID, "finaleState")?.activeFinale;
  if (resolving) {
    rules.push({ key: "RollOption", option: `${FINALE_RESOLVING_OPTION}:${resolving}` });
  }
  return rules;
}

async function syncComboEffect(actor, value = state(actor).chains) {
  const effect = await ensureEffect(actor, EFFECT_UUIDS.comboChain, "effect-combo-chain");
  const max = maxChains(actor);
  const note = state(actor).openingNote;
  const noteName = note ? ` | Note: ${NOTES[note]?.name ?? "?"}` : "";
  const clamped = clamp(Number(value ?? 0), 0, max);
  const description = `<p>Combo Chain: <strong>${clamped}/${max}</strong>${noteName}</p><p>Maintained by Symphonies of War module.</p>`;
  const rules = comboEffectRules(actor, clamped);
  const update = {};
  if (Number(effect.system?.badge?.value ?? 0) !== clamped) update["system.badge.value"] = clamped;
  if (Number(effect.system?.badge?.max ?? 0) !== max) update["system.badge.max"] = max;
  if (effect.system?.description?.value !== description) update["system.description.value"] = description;
  if (JSON.stringify(effect.system?.rules ?? []) !== JSON.stringify(rules)) update["system.rules"] = rules;
  if (Object.keys(update).length) await effect.update(update, { [MODULE_ID]: { internalComboSync: true } });

  // Keep the editable badge, module state, and PF2e damage flag synchronized.
  const storedState = foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG) ?? {});
  if (Number(storedState.chains ?? 0) !== clamped) {
    await actor.setFlag(MODULE_ID, FLAG, { ...storedState, chains: clamped });
  }
  const existingChains = Number(actor.flags?.pf2e?.sow?.chains ?? 0);
  if (existingChains !== clamped) {
    await actor.setFlag("pf2e", "sow", { ...(actor.flags?.pf2e?.sow ?? {}), chains: clamped });
  }
  await syncFinaleDamageDice(actor);
  await syncLevelTwoRules(actor);
  scheduleVirtuosoUiRefresh(actor);
}

async function syncFinaleDamageDice(actor) {
  const chains = state(actor).chains;
  const resolvingState = actor.getFlag(MODULE_ID, "finaleState");
  const activeFinale = resolvingState?.activeFinale ?? activeFinaleSelection(actor);
  const damageChains = activeFinale === "crescendo-strike"
    ? Number(resolvingState?.diceChains ?? resolvingState?.totalChains ?? chains)
    : chains;

  const crescendoAction = actor.items.find((item) => item.slug === "crescendo-strike" && (item.type === "action" || (item.type === "feat" && item.system?.category === "classfeature")));
  if (!crescendoAction) return;

  const rules = foundry.utils.deepClone(crescendoAction.system?.rules ?? []);
  const ddRule = rules.find((rule) => rule.key === "DamageDice" && rule.slug === "crescendo-strike");
  const rtRule = rules.find((rule) => rule.key === "RollTwice" && rule.slug === "crescendo-strike-fortune");
  const dosRule = rules.find((rule) => rule.key === "AdjustDegreeOfSuccess" && rule.slug === "crescendo-strike-seven-chain-critical");
  let changed = false;

  if (ddRule) {
    const shouldDamage = activeFinale === "crescendo-strike" && damageChains > 0;
    if (shouldDamage) {
      if (ddRule.diceNumber !== damageChains || ddRule.ignored) {
        ddRule.diceNumber = damageChains;
        ddRule.ignored = false;
        changed = true;
      }
    } else if (ddRule.diceNumber !== 0 || !ddRule.ignored) {
      ddRule.diceNumber = 0;
      ddRule.ignored = true;
      changed = true;
    }
  }

  // Fortune is needed only while declaring the attack. Once the attack card
  // exists, the resolving option keeps damage active even though the checkbox
  // becomes disabled for the rest of the turn.
  if (rtRule) {
    const shouldFortune = activeFinaleSelection(actor) === "crescendo-strike" && chains >= 3;
    if (rtRule.ignored === shouldFortune) {
      rtRule.ignored = !shouldFortune;
      changed = true;
    }
  }

  // At seven or more committed Combo Chains, PF2e must know about the
  // degree-of-success upgrade before the Strike is rolled so the attack card,
  // critical-damage button, and downstream PF2e automation all agree that a
  // success is a critical success.
  if (dosRule) {
    const shouldUpgradeSuccess = activeFinaleSelection(actor) === "crescendo-strike" && chains >= 7;
    if (dosRule.ignored === shouldUpgradeSuccess) {
      dosRule.ignored = !shouldUpgradeSuccess;
      changed = true;
    }
  }

  if (changed) {
    await crescendoAction.update({ "system.rules": rules });
    actor.reset();
  }
}

async function syncOpeningEffect(actor, note = state(actor).openingNote) {
  if (!note) return;
  const current = state(actor);
  const effect = await ensureEffect(actor, EFFECT_UUIDS.openingNote, "effect-opening-note");
  await effect.update({
    "system.badge.value": Number(note),
    "system.description.value": `<p><strong>${NOTES[note].name}</strong></p><p>${noteText(actor, note)}</p><p><em>The module watches this turn for matching PF2e actions, checks, and conditions.</em></p>`,
    [`flags.${MODULE_ID}.openingNoteInstance`]: current.openingNoteInstance ?? null,
  });
}

function cadenceMotif(actor) {
  const slugs = features(actor);
  for (const [slug, motif] of Object.entries(SIGNATURE_MOTIFS)) {
    if (slugs.has(slug)) return motif;
  }
  return ["Signature Motif", "Satisfy the requirement of your Core Cadence's unique note."];
}

function noteText(actor, note) {
  if (Number(note) !== 6) return NOTES[note]?.text ?? "";
  const [name, text] = cadenceMotif(actor);
  return `<strong>${name}:</strong> ${text}`;
}

async function post(actor, title, body, options = {}) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<section class="sow-card"><h3>${title}</h3>${body}${options.buttons ?? ""}</section>`,
    flags: { [MODULE_ID]: { actorUuid: actor.uuid } },
  });
}

async function rollOpeningNote(actor) {
  await ensureBattleTempo(actor);
  const openingNoteInstance = `${currentTurnKey()}:${foundry.utils.randomID(8)}`;
  const roll = await new Roll("1d6").evaluate();
  let note = Number(roll.total);
  let rerolled = false;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<section class="sow-opening-note-flavor" data-sow-opening-note-instance="${escapeHtml(openingNoteInstance)}"><strong>Opening Note: ${NOTES[note].name}</strong><br>${noteText(actor, note)}<br><em>Monitoring actions and conditions this turn.</em></section>`,
    flags: { [MODULE_ID]: { actorUuid: actor.uuid, openingNote: note, openingNoteInstance } },
  });
  const precision = await technicalPrecisionChoice(actor);
  if (precision === note) {
    const useReroll = await Dialog.confirm({
      title: "Technical Precision",
      content: `<p>You rolled your practiced Note, <strong>${note}. ${NOTES[note].name}</strong>. Reroll it?</p><p>You must use the second result.</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false,
    }).catch(() => false);
    if (useReroll) {
      rerolled = true;
      const second = await new Roll("1d6").evaluate();
      note = Number(second.total);
      await second.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `<strong>Technical Precision reroll: ${NOTES[note].name}</strong><br>${noteText(actor, note)}` });
    }
  }
  await finalizeOpeningNote(actor, note, { rerolled, openingNoteInstance });
}

async function startBattleTempo(actor, { announce = false, force = false } = {}) {
  if (!canEdit(actor)) return ui.notifications.warn("You cannot edit that actor.");
  if (hasBattleTempo(actor) && !force) return post(actor, "Battle Tempo", "<p>You are already in Battle Tempo. The Opening Note changes only at the start of your turn.</p>");
  const before = state(actor);
  const retainedExpired = before.retainedUntil > 0 && Date.now() > before.retainedUntil;
  if (before.passTheBeatAllyUuid || before.passTheBeatAllyId) {
    const previousAlly = await resolveActorReference({ uuid: before.passTheBeatAllyUuid, id: before.passTheBeatAllyId });
    if (previousAlly) await clearPassTheBeatEffects({ sourceActorUuid: actor.uuid, sourceActorId: actor.id, allyActor: previousAlly });
  }
  await ensureBattleTempo(actor);
  if (isEchoingRondo(actor)) await ensureRicochetTempoEffect(actor);
  await setState(actor, {
    chains: retainedExpired ? 0 : before.chains,
    completed: false,
    preserveReset: false,
    satisfiedNotes: {},
    retainedUntil: 0,
    passTheBeatAllyUuid: null,
    passTheBeatAllyId: null,
    passTheBeatTurnKey: null,
    passTheBeatProgress: null,
    delayPending: false,
    delayRound: 0,
    delayCombatId: null,
    heroicCadenceLocked: false,
    heroicCadenceUsedTurnKey: null,
  });
  const slugs = features(actor);
  if (game.combat?.id && slugs.has("battle-overture") && state(actor).battleOvertureCombat !== game.combat.id) {
    await setState(actor, { chains: Math.max(state(actor).chains, 1), battleOvertureCombat: game.combat.id });
  }
  if (announce) await post(actor, "Battle Tempo", "<p>Stance started. Rolling Opening Note.</p>");
  await rollOpeningNote(actor);
  await offerRhythmicFlow(actor);
}

function queueComboGain(actor, task) {
  const key = actorIdentityId(actor) ?? actor?.uuid;
  if (!key) return task();

  const previous = comboGainQueues.get(key) ?? Promise.resolve();
  const queued = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (comboGainQueues.get(key) === queued) comboGainQueues.delete(key);
    });
  comboGainQueues.set(key, queued);
  return queued;
}

async function gainCombo(actor, amount = 1, { complete = false, reason = "", viaPassTheBeat = false } = {}) {
  return queueComboGain(actor, async () => {
    await ensureBattleTempo(actor);
    const current = state(actor);
    if (complete && current.heroicCadenceLocked) return current;
    if (!viaPassTheBeat && (current.passTheBeatAllyUuid || current.passTheBeatAllyId) && current.passTheBeatTurnKey === currentTurnKey()) return current;
    if (complete && current.completed) return current;

    let gain = Number(amount);
    const slugs = features(actor);
    if (complete && slugs.has("advanced-composition") && current.openingNote && !current.satisfiedNotes[current.openingNote]) gain = 2;

    const satisfiedNotes = { ...current.satisfiedNotes };
    if (complete && current.openingNote) satisfiedNotes[current.openingNote] = true;
    const next = await setState(actor, {
      chains: current.chains + gain,
      completed: complete ? true : current.completed,
      satisfiedNotes,
    });
    const prefix = reason ? `<p>${reason}</p>` : "";
    await post(actor, "Combo Chain", `${prefix}<p>Gained ${gain} Combo Chain. Current: <strong>${next.chains}/${maxChains(actor)}</strong>.</p>`);
    return next;
  });
}

async function resetCombo(actor, reason = "Combo Chain reset.") {
  const current = state(actor);
  const ally = await resolveActorReference({ uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId });
  if (ally) await clearPassTheBeatEffects({ sourceActorUuid: actor.uuid, sourceActorId: actor.id, allyActor: ally });
  else await clearPassTheBeatEffects({ sourceActorUuid: actor.uuid, sourceActorId: actor.id });
  for (const [key, candidate] of recentPassedHealingCandidates) {
    if (candidate.sourceActorUuid === actor.uuid) recentPassedHealingCandidates.delete(key);
  }
  await setState(actor, {
    chains: 0,
    completed: false,
    preserveReset: false,
    passTheBeatAllyUuid: null,
    passTheBeatAllyId: null,
    passTheBeatTurnKey: null,
    passTheBeatProgress: null,
    delayPending: false,
    delayRound: 0,
    delayCombatId: null,
    heroicCadenceLocked: false,
    heroicCadenceUsedTurnKey: null,
  });
  await post(actor, "Combo Chain", `<p>${reason}</p>`);
}

async function preserveCombo(actor) {
  await setState(actor, { preserveReset: true });
  await post(actor, "Combo Chain", "<p>Combo Chain will be preserved at the next end-of-turn reset check.</p>");
}

async function delayBattleTempo(actor) {
  if (!canEdit(actor)) return ui.notifications.warn("You cannot edit that actor.");
  if (!game.combat?.started) return ui.notifications.warn("Delay can only be prepared during an encounter.");
  if (!hasBattleTempo(actor)) return ui.notifications.warn("You must be in Battle Tempo to preserve its rhythm while Delaying.");
  const combatant = game.combat.combatants?.find((entry) => actorIdentityId(entry.actor) === actorIdentityId(actor));
  if (!combatant || actorIdentityId(game.combat.combatant?.actor) !== actorIdentityId(actor)) {
    return ui.notifications.warn("Use Delay during your own turn.");
  }
  const current = state(actor);
  if (current.delayPending && current.delayCombatId === game.combat.id && current.delayRound === game.combat.round) {
    return ui.notifications.warn("Battle Tempo is already being preserved for a delayed turn this round.");
  }
  await setState(actor, {
    delayPending: true,
    delayRound: Number(game.combat.round ?? 0),
    delayCombatId: game.combat.id,
  });
  await post(actor, "Delay", `<p>Your current <strong>Opening Note</strong> and <strong>${state(actor).chains} Combo Chain${state(actor).chains === 1 ? "" : "s"}</strong> are preserved while you Delay.</p><p>Take the delayed turn later this round using the combat tracker. If the round ends first, the normal end-of-turn reset is resolved.</p>`);
}

async function completeOpeningNoteManually(actor) {
  if (!canEdit(actor)) return ui.notifications.warn("You cannot edit that actor.");
  if (!hasBattleTempo(actor)) return ui.notifications.warn("You must be in Battle Tempo to complete an Opening Note.");
  const current = state(actor);
  if (!current.openingNote) return ui.notifications.warn("No Opening Note is currently active.");
  if (current.completed) return ui.notifications.info("The current Opening Note is already complete.");

  const noteName = NOTES[current.openingNote]?.name ?? "Opening Note";
  const passedAlly = await resolveActorReference({
    uuid: current.passTheBeatAllyUuid,
    id: current.passTheBeatAllyId,
  });
  if (passedAlly) {
    await completePassedNote(actor, passedAlly, `${noteName} was marked complete manually.`);
    return;
  }

  if (current.passTheBeatAllyUuid || current.passTheBeatAllyId) {
    await clearPassTheBeatState(actor, null);
  }
  await gainCombo(actor, 1, {
    complete: true,
    reason: `${noteName} was marked complete manually.`,
    viaPassTheBeat: true,
  });
}

async function spendCombo(actor, spent, { finale = false } = {}) {
  const current = state(actor);
  const value = clamp(Number(spent), 0, current.chains);
  const remaining = finale ? 0 : current.chains - value;
  await setState(actor, { chains: remaining, completed: current.completed });
  return value;
}

// Measured Finale: spend only chosen chains, retain the rest
async function spendComboPartial(actor, spent) {
  const current = state(actor);
  const value = clamp(Number(spent), 0, current.chains);
  const remaining = current.chains - value;
  await setState(actor, { chains: remaining, completed: current.completed });
  if (remaining > 0) {
    await post(actor, "Measured Finale", `<p>Spent <strong>${value} chain${value > 1 ? 's' : ''}</strong>. Retaining <strong>${remaining}</strong>.</p>`);
  }
  return value;
}

/**
 * Commit a Finale declaration as one actor update.
 *
 * The Combo Chain resource and the once-per-turn lock must change together.
 * Keeping them in separate updates allowed an older Combo Chain effect hook
 * to restore the previous badge value until the later damage roll.
 */
async function commitFinaleResourceSpend(actor, {
  spent,
  totalChains = state(actor).chains,
  measured = false,
  turnKey = currentTurnKey(),
  finaleState = null,
} = {}) {
  const total = clamp(Number(totalChains ?? 0), 0, maxChains(actor));
  const actualSpent = clamp(Number(spent ?? total), 0, total);
  const remaining = measured ? Math.max(0, total - actualSpent) : 0;
  const current = state(actor);
  const nextState = { ...current, chains: remaining, finaleUsedTurnKey: turnKey };
  const update = {
    [`flags.${MODULE_ID}.${FLAG}`]: nextState,
    "flags.pf2e.sow": { ...(actor.flags?.pf2e?.sow ?? {}), chains: remaining },
  };
  if (finaleState) update[`flags.${MODULE_ID}.finaleState`] = finaleState;

  await actor.update(update);
  await syncComboEffect(actor, remaining);
  if (nextState.openingNote) await syncOpeningEffect(actor, nextState.openingNote);
  return { spent: actualSpent, remaining, total, state: nextState };
}

function getFinaleThresholds(slug, chains) {
  const effects = [];
  if (slug === "crescendo-strike") {
    if (chains >= 3) effects.push("3+: Fortune — roll the Strike twice, use better result + 1d8 force per chain");
    if (chains >= 5) effects.push("5+: On success → Clumsy 1 (Clumsy 2 on crit)");
    if (chains >= 7) effects.push("7+: Success becomes Critical Success");
  } else if (slug === "whirling-crescendo") {
    if (chains >= 3) effects.push("3+: Up to 2 Strikes during movement");
    if (chains >= 5) effects.push("5+: Up to 3 Strikes, hit enemies get -10 Speed");
    if (chains >= 7) effects.push("7+: Up to 4 Strikes, +2 force per hit");
  } else if (slug === "soothing-crescendo") {
    if (chains >= 3) effects.push("3+: Cleanse frightened/sickened/clumsy");
    if (chains >= 5) effects.push("5+: Temp HP equal to your level");
    if (chains >= 7) effects.push("7+: Affect 2 allies instead of 1");
  } else if (slug === "vibrating-crescendo") {
    if (chains >= 3) effects.push("3+: Enemies take -2 to attacks not targeting you");
    if (chains >= 5) effects.push("5+: Additional resistance to all damage");
    if (chains >= 7) effects.push("7+: Enemies striking you take sonic damage");
  } else if (slug === "shattering-crescendo") {
    if (chains >= 3) effects.push("3+: Ignore frightened immunity");
    if (chains >= 5) effects.push("5+: On failure → Slowed 1");
    if (chains >= 7) effects.push("7+: 30-foot emanation (all enemies)");
  } else if (slug === "shatter-point-crescendo") {
    if (chains >= 3) effects.push("3+: Off-guard penalty worsens to -3");
    if (chains >= 5) effects.push("5+: Reduce physical resistances");
    if (chains >= 7) effects.push("7+: Weakness to physical damage");
  }
  return effects;
}

function showFinaleDialog(actor, finaleSlug, { allowChainChoice = false } = {}) {
  const current = state(actor);
  const chains = current.chains;
  allowChainChoice = !!allowChainChoice && actorHasMeasuredFinale(actor);
  if (current.finaleUsedTurnKey === currentTurnKey()) return ui.notifications.warn("You can use only one Finale per turn.");
  if (chains < 1) return post(actor, "Combo Chain", "<p>No Combo Chains available.</p>");

  const finaleName = finaleSlug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const slugs = features(actor);
  const hasEndlessMeasure = actorHasEndlessMeasure(actor);
  const chainOptions = Array.from({ length: chains }, (_, i) => i + 1).map(n => {
    const thresholds = getFinaleThresholds(finaleSlug, n);
    const label = `${n} chain${n > 1 ? 's' : ''}${n === chains ? ' (all)' : ''}${thresholds.length ? ' — ' + thresholds[thresholds.length - 1].split(':')[0] : ''}`;
    return `<option value="${n}" ${n === chains ? 'selected' : ''}>${label}</option>`;
  }).join('');

  const chainSelect = allowChainChoice
    ? `<div class="form-group"><label>Combo Chains to spend</label><select name="chains">${chainOptions}</select></div>`
    : `<p><strong>Spending:</strong> ${chains} chain${chains > 1 ? 's' : ''} (all)</p><input type="hidden" name="chains" value="${chains}">`;

  const allThresholds = getFinaleThresholds(finaleSlug, chains);
  const thresholdHTML = allThresholds.length ? `
    <div style="margin-top:8px;padding:6px;background:#f0f0f0;border-radius:3px;font-size:11px">
      <strong>Effects at ${chains} chains:</strong><br>${allThresholds.join('<br>')}
    </div>` : '';

  const endlessNote = hasEndlessMeasure && allowChainChoice
    ? `<p style="margin-top:8px;padding:4px 6px;background:#e8f4e8;border-radius:3px;font-size:11px"><strong>Endless Measure:</strong> Damage dice use all ${chains} chains, regardless of spend amount.</p>`
    : '';
  const retentionNote = allowChainChoice
    ? `<p style="margin-top:8px;font-size:11px;color:#666">Measured Finale: unspent chains are retained.</p>`
    : `<p style="margin-top:8px;font-size:11px;color:#666">Finale resets remaining chains to 0.</p>`;

  const content = `
    <form>
      ${chainSelect}
      ${thresholdHTML}
      ${endlessNote}
      ${retentionNote}
    </form>`;

  return new Promise((resolve) => {
    new Dialog({
      title: `${finaleName} — Finale`,
      content,
      buttons: {
        apply: {
          icon: '<i class="fa-solid fa-hand-fist"></i>',
          label: "Apply",
          callback: async (html) => {
            const spent = Number(html.find('[name="chains"]').val());
            await executeFinale(actor, finaleSlug, spent, { measured: allowChainChoice });
            resolve();
          },
        },
        cancel: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: "Cancel",
          callback: () => resolve(),
        },
      },
      default: "apply",
    }).render(true);
  });
}

async function executeFinale(actor, finaleSlug, spent, { measured = false } = {}) {
  const current = state(actor);
  const turnKey = currentTurnKey();
  if (current.finaleUsedTurnKey === turnKey) return ui.notifications.warn("You can use only one Finale per turn.");
  const currentChains = current.chains;
  if (currentChains < 1) return ui.notifications.warn("You need at least 1 Combo Chain.");
  const measuredActive = !!measured && actorHasMeasuredFinale(actor);
  const endlessActive = measuredActive && actorHasEndlessMeasure(actor);
  const requested = clamp(Number(spent ?? currentChains), 1, currentChains);
  const effectiveSpent = measuredActive ? requested : currentChains;
  await setState(actor, { finaleUsedTurnKey: turnKey });
  const diceChains = endlessActive ? currentChains : effectiveSpent;

  let actual;
  if (measuredActive) {
    actual = await spendComboPartial(actor, effectiveSpent);
  } else {
    actual = await spendCombo(actor, currentChains, { finale: true });
  }

  const finaleName = finaleSlug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

  if (["crescendo-strike", "shatter-point-crescendo"].includes(finaleSlug)) {
    const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll") ?? Roll;
    const die = finaleSlug === "shatter-point-crescendo" ? "d4" : "d8";
    const roll = await new DamageRoll(`${diceChains}${die}[force]`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${finaleName} — Force Damage (${diceChains} chain${diceChains > 1 ? 's' : ''})${measuredActive ? ' [Measured Finale]' : ''}`,
    });
  }

  const effects = getFinaleThresholds(finaleSlug, effectiveSpent);
  if (effects.length) {
    await post(actor, `${finaleName} — Effects`, `<ul>${effects.map(e => `<li>${e}</li>`).join('')}</ul>`);
  }
}

async function offerRhythmRecoveryOrReset(actor, reason) {
  const current = state(actor);
  if (current.chains <= 0) {
    await clearPassTheBeatState(actor);
    await setState(actor, { completed: false });
    return;
  }
  const slugs = features(actor);
  const today = new Date().toISOString().slice(0, 10);
  if (slugs.has("dynamic-composition") && current.rhythmRecoveryUsedDay !== today) {
    await post(actor, "Rhythm Recovery Available", `<p>${reason}</p><p>You have <strong>${current.chains} Combo Chain${current.chains > 1 ? "s" : ""}</strong> that would reset. Use Rhythm Recovery?</p><div class="sow-buttons" style="display:flex;gap:4px;margin-top:4px"><a data-sow-action="use-rhythm-recovery" data-actor-uuid="${actor.uuid}" style="cursor:pointer;padding:2px 8px;background:#4a90d9;color:white;border-radius:3px;font-size:12px">🎵 Preserve Chains (1/day)</a> <a data-sow-action="accept-reset" data-actor-uuid="${actor.uuid}" style="cursor:pointer;padding:2px 8px;background:#666;color:white;border-radius:3px;font-size:12px">Accept Reset</a></div>`);
    return;
  }
  await resetCombo(actor, reason);
}

function hasPendingPassTheBeat(actor) {
  const current = state(actor);
  return Boolean(current.passTheBeatAllyUuid || current.passTheBeatAllyId);
}

async function expirePassTheBeatAtSourceTurnStart(actor) {
  if (!hasPendingPassTheBeat(actor)) return false;

  const ally = await resolveActorReference({
    uuid: state(actor).passTheBeatAllyUuid,
    id: state(actor).passTheBeatAllyId,
  });
  await clearPassTheBeatState(actor, ally);
  await setState(actor, { completed: false });
  await offerRhythmRecoveryOrReset(
    actor,
    "The passed Opening Note expired at the start of your next turn.",
  );
  return true;
}

async function onEndTurn(combatant) {
  if (!game.user.isActiveGM || !combatant?.actor) return;
  const endingActor = combatant.actor;

  // Adaptive Measure is passive, but using it is optional. Clear both an unanswered
  // prompt and an accepted replacement Strike when the triggering turn ends.
  await clearPendingAdaptivePromptsForActor(endingActor.uuid);
  if (endingActor.getFlag(MODULE_ID, "adaptiveMeasure")) {
    await endingActor.unsetFlag(MODULE_ID, "adaptiveMeasure");
  }
  if (endingActor.getFlag(MODULE_ID, "adaptiveNoDamage")) {
    await endingActor.unsetFlag(MODULE_ID, "adaptiveNoDamage");
  }
  await cleanupFinaleEffectsForSource(endingActor, "source-turn-end");
  if (endingActor.getFlag(MODULE_ID, "whirlingCrescendo")) await endingActor.unsetFlag(MODULE_ID, "whirlingCrescendo");
  for (const flag of ["flowingSweep", "measuredStepGuiding", "doubleCadenzaBenefit", "doubleCadenzaDamageChoice", "flourishUsedTurnKey", "rhythmicFlow", "sidestepSync"]) await endingActor.unsetFlag(MODULE_ID, flag).catch(() => {});

  // Resolve any Pass the Beat that was waiting on this ally's turn.
  for (const virtuoso of passTheBeatCandidateActors()) {
    const pending = state(virtuoso);
    if (!actorMatchesReference(endingActor, { uuid: pending.passTheBeatAllyUuid, id: pending.passTheBeatAllyId })) continue;
    await clearPassTheBeatState(virtuoso, endingActor);
    await setState(virtuoso, { completed: false });
    await offerRhythmRecoveryOrReset(virtuoso, `${endingActor.name} did not fulfill the passed Opening Note before the end of their turn.`);
  }

  if (!hasBattleTempo(endingActor)) return;
  const current = state(endingActor);

  // Delay ends the current initiative slot but is still the same turn later in
  // the round. Preserve the current Opening Note, completion state, and chains.
  if (current.delayPending && current.delayCombatId === game.combat?.id && current.delayRound === Number(game.combat?.round ?? 0)) {
    return;
  }

  // Pass the Beat delays the reset until the first of its two expiry points:
  // the chosen ally's next turn ending or the Virtuoso's next turn starting.
  if (hasPendingPassTheBeat(endingActor)) {
    await setState(endingActor, { completed: false });
    return;
  }
  if (current.preserveReset) {
    await setState(endingActor, { preserveReset: false, completed: false });
    return;
  }
  if (!current.completed) {
    await offerRhythmRecoveryOrReset(endingActor, "Opening Note was not completed this turn.");
    return;
  }
  await setState(endingActor, { completed: false });
}

async function onStartTurn(combatant) {
  if (!game.user.isActiveGM || !combatant?.actor) return;
  const actor = combatant.actor;
  await cleanupFinaleEffectsForSource(actor, "source-turn-start");
  await actor.unsetFlag(MODULE_ID, "clashingMotif").catch(() => {});
  await actor.unsetFlag(MODULE_ID, "rhythmicFlow").catch(() => {});
  await actor.unsetFlag(MODULE_ID, "attackCount").catch(() => {});
  await actor.unsetFlag(MODULE_ID, "flowingSweep").catch(() => {});
  await clearGuidingNoteStepPromptForSource(actor);
  await actor.unsetFlag(MODULE_ID, "guidingNote").catch(() => {});
  await actor.unsetFlag(MODULE_ID, "flourishUsedTurnKey").catch(() => {});

  const tempHpGrant = actor.getFlag(MODULE_ID, "passBeatTempHp");
  if (tempHpGrant?.value) {
    const currentTemp = Number(actor.system?.attributes?.hp?.temp ?? 0);
    if (currentTemp <= Number(tempHpGrant.value)) await actor.update({ "system.attributes.hp.temp": 0 });
    await actor.unsetFlag(MODULE_ID, "passBeatTempHp");
  }

  const delayed = state(actor);
  if (
    hasBattleTempo(actor)
    && delayed.delayPending
    && delayed.delayCombatId === game.combat?.id
    && delayed.delayRound === Number(game.combat?.round ?? 0)
  ) {
    await setState(actor, { delayPending: false, delayRound: 0, delayCombatId: null });
    await post(actor, "Delay", "<p>You resume the delayed turn with the same Opening Note and Combo Chains.</p>");
    return;
  }

  // Heroic Cadence blocks further completion only for the turn in which the
  // Hero Point reroll failed. A resumed Delay is handled above and keeps the
  // same lock; a genuine new turn clears it before the new Opening Note.
  const currentTurnState = state(actor);
  if (currentTurnState.heroicCadenceLocked || currentTurnState.heroicCadenceUsedTurnKey) {
    await setState(actor, { heroicCadenceLocked: false, heroicCadenceUsedTurnKey: null });
  }
  await actor.unsetFlag(MODULE_ID, "doubleCadenzaBenefit").catch(() => {});

  // A resumed delayed turn is still the same turn. Any other return to the
  // Virtuoso's initiative is the second expiry point for Pass the Beat.
  if (hasBattleTempo(actor)) {
    await expirePassTheBeatAtSourceTurnStart(actor);
    await rollOpeningNote(actor);
  }
}

async function expireDelayedBattleTempo(combat) {
  if (!game.user.isActiveGM || !combat?.started) return;
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor || !hasBattleTempo(actor)) continue;
    const current = state(actor);
    if (!current.delayPending || current.delayCombatId !== combat.id || current.delayRound >= Number(combat.round ?? 0)) continue;
    await setState(actor, { delayPending: false, delayRound: 0, delayCombatId: null });
    if (current.preserveReset) {
      await setState(actor, { preserveReset: false, completed: false });
    } else if (!current.completed) {
      await offerRhythmRecoveryOrReset(actor, "Your delayed turn was not taken before the end of the round.");
    } else {
      await setState(actor, { completed: false });
    }
  }
}

// Unending Resonance: retain chains for a real ten-minute window after combat.
async function onCombatEnd(combat) {
  if (!game.user.isActiveGM) return;
  recentPassedHealingCandidates.clear();
  await clearPassTheBeatEffects();
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    await cleanupFinaleEffectsForSource(actor, "source-turn-start");
    await cleanupFinaleEffectsForSource(actor, "source-turn-end");
    const ricochetIds = (actor.itemTypes?.effect ?? []).filter((effect) => effect.slug === "ricochet-tempo-returning").map((effect) => effect.id);
    if (ricochetIds.length) await actor.deleteEmbeddedDocuments("Item", ricochetIds);
    if (actor.getFlag(MODULE_ID, "adaptiveMeasure")) await actor.unsetFlag(MODULE_ID, "adaptiveMeasure");
    if (actor.getFlag(MODULE_ID, "adaptiveNoDamage")) await actor.unsetFlag(MODULE_ID, "adaptiveNoDamage");
    if (actor.getFlag(MODULE_ID, "whirlingCrescendo")) await actor.unsetFlag(MODULE_ID, "whirlingCrescendo");
    if (actor.getFlag(MODULE_ID, "vitalizingStrikeCombat")) await actor.unsetFlag(MODULE_ID, "vitalizingStrikeCombat");
    if (actor.getFlag(MODULE_ID, "rhythmicFlow")) await actor.unsetFlag(MODULE_ID, "rhythmicFlow");
    if (actor.getFlag(MODULE_ID, "clashingMotif")) await actor.unsetFlag(MODULE_ID, "clashingMotif");
    if (actor.getFlag(MODULE_ID, "temporaryConditions")) await actor.unsetFlag(MODULE_ID, "temporaryConditions");
    const current = state(actor);
    const slugs = features(actor);
    if (slugs.has("unending-resonance") && current.chains > 0) {
      const retainedUntil = Date.now() + 10 * 60 * 1000;
      await setState(actor, { retainedUntil, preserveReset: false, completed: false, passTheBeatAllyUuid: null, passTheBeatAllyId: null, passTheBeatTurnKey: null, passTheBeatProgress: null, heroicCadenceLocked: false, heroicCadenceUsedTurnKey: null });
      await post(actor, "Unending Resonance", `<p>Your <strong>${current.chains} Combo Chain${current.chains > 1 ? "s" : ""}</strong> will persist until <strong>${new Date(retainedUntil).toLocaleTimeString()}</strong>.</p>`);
    } else if (current.chains > 0 || current.openingNote || current.passTheBeatAllyUuid || current.passTheBeatAllyId) {
      await setState(actor, { chains: 0, openingNote: 0, openingNoteInstance: null, completed: false, preserveReset: false, passTheBeatAllyUuid: null, passTheBeatAllyId: null, passTheBeatTurnKey: null, passTheBeatProgress: null, retainedUntil: 0, satisfiedNotes: {}, delayPending: false, delayRound: 0, delayCombatId: null, heroicCadenceLocked: false, heroicCadenceUsedTurnKey: null });
    }
  }
}

// ── Level 1 audit and automation ───────────────────────────────────────────
function levelOneRules(slug, { selection = null, choices = TUNED_ARSENAL_TRAITS } = {}) {
  if (slug === "technical-precision") {
    const choiceRule = {
      key: "ChoiceSet",
      prompt: "Choose the Opening Note you can reroll with Technical Precision",
      flag: TECHNICAL_PRECISION_SELECTION_FLAG,
      choices: TECHNICAL_PRECISION_NOTES.map((value) => ({ label: `${value}. ${NOTES[value].name}`, value })),
    };
    if (TECHNICAL_PRECISION_NOTES.includes(Number(selection))) choiceRule.selection = Number(selection);
    return [choiceRule];
  }
  if (slug === "juggling-arsenal") {
    return [
      {
        key: "AdjustStrike",
        mode: "add",
        property: "weapon-traits",
        value: "thrown-20",
        definition: ["item:melee", "item:hands-held:1", { not: "item:trait:thrown" }],
        predicate: ["self:effect:battle-tempo"],
      },
      {
        key: "AdjustStrike",
        mode: "add",
        property: "range-increment",
        value: 10,
        definition: ["item:ranged", "item:trait:thrown", "item:hands-held:1"],
        predicate: ["self:effect:battle-tempo"],
      },
    ];
  }
  if (slug === "tuned-arsenal") {
    const choiceRule = {
      key: "ChoiceSet",
      prompt: "Choose the weapon trait granted by Tuned Arsenal",
      flag: TUNED_ARSENAL_SELECTION_FLAG,
      choices: choices.map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value })),
    };
    if (selection) choiceRule.selection = selection;
    return [
      choiceRule,
      {
        key: "AdjustStrike",
        mode: "add",
        property: "weapon-traits",
        value: selection ?? `{item|flags.pf2e.rulesSelections.${TUNED_ARSENAL_SELECTION_FLAG}}`,
        definition: ["item:melee", { not: "item:trait:unarmed" }],
        predicate: [{ or: ["self:effect:battle-tempo", "battle-tempo"] }],
      },
    ];
  }
  return [];
}

function isManagedLevelOneRule(slug, rule) {
  if (!rule) return false;
  if (slug === "tuned-arsenal") {
    return (rule.key === "ChoiceSet" && rule.flag === TUNED_ARSENAL_SELECTION_FLAG)
      || (rule.key === "AdjustStrike" && rule.property === "weapon-traits");
  }
  if (slug === "technical-precision") return rule.key === "ChoiceSet" && rule.flag === "technicalPrecisionNote";
  if (slug === "juggling-arsenal") return rule.key === "AdjustStrike" && ["weapon-traits", "range-increment"].includes(rule.property);
  return false;
}

function normalizedLevelOneRules(item, slug) {
  const selection = slug === "tuned-arsenal"
    ? tunedArsenalSelection(item)
    : slug === "technical-precision"
      ? technicalPrecisionSelection(item)
      : null;
  const allowed = slug === "tuned-arsenal" && item?.parent
    ? availableTunedArsenalTraits(item.parent, item)
    : TUNED_ARSENAL_TRAITS;
  const choices = selection && !allowed.includes(selection) ? [...allowed, selection] : allowed;
  const desired = levelOneRules(slug, { selection, choices });
  if (!desired.length) return null;
  const existing = foundry.utils.deepClone(item.system?.rules ?? []).filter((rule) => !isManagedLevelOneRule(slug, rule));
  return [...existing, ...desired];
}

const LEVEL_ONE_GRANTED_ACTION_UUIDS = Object.freeze({
  "heroic-cadence": "Compendium.pf2e-symphonies-of-war.sow-actions.Item.Ol5Co79QMbnIZzea",
  "resonant-disarm": "Compendium.pf2e-symphonies-of-war.sow-actions.Item.IBGVCk9UbYwSfsSm",
});

function normalizeGrantedActionFeatRules(item, slug) {
  const actionUuid = LEVEL_ONE_GRANTED_ACTION_UUIDS[slug];
  if (!actionUuid) return foundry.utils.deepClone(item.system?.rules ?? []);
  const rules = foundry.utils.deepClone(item.system?.rules ?? []).filter((rule) => {
    if (rule?.key !== "GrantItem") return true;
    const uuid = String(rule.uuid ?? "");
    return !uuid.includes(`sow-actions.Item.`) || uuid === actionUuid;
  });
  if (!rules.some((rule) => rule?.key === "GrantItem" && String(rule.uuid ?? "") === actionUuid)) {
    rules.push({ key: "GrantItem", uuid: actionUuid });
  }
  return rules;
}

function ensureGrantedActivityRule(item, actionUuid) {
  const rules = foundry.utils.deepClone(item.system?.rules ?? []);
  if (!rules.some((rule) => rule?.key === "GrantItem" && String(rule.uuid ?? "") === actionUuid)) {
    rules.push({ key: "GrantItem", uuid: actionUuid });
  }
  return rules;
}

function normalizeArchetypeGrantedActionFeat(item) {
  if (!item || item.type !== "feat") return false;
  const slug = item.slug ?? item.system?.slug;
  const actionUuids = [
    ...(ARCHETYPE_GRANTED_ACTION_UUIDS.has(slug) ? [ARCHETYPE_GRANTED_ACTION_UUIDS.get(slug)] : []),
    ...(ARCHETYPE_EXTRA_GRANTED_ACTION_UUIDS.get(slug) ?? []),
  ].filter(Boolean);
  if (!actionUuids.length) return false;
  let rules = foundry.utils.deepClone(item.system?.rules ?? []);
  for (const actionUuid of actionUuids) rules = ensureGrantedActivityRule({ system: { rules } }, actionUuid);
  item.updateSource?.({
    "system.actionType.value": "passive",
    "system.actions.value": null,
    "system.selfEffect": null,
    "system.rules": rules,
  });
  return true;
}

function normalizeLevelOneItem(item) {
  if (!item) return false;
  const slug = item.slug ?? item.system?.slug;
  const update = {};
  if (LEVEL_ONE_ACTION_FEATS.has(slug)) {
    const actions = LEVEL_ONE_ACTION_FEATS.get(slug)?.actions ?? 1;
    update["system.actionType.value"] = "action";
    update["system.actions.value"] = actions;
    update["system.selfEffect"] = null;
  }
  if (LEVEL_ONE_GRANTED_ACTIONS.has(slug)) {
    const config = LEVEL_ONE_GRANTED_ACTIONS.get(slug);
    if (item.type === "action") {
      update["system.actionType.value"] = config.actionType;
      update["system.actions.value"] = config.actions;
      update["system.selfEffect"] = null;
    } else if (item.type === "feat") {
      update["system.actionType.value"] = "passive";
      update["system.actions.value"] = null;
      update["system.selfEffect"] = null;
      update["system.rules"] = normalizeGrantedActionFeatRules(item, slug);
    }
  }
  if (slug === "tuned-arsenal") update["system.maxTakable"] = TUNED_ARSENAL_TRAITS.length;
  const rules = normalizedLevelOneRules(item, slug);
  if (rules) update["system.rules"] = rules;
  if (!Object.keys(update).length) return false;
  item.updateSource?.(update);
  return true;
}

function tunedArsenalSelection(item) {
  const choiceRule = item?.system?.rules?.find((rule) =>
    rule.key === "ChoiceSet" && rule.flag === TUNED_ARSENAL_SELECTION_FLAG
  );
  const selected = item?.flags?.pf2e?.rulesSelections?.[TUNED_ARSENAL_SELECTION_FLAG]
    ?? item?.flags?.system?.rulesSelections?.[TUNED_ARSENAL_SELECTION_FLAG]
    ?? choiceRule?.selection
    ?? null;
  return TUNED_ARSENAL_TRAITS.includes(selected) ? selected : null;
}

function tunedArsenalFeats(actor) {
  return (actor?.itemTypes?.feat ?? []).filter((item) => item.slug === "tuned-arsenal");
}

function availableTunedArsenalTraits(actor, currentItem = null) {
  const used = new Set(tunedArsenalFeats(actor)
    .filter((item) => item.id !== currentItem?.id)
    .map(tunedArsenalSelection)
    .filter(Boolean));
  return TUNED_ARSENAL_TRAITS.filter((trait) => !used.has(trait));
}

function prepareTunedArsenalCreation(item) {
  const actor = item?.parent;
  if (!actor || item.slug !== "tuned-arsenal") return true;

  const available = availableTunedArsenalTraits(actor);
  if (!available.length) {
    ui.notifications.warn("Tuned Arsenal can be taken only once for each listed trait. This actor already has all five traits.");
    return false;
  }

  const incoming = tunedArsenalSelection(item);
  const used = new Set(tunedArsenalFeats(actor).map(tunedArsenalSelection).filter(Boolean));
  const duplicate = !!incoming && used.has(incoming);
  const selected = duplicate ? null : incoming;
  const unmanagedRules = foundry.utils.deepClone(item.system?.rules ?? [])
    .filter((rule) => !isManagedLevelOneRule("tuned-arsenal", rule));
  const flags = foundry.utils.deepClone(item._source?.flags ?? item.flags ?? {});
  if (duplicate) {
    if (flags.pf2e?.rulesSelections) delete flags.pf2e.rulesSelections[TUNED_ARSENAL_SELECTION_FLAG];
    if (flags.system?.rulesSelections) delete flags.system.rulesSelections[TUNED_ARSENAL_SELECTION_FLAG];
    ui.notifications.warn(`Tuned Arsenal is already using ${incoming}. The feat can be taken multiple times, but each copy must choose a different trait.`);
  }

  item.updateSource?.({
    flags,
    "system.maxTakable": TUNED_ARSENAL_TRAITS.length,
    "system.rules": [...unmanagedRules, ...levelOneRules("tuned-arsenal", { selection: selected, choices: available })],
  });
  return true;
}

async function finalizeTunedArsenalCreation(item) {
  const actor = item?.parent;
  if (!actor || item.slug !== "tuned-arsenal") return;
  const selection = tunedArsenalSelection(item);
  const duplicate = selection && tunedArsenalFeats(actor).some((other) => other.id !== item.id && tunedArsenalSelection(other) === selection);
  if (!duplicate) {
    if (selection) await repairTunedArsenalRules(item);
    return;
  }

  ui.notifications.warn(`Tuned Arsenal is already using ${selection}. Choose a different trait for this copy.`);
  const replacement = await promptTunedArsenalChoice(item);
  const stillDuplicate = !replacement || tunedArsenalFeats(actor).some((other) => other.id !== item.id && tunedArsenalSelection(other) === replacement);
  if (stillDuplicate && item.parent) {
    await item.delete({ render: false });
    ui.notifications.warn("The duplicate Tuned Arsenal feat was removed because no different trait was selected.");
  }
}

function technicalPrecisionSelection(item) {
  const choiceRule = item?.system?.rules?.find((rule) =>
    rule.key === "ChoiceSet" && rule.flag === TECHNICAL_PRECISION_SELECTION_FLAG
  );
  const selected = Number(
    item?.flags?.pf2e?.rulesSelections?.[TECHNICAL_PRECISION_SELECTION_FLAG]
      ?? item?.flags?.system?.rulesSelections?.[TECHNICAL_PRECISION_SELECTION_FLAG]
      ?? choiceRule?.selection
      ?? 0,
  );
  return TECHNICAL_PRECISION_NOTES.includes(selected) ? selected : null;
}

function technicalPrecisionFeat(actor) {
  return actor?.itemTypes?.feat?.find((item) => item.slug === "technical-precision") ?? null;
}

async function repairTechnicalPrecisionRules(item) {
  if (!item || item.slug !== "technical-precision") return false;
  const selection = technicalPrecisionSelection(item);
  if (!selection) return false;
  const rules = normalizedLevelOneRules(item, "technical-precision");
  const update = {};
  if (rules && JSON.stringify(rules) !== JSON.stringify(item.system?.rules ?? [])) update["system.rules"] = rules;
  if (Number(item.flags?.pf2e?.rulesSelections?.[TECHNICAL_PRECISION_SELECTION_FLAG] ?? 0) !== selection) {
    update[`flags.pf2e.rulesSelections.${TECHNICAL_PRECISION_SELECTION_FLAG}`] = selection;
  }
  if (item.flags?.system?.rulesSelections?.[TECHNICAL_PRECISION_SELECTION_FLAG] != null) {
    update[`flags.system.rulesSelections.-=${TECHNICAL_PRECISION_SELECTION_FLAG}`] = null;
  }
  if (!Object.keys(update).length) return false;
  await item.update(update, { [MODULE_ID]: { technicalPrecisionRepair: true }, render: false });
  return true;
}

async function promptTechnicalPrecisionChoice(item) {
  const actor = item?.parent;
  if (!actor || item.slug !== "technical-precision" || !canEdit(actor)) return null;

  const current = technicalPrecisionSelection(item);
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  let selected = null;
  const title = current ? "Change Technical Precision Note" : "Choose Technical Precision Note";
  const currentText = current
    ? `<p>Current Opening Note: <strong>${current}. ${escapeHtml(NOTES[current].name)}</strong>.</p>`
    : "";

  if (DialogV2?.wait) {
    selected = await DialogV2.wait({
      window: { title },
      position: { width: 460 },
      modal: true,
      content: `${currentText}<p>Choose the Opening Note that Technical Precision can reroll.</p>`,
      buttons: [
        ...TECHNICAL_PRECISION_NOTES.map((note, index) => ({
          action: String(note),
          label: `${note}. ${NOTES[note].name}`,
          default: current ? note === current : index === 0,
          callback: () => note,
        })),
        { action: "cancel", label: "Cancel", callback: () => null },
      ],
    }).catch((error) => {
      console.error("Symphonies of War | Technical Precision selection failed", error);
      return null;
    });
  } else {
    selected = await Dialog.wait({
      title,
      content: `<form>${currentText}<div class="form-group"><label>Opening Note</label><select name="note">${TECHNICAL_PRECISION_NOTES.map((note) => `<option value="${note}"${note === current ? " selected" : ""}>${note}. ${escapeHtml(NOTES[note].name)}</option>`).join("")}</select></div></form>`,
      buttons: {
        choose: { label: current ? "Change" : "Choose", callback: (html) => Number(html.querySelector?.('[name="note"]')?.value ?? html.find?.('[name="note"]').val() ?? 0) },
        cancel: { label: "Cancel", callback: () => null },
      },
      default: "choose",
      close: () => null,
    }).catch(() => null);
  }

  selected = Number(selected);
  if (!TECHNICAL_PRECISION_NOTES.includes(selected)) return null;
  if (selected === current) {
    ui.notifications.info(`Technical Precision is already set to ${selected}. ${NOTES[selected].name}.`);
    return current;
  }

  const unmanagedRules = foundry.utils.deepClone(item.system?.rules ?? [])
    .filter((rule) => !isManagedLevelOneRule("technical-precision", rule));
  const managedRules = levelOneRules("technical-precision", { selection: selected });
  await item.update({
    [`flags.pf2e.rulesSelections.${TECHNICAL_PRECISION_SELECTION_FLAG}`]: selected,
    [`flags.system.rulesSelections.-=${TECHNICAL_PRECISION_SELECTION_FLAG}`]: null,
    "system.rules": [...unmanagedRules, ...managedRules],
  }, { [MODULE_ID]: { technicalPrecisionReselection: true } });

  await repairTechnicalPrecisionRules(item);
  refreshVirtuosoUi(actor);
  ui.notifications.info(`Technical Precision now rerolls ${selected}. ${NOTES[selected].name}.`);
  return selected;
}

function refreshTunedArsenal(actor) {
  if (!actor) return;
  try { actor.reset?.(); } catch (_error) {}
  refreshVirtuosoUi(actor);
}

async function promptTunedArsenalChoice(item) {
  const actor = item?.parent;
  if (!actor || item.slug !== "tuned-arsenal" || !canEdit(actor)) return null;

  const current = tunedArsenalSelection(item);
  const choices = availableTunedArsenalTraits(actor, item);
  if (!choices.length) {
    ui.notifications.warn("All Tuned Arsenal traits are already selected on this actor.");
    return null;
  }

  const title = current ? "Change Tuned Arsenal Trait" : "Choose Tuned Arsenal Trait";
  const currentText = current
    ? `<p>Current trait: <strong>${current[0].toUpperCase() + current.slice(1)}</strong>.</p>`
    : "";
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  let selected = null;

  if (DialogV2?.wait) {
    selected = await DialogV2.wait({
      window: { title },
      position: { width: 420 },
      modal: true,
      content: `${currentText}<p>Choose the weapon trait your melee weapons gain while you are in Battle Tempo.</p>`,
      buttons: [
        ...choices.map((trait, index) => ({
          action: trait,
          label: trait[0].toUpperCase() + trait.slice(1),
          default: current ? trait === current : index === 0,
          callback: () => trait,
        })),
        { action: "cancel", label: "Cancel", callback: () => null },
      ],
    }).catch((error) => {
      console.error("Symphonies of War | Tuned Arsenal selection failed", error);
      return null;
    });
  } else {
    selected = await Dialog.wait({
      title,
      content: `<form>${currentText}<div class="form-group"><label>Weapon trait</label><select name="trait">${choices.map((trait) => `<option value="${trait}"${trait === current ? " selected" : ""}>${trait[0].toUpperCase() + trait.slice(1)}</option>`).join("")}</select></div></form>`,
      buttons: {
        choose: { label: current ? "Change" : "Choose", callback: (html) => html.querySelector?.('[name="trait"]')?.value ?? html.find?.('[name="trait"]').val() ?? null },
        cancel: { label: "Cancel", callback: () => null },
      },
      default: "choose",
      close: () => null,
    }).catch(() => null);
  }

  if (!TUNED_ARSENAL_TRAITS.includes(selected)) return null;
  if (selected === current) {
    ui.notifications.info(`Tuned Arsenal is already set to ${selected}.`);
    return current;
  }

  const unmanagedRules = foundry.utils.deepClone(item.system?.rules ?? [])
    .filter((rule) => !isManagedLevelOneRule("tuned-arsenal", rule));
  const managedRules = levelOneRules("tuned-arsenal", { selection: selected, choices });
  await item.update({
    [`flags.pf2e.rulesSelections.${TUNED_ARSENAL_SELECTION_FLAG}`]: selected,
    [`flags.system.rulesSelections.-=${TUNED_ARSENAL_SELECTION_FLAG}`]: null,
    "system.rules": [...unmanagedRules, ...managedRules],
  }, { [MODULE_ID]: { tunedArsenalReselection: true } });

  await repairTunedArsenalRules(item);
  refreshTunedArsenal(actor);
  ui.notifications.info(`Tuned Arsenal now grants the ${selected} trait while Battle Tempo is active.`);
  return selected;
}

function levelTwoRules(slug, actor = null) {
  if (slug === "honed-cadence") {
    const skill = cadenceSkillSlug(actor) ?? "athletics";
    return [
      { key: "FlatModifier", label: "Honed Cadence", selector: skill, slug: "honed-cadence", type: "status", value: 1, predicate: ["self:effect:battle-tempo"] },
      { key: "FlatModifier", label: "Honed Cadence", selector: skill, slug: "honed-cadence-greater", type: "status", value: 2, predicate: ["self:effect:battle-tempo", "combo-chain-at-least:5"] },
    ];
  }
  if (slug === "vigorous-brace") {
    return [{
      key: "ItemAlteration",
      itemType: "shield",
      mode: "add",
      property: "hardness",
      value: Math.max(0, actor ? state(actor).chains : 0),
      predicate: ["self:effect:battle-tempo", "virtuoso:cadence:vigorous-march", "item:equipped"],
    }];
  }
  return [];
}

function normalizeLevelTwoItem(item) {
  if (!item) return false;
  const slug = item.slug ?? item.system?.slug;
  const update = {};
  if (LEVEL_TWO_ACTION_FEATS.has(slug)) {
    const actions = LEVEL_TWO_ACTION_FEATS.get(slug)?.actions ?? 1;
    update["system.actionType.value"] = "action";
    update["system.actions.value"] = actions;
    update["system.selfEffect"] = null;
  }
  if (LEVEL_TWO_PASSIVE_FEATS.has(slug)) {
    update["system.actionType.value"] = "passive";
    update["system.actions.value"] = null;
    update["system.selfEffect"] = null;
  }
  if (slug === "visceral-presence") {
    const description = String(item.system?.description?.value ?? "");
    if (!description.includes('data-sow-action="visceral-demoralize"')) {
      update["system.description.value"] = `${description}<hr><p><strong>Foundry automation:</strong> while in Battle Tempo, target an enemy within 30 feet and use the button below instead of the normal Demoralize action.</p><button type="button" data-sow-action="visceral-demoralize">Visceral Demoralize</button>`;
    }
  }
  const desiredRules = levelTwoRules(slug, item.parent ?? null);
  if (desiredRules.length) update["system.rules"] = desiredRules;
  if (!Object.keys(update).length) return false;
  item.updateSource?.(update);
  return true;
}

async function syncLevelTwoRules(actor) {
  if (!actor) return;
  const updates = [];
  for (const item of actor.itemTypes?.feat ?? []) {
    if (!LEVEL_TWO_ALL_SLUGS.has(item.slug)) continue;
    const desired = levelTwoRules(item.slug, actor);
    if (desired.length && JSON.stringify(item.system?.rules ?? []) !== JSON.stringify(desired)) {
      updates.push({ _id: item.id, "system.rules": desired });
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { render: false });
}

function passTheBeatDescriptionV11(description) {
  return String(description ?? "")
    .replace(
      /Until the end of that ally(?:&#39;|')s next turn:/gi,
      "Until the end of that ally's next turn or until the start of your next turn:",
    )
    .replace(
      /until the end of the chosen ally(?:&#39;|')s turn\./gi,
      "until the end of the chosen ally's turn or the start of your next turn, whichever comes first.",
    );
}

function normalizePassTheBeatItem(item) {
  if (!item || (item.slug ?? item.system?.slug) !== "pass-the-beat") return false;
  const update = {};

  if (item.type === "feat" && item.system?.category === "classfeature") {
    // Pass the Beat is itself the class feature and the usable action. Keeping a
    // second granted action only creates a duplicate sheet entry.
    update["system.actionType.value"] = "action";
    update["system.actions.value"] = 1;
    update["system.selfEffect"] = null;
    update["system.description.value"] = passTheBeatDescriptionV11(item.system?.description?.value);
    const rules = foundry.utils.deepClone(item.system?.rules ?? []).filter((rule) => {
      const uuid = String(rule?.uuid ?? "");
      return !(rule?.key === "GrantItem" && uuid === LEGACY_DUPLICATE_ACTION_UUIDS.passTheBeat);
    });
    update["system.rules"] = rules;
  } else if (item.type === "action") {
    // Legacy duplicate. It is removed by the actor migration; strip the dummy
    // self-effect immediately so it never creates SOW Action Use meanwhile.
    update["system.actionType.value"] = "action";
    update["system.actions.value"] = 1;
    update["system.selfEffect"] = null;
    update["system.description.value"] = passTheBeatDescriptionV11(item.system?.description?.value);
  } else {
    return false;
  }

  item.updateSource?.(update);
  return true;
}

function stripThirdPartyTrait(item) {
  const traits = Array.isArray(item?.system?.traits?.value) ? item.system.traits.value : [];
  const filtered = traits.filter((trait) => !["third-party", "3rd-party"].includes(String(trait).toLowerCase()));
  if (filtered.length === traits.length) return false;
  item.updateSource?.({ "system.traits.value": filtered });
  return true;
}


function normalizedAcousticTraits(traits) {
  const values = [...new Set((traits ?? []).map((trait) => String(trait).toLowerCase()))];
  if (!values.includes("acoustic")) return values;
  const family = ["wind", "string", "percussion"].find((candidate) => values.includes(candidate));
  if (!family) return values;
  return values.filter((trait) => !["acoustic", "wind", "string", "percussion"].includes(trait)).concat(`acoustic-${family}`);
}

function normalizeAcousticItemTraits(item) {
  if (!item || !["weapon", "shield"].includes(item.type)) return false;
  const traits = Array.isArray(item.system?.traits?.value) ? item.system.traits.value : [];
  const normalized = normalizedAcousticTraits(traits);
  if (JSON.stringify(normalized) === JSON.stringify(traits)) return false;
  item.updateSource?.({ "system.traits.value": normalized });
  return true;
}

function companionModuleActive() {
  return game.modules?.get("pf2e-animal-companions")?.active === true;
}

function isSymphoniesCompanionItem(item) {
  const source = String(item?._stats?.compendiumSource ?? item?.sourceId ?? "");
  return source.includes("pf2e-symphonies-of-war.sow-companions");
}

function preventUnavailableCompanionCreation(item) {
  if (!isSymphoniesCompanionItem(item) || companionModuleActive()) return;
  ui.notifications.warn("SoW Companions require the optional PF2e Companion Compendia module.");
  return false;
}

async function configureCompanionPack() {
  if (!game.user.isActiveGM) return;
  const pack = game.packs?.get(`${MODULE_ID}.sow-companions`);
  if (!pack?.configure) return;
  const enabled = companionModuleActive();
  const ownership = enabled
    ? { PLAYER: "OBSERVER", TRUSTED: "OBSERVER", ASSISTANT: "OWNER", GAMEMASTER: "OWNER" }
    : { PLAYER: "NONE", TRUSTED: "NONE", ASSISTANT: "NONE", GAMEMASTER: "OWNER" };
  try {
    await pack.configure({ ownership });
  } catch (error) {
    console.warn("Symphonies of War | Could not update optional companion pack ownership.", error);
  }
}

function folderParentId(folder) {
  return folder?.folder?.id ?? folder?.folder ?? null;
}

function findCompendiumFolder(name, parent = null) {
  const parentId = parent?.id ?? parent ?? null;
  return [...(game.folders ?? [])].find((folder) =>
    folder.type === "Compendium"
    && folder.name === name
    && folderParentId(folder) === parentId
  ) ?? null;
}

async function ensureCompendiumFolder(name, { parent = null, sort = 0 } = {}) {
  let folder = findCompendiumFolder(name, parent);
  if (!folder) {
    folder = await Folder.create({
      name,
      type: "Compendium",
      folder: parent?.id ?? parent ?? null,
      sorting: "m",
      sort,
    });
    return folder;
  }

  const update = {};
  if (folder.sorting !== "m") update.sorting = "m";
  if (Number(folder.sort ?? 0) !== sort) update.sort = sort;
  if (Object.keys(update).length) await folder.update(update);
  return folder;
}

async function placeCompendiumPack(packName, folder, sort) {
  const pack = game.packs?.get(`${MODULE_ID}.${packName}`);
  if (!pack) return;
  if (pack.folder?.id !== folder?.id) await pack.setFolder(folder);
  if (Number(pack.sort ?? 0) !== sort) await pack.configure({ sort });
}

async function organizeCompendiumPacks() {
  if (!game.user.isActiveGM) return;
  const root = await ensureCompendiumFolder("Symphonies of War", { sort: 100000 });
  // Root contents and package groups use alphabetical manual sort. Level
  // folders inside SoW Feats/Class intentionally remain numeric.
  const characterBuilding = await ensureCompendiumFolder("Character Building", { parent: root, sort: 100000 });
  const effects = await ensureCompendiumFolder("Effects", { parent: root, sort: 200000 });

  await placeCompendiumPack("sow-journals", root, 300000);
  for (const [index, packName] of [
    "sow-actions",
    "sow-backgrounds",
    "sow-class-features",
    "sow-classes",
    "sow-companions",
    "sow-equipment",
    "sow-feats",
  ].entries()) {
    await placeCompendiumPack(packName, characterBuilding, (index + 1) * 100000);
  }
  await placeCompendiumPack("sow-companion-effects", effects, 100000);
  await placeCompendiumPack("sow-effects", effects, 200000);

  // 0.6.17-0.6.21 used a nested pack folder named SoW Feats. Remove it once
  // its packs have been moved into Character Building, otherwise it remains as
  // an empty folder in worlds that already initialized the old manifest.
  const obsoleteFeatFolder = findCompendiumFolder("SoW Feats", characterBuilding);
  if (obsoleteFeatFolder) {
    const containsPack = [...(game.packs ?? [])].some((pack) => pack.folder?.id === obsoleteFeatFolder.id);
    const containsFolder = [...(game.folders ?? [])].some((folder) => folderParentId(folder) === obsoleteFeatFolder.id);
    if (!containsPack && !containsFolder) await obsoleteFeatFolder.delete();
  }
}

function stripSowActionUseFromItem(item) {
  if (!item) return false;
  const selfEffect = item.system?.selfEffect;
  const uuid = String(selfEffect?.uuid ?? "");
  const name = String(selfEffect?.name ?? "");
  if (!selfEffect || (!uuid.includes("9n99ovcRlf1U4LAy") && name !== "SOW Action Use")) return false;
  item.updateSource?.({ "system.selfEffect": null });
  return true;
}

function officialFeatureDescription(item, legacyName) {
  const description = String(item.system?.description?.value ?? "");
  return description.replace(`<p><em>This class feature grants the ${legacyName} action.</em></p>`, "");
}

function normalizeCoreClassFeatureItem(item) {
  if (!item || item.type !== "feat" || item.system?.category !== "classfeature") return false;
  const slug = item.slug ?? item.system?.slug;
  const name = String(item.name ?? "");
  const update = {};
  let rules = foundry.utils.deepClone(item.system?.rules ?? []);

  if (["battle-tempo", "battle-tempo-training"].includes(slug) || name === "Battle Tempo Training") {
    update.name = "Battle Tempo";
    update["system.slug"] = "battle-tempo";
    update["system.actionType.value"] = "action";
    update["system.actions.value"] = 1;
    update["system.selfEffect"] = null;
    update["system.description.value"] = officialFeatureDescription(item, "Battle Tempo");
    rules = rules.filter((rule) => {
      const uuid = String(rule?.uuid ?? "");
      return !(rule?.key === "GrantItem" && uuid === LEGACY_DUPLICATE_ACTION_UUIDS.battleTempo);
    });
    update["system.rules"] = rules;
  } else if (["crescendo-strike", "crescendo-strike-training"].includes(slug) || name === "Crescendo Strike Training") {
    update.name = "Crescendo Strike";
    update["system.slug"] = "crescendo-strike";
    update["system.actionType.value"] = "passive";
    update["system.actions.value"] = null;
    update["system.selfEffect"] = null;
    update["system.description.value"] = officialFeatureDescription(item, "Crescendo Strike");
    rules = rules.filter((rule) => {
      const uuid = String(rule?.uuid ?? "");
      if (rule?.key === "GrantItem" && uuid === LEGACY_DUPLICATE_ACTION_UUIDS.crescendoStrike) return false;
      if (rule?.key === "DamageDice" && ["crescendo-strike", "finale-force-damage"].includes(rule.slug)) return false;
      if (rule?.key === "RollTwice" && JSON.stringify(rule?.predicate ?? "").includes("crescendo-strike")) return false;
      if (rule?.key === "RollOption" && String(rule?.option ?? "").includes("crescendo-strike")) return false;
      return true;
    });
    rules.push(...finaleActionRules("crescendo-strike"));
    update["system.rules"] = rules;
  }

  if (!Object.keys(update).length) return false;
  item.updateSource?.(update);
  return true;
}

function stripLegacyCrescendoRules(item) {
  if (!item || item.slug !== "crescendo-strike-training") return false;
  const rules = foundry.utils.deepClone(item.system?.rules ?? []);
  const filtered = rules.filter((rule) => {
    if (rule.key === "GrantItem") return true;
    if (rule.key === "DamageDice" && ["crescendo-strike", "finale-force-damage"].includes(rule.slug)) return false;
    if (rule.key === "RollTwice" && String(rule.predicate ?? "").includes("crescendo-strike")) return false;
    if (rule.key === "RollOption" && String(rule.option ?? "").includes("crescendo-strike")) return false;
    return true;
  });
  if (JSON.stringify(filtered) === JSON.stringify(rules)) return false;
  item.updateSource?.({ "system.rules": filtered });
  return true;
}

async function technicalPrecisionChoice(actor) {
  const feat = technicalPrecisionFeat(actor);
  if (!feat) return null;
  return technicalPrecisionSelection(feat);
}

async function finalizeOpeningNote(actor, note, { rerolled = false, openingNoteInstance = null } = {}) {
  await setState(actor, {
    openingNote: note,
    openingNoteInstance: openingNoteInstance ?? `${currentTurnKey()}:${foundry.utils.randomID(8)}`,
    completed: false,
    preserveReset: false,
  });
  if (isEchoingRondo(actor) && [1, 4].includes(note)) await offerRicochetManeuver(actor, note);
  if (rerolled) ui.notifications.info(`Technical Precision selected ${NOTES[note].name}.`);
}

function guidingNoteNearbyAllies(actor) {
  return (canvas?.tokens?.placeables ?? []).filter((token) =>
    token.actor
    && !sameActorIdentity(token.actor, actor)
    && !isEnemy(actor, token.actor)
    && actorDistance(actor, token.actor) <= 30
  );
}

function guidingNoteEligibleAllies(actor) {
  return guidingNoteNearbyAllies(actor).filter((token) => !token.actor.hasCondition?.("deafened"));
}

async function promptGuidingNoteAlly(actor, allies) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  return DialogV2.wait({
    window: { title: "Guiding Note — Select Ally" },
    position: { width: 440 },
    modal: true,
    content: "<p>Choose one ally within 30 feet who can hear you. You prepare to Aid that ally, and they may spend their reaction to Step.</p>",
    buttons: [
      ...allies.map((token, index) => ({
        action: `ally-${index}`,
        label: token.actor.name,
        icon: "fa-solid fa-user-group",
        default: index === 0,
        callback: () => token.actor.id,
      })),
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark", callback: () => null },
    ],
  }).catch((error) => {
    console.error("Symphonies of War | Guiding Note ally dialog failed", error);
    return null;
  });
}

function guidingNotePromptRecipients(ally) {
  const playerOwners = (game.users ?? [])
    .filter((user) => user.active && !user.isGM && ally.testUserPermission?.(user, "OWNER"))
    .map((user) => user.id);
  if (playerOwners.length) return playerOwners;
  const activeGM = game.users?.activeGM;
  return activeGM ? [activeGM.id] : [game.user.id];
}

async function clearGuidingNoteStepPromptForSource(sourceActor) {
  const candidates = new Map();
  for (const actor of game.actors ?? []) candidates.set(actor.uuid, actor);
  for (const token of canvas?.tokens?.placeables ?? []) if (token.actor) candidates.set(token.actor.uuid, token.actor);
  for (const actor of candidates.values()) {
    const prompt = actor.getFlag(MODULE_ID, "guidingNoteStep");
    if (!prompt) continue;
    if (actorMatchesReference(sourceActor, { uuid: prompt.sourceActorUuid, id: prompt.sourceActorId })) {
      await actor.unsetFlag(MODULE_ID, "guidingNoteStep").catch(() => {});
    }
  }
}

function emitGuidingNoteStepPrompt(sourceActor, allyActor, promptId) {
  const payload = {
    type: "guidingNoteStepPrompt",
    promptId,
    sourceActorUuid: sourceActor.uuid,
    sourceActorId: sourceActor.id,
    allyActorUuid: allyActor.uuid,
    allyActorId: allyActor.id,
    targetUserIds: guidingNotePromptRecipients(allyActor),
  };
  if (payload.targetUserIds.includes(game.user.id)) void handleGuidingNoteStepPrompt(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleGuidingNoteStepPrompt(payload) {
  if (!payload?.targetUserIds?.includes(game.user.id) || shownGuidingNotePrompts.has(payload.promptId)) return;
  shownGuidingNotePrompts.add(payload.promptId);
  setTimeout(() => shownGuidingNotePrompts.delete(payload.promptId), 10 * 60 * 1000);
  const sourceActor = await resolveActorReference({ uuid: payload.sourceActorUuid, id: payload.sourceActorId });
  const allyActor = await resolveActorReference({ uuid: payload.allyActorUuid, id: payload.allyActorId });
  if (!sourceActor || !allyActor || (!game.user.isGM && !allyActor.testUserPermission?.(game.user, "OWNER"))) return;
  const pending = allyActor.getFlag(MODULE_ID, "guidingNoteStep");
  if (!pending || pending.promptId !== payload.promptId) return;

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  let accepted = false;
  if (DialogV2?.wait) {
    accepted = await DialogV2.wait({
      window: { title: "Guiding Note — Reaction" },
      position: { width: 430 },
      modal: true,
      content: `<p><strong>${escapeHtml(sourceActor.name)}</strong> uses Guiding Note on <strong>${escapeHtml(allyActor.name)}</strong>.</p><p>Spend your reaction to Step now?</p>`,
      buttons: [
        { action: "step", label: "Use Reaction and Step", icon: "fa-solid fa-person-walking", default: true, callback: () => true },
        { action: "decline", label: "Decline", icon: "fa-solid fa-xmark", callback: () => false },
      ],
    }).catch(() => false);
  } else {
    accepted = await Dialog.confirm({
      title: "Guiding Note — Reaction",
      content: `<p><strong>${escapeHtml(sourceActor.name)}</strong> allows <strong>${escapeHtml(allyActor.name)}</strong> to spend their reaction to Step now.</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: true,
    }).catch(() => false);
  }

  const response = {
    type: "guidingNoteStepResponse",
    promptId: payload.promptId,
    sourceActorUuid: sourceActor.uuid,
    sourceActorId: sourceActor.id,
    allyActorUuid: allyActor.uuid,
    allyActorId: allyActor.id,
    userId: game.user.id,
    accepted: !!accepted,
  };
  if (game.user.isActiveGM || !game.users?.activeGM) await handleGuidingNoteStepResponse(response);
  else game.socket?.emit(SOCKET_CHANNEL, response);
}

async function handleGuidingNoteStepResponse(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const user = game.users?.get(payload?.userId);
  const sourceActor = await resolveActorReference({ uuid: payload?.sourceActorUuid, id: payload?.sourceActorId });
  const allyActor = await resolveActorReference({ uuid: payload?.allyActorUuid, id: payload?.allyActorId });
  if (!user || !sourceActor || !allyActor || (!user.isGM && !allyActor.testUserPermission?.(user, "OWNER"))) return;
  const pending = allyActor.getFlag(MODULE_ID, "guidingNoteStep");
  const aid = sourceActor.getFlag(MODULE_ID, "guidingNote");
  if (!pending || pending.promptId !== payload.promptId || !aid?.aidPrepared || !actorMatchesReference(allyActor, { uuid: aid.allyUuid, id: aid.allyId })) return;
  await allyActor.unsetFlag(MODULE_ID, "guidingNoteStep").catch(() => {});
  if (!payload.accepted) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: allyActor }),
    content: `<section class="sow-card"><h3>Guiding Note</h3><p><strong>${escapeHtml(allyActor.name)}</strong> spends their reaction and may Step now.</p><p><strong>${escapeHtml(sourceActor.name)}</strong> is prepared to Aid them before the start of ${escapeHtml(sourceActor.name)}'s next turn.</p></section>`,
    flags: { [MODULE_ID]: { guidingNoteReaction: true, sourceActorUuid: sourceActor.uuid, allyActorUuid: allyActor.uuid } },
  });
}

async function beginGuidingNote(actor) {
  const current = state(actor);
  if (!hasBattleTempo(actor)) return post(actor, "Guiding Note", "<p>You must be in Battle Tempo.</p>");
  if (current.openingNote !== 3) return post(actor, "Guiding Note", "<p>Your Opening Note is not Supporting Harmony.</p>");
  if (current.completed) return post(actor, "Guiding Note", "<p>You have already completed this Opening Note.</p>");
  const nearbyAllies = guidingNoteNearbyAllies(actor);
  const allies = nearbyAllies.filter((token) => !token.actor.hasCondition?.("deafened"));
  if (!nearbyAllies.length) {
    await gainCombo(actor, 1, { complete: true, reason: "Guiding Note satisfies Supporting Harmony; no allies are within 30 feet." });
    return post(actor, "Guiding Note", "<p>No allies are within 30 feet. You can Step instead.</p>");
  }
  if (!allies.length) return post(actor, "Guiding Note", "<p>All allies within 30 feet are unable to hear you, so none can be chosen for Guiding Note.</p>");

  const selectedActorId = await promptGuidingNoteAlly(actor, allies);
  if (selectedActorId) return chooseGuidingNoteAlly(actor, selectedActorId);

  if (!foundry?.applications?.api?.DialogV2?.wait) {
    const buttons = allies.map((token) => `<button type="button" data-sow-action="guiding-note-ally" data-actor-uuid="${escapeHtml(actor.uuid)}" data-ally-id="${escapeHtml(token.actor.id)}">${escapeHtml(token.actor.name)}</button>`).join("");
    return post(actor, "Guiding Note", `<p>Choose one ally within 30 feet. You automatically prepare to Aid them, and they may spend their reaction to Step.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons}</div>`);
  }
  return null;
}

async function chooseGuidingNoteAlly(actor, allyReference) {
  const current = state(actor);
  if (!hasBattleTempo(actor) || current.openingNote !== 3 || current.completed) return ui.notifications.warn("Guiding Note is no longer available.");
  const requested = String(allyReference ?? "");
  const eligibleToken = guidingNoteEligibleAllies(actor).find((token) => token.actor.id === requested || token.actor.uuid === requested);
  const ally = eligibleToken?.actor ?? await resolveActorReference({ uuid: requested, id: requested });
  if (!ally || !eligibleToken) return ui.notifications.warn("That ally is no longer eligible.");

  await gainCombo(actor, 1, { complete: true, reason: `Guiding Note targets ${ally.name} and satisfies Supporting Harmony.` });
  await actor.setFlag(MODULE_ID, "guidingNote", {
    allyUuid: ally.uuid,
    allyId: ally.id,
    turnKey: currentTurnKey(),
    aidPrepared: true,
  });

  const promptId = foundry.utils.randomID();
  await ally.setFlag(MODULE_ID, "guidingNoteStep", {
    promptId,
    sourceActorUuid: actor.uuid,
    sourceActorId: actor.id,
    createdAt: Date.now(),
  });

  const measuredStepEffects = actor.itemTypes?.effect?.filter((effect) => effect.slug === "measured-step-supporting-harmony") ?? [];
  const freeStep = actor.getFlag(MODULE_ID, "measuredStepGuiding") === currentTurnKey() || measuredStepEffects.length > 0;
  if (freeStep) {
    await actor.unsetFlag(MODULE_ID, "measuredStepGuiding");
    if (measuredStepEffects.length) await actor.deleteEmbeddedDocuments("Item", measuredStepEffects.map((effect) => effect.id));
  }
  await post(actor, "Guiding Note", `<p><strong>${escapeHtml(ally.name)}</strong> is your chosen ally.</p><p>You are prepared to Aid them before the start of your next turn. They have been prompted to spend their reaction to Step.</p>${freeStep ? `<p><strong>Measured Step:</strong> ${escapeHtml(actor.name)} may also Step as a free action.</p>` : ""}`);
  emitGuidingNoteStepPrompt(actor, ally, promptId);
}

function attackCount(actor) {
  const data = actor.getFlag(MODULE_ID, "attackCount");
  return data?.turnKey === currentTurnKey() ? Number(data.count ?? 0) : 0;
}

async function registerAttack(actor, message) {
  if (message.flags?.pf2e?.context?.type !== "attack-roll") return;
  const count = attackCount(actor) + 1;
  await actor.setFlag(MODULE_ID, "attackCount", { turnKey: currentTurnKey(), count });
}

function strikeEntry(actor, rootIndex, altUsage = "") {
  const root = actor.system?.actions?.[Number(rootIndex)];
  if (!root) return null;
  if (altUsage === "" || altUsage == null) return root;
  return root.altUsages?.[Number(altUsage)] ?? null;
}

function strikeVariantForCurrentMAP(actor, strike) {
  const mapIndex = Math.min(2, Math.max(0, attackCount(actor)));
  return strike?.variants?.[mapIndex] ?? strike?.variants?.[0] ?? strike;
}

function levelOneStrikeButton(actor, action, entry, extra = "") {
  const label = adaptiveStrikeLabel(entry.strike);
  return `<button type="button" data-sow-action="${action}" data-actor-uuid="${escapeHtml(actor.uuid)}" data-root-index="${entry.rootIndex}" data-alt-usage="${entry.altUsage ?? ""}" ${extra}><img src="${escapeHtml(entry.strike.item.img)}" width="24" height="24" style="border:0;vertical-align:middle;margin-right:4px">${escapeHtml(label)}</button>`;
}

function flourishAvailable(actor) {
  return actor.getFlag(MODULE_ID, "flourishUsedTurnKey") !== currentTurnKey();
}

async function reserveFlourish(actor, label) {
  if (!flourishAvailable(actor)) {
    await post(actor, label, "<p>You have already used an action with the flourish trait this turn.</p>");
    return false;
  }
  await actor.setFlag(MODULE_ID, "flourishUsedTurnKey", currentTurnKey());
  return true;
}

async function beginDoubleCadenza(actor) {
  if (!hasBattleTempo(actor)) return ui.notifications.warn("You must be in Battle Tempo to use Double Cadenza.");
  if (!features(actor).has("sliced-cadenza") && !flourishAvailable(actor)) {
    return ui.notifications.warn("You have already used an action with the flourish trait this turn.");
  }
  const entries = meleeStrikeEntries(actor).filter(({ strike }) => !weaponHasTrait(strike.item, "unarmed"));
  const pairs = [];
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    if (entries[i].strike.item.id !== entries[j].strike.item.id) pairs.push([entries[i], entries[j]]);
  }
  if (!pairs.length) return ui.notifications.warn("Wield two different melee weapons to use Double Cadenza.");
  const buttons = pairs.map(([a, b]) => `<button type="button" data-sow-action="double-cadenza-pair" data-actor-uuid="${escapeHtml(actor.uuid)}" data-a-root="${a.rootIndex}" data-a-alt="${a.altUsage ?? ""}" data-b-root="${b.rootIndex}" data-b-alt="${b.altUsage ?? ""}">${escapeHtml(adaptiveStrikeLabel(a.strike))} + ${escapeHtml(adaptiveStrikeLabel(b.strike))}</button>`).join("");
  return post(actor, "Double Cadenza", `<p>Target one enemy, then choose the two weapons. Both Strikes use the same current MAP. Each Strike creates its normal PF2e attack card.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons}</div>`);
}

function doubleCadenzaHit(outcome) {
  return ["success", "criticalSuccess"].includes(outcome);
}

function doubleCadenzaRollOptions(actor, { combined = false } = {}) {
  const options = ["sow:activity:double-cadenza", "item:trait:virtuoso"];
  if (combined) options.push("sow:damage:combined");
  if (!features(actor).has("sliced-cadenza")) options.push("item:trait:flourish");
  return options;
}

function doubleCadenzaDamageData(entry, outcome) {
  return {
    rootIndex: Number(entry.rootIndex),
    altUsage: entry.altUsage ?? "",
    outcome,
  };
}

function doubleCadenzaStrikeFromData(actor, data) {
  return strikeEntry(actor, Number(data.rootIndex), data.altUsage ?? "");
}

async function rollDoubleCadenzaStrikeDamage(actor, target, data) {
  if (!doubleCadenzaHit(data.outcome)) return null;
  const strike = doubleCadenzaStrikeFromData(actor, data);
  if (!strike) throw new Error("The Double Cadenza Strike is no longer available.");
  const roller = data.outcome === "criticalSuccess" ? strike.critical : strike.damage;
  if (typeof roller !== "function") throw new Error(`PF2e did not expose damage for ${strike.item?.name ?? "that Strike"}.`);
  return roller.call(strike, {
    target,
    options: doubleCadenzaRollOptions(actor),
  });
}

async function rollDoubleCadenzaSeparateDamage(actor, target, attacks) {
  for (const attack of attacks.filter((entry) => doubleCadenzaHit(entry.outcome))) {
    await rollDoubleCadenzaStrikeDamage(actor, target, attack);
  }
}

async function doubleCadenzaDamageFormula(actor, target, data) {
  const strike = doubleCadenzaStrikeFromData(actor, data);
  if (!strike) throw new Error("The Double Cadenza Strike is no longer available.");
  const roller = data.outcome === "criticalSuccess" ? strike.critical : strike.damage;
  if (typeof roller !== "function") throw new Error(`PF2e did not expose damage for ${strike.item?.name ?? "that Strike"}.`);
  return String(await roller.call(strike, {
    target,
    getFormula: true,
    createMessage: false,
    options: doubleCadenzaRollOptions(actor, { combined: true }),
  }) ?? "").trim();
}

async function rollDoubleCadenzaCombinedDamage(actor, target, attacks) {
  const formulas = [];
  for (const attack of attacks.filter((entry) => doubleCadenzaHit(entry.outcome))) {
    const formula = await doubleCadenzaDamageFormula(actor, target, attack);
    if (formula) formulas.push(`(${formula})`);
  }
  if (formulas.length !== 2) throw new Error("Combined Double Cadenza damage requires two successful Strikes.");

  const DamageRoll = CONFIG.Dice.rolls.find((rollClass) => rollClass.name === "DamageRoll") ?? Roll;
  const roll = await new DamageRoll(formulas.join(" + ")).evaluate();
  const sourceToken = sourceTokenForActor(actor);
  const targetFlag = {
    actor: target.actor.uuid,
    token: target.document?.uuid ?? target.uuid,
  };
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: sourceToken?.document }),
    flavor: `<strong>Double Cadenza — Combined Damage</strong><br><small>Both Strikes are combined for resistances and weaknesses.</small>`,
    flags: {
      pf2e: {
        context: {
          type: "damage-roll",
          sourceType: "attack",
          actor: actor.id,
          token: sourceToken?.id ?? sourceToken?.document?.id ?? null,
          target: targetFlag,
          domains: ["damage", "strike-damage", "double-cadenza-damage"],
          options: ["sow:activity:double-cadenza", "sow:damage:combined", "item:trait:virtuoso"],
          traits: ["attack", "virtuoso"],
          outcome: null,
        },
        target: targetFlag,
      },
      [MODULE_ID]: { actorUuid: actor.uuid, doubleCadenzaCombinedDamage: true },
    },
  });
  return roll;
}

async function applyDoubleCadenzaBenefit(actor, target, note) {
  if (note === 2) {
    const applied = await applyTemporaryCondition(actor, target.actor, "clumsy", 1, "source-turn-start");
    if (!applied) return false;
    if (!state(actor).completed) {
      await gainCombo(actor, 1, { complete: true, reason: "Double Cadenza inflicted clumsy 1 and completed Discordant Chord." });
    }
    await post(actor, "Double Cadenza", `<p><strong>Satisfied Discordant Chord:</strong> Clumsy 1 was applied to ${escapeHtml(target.actor.name)}.</p><p>@UUID[Compendium.pf2e.conditionitems.Item.i3OJZU2nk64Df3xm]{Clumsy 1}</p>`);
    return true;
  }

  if (note === 5) {
    const marker = `sow:double-cadenza-target:${actor.id}`;
    const markerSource = runtimeEffectSource(
      "Double Cadenza — Constant Refrain Target",
      "double-cadenza-constant-refrain-target",
      [{ key: "RollOption", domain: "all", option: `self:${marker}` }],
      {
        description: `This creature is the target of ${actor.name}'s Double Cadenza Constant Refrain bonus.`,
        sourceActorUuid: actor.uuid,
        expiryPhase: "source-turn-start",
        extraFlags: { protectedActorUuid: actor.uuid },
      },
    );
    markerSource.system.tokenIcon.show = false;
    await addRuntimeEffect(target.actor, markerSource);
    await addRuntimeEffect(actor, runtimeEffectSource(
      "Double Cadenza",
      "double-cadenza-guarded-refrain",
      [{ key: "FlatModifier", selector: "ac", type: "circumstance", value: 1, predicate: [`origin:${marker}`] }],
      {
        description: `You gain a +1 circumstance bonus to AC only against ${target.actor.name} until the start of your next turn.`,
        sourceActorUuid: actor.uuid,
        expiryPhase: "source-turn-start",
        extraFlags: { targetActorUuid: target.actor.uuid },
      },
    ));
    if (!state(actor).completed) {
      await gainCombo(actor, 1, { complete: true, reason: "Double Cadenza granted a target-specific circumstance bonus to AC and completed Constant Refrain." });
    }
    await post(actor, "Double Cadenza", `<p><strong>Satisfied Constant Refrain:</strong> The +1 circumstance bonus to AC against ${escapeHtml(target.actor.name)} was applied.</p><p>@UUID[${EFFECT_UUIDS.doubleCadenzaConstantRefrain}]{Effect: Double Cadenza - Constant Refrain}</p>`);
    return true;
  }

  return false;
}

async function offerDoubleCadenzaDamageChoice(actor, target, attacks) {
  const id = foundry.utils.randomID();
  await actor.setFlag(MODULE_ID, "doubleCadenzaDamageChoice", {
    id,
    turnKey: currentTurnKey(),
    targetTokenUuid: target.document?.uuid ?? target.uuid,
    attacks,
  });
  return post(actor, "Sliced Cadenza", `<p>Both Strikes hit the same creature. Choose how to resolve their damage.</p><div class="message-buttons" style="display:flex;gap:4px;flex-wrap:wrap"><button type="button" data-sow-action="double-cadenza-damage-choice" data-damage-mode="combined" data-choice-id="${id}">Roll Combined Damage</button><button type="button" data-sow-action="double-cadenza-damage-choice" data-damage-mode="separate" data-choice-id="${id}">Roll Separate Damage</button></div>`);
}

async function resolveDoubleCadenzaDamageChoice(actor, choiceId, mode, messageId = null) {
  const data = actor.getFlag(MODULE_ID, "doubleCadenzaDamageChoice");
  if (!data || data.id !== choiceId || data.turnKey !== currentTurnKey()) {
    return ui.notifications.warn("That Sliced Cadenza damage choice is no longer available.");
  }
  const target = await tokenFromUuid(data.targetTokenUuid);
  if (!target?.actor) {
    await actor.unsetFlag(MODULE_ID, "doubleCadenzaDamageChoice");
    return ui.notifications.warn("The Double Cadenza target is no longer available.");
  }

  await actor.unsetFlag(MODULE_ID, "doubleCadenzaDamageChoice");
  try {
    if (mode === "combined") await rollDoubleCadenzaCombinedDamage(actor, target, data.attacks ?? []);
    else await rollDoubleCadenzaSeparateDamage(actor, target, data.attacks ?? []);
    const message = messageId ? game.messages?.get(messageId) : null;
    if (message && (message.isOwner || game.user.isGM)) {
      await message.update({
        content: `<section class="sow-card"><h3>Sliced Cadenza</h3><p>${mode === "combined" ? "Combined" : "Separate"} damage rolled.</p></section>`,
      });
    }
  } catch (error) {
    console.error("Symphonies of War | Sliced Cadenza damage failed", error);
    ui.notifications.error(error.message ?? "Sliced Cadenza damage could not be rolled.");
  }
}

async function executeDoubleCadenza(actor, button) {
  const targetUuid = selectedTargetTokenUuids();
  if (targetUuid.length !== 1) return ui.notifications.warn("Target exactly one enemy.");
  const target = await tokenFromUuid(targetUuid[0]);
  const firstEntry = { rootIndex: Number(button.dataset.aRoot), altUsage: button.dataset.aAlt ?? "" };
  const secondEntry = { rootIndex: Number(button.dataset.bRoot), altUsage: button.dataset.bAlt ?? "" };
  const first = strikeEntry(actor, firstEntry.rootIndex, firstEntry.altUsage);
  const second = strikeEntry(actor, secondEntry.rootIndex, secondEntry.altUsage);
  if (!target?.actor || !first || !second || first.item.id === second.item.id) return ui.notifications.warn("The selected Double Cadenza is no longer valid.");
  const slicedCadenza = features(actor).has("sliced-cadenza");
  if (!slicedCadenza && !await reserveFlourish(actor, "Double Cadenza")) return;

  const mapIndex = Math.min(2, attackCount(actor));
  const rollOptions = doubleCadenzaRollOptions(actor);
  const roll1 = await first.variants?.[mapIndex]?.roll({ target, options: rollOptions, createMessage: true });
  const roll2 = await second.variants?.[mapIndex]?.roll({ target, options: rollOptions, createMessage: true });
  const outcome1 = adaptiveOutcomeFromRoll(roll1);
  const outcome2 = adaptiveOutcomeFromRoll(roll2);
  const hit1 = doubleCadenzaHit(outcome1);
  const hit2 = doubleCadenzaHit(outcome2);
  const triggered = (hit1 && hit2) || outcome1 === "criticalSuccess" || outcome2 === "criticalSuccess";
  const attacks = [
    doubleCadenzaDamageData(firstEntry, outcome1),
    doubleCadenzaDamageData(secondEntry, outcome2),
  ];

  if (triggered) await applyDoubleCadenzaBenefit(actor, target, Number(state(actor).openingNote ?? 0));

  try {
    if (hit1 && hit2 && slicedCadenza) {
      await offerDoubleCadenzaDamageChoice(actor, target, attacks);
    } else {
      await rollDoubleCadenzaSeparateDamage(actor, target, attacks);
    }
  } catch (error) {
    console.error("Symphonies of War | Double Cadenza automatic damage failed", error);
    ui.notifications.error(error.message ?? "Double Cadenza damage could not be rolled.");
  }
}

async function beginFlowingSweep(actor) {
  const finesse = meleeStrikeEntries(actor).some(({ strike }) => weaponHasTrait(strike.item, "finesse"));
  if (!finesse) return ui.notifications.warn("You must wield a melee weapon with the finesse trait.");
  const button = (maneuver, skill) => `<button type="button" data-sow-action="flowing-sweep-maneuver" data-maneuver="${maneuver}" data-skill="${skill}" data-actor-uuid="${escapeHtml(actor.uuid)}">${maneuver[0].toUpperCase() + maneuver.slice(1)} with ${skill[0].toUpperCase() + skill.slice(1)}</button>`;
  return post(actor, "Flowing Sweep", `<p>Target one enemy. Choose Disarm or Trip, then choose the normal Athletics check or the Acrobatics substitution granted by Flowing Sweep. PF2e applies the normal DC and MAP.</p><div class="message-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${button("disarm", "athletics")}${button("disarm", "acrobatics")}${button("trip", "athletics")}${button("trip", "acrobatics")}</div>`);
}

async function executeFlowingSweep(actor, maneuver, skill = "athletics") {
  if (!['disarm', 'trip'].includes(maneuver) || !['athletics', 'acrobatics'].includes(skill)) {
    return ui.notifications.warn("That Flowing Sweep option is not valid.");
  }
  const targets = selectedTargetTokenUuids();
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy.");
  await actor.setFlag(MODULE_ID, "flowingSweep", { maneuver, skill, targetTokenUuid: targets[0], turnKey: currentTurnKey() });
  const action = game.pf2e?.actions?.[maneuver];
  if (typeof action !== "function") {
    return post(actor, "Flowing Sweep", `<p>PF2e's ${escapeHtml(maneuver)} action was not available. Roll ${escapeHtml(skill)} against the target's Reflex DC manually.</p>`);
  }
  return action({ actors: [actor], skill });
}

async function beginMeasuredStep(actor) {
  if (!hasBattleTempo(actor)) return ui.notifications.warn("You must be in Battle Tempo to use Measured Step.");
  if (!await reserveFlourish(actor, "Measured Step")) return;
  const note = state(actor).openingNote;

  if (note === 2) {
    await addRuntimeEffect(actor, runtimeEffectSource(
      "Measured Step — Discordant Chord",
      "measured-step-demoralize",
      [{ key: "FlatModifier", selector: "intimidation", type: "circumstance", value: 2, predicate: ["action:demoralize"] }],
      { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-end" },
    ));
    ui.notifications.info("Measured Step: Step now. Your next Demoralize check this turn gains a +2 circumstance bonus.");
    return;
  }

  if (note === 3) {
    await actor.setFlag(MODULE_ID, "measuredStepGuiding", currentTurnKey());
    const existing = actor.itemTypes?.effect?.filter((effect) => effect.slug === "measured-step-supporting-harmony").map((effect) => effect.id) ?? [];
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing);
    await addRuntimeEffect(actor, runtimeEffectSource(
      "Measured Step — Supporting Harmony",
      "measured-step-supporting-harmony",
      [],
      { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-end" },
    ));
    ui.notifications.info("Measured Step: Step now. Your next Guiding Note this turn also lets you Step as a free action.");
    return;
  }

  if (note === 5) {
    await addRuntimeEffect(actor, runtimeEffectSource(
      "Measured Step — Constant Refrain",
      "measured-step-ac",
      [{ key: "FlatModifier", selector: "ac", type: "circumstance", value: 1 }],
      { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-start" },
    ));
    if (!state(actor).completed) {
      await gainCombo(actor, 1, { complete: true, reason: "Measured Step granted a circumstance bonus to AC and completed Constant Refrain." });
    }
    ui.notifications.info("Measured Step: Step now. You gain a +1 circumstance bonus to AC until the start of your next turn.");
    return;
  }

  ui.notifications.info("Measured Step: Step now.");
}

function actorHoldsItem(actor) {
  return (actor?.items ?? []).some((item) => {
    const equipped = item.system?.equipped;
    return equipped?.carryType === "held" || Number(equipped?.handsHeld ?? 0) > 0;
  });
}

async function beginResonantDisarm(actor) {
  if (!features(actor).has("resonant-disarm")) return ui.notifications.warn("You do not have Resonant Disarm.");
  const targets = selectedTargetTokenUuids();
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one creature for Resonant Disarm.");
  const target = await tokenFromUuid(targets[0]);
  if (!target?.actor) return ui.notifications.warn("The Resonant Disarm target is not available.");
  const action = game.pf2e?.actions?.disarm;
  if (typeof action !== "function") return ui.notifications.warn("PF2e's Disarm action is not available.");
  return action({ actors: [actor], skill: "athletics" });
}

async function applyResonantDisarm(actor, message, target) {
  if (!features(actor).has("resonant-disarm") || !target || actorHoldsItem(target) || !messageSucceeded(message)) return;
  const outcome = message.flags?.pf2e?.context?.outcome;
  const effect = await addRuntimeEffect(target, runtimeEffectSource("Resonant Disarm", "resonant-disarm-off-balance", [{ key: "FlatModifier", selector: "melee-attack-roll", type: "circumstance", value: -2 }], { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-start" }));
  if (["criticalSuccess", "critical-success"].includes(outcome)) await applyTemporaryCondition(actor, target, "clumsy", 1, "source-turn-start");
  await post(actor, "Resonant Disarm", `<p>${escapeHtml(target.name)} is off-balance: -2 circumstance penalty to melee attack rolls until the start of your next turn.${["criticalSuccess", "critical-success"].includes(outcome) ? " It is also clumsy 1." : ""}</p>${effect ? `<button type="button" data-sow-action="resonant-recenter" data-actor-uuid="${escapeHtml(actor.uuid)}" data-effect-uuid="${escapeHtml(effect.uuid)}">Target re-centers (Interact)</button>` : ""}`);
}

async function beginCrescendoStrike(actor) {
  const current = state(actor);
  if (current.chains < 1) return post(actor, "Crescendo Strike", "<p>You need at least 1 Combo Chain.</p>");
  if (current.finaleUsedTurnKey === currentTurnKey()) return post(actor, "Crescendo Strike", "<p>You can use only one Finale per turn.</p>");
  const entries = meleeStrikeEntries(actor);
  if (!entries.length) return post(actor, "Crescendo Strike", "<p>No ready melee Strike is available.</p>");
  const buttons = entries.map((entry) => levelOneStrikeButton(actor, "crescendo-strike-weapon", entry)).join("");
  return post(actor, "Crescendo Strike", `<p>Target one enemy and choose a melee Strike. All ${current.chains} Combo Chains are spent when the attack is declared. Extra force damage is rolled automatically on a hit.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons}</div>`);
}

async function executeCrescendoStrike(actor, button) {
  const targets = selectedTargetTokenUuids();
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy.");
  const target = await tokenFromUuid(targets[0]);
  const strike = strikeEntry(actor, button.dataset.rootIndex, button.dataset.altUsage);
  const current = state(actor);
  if (!target?.actor || !strike || current.chains < 1 || current.finaleUsedTurnKey === currentTurnKey()) return ui.notifications.warn("Crescendo Strike is no longer available.");
  const spent = current.chains;
  const id = foundry.utils.randomID();
  const option = `${CRESCENDO_EXECUTION_OPTION}:${id}`;
  await setState(actor, { chains: 0, finaleUsedTurnKey: currentTurnKey() });
  let fortuneEffect = null;
  if (spent >= 3) {
    fortuneEffect = await addRuntimeEffect(actor, runtimeEffectSource("Crescendo Strike — Fortune", "crescendo-strike-fortune", [{ key: "RollTwice", selector: "strike-attack-roll", keep: "higher", predicate: [option] }], { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-end" }));
  }
  const mapIndex = Math.min(2, attackCount(actor));
  const preparedStrike = strikeEntry(actor, button.dataset.rootIndex, button.dataset.altUsage) ?? strike;
  const roll = await preparedStrike.variants?.[mapIndex]?.roll({ target, options: ["action:crescendo-strike", "item:trait:virtuoso", option] });
  if (fortuneEffect) await fortuneEffect.delete().catch(() => {});
  let outcome = adaptiveOutcomeFromRoll(roll);
  if (spent >= 7 && outcome === "success") outcome = "criticalSuccess";
  if (!["success", "criticalSuccess"].includes(outcome)) return post(actor, "Crescendo Strike", `<p>The Strike missed. ${spent} Combo Chain${spent === 1 ? "" : "s"} were spent.</p>`);
  const damageDice = spent * (outcome === "criticalSuccess" ? 2 : 1);
  const damage = await new DamageRoll(`${damageDice}d8[force]`).evaluate();
  await damage.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `<strong>Crescendo Strike</strong> — additional force damage (${spent} Combo Chain${spent === 1 ? "" : "s"}${outcome === "criticalSuccess" ? ", doubled for critical success" : ""})` });
  if (spent >= 5) await applyTemporaryCondition(actor, target.actor, "clumsy", outcome === "criticalSuccess" ? 2 : 1, "source-turn-start");
}

async function useHeroicCadence(actor) {
  if (!features(actor).has("heroic-cadence")) return ui.notifications.warn("You do not have Heroic Cadence.");
  if (!hasBattleTempo(actor)) return ui.notifications.warn("You must be in Battle Tempo to use Heroic Cadence.");
  if (!game.combat?.started || !sameActorIdentity(game.combat.combatant?.actor, actor)) {
    return ui.notifications.warn("Use Heroic Cadence during the Virtuoso's own turn.");
  }

  return queueComboGain(actor, async () => {
    const current = state(actor);
    if (!current.openingNote) return ui.notifications.warn("You do not have an Opening Note to preserve with Heroic Cadence.");
    if (current.completed) return ui.notifications.warn("You already completed your Opening Note this turn.");
    if (current.chains >= maxChains(actor)) return ui.notifications.warn("Your Combo Chain is already at its maximum, so Heroic Cadence cannot grant or preserve another chain.");
    if (current.heroicCadenceLocked || current.heroicCadenceUsedTurnKey === currentTurnKey()) {
      return ui.notifications.warn("Heroic Cadence has already been used for this turn.");
    }

    const ally = await resolveActorReference({ uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId });
    if (current.passTheBeatAllyUuid || current.passTheBeatAllyId) {
      await clearPassTheBeatState(actor, ally);
    }

    const latest = state(actor);
    const next = await setState(actor, {
      chains: latest.chains + 1,
      preserveReset: true,
      heroicCadenceLocked: true,
      heroicCadenceUsedTurnKey: currentTurnKey(),
      completed: false,
    });
    await post(actor, "Heroic Cadence", `<p>You confirm that a Hero Point reroll intended to satisfy <strong>${escapeHtml(NOTES[latest.openingNote]?.name ?? "your Opening Note")}</strong> still failed.</p><p>You gain 1 Combo Chain, your chains will not reset at the end of this turn, and you cannot gain another Combo Chain by satisfying this Opening Note this turn, including through Pass the Beat.</p><p>Current: <strong>${next.chains}/${maxChains(actor)}</strong>.</p>`);
    return next;
  });
}

async function resolveGuidingAid(actor, slug, message) {
  if (slug !== "aid") return false;
  const data = actor.getFlag(MODULE_ID, "guidingNote");
  if (!data?.aidPrepared || data.turnKey === currentTurnKey()) return false;

  const target = targetActorFromMessage(message);
  if (target && !actorMatchesReference(target, { uuid: data.allyUuid, id: data.allyId })) return false;

  const outcome = message.flags?.pf2e?.context?.outcome;
  if (["failure", "criticalFailure", "critical-failure"].includes(outcome)) {
    await post(actor, "Guiding Note — Aid", "<p>Your failed Aid check is treated as a success.</p>");
  }
  await actor.unsetFlag(MODULE_ID, "guidingNote");
  return true;
}



// ── Level 2 automation ────────────────────────────────────────────────────

function singleSelectedTarget(actor, { enemy = true, range = null } = {}) {
  const uuids = selectedTargetTokenUuids();
  if (uuids.length !== 1) return null;
  const token = canvas?.tokens?.placeables?.find((candidate) => (candidate.document?.uuid ?? candidate.uuid) === uuids[0]) ?? null;
  if (!token?.actor) return null;
  if (enemy && !isEnemy(actor, token.actor)) return null;
  if (!enemy && !isAlly(actor, token.actor)) return null;
  if (range != null && actorDistance(actor, token.actor) > Number(range)) return null;
  return token;
}

function levelTwoStrikeButtons(actor, actionSlug) {
  const entries = meleeStrikeEntries(actor).filter(({ strike }) => actionSlug !== "deafening-clash" || !weaponHasTrait(strike.item, "unarmed"));
  return entries.map((entry) => `<button type="button" data-sow-action="level-two-strike" data-level-two-slug="${escapeHtml(actionSlug)}" data-actor-uuid="${escapeHtml(actor.uuid)}" data-root-index="${entry.rootIndex}" data-alt-usage="${entry.altUsage ?? ""}"><img src="${escapeHtml(entry.strike.item.img)}" width="24" height="24" style="border:0;vertical-align:middle;margin-right:4px">${escapeHtml(adaptiveStrikeLabel(entry.strike))}</button>`).join("");
}

async function beginDeafeningClash(actor) {
  const target = singleSelectedTarget(actor, { enemy: true });
  if (!target) return ui.notifications.warn("Target exactly one enemy in melee reach for Deafening Clash.");
  const buttons = levelTwoStrikeButtons(actor, "deafening-clash");
  return post(actor, "Deafening Clash", `<p>Choose the melee Strike. On a hit that deals damage, the target becomes clumsy 1 (clumsy 2 on a critical hit) until the start of your next turn.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons || "<p>No melee Strike is available.</p>"}</div>`);
}

async function beginStaggeringStrike(actor) {
  const current = state(actor);
  if (!hasBattleTempo(actor) || ![1, 4].includes(current.openingNote)) return ui.notifications.warn("Staggering Strike requires Battle Tempo and Ensnaring Hook or Percussive Drop.");
  const target = singleSelectedTarget(actor, { enemy: true });
  if (!target) return ui.notifications.warn("Target exactly one enemy in melee reach for Staggering Strike.");
  const buttons = levelTwoStrikeButtons(actor, "staggering-strike");
  return post(actor, "Staggering Strike", `<p>Current note: <strong>${escapeHtml(NOTES[current.openingNote].name)}</strong>. Choose the melee Strike.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons || "<p>No melee Strike is available.</p>"}</div>`);
}

async function beginHeartbeatDissonance(actor) {
  if (actorCadenceSlug(actor) !== "the-mending-hymn") return ui.notifications.warn("Heartbeat Dissonance requires the Mending Hymn cadence.");
  const target = singleSelectedTarget(actor, { enemy: true, range: 30 });
  if (!target) return ui.notifications.warn("Target exactly one enemy within 30 feet.");
  return requestLevelTwoAction(actor, "heartbeat-dissonance", { targetTokenUuid: target.document?.uuid ?? target.uuid });
}

async function beginJarringMotif(actor) {
  const target = singleSelectedTarget(actor, { enemy: true, range: 30 });
  if (!target) return ui.notifications.warn("Target exactly one enemy within 30 feet.");
  if (target.actor.hasCondition?.("deafened")) return ui.notifications.warn("The target cannot hear Jarring Motif.");
  return requestLevelTwoAction(actor, "jarring-motif", { targetTokenUuid: target.document?.uuid ?? target.uuid });
}

async function beginStaggeringDisplay(actor) {
  if (actorCadenceSlug(actor) !== "the-captivating-solo") return ui.notifications.warn("Staggering Display requires the Captivating Solo cadence.");
  const target = singleSelectedTarget(actor, { enemy: true, range: 30 });
  if (!target) return ui.notifications.warn("Target exactly one enemy within 30 feet.");
  if (target.actor.hasCondition?.("deafened")) return ui.notifications.warn("The target cannot hear Staggering Display.");
  const targetUuid = target.document?.uuid ?? target.uuid;
  return post(actor, "Staggering Display", `<p>Choose the skill used against the target's Will DC.</p><div class="message-buttons"><button type="button" data-sow-action="level-two-skill" data-level-two-slug="staggering-display" data-skill="diplomacy" data-target-token-uuid="${escapeHtml(targetUuid)}" data-actor-uuid="${escapeHtml(actor.uuid)}">Diplomacy</button><button type="button" data-sow-action="level-two-skill" data-level-two-slug="staggering-display" data-skill="intimidation" data-target-token-uuid="${escapeHtml(targetUuid)}" data-actor-uuid="${escapeHtml(actor.uuid)}">Intimidation</button><button type="button" data-sow-action="level-two-skill" data-level-two-slug="staggering-display" data-skill="performance" data-target-token-uuid="${escapeHtml(targetUuid)}" data-actor-uuid="${escapeHtml(actor.uuid)}">Performance</button></div>`);
}

async function requestLevelTwoAction(actor, slug, extra = {}) {
  const payload = { type: "levelTwoActionRequest", userId: game.user.id, actorUuid: actor.uuid, actionSlug: slug, extra };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleLevelTwoActionRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

function sizeIndex(actor) {
  const size = String(actor?.system?.traits?.size?.value ?? actor?.system?.traits?.size ?? "med");
  return ["tiny", "sm", "med", "lg", "huge", "grg"].indexOf(size);
}

function canGrabTarget(actor, target, strike = null) {
  const hasHand = Number(actor?.handsFree ?? actor?.system?.attributes?.handsFree ?? 0) > 0;
  const hasGrapple = weaponHasTrait(strike?.item, "grapple") || meleeStrikeEntries(actor).some(({ strike: candidate }) => weaponHasTrait(candidate.item, "grapple"));
  const sourceSize = sizeIndex(actor);
  const targetSize = sizeIndex(target);
  return (hasHand || hasGrapple) && sourceSize >= 0 && targetSize >= 0 && targetSize <= sourceSize + 1;
}

async function ensureConditionAtLeast(target, slug, value = null) {
  const existing = target?.getCondition?.(slug) ?? null;
  if (existing) {
    if (value == null || existing.value == null || Number(existing.value) >= Number(value)) return existing;
    await game.pf2e.ConditionManager.updateConditionValue(existing.id, target, Number(value));
    return existing;
  }
  return target?.increaseCondition?.(slug, value == null ? {} : { value: Number(value) });
}

async function addActionImmunity(target, source, slug, { unit = "minutes", value = 1 } = {}) {
  const existing = temporaryActionImmunity(target, slug, source);
  if (existing) return null;
  return addRuntimeEffect(target, runtimeEffectSource(
    `${finaleName(slug)} Immunity`,
    `${slug}-immunity`,
    [],
    {
      description: `<p>Temporarily immune to ${escapeHtml(source.name)}'s ${escapeHtml(finaleName(slug))}.</p>`,
      sourceActorUuid: source.uuid,
      duration: { unit, value, expiry: null },
      extraFlags: { actionImmunity: slug },
    },
  ));
}

async function rollSkillAgainstDC(actor, skill, targetToken, dcSlug, label, extraRollOptions = []) {
  const statistic = actor.getStatistic?.(skill);
  const dc = Number(targetToken?.actor?.getStatistic?.(dcSlug)?.dc?.value ?? NaN);
  if (!statistic || !Number.isFinite(dc)) return null;
  return statistic.roll({
    dc: { value: dc, label: `${targetToken.actor.name} ${dcSlug}` },
    target: targetToken.actor,
    skipDialog: false,
    createMessage: true,
    extraRollOptions: ["sow:module-resolution", `action:${slugify(label)}`, "item:trait:virtuoso", ...extraRollOptions],
    label,
  });
}

async function executeDeafeningClash(actor, targetToken, strike) {
  if (!targetToken?.actor || !strike || actorDistance(actor, targetToken.actor) > reachForActor(actor)) return ui.notifications.warn("The Deafening Clash target is no longer in reach.");
  const current = state(actor);
  const descriptor = sanitizeAdaptiveDescriptor({ ...(ACTION_NOTE_IMMUNITY_MAP["deafening-clash"]?.[2] ?? {}), note: 2, actionAliases: ["deafening-clash"] });
  if (hasBattleTempo(actor) && current.openingNote === 2 && !current.completed) {
    const immunity = checkTargetImmunity(targetToken.actor, "deafening-clash", actor, descriptor);
    if (immunity) return requestAdaptiveMeasurePrompt(actor, targetToken.actor, "deafening-clash", immunity, { targetTokenUuid: targetToken.document?.uuid ?? targetToken.uuid, descriptor });
  }
  const variant = strikeVariantForCurrentMAP(actor, strike);
  const roll = await variant?.roll?.({ target: targetToken, options: ["action:deafening-clash", "item:trait:auditory", "item:trait:virtuoso"] });
  const outcome = adaptiveOutcomeFromRoll(roll);
  if (!["success", "criticalSuccess"].includes(outcome)) return;
  await applyTemporaryCondition(actor, targetToken.actor, "clumsy", outcome === "criticalSuccess" ? 2 : 1, "source-turn-start");
  if (hasBattleTempo(actor) && state(actor).openingNote === 2 && !state(actor).completed) {
    await gainCombo(actor, 1, { complete: true, reason: "Deafening Clash inflicted clumsy and completed Discordant Chord." });
  }
}

async function executeHeartbeatDissonance(actor, targetToken) {
  if (!targetToken?.actor || actorDistance(actor, targetToken.actor) > 30 || !isEnemy(actor, targetToken.actor)) return ui.notifications.warn("The target is no longer eligible.");
  const current = state(actor);
  const descriptor = sanitizeAdaptiveDescriptor({ ...(ACTION_NOTE_IMMUNITY_MAP["heartbeat-dissonance"]?.[2] ?? {}), note: 2, actionAliases: ["heartbeat-dissonance"] });
  if (hasBattleTempo(actor) && current.openingNote === 2 && !current.completed) {
    const immunity = checkTargetImmunity(targetToken.actor, "heartbeat-dissonance", actor, descriptor);
    if (immunity) return requestAdaptiveMeasurePrompt(actor, targetToken.actor, "heartbeat-dissonance", immunity, { targetTokenUuid: targetToken.document?.uuid ?? targetToken.uuid, descriptor });
  }
  if (temporaryActionImmunity(targetToken.actor, "heartbeat-dissonance", actor)) return ui.notifications.warn("That target is temporarily immune to your Heartbeat Dissonance.");
  const roll = await rollSkillAgainstDC(actor, "medicine", targetToken, "fortitude", "Heartbeat Dissonance", ["item:trait:mental"]);
  const outcome = adaptiveOutcomeFromRoll(roll);
  if (outcome === "criticalSuccess") await applyTemporaryCondition(actor, targetToken.actor, "clumsy", 2, "source-turn-start");
  else if (outcome === "success") await applyTemporaryCondition(actor, targetToken.actor, "clumsy", 1, "source-turn-start");
  else {
    await addActionImmunity(targetToken.actor, actor, "heartbeat-dissonance", { unit: "minutes", value: 1 });
    if (outcome === "criticalFailure") await ensureConditionAtLeast(actor, "frightened", 1);
  }
  if (["success", "criticalSuccess"].includes(outcome) && hasBattleTempo(actor) && state(actor).openingNote === 2 && !state(actor).completed) {
    await gainCombo(actor, 1, { complete: true, reason: "Heartbeat Dissonance inflicted clumsy and completed Discordant Chord." });
  }
}

function sourceNextTurnEndPhase(source) {
  return game.combat?.combatant?.actor?.uuid === source?.uuid ? "source-next-turn-end" : "source-turn-end";
}

async function createJarringPenalty(source, target, value, { expiryPhase = null, duration = null } = {}) {
  return addRuntimeEffect(target, runtimeEffectSource(
    "Jarring Motif",
    "jarring-motif-penalty",
    [{ key: "FlatModifier", selector: "will", type: "status", value: -Math.abs(value) }],
    { sourceActorUuid: source.uuid, expiryPhase, duration: duration ?? { unit: "minutes", value: 1, expiry: null }, extraFlags: { jarringMotif: { sourceActorUuid: source.uuid, penalty: value } } },
  ));
}

async function resolveJarringMotifOutcome(actor, targetToken, outcome, { clearMind = false } = {}) {
  const oldIds = (targetToken.actor.itemTypes?.effect ?? []).filter((effect) => effect.slug === "jarring-motif-penalty" && effect.getFlag?.(MODULE_ID, "temporaryFinale")?.sourceActorUuid === actor.uuid).map((effect) => effect.id);
  if (oldIds.length) await targetToken.actor.deleteEmbeddedDocuments("Item", oldIds);
  if (outcome === "criticalSuccess") {
    if (!clearMind) await addActionImmunity(targetToken.actor, actor, "jarring-motif", { unit: "minutes", value: 10 });
    return;
  }
  let effect = null;
  if (outcome === "success") effect = await createJarringPenalty(actor, targetToken.actor, 1, { expiryPhase: sourceNextTurnEndPhase(actor), duration: { unit: "encounter", value: -1, expiry: null } });
  if (outcome === "failure") effect = await createJarringPenalty(actor, targetToken.actor, 2);
  if (outcome === "criticalFailure") effect = await createJarringPenalty(actor, targetToken.actor, 3);
  if (effect) {
    const owners = game.users?.filter((user) => user.active && (user.isGM || targetToken.actor.testUserPermission?.(user, "OWNER"))).map((user) => user.id) ?? [];
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper: owners, content: `<section class="sow-card"><h3>Jarring Motif</h3><p>${escapeHtml(targetToken.name ?? targetToken.actor.name)} can spend one action with the concentrate trait to clear its mind.</p><button type="button" data-sow-action="jarring-clear-mind" data-actor-uuid="${escapeHtml(actor.uuid)}" data-target-token-uuid="${escapeHtml(targetToken.document?.uuid ?? targetToken.uuid)}">Clear Mind</button></section>`, flags: { [MODULE_ID]: { actorUuid: actor.uuid } } });
  }
}

async function executeJarringMotif(actor, targetToken) {
  if (!targetToken?.actor || actorDistance(actor, targetToken.actor) > 30 || !isEnemy(actor, targetToken.actor) || targetToken.actor.hasCondition?.("deafened")) return ui.notifications.warn("The target is no longer eligible.");
  if (temporaryActionImmunity(targetToken.actor, "jarring-motif", actor)) return ui.notifications.warn("That target is temporarily immune to your Jarring Motif.");
  const roll = await rollSave(targetToken, "will", actor, "Jarring Motif");
  await resolveJarringMotifOutcome(actor, targetToken, adaptiveOutcomeFromRoll(roll));
}

async function executeStaggeringDisplay(actor, targetToken, skill) {
  if (!targetToken?.actor || actorDistance(actor, targetToken.actor) > 30 || !isEnemy(actor, targetToken.actor) || targetToken.actor.hasCondition?.("deafened")) return ui.notifications.warn("The target is no longer eligible.");
  const current = state(actor);
  const descriptor = sanitizeAdaptiveDescriptor({ ...(ACTION_NOTE_IMMUNITY_MAP["staggering-display"]?.[4] ?? {}), note: 4, actionAliases: ["staggering-display"] });
  if (hasBattleTempo(actor) && current.openingNote === 4 && !current.completed) {
    const immunity = checkTargetImmunity(targetToken.actor, "staggering-display", actor, descriptor);
    if (immunity) return requestAdaptiveMeasurePrompt(actor, targetToken.actor, "staggering-display", immunity, { targetTokenUuid: targetToken.document?.uuid ?? targetToken.uuid, descriptor });
  }
  if (temporaryActionImmunity(targetToken.actor, "staggering-display", actor)) return ui.notifications.warn("That target is temporarily immune to your Staggering Display.");
  const roll = await rollSkillAgainstDC(actor, skill, targetToken, "will", "Staggering Display", ["item:trait:auditory", "item:trait:emotion", "item:trait:mental", ...(skill === "performance" ? [] : ["item:trait:linguistic"])]);
  const outcome = adaptiveOutcomeFromRoll(roll);
  if (["success", "criticalSuccess"].includes(outcome)) {
    await targetToken.actor.increaseCondition?.("prone");
    await addActionImmunity(targetToken.actor, actor, "staggering-display", { unit: "hours", value: 24 });
    if (outcome === "criticalSuccess") await rollDamageAndApply(actor, targetToken, `${Math.max(1, Math.floor(actorLevel(actor) / 2))}d6`, "Staggering Display", { damageType: "mental", outcome });
    if (hasBattleTempo(actor) && state(actor).openingNote === 4 && !state(actor).completed) await gainCombo(actor, 1, { complete: true, reason: "Staggering Display knocked the target prone and completed Percussive Drop." });
    return;
  }
  const selector = skill === "performance" ? "reflex-dc" : "will-dc";
  await addRuntimeEffect(targetToken.actor, runtimeEffectSource("Staggering Display", "staggering-display-distracted", [{ key: "FlatModifier", selector, type: "circumstance", value: -1 }], { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-start" }));
}

async function executeStaggeringStrike(actor, targetToken, strike) {
  const note = state(actor).openingNote;
  if (!hasBattleTempo(actor) || ![1, 4].includes(note)) return ui.notifications.warn("Staggering Strike no longer matches the Opening Note.");
  if (!targetToken?.actor || !strike || actorDistance(actor, targetToken.actor) > reachForActor(actor)) return ui.notifications.warn("The target is no longer in reach.");
  const descriptor = sanitizeAdaptiveDescriptor({ ...(ACTION_NOTE_IMMUNITY_MAP["staggering-strike"]?.[note] ?? {}), note, actionAliases: ["staggering-strike"] });
  if (!state(actor).completed) {
    const immunity = checkTargetImmunity(targetToken.actor, "staggering-strike", actor, descriptor);
    if (immunity) return requestAdaptiveMeasurePrompt(actor, targetToken.actor, "staggering-strike", immunity, { targetTokenUuid: targetToken.document?.uuid ?? targetToken.uuid, descriptor });
  }
  const variant = strikeVariantForCurrentMAP(actor, strike);
  const attack = await variant?.roll?.({ target: targetToken, options: ["action:staggering-strike", "item:trait:virtuoso"] });
  const attackOutcome = adaptiveOutcomeFromRoll(attack);
  if (!["success", "criticalSuccess"].includes(attackOutcome)) return;
  let save = await rollSave(targetToken, "fortitude", actor, "Staggering Strike");
  let outcome = adaptiveOutcomeFromRoll(save);
  if (attackOutcome === "criticalSuccess") outcome = { criticalSuccess: "success", success: "failure", failure: "criticalFailure", criticalFailure: "criticalFailure" }[outcome] ?? outcome;
  if (outcome !== "criticalSuccess") {
    await addRuntimeEffect(targetToken.actor, runtimeEffectSource("Staggering Strike", "staggering-strike-disrupted", [
      { key: "FlatModifier", selector: "fortitude-dc", type: "circumstance", value: -1, predicate: [{ or: ["action:grapple", "action:shove"] }, `origin:actor:uuid:${actor.uuid}`] },
      { key: "FlatModifier", selector: "reflex-dc", type: "circumstance", value: -1, predicate: [{ or: ["action:disarm", "action:trip"] }, `origin:actor:uuid:${actor.uuid}`] },
    ], { sourceActorUuid: actor.uuid, duration: { unit: "minutes", value: 1, expiry: null } }));
  }
  const canGrab = canGrabTarget(actor, targetToken.actor, strike);
  if (outcome === "failure") {
    if (note === 1 && canGrab) await applyTemporaryCondition(actor, targetToken.actor, "grabbed", null, sourceNextTurnEndPhase(actor));
    if (note === 4) await targetToken.actor.increaseCondition?.("prone");
  }
  if (outcome === "criticalFailure") {
    await targetToken.actor.increaseCondition?.("prone");
    if (canGrab) await applyTemporaryCondition(actor, targetToken.actor, "grabbed", null, sourceNextTurnEndPhase(actor));
  }
  const satisfied = note === 1 ? targetToken.actor.hasCondition?.("grabbed") : targetToken.actor.hasCondition?.("prone");
  if (satisfied && !state(actor).completed) await gainCombo(actor, 1, { complete: true, reason: `Staggering Strike completed ${NOTES[note].name}.` });
}

async function executeVisceralDemoralize(actor, targetToken) {
  if (!features(actor).has("visceral-presence")) return ui.notifications.warn("This actor does not have Visceral Presence.");
  if (!hasBattleTempo(actor)) return ui.notifications.warn("Visceral Presence requires Battle Tempo.");
  const skill = cadenceSkillSlug(actor);
  if (!skill || !targetToken?.actor || actorDistance(actor, targetToken.actor) > 30 || !isEnemy(actor, targetToken.actor)) return ui.notifications.warn("Visceral Presence cannot be used against that target.");
  const current = state(actor);
  const descriptor = sanitizeAdaptiveDescriptor({ ...(ACTION_NOTE_IMMUNITY_MAP["visceral-demoralize"]?.[2] ?? {}), note: current.openingNote === 6 && actorCadenceSlug(actor) === "the-captivating-solo" ? 6 : 2, signatureMotif: current.openingNote === 6 ? "magnetic-verse" : null });
  if (hasBattleTempo(actor) && [2, 6].includes(current.openingNote) && !current.completed) {
    const immunity = checkTargetImmunity(targetToken.actor, "visceral-demoralize", actor, descriptor);
    if (immunity) return requestAdaptiveMeasurePrompt(actor, targetToken.actor, "visceral-demoralize", immunity, { targetTokenUuid: targetToken.document?.uuid ?? targetToken.uuid, descriptor });
  }
  if (temporaryActionImmunity(targetToken.actor, "demoralize", actor) || temporaryActionImmunity(targetToken.actor, "visceral-demoralize", actor)) return ui.notifications.warn("That target is temporarily immune to your Demoralize.");
  const roll = await rollSkillAgainstDC(actor, skill, targetToken, "will", "Visceral Demoralize", ["action:demoralize", "item:trait:visual", "item:trait:emotion", "item:trait:fear", "item:trait:mental"]);
  const outcome = adaptiveOutcomeFromRoll(roll);
  if (outcome === "criticalSuccess") await ensureConditionAtLeast(targetToken.actor, "frightened", 2);
  if (outcome === "success") await ensureConditionAtLeast(targetToken.actor, "frightened", 1);
  await addActionImmunity(targetToken.actor, actor, "visceral-demoralize", { unit: "minutes", value: 10 });
  if (["success", "criticalSuccess"].includes(outcome) && hasBattleTempo(actor) && !state(actor).completed) {
    if (state(actor).openingNote === 2) await gainCombo(actor, 1, { complete: true, reason: "Visceral Demoralize inflicted frightened and completed Discordant Chord." });
    else if (state(actor).openingNote === 6 && actorCadenceSlug(actor) === "the-captivating-solo") await gainCombo(actor, 1, { complete: true, reason: "Visceral Demoralize satisfied Magnetic Verse." });
  }
}

async function handleLevelTwoActionRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = payload?.actorUuid ? await fromUuid(payload.actorUuid) : null;
  if (!requester || !actor || !actor.testUserPermission?.(requester, "OWNER")) return;
  const slug = String(payload?.actionSlug ?? "");
  const targetToken = payload?.extra?.targetTokenUuid ? await tokenFromUuid(payload.extra.targetTokenUuid) : null;
  if (slug === "deafening-clash" || slug === "staggering-strike") {
    const strike = strikeEntry(actor, payload.extra?.rootIndex, payload.extra?.altUsage);
    return slug === "deafening-clash" ? executeDeafeningClash(actor, targetToken, strike) : executeStaggeringStrike(actor, targetToken, strike);
  }
  if (slug === "heartbeat-dissonance") return executeHeartbeatDissonance(actor, targetToken);
  if (slug === "jarring-motif") return executeJarringMotif(actor, targetToken);
  if (slug === "staggering-display") return executeStaggeringDisplay(actor, targetToken, String(payload.extra?.skill ?? "performance"));
  if (slug === "visceral-demoralize") return executeVisceralDemoralize(actor, targetToken);
  if (slug === "sidestep-sync") return executeSidestepSync(actor, targetToken);
  if (slug === "jarring-clear-mind") {
    const roll = await rollSave(targetToken, "will", actor, "Clear Mind — Jarring Motif");
    return resolveJarringMotifOutcome(actor, targetToken, adaptiveOutcomeFromRoll(roll), { clearMind: true });
  }
}


function passTheBeatEffectData(effect) {
  return effect?.getFlag?.(MODULE_ID, "passTheBeat") ?? effect?.flags?.[MODULE_ID]?.passTheBeat ?? null;
}

function passTheBeatEffectSource(virtuoso, ally, note) {
  const noteName = NOTES[note]?.name ?? `Opening Note ${note}`;
  const requirement = noteText(virtuoso, note);
  return {
    name: `Pass the Beat — ${noteName}`,
    type: "effect",
    img: "icons/tools/instruments/harp-yellow-teal.webp",
    system: {
      description: {
        value: `<p><strong>${escapeHtml(virtuoso.name)}</strong> passed their battlefield rhythm to you.</p><p><strong>${escapeHtml(noteName)}:</strong> ${requirement}</p><p>This passed note lasts until the end of your next turn or until the start of ${escapeHtml(virtuoso.name)}'s next turn, whichever comes first.</p><p>If you fulfill the requirement before then, ${escapeHtml(virtuoso.name)} gains 1 Combo Chain and you gain temporary Hit Points equal to their Charisma modifier.</p>`,
      },
      duration: { sustained: false, unit: "unlimited", value: -1, expiry: null },
      level: { value: Math.max(1, actorLevel(virtuoso)) },
      publication: { license: "ORC", remaster: true, title: "Symphonies of War" },
      rules: [],
      start: { initiative: null, value: 0 },
      tokenIcon: { show: true },
      traits: { rarity: "common", value: ["virtuoso"] },
      slug: PASS_THE_BEAT_EFFECT_SLUG,
      _migration: { version: 0.955, previous: null },
    },
    flags: {
      [MODULE_ID]: {
        passTheBeat: {
          sourceActorUuid: virtuoso.uuid,
          sourceActorId: virtuoso.id,
          allyActorUuid: ally.uuid,
          allyActorId: ally.id,
          openingNote: note,
          sourceTurnKey: currentTurnKey(),
          createdAt: Date.now(),
        },
      },
    },
  };
}

function passTheBeatCandidateActors() {
  const actors = new Map();
  for (const actor of game.actors ?? []) {
    const key = actorIdentityId(actor) ?? actor.uuid;
    if (key) actors.set(key, actor);
  }
  // Prefer the synthetic actor currently represented on the active canvas. It
  // has the same stable actor ID but the correct token-scoped context in V13.
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!token.actor) continue;
    const key = actorIdentityId(token.actor) ?? token.actor.uuid;
    if (key) actors.set(key, token.actor);
  }
  return [...actors.values()];
}

async function clearPassTheBeatEffects({ sourceActorUuid = null, sourceActorId = null, allyActor = null } = {}) {
  const actors = allyActor ? [allyActor] : passTheBeatCandidateActors();
  for (const actor of actors) {
    const ids = (actor.itemTypes?.effect ?? []).filter((effect) => {
      if (effect.slug !== PASS_THE_BEAT_EFFECT_SLUG) return false;
      const data = passTheBeatEffectData(effect);
      if (!sourceActorUuid && !sourceActorId) return true;
      return (sourceActorId && data?.sourceActorId === sourceActorId)
        || (sourceActorUuid && data?.sourceActorUuid === sourceActorUuid);
    }).map((effect) => effect.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids, { render: false });
  }
}

async function applyPassTheBeatEffect(virtuoso, ally, note) {
  await clearPassTheBeatEffects({ sourceActorUuid: virtuoso.uuid, sourceActorId: virtuoso.id });
  return addRuntimeEffect(ally, passTheBeatEffectSource(virtuoso, ally, note));
}

async function repairPassTheBeatEffects() {
  if (!game.user.isActiveGM) return;
  for (const ally of passTheBeatCandidateActors()) {
    const deletions = [];
    for (const effect of ally.itemTypes?.effect ?? []) {
      if (effect.slug !== PASS_THE_BEAT_EFFECT_SLUG) continue;
      const data = passTheBeatEffectData(effect);
      const source = await resolveActorReference({ uuid: data?.sourceActorUuid, id: data?.sourceActorId });
      const current = source ? state(source) : null;
      const valid = source
        && hasBattleTempo(source)
        && actorMatchesReference(ally, { uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId })
        && Number(current.openingNote) === Number(data?.openingNote);
      if (!valid) deletions.push(effect.id);
    }
    if (deletions.length) await ally.deleteEmbeddedDocuments("Item", deletions, { render: false });
  }

  for (const virtuoso of passTheBeatCandidateActors()) {
    const current = state(virtuoso);
    if (!hasBattleTempo(virtuoso) || (!current.passTheBeatAllyUuid && !current.passTheBeatAllyId) || !current.openingNote) continue;
    const ally = await resolveActorReference({ uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId });
    if (!ally) {
      await setState(virtuoso, { passTheBeatAllyUuid: null, passTheBeatAllyId: null, passTheBeatTurnKey: null, passTheBeatProgress: null });
      continue;
    }
    if (!current.passTheBeatAllyId) await setState(virtuoso, { passTheBeatAllyId: ally.id });
    const exists = (ally.itemTypes?.effect ?? []).some((effect) => {
      const data = passTheBeatEffectData(effect);
      return effect.slug === PASS_THE_BEAT_EFFECT_SLUG
        && ((data?.sourceActorId && data.sourceActorId === virtuoso.id)
          || data?.sourceActorUuid === virtuoso.uuid);
    });
    if (!exists) await addRuntimeEffect(ally, passTheBeatEffectSource(virtuoso, ally, current.openingNote));
  }
}

async function clearPassTheBeatState(virtuoso, ally = null) {
  const current = state(virtuoso);
  const allyActor = ally ?? await resolveActorReference({ uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId });
  if (allyActor) await clearPassTheBeatEffects({ sourceActorUuid: virtuoso.uuid, sourceActorId: virtuoso.id, allyActor });
  else await clearPassTheBeatEffects({ sourceActorUuid: virtuoso.uuid, sourceActorId: virtuoso.id });
  for (const [key, candidate] of recentPassedHealingCandidates) {
    if (candidate.sourceActorUuid === virtuoso.uuid || candidate.sourceActorId === virtuoso.id) recentPassedHealingCandidates.delete(key);
  }
  await setState(virtuoso, {
    passTheBeatAllyUuid: null,
    passTheBeatAllyId: null,
    passTheBeatTurnKey: null,
    passTheBeatProgress: null,
  });
}

function passTheBeatEligibleAllies(actor) {
  return (canvas?.tokens?.placeables ?? []).filter((token) =>
    token.actor
    && !sameActorIdentity(token.actor, actor)
    && !isEnemy(actor, token.actor)
    && actorDistance(actor, token.actor) <= 30
    && !token.document?.hidden
  );
}

async function assignPassTheBeatAlly(actor, allyReference) {
  const current = state(actor);
  if (!hasBattleTempo(actor) || current.completed || current.passTheBeatAllyUuid || current.passTheBeatAllyId) {
    return post(actor, "Pass the Beat", "<p>Pass the Beat is no longer available.</p>");
  }

  const requestedId = typeof allyReference === "object" ? allyReference?.id : String(allyReference ?? "");
  const requestedUuid = typeof allyReference === "object" ? allyReference?.uuid : null;
  const eligibleToken = passTheBeatEligibleAllies(actor).find((token) =>
    (requestedId && token.actor?.id === requestedId)
    || (requestedUuid && token.actor?.uuid === requestedUuid)
    || (!requestedUuid && requestedId && token.actor?.uuid === requestedId)
  );
  const ally = eligibleToken?.actor ?? await resolveActorReference({ uuid: requestedUuid ?? requestedId, id: requestedId });
  if (!ally || !eligibleToken) {
    return post(actor, "Pass the Beat", "<p>That ally is no longer visible, eligible, or within 30 feet.</p>");
  }

  await setState(actor, {
    passTheBeatAllyUuid: ally.uuid,
    passTheBeatAllyId: ally.id,
    passTheBeatTurnKey: currentTurnKey(),
    passTheBeatProgress: { strikes: [], healingCandidateAt: 0 },
    completed: false,
  });
  await applyPassTheBeatEffect(actor, ally, current.openingNote);
  return post(actor, "Pass the Beat", `<p>Rhythm passed to <strong>${escapeHtml(ally.name)}</strong>.</p><p><strong>${escapeHtml(NOTES[current.openingNote]?.name ?? "Opening Note")}</strong>: ${noteText(actor, current.openingNote)}</p><p>Your chains are held until the end of that ally's next turn or until the start of your next turn, whichever comes first.</p>`);
}

async function promptPassTheBeatAlly(actor, allies) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;

  const current = state(actor);
  const selectedActorId = await DialogV2.wait({
    window: { title: "Pass the Beat — Select Ally" },
    position: { width: 460 },
    modal: true,
    content: `<div class="sow-pass-the-beat-dialog"><p>Choose one visible ally within 30 feet.</p><p><strong>${escapeHtml(NOTES[current.openingNote]?.name ?? "Opening Note")}</strong>: ${noteText(actor, current.openingNote)}</p></div>`,
    buttons: [
      ...allies.map((token, index) => ({
        action: `ally-${index}`,
        label: token.actor.name,
        icon: "fa-solid fa-user-group",
        default: index === 0,
        callback: () => token.actor.id,
      })),
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-xmark",
        callback: () => null,
      },
    ],
  }).catch((error) => {
    console.error("Symphonies of War | Pass the Beat ally dialog failed", error);
    return null;
  });

  return typeof selectedActorId === "string" && selectedActorId.length ? selectedActorId : null;
}

async function beginPassTheBeat(actor) {
  const current = state(actor);
  if (!hasBattleTempo(actor)) return post(actor, "Pass the Beat", "<p>You must be in Battle Tempo.</p>");
  if (current.completed) return post(actor, "Pass the Beat", "<p>You have already gained your standard Combo Chain this turn.</p>");
  if (current.heroicCadenceLocked) return post(actor, "Pass the Beat", "<p>Heroic Cadence prevents any further Combo Chain from this Opening Note during the current turn.</p>");
  if (current.passTheBeatAllyUuid || current.passTheBeatAllyId) return post(actor, "Pass the Beat", "<p>Your Opening Note is already being carried by an ally.</p>");
  const allies = passTheBeatEligibleAllies(actor);
  if (!allies.length) return post(actor, "Pass the Beat", "<p>No visible eligible ally is within 30 feet.</p>");

  const selectedActorId = await promptPassTheBeatAlly(actor, allies);
  if (selectedActorId) return assignPassTheBeatAlly(actor, selectedActorId);

  // Foundry 13 provides DialogV2. This fallback is retained for older or highly
  // customized clients where the dialog API is unavailable.
  if (!foundry?.applications?.api?.DialogV2?.wait) {
    const buttons = allies.map((token) => `<a data-sow-action="select-ptb-ally" data-ally-id="${token.actor.id}" data-actor-uuid="${actor.uuid}" style="cursor:pointer;padding:2px 8px;background:#4a90d9;color:white;border-radius:3px;font-size:12px;margin:2px">${escapeHtml(token.actor.name)}</a>`).join(" ");
    return post(actor, "Pass the Beat", `<p>Choose an ally within 30 feet:</p><p><strong>${escapeHtml(NOTES[current.openingNote]?.name ?? "Opening Note")}</strong>: ${noteText(actor, current.openingNote)}</p><div class="sow-buttons" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${buttons}</div>`);
  }

  return null;
}

async function handleAction(eventOrButton) {
  const button = eventOrButton instanceof HTMLElement ? eventOrButton : eventOrButton.currentTarget;
  const actorUuid = button.dataset.sowActorUuid ?? button.dataset.actorUuid ?? null;
  let actor = actorUuid ? await fromUuid(actorUuid) : null;
  if (!actor) {
    const sheet = button.closest("[data-appid], .app, .application");
    if (sheet) {
      const app = ui.windows?.[Number(sheet.dataset.appid)] ?? Object.values(ui.windows ?? {}).find((w) => w.element?.[0] === sheet);
      if (app?.actor) actor = app.actor;
    }
  }
  if (!actor || !canEdit(actor)) return ui.notifications.warn("You cannot edit that actor.");
  const action = button.dataset.sowAction;
  if (action === "adaptive-measure-yes" || action === "adaptive-measure-no") {
    const message = game.messages?.get(button.dataset.messageId);
    if (!message) return ui.notifications.warn("The Adaptive Measure prompt is no longer available.");
    return requestAdaptiveChatDecision(message, action === "adaptive-measure-yes");
  }
  if (action === "adaptive-measure-strike") {
    const message = game.messages?.get(button.dataset.messageId);
    if (!message) return ui.notifications.warn("The Adaptive Measure prompt is no longer available.");
    return useAdaptiveMeasureStrike(message, button);
  }
  if (action === "adaptive-measure-cancel") {
    const message = game.messages?.get(button.dataset.messageId);
    if (!message) return;
    return requestAdaptiveChatDecision(message, false);
  }
  if (action === "resolve-subclass-finale") {
    const slug = String(button.dataset.finaleSlug ?? "");
    if (!SUBCLASS_FINALE_SLUGS.has(slug)) return ui.notifications.warn("Unknown Virtuoso Finale.");
    return requestSubclassFinale(actor, slug, selectedTargetTokenUuids(), { requestedSpend: Number(button.dataset.spend || state(actor).chains) });
  }
  if (action === "use-rhythmic-flow") return useRhythmicFlow(actor, String(button.dataset.flowAction ?? ""));
  if (action === "vitalizing-strike") {
    const targets = selectedTargetTokenUuids();
    if (targets.length !== 1) return ui.notifications.warn("Target exactly one ally for Vitalizing Strike.");
    return requestVitalizingStrike(actor, Number(button.dataset.rootIndex), button.dataset.altUsage ?? "", targets[0]);
  }
  if (action === "whirling-strike") {
    const targets = selectedTargetTokenUuids();
    if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy for Whirling Crescendo.");
    return requestWhirlingStrike(actor, Number(button.dataset.rootIndex), button.dataset.altUsage ?? "", targets[0]);
  }
  if (action === "finish-whirling") return requestWhirlingFinish(actor);
  if (action === "whirling-damage") return requestWhirlingDamage(actor, Number(button.dataset.hitIndex));
  if (action === "clear-whirling") return requestWhirlingClear(actor);
  if (action === "ricochet-maneuver") {
    const targets = selectedTargetTokenUuids();
    if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy for Ricochet Tempo.");
    return requestRicochetManeuver(actor, String(button.dataset.maneuver ?? ""), Number(button.dataset.rootIndex), button.dataset.altUsage ?? "", targets[0]);
  }
  if (action === "guiding-note-ally") return chooseGuidingNoteAlly(actor, button.dataset.allyId ?? button.dataset.allyUuid);
  if (action === "level-two-strike") {
    const targets = selectedTargetTokenUuids();
    if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy.");
    return requestLevelTwoAction(actor, String(button.dataset.levelTwoSlug ?? ""), { targetTokenUuid: targets[0], rootIndex: Number(button.dataset.rootIndex), altUsage: button.dataset.altUsage ?? "" });
  }
  if (action === "level-two-skill") return requestLevelTwoAction(actor, String(button.dataset.levelTwoSlug ?? ""), { targetTokenUuid: button.dataset.targetTokenUuid, skill: button.dataset.skill });
  if (action === "jarring-clear-mind") return requestLevelTwoAction(actor, "jarring-clear-mind", { targetTokenUuid: button.dataset.targetTokenUuid });
  if (action === "sidestep-sync") return requestLevelTwoAction(actor, "sidestep-sync", { targetTokenUuid: button.dataset.targetTokenUuid });
  if (action === "visceral-demoralize") {
    const targets = selectedTargetTokenUuids();
    if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy within 30 feet.");
    return requestLevelTwoAction(actor, "visceral-demoralize", { targetTokenUuid: targets[0] });
  }
  if (action === "double-cadenza-pair") return executeDoubleCadenza(actor, button);
  if (action === "double-cadenza-damage-choice") return resolveDoubleCadenzaDamageChoice(
    actor,
    String(button.dataset.choiceId ?? ""),
    String(button.dataset.damageMode ?? "separate"),
    button.dataset.messageId ?? null,
  );
  if (action === "flowing-sweep-maneuver") return executeFlowingSweep(actor, String(button.dataset.maneuver ?? ""), String(button.dataset.skill ?? "athletics"));
  if (action === "crescendo-strike-weapon") return executeCrescendoStrike(actor, button);
  if (action === "resonant-recenter") {
    const effect = button.dataset.effectUuid ? await fromUuid(button.dataset.effectUuid) : null;
    if (effect?.isOwner || game.user.isGM) await effect.delete();
    return;
  }
  if (action === "start-battle-tempo") return startBattleTempo(actor);
  if (action === "roll-opening-note") return rollOpeningNote(actor);
  if (action === "complete-opening-note") return gainCombo(actor, 1, { complete: true, reason: "Opening Note completed manually." });
  if (action === "gain-combo-chain") return gainCombo(actor, 1);
  if (action === "reset-combo-chain") return resetCombo(actor);
  if (action === "preserve-combo-chain") return preserveCombo(actor);
  if (action === "spend-combo-chain" && button.dataset.spend) {
    const spent = await spendCombo(actor, Number(button.dataset.spend));
    return post(actor, "Combo Chain", `<p>Spent ${spent} Combo Chain. Current: <strong>${state(actor).chains}/${maxChains(actor)}</strong>.</p>`, { includeSpend: true });
  }
  if (action === "spend-combo-chain") return;
  if (action === "use-crescendo-strike") return beginCrescendoStrike(actor);
  if (action === "use-all-crescendo-strike") return beginCrescendoStrike(actor);
  if (action === "resolve-crescendo-strike") return beginCrescendoStrike(actor);
  if (action === "use-rhythm-recovery") {
    const today = new Date().toISOString().slice(0, 10);
    await setState(actor, { preserveReset: false, rhythmRecoveryUsedDay: today, completed: false });
    return post(actor, "Rhythm Recovery", "<p>Combo Chains preserved! They will not reset at end of turn.</p>");
  }
  if (action === "accept-reset") return resetCombo(actor, "Opening Note was not completed this turn.");
  if (action === "pass-the-beat") return beginPassTheBeat(actor);
  if (action === "select-ptb-ally") return assignPassTheBeatAlly(actor, button.dataset.allyId ?? button.dataset.allyUuid);
}

function wireChatButtons(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const actor = actorFromSpeaker(message.speaker);
  root.querySelectorAll("[data-sow-action]").forEach((button) => {
    if (!button.dataset.actorUuid && actor) button.dataset.actorUuid = actor.uuid;
    button.dataset.messageId = message.id;
  });

  const doubleCadenzaAttack = messageRollOptions(message).includes("sow:activity:double-cadenza");
  if (isAdaptiveStrikeMessage(message) || doubleCadenzaAttack) {
    root.querySelectorAll(
      '[data-action="strike-damage"], [data-action="strike-critical"], [data-action^="strike-damage"]',
    ).forEach((element) => element.remove());
    root.querySelectorAll(".message-buttons, .card-buttons-two-column").forEach((group) => {
      if (!group.querySelector("button, a")) group.remove();
    });
    if (isAdaptiveStrikeMessage(message)) {
      const content = root.querySelector(".message-content");
      if (content && !content.querySelector(".sow-adaptive-no-damage")) {
        content.insertAdjacentHTML("afterbegin", '<div class="sow-adaptive-no-damage" style="margin-bottom:4px;padding:4px 6px;border:1px solid var(--color-border-light-primary);border-radius:3px"><strong>Adaptive Measure:</strong> MAP 0. This Strike deals no damage.</div>');
      }
    }
  }
}

function shouldAutomateActor(actor) {
  if (!actor || !canEdit(actor)) return false;
  const activeGM = game.users?.activeGM;
  return activeGM ? game.user.isActiveGM : actor.isOwner;
}

async function actionFromMessage(message, actor) {
  const flags = message.flags?.pf2e ?? {};
  const contextItemId = flags.context?.type === "self-effect" ? flags.context.item : null;
  if (contextItemId && actor?.items?.has(contextItemId)) return actor.items.get(contextItemId);
  const uuid = flags.origin?.uuid;
  if (!uuid) return null;
  const item = await fromUuid(uuid);
  return item?.actor?.uuid === actor?.uuid || uuid.startsWith("Compendium.") ? item : null;
}

function actionSlugFromMessage(message, item) {
  const itemSlug = item?.slug ?? item?.system?.slug ?? null;

  // Executable SoW action/feat documents own their workflow and should keep
  // their document slug. Native PF2e skill actions are different: Disarm,
  // Grapple, Shove, and Trip can attach the best maneuver weapon as the roll
  // origin. In that case the origin item slug is the weapon (for example
  // "whip"), while the authoritative action is carried by `action:*` roll
  // options. Prefer those explicit action options before a weapon/item slug.
  const sowExecutableFeat = item?.type === "feat" && (
    LEVEL_ONE_ACTION_FEATS.has(itemSlug)
    || LEVEL_TWO_ACTION_FEATS.has(itemSlug)
    || LEVEL_ONE_GRANTED_ACTIONS.has(itemSlug)
    || ARCHETYPE_GRANTED_ACTION_UUIDS.has(itemSlug)
  );
  if ((item?.type === "action" || sowExecutableFeat) && itemSlug) return itemSlug;

  const actionOptions = messageRollOptions(message)
    .map((option) => /^(?:origin:|self:)?action(?::slug)?:([a-z0-9-]+)$/.exec(String(option))?.[1] ?? null)
    .filter(Boolean);
  if (actionOptions.length) {
    const preferred = actionOptions.find((slug) => (
      CHECK_ACTIONS.has(slug)
      || ACTION_COMPLETES_NOTE[slug]
      || ACTION_IMMUNITY_MAP[slug]
      || ACTION_NOTE_IMMUNITY_MAP[slug]
    ));
    return preferred ?? actionOptions.at(-1);
  }

  return itemSlug;
}

function messageOutcome(message) {
  const outcome = message.flags?.pf2e?.context?.outcome ?? null;
  if (!outcome) return null;
  return String(outcome).replace("critical-success", "criticalSuccess").replace("critical-failure", "criticalFailure");
}

function messageSucceeded(message) {
  return ["success", "criticalSuccess"].includes(messageOutcome(message));
}

function messageFailed(message) {
  return ["failure", "criticalFailure"].includes(messageOutcome(message));
}

function messageAuthor(message) {
  const userReference = message?.author?.id ?? message?.user?.id ?? message?.user ?? message?.userId ?? null;
  return message?.author ?? (userReference ? game.users?.get(userReference) : null) ?? null;
}

function messageAuthorTargetActor(message) {
  const targets = messageAuthor(message)?.targets;
  if (!targets) return null;
  return targets.first?.()?.actor ?? Array.from(targets)[0]?.actor ?? null;
}

function targetActorFromMessage(message) {
  const actorRefs = [
    message.flags?.pf2e?.context?.target?.actor,
    message.flags?.pf2e?.target?.actor,
    message.target?.actor?.uuid,
    message.target?.actor?.id,
  ].filter(Boolean);
  for (const reference of actorRefs) {
    const document = fromUuidSync?.(reference) ?? game.actors?.get(reference) ?? null;
    if (document?.actor) return document.actor;
    if (document?.type && document?.system) return document;
  }

  const tokenRefs = [
    message.flags?.pf2e?.context?.target?.token,
    message.flags?.pf2e?.target?.token,
    message.target?.token?.document?.uuid,
    message.target?.token?.uuid,
  ].filter(Boolean);
  for (const reference of tokenRefs) {
    const token = fromUuidSync?.(reference)
      ?? canvas?.scene?.tokens?.get(reference)
      ?? canvas?.tokens?.get(reference)?.document
      ?? null;
    if (token?.actor) return token.actor;
  }

  return messageAuthorTargetActor(message);
}

function messageRollOptions(message) {
  return [
    ...(message.flags?.pf2e?.context?.options ?? []),
    ...(message.flags?.pf2e?.origin?.rollOptions ?? []),
    ...(message.flags?.pf2e?.context?.domains ?? []).map((d) => `domain:${d}`),
  ];
}

function isAdaptiveStrikeMessage(message) {
  return !!message?.flags?.[MODULE_ID]?.adaptiveMeasureStrike
    || messageRollOptions(message).includes(ADAPTIVE_ROLL_OPTION);
}

function stripAdaptiveDamageControls(content) {
  if (!content || typeof document === "undefined") return content;
  const container = document.createElement("div");
  container.innerHTML = String(content);
  container.querySelectorAll(
    '[data-action="strike-damage"], [data-action="strike-critical"], [data-action^="strike-damage"]',
  ).forEach((element) => element.remove());
  container.querySelectorAll(".message-buttons, .card-buttons-two-column").forEach((group) => {
    if (!group.querySelector("button, a")) group.remove();
  });
  return container.innerHTML;
}

function serializeNonDamagingRoll(roll) {
  let source = typeof roll?.toJSON === "function" ? roll.toJSON() : null;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = null; }
  }
  if (!source || typeof source !== "object") return null;
  source = foundry.utils.deepClone(source);
  source.options = { ...(source.options ?? {}), damaging: false };
  return source;
}

function markAdaptiveStrikeNonDamaging(message) {
  // PF2e decides whether to render Damage/Critical Damage controls from the
  // CheckRoll's `options.damaging` value. Clear it before the message is created,
  // keep an explicit module flag for later re-renders, and sanitize already-built
  // HTML as a compatibility fallback for Foundry/PF2e changes.
  for (const roll of message.rolls ?? []) {
    try {
      if (roll?.options) roll.options.damaging = false;
    } catch {
      // Some Foundry builds freeze hydrated Roll options. The serialized source
      // replacement below remains the authoritative fallback.
    }
  }
  const rolls = (message.rolls ?? []).map(serializeNonDamagingRoll).filter(Boolean);
  const adaptiveStrikeFlag = {
    ...(message.flags?.[MODULE_ID]?.adaptiveMeasureStrike ?? {}),
    noDamage: true,
  };
  const update = {
    [`flags.${MODULE_ID}.adaptiveMeasureStrike`]: adaptiveStrikeFlag,
    "flags.pf2e.suppressDamageButtons": true,
    content: stripAdaptiveDamageControls(message.content),
  };
  if (rolls.length) update.rolls = rolls;
  try {
    message.updateSource(update);
  } catch (error) {
    console.warn("Symphonies of War | Could not rewrite Adaptive Measure roll source; applying HTML/flag fallback.", error);
    message.updateSource({
      [`flags.${MODULE_ID}.adaptiveMeasureStrike`]: adaptiveStrikeFlag,
      "flags.pf2e.suppressDamageButtons": true,
      content: stripAdaptiveDamageControls(message.content),
    });
  }
}

function adaptiveDamageBlockFor(actor) {
  const block = actor?.getFlag?.(MODULE_ID, "adaptiveNoDamage") ?? null;
  if (!block) return null;
  if (Number(block.expiresAt ?? 0) <= Date.now()) {
    actor.unsetFlag?.(MODULE_ID, "adaptiveNoDamage").catch(() => {});
    return null;
  }
  return block;
}

function damageMessageMatchesAdaptiveBlock(message, actor) {
  const block = adaptiveDamageBlockFor(actor);
  if (!block) return false;
  const context = message.flags?.pf2e?.context ?? {};
  const originUuid = message.flags?.pf2e?.origin?.uuid ?? context.origin?.item ?? "";
  const itemMatches = !block.strikeItemId
    || originUuid === block.strikeItemUuid
    || originUuid.endsWith(`.${block.strikeItemId}`);
  const targetUuid = context.target?.actor ?? null;
  const targetMatches = !block.targetUuid || !targetUuid || targetUuid === block.targetUuid;
  return itemMatches && targetMatches;
}

function preCreateAdaptiveMeasureMessage(message) {
  try {
    const options = messageRollOptions(message);
    const context = message.flags?.pf2e?.context ?? {};
    const actor = actorFromSpeaker(message.speaker) ?? message.actor ?? null;

    // Mark the attack itself as non-damaging at the Roll source level. Merely
    // removing its buttons after render is not sufficient because PF2e and some
    // automation modules can render or invoke damage before that hook runs.
    if (context.type === "attack-roll" && options.includes(ADAPTIVE_ROLL_OPTION)) {
      markAdaptiveStrikeNonDamaging(message);
      return;
    }

    // Cancel damage even when another automation fails to carry our custom roll
    // option forward. The short-lived actor block is keyed to the exact weapon and
    // target chosen for Adaptive Measure.
    if (context.type === "damage-roll" && (
      options.includes(ADAPTIVE_ROLL_OPTION)
      || damageMessageMatchesAdaptiveBlock(message, actor)
    )) {
      ui.notifications.warn("Adaptive Measure Strikes deal no damage.");
      return false;
    }

    if (message.flags?.[MODULE_ID] || options.includes(ADAPTIVE_ROLL_OPTION)) return;
    if (!actor || !canEdit(actor) || !adaptiveMeasureItem(actor) || !hasBattleTempo(actor)) return;

    const item = message.item
      ?? (message.flags?.pf2e?.origin?.uuid ? fromUuidSync(message.flags.pf2e.origin.uuid) : null)
      ?? null;
    const slug = actionSlugFromMessage(message, item);
    if (!slug) return;

    const current = state(actor);
    if (current.completed) return;
    const descriptor = adaptiveDescriptorForAction(actor, message, item, slug);
    if (!descriptor?.note) return;

    const target = targetActorFromMessage(message) ?? message.target?.actor ?? messageAuthorTargetActor(message) ?? null;
    const immunity = checkTargetImmunity(target, slug, actor, descriptor);
    if (!target || !immunity) return;

    queueAdaptiveMeasurePrompt(actor, target, slug, immunity, {
      targetTokenUuid: adaptiveTargetTokenUuid(message),
      descriptor,
    });
    closeAdaptiveSourceDialogs(slug, message, item);

    // PF2e still constructs a check for actions against immune targets. Cancel the
    // chat message before creation and replace it with the reaction-style prompt.
    return false;
  } catch (error) {
    console.warn("Symphonies of War | Adaptive Measure pre-create interception failed:", error);
    return undefined;
  }
}

function statisticSlugFromMessage(message) {
  const context = message.flags?.pf2e?.context ?? {};
  const candidates = [
    message.flags?.pf2e?.modifierName,
    context.statistic,
    context.slug,
    ...(context.domains ?? []),
  ].filter((value) => typeof value === "string");

  for (const option of messageRollOptions(message)) {
    const match = /^(?:check:statistic|skill):([a-z0-9-]+)$/.exec(option);
    if (match) candidates.push(match[1]);
  }

  return candidates.find((candidate) => !!CONFIG.PF2E?.skills?.[candidate]) ?? null;
}

function isCharismaSkillCheck(message, actor = null) {
  const context = message.flags?.pf2e?.context ?? {};
  const options = messageRollOptions(message);
  const statisticSlug = statisticSlugFromMessage(message);
  const isSkill = context.type === "skill-check"
    || context.domains?.includes("skill-check")
    || options.includes("check:type:skill")
    || !!statisticSlug;
  if (!isSkill) return false;

  const configuredAttribute = statisticSlug ? CONFIG.PF2E?.skills?.[statisticSlug]?.attribute : null;
  const statisticAttribute = statisticSlug ? actor?.getStatistic?.(statisticSlug)?.attribute : null;
  return configuredAttribute === "cha"
    || statisticAttribute === "cha"
    || context.domains?.includes("cha-based")
    || options.includes("domain:cha-based")
    || options.includes("cha-based");
}

function actionTraitsFromMessage(message, item = null) {
  const traits = new Set(message.flags?.pf2e?.context?.traits ?? []);
  for (const option of messageRollOptions(message)) {
    const match = /^(?:item:trait|action:trait|self:action:trait):([a-z0-9-]+)$/.exec(option);
    if (match) traits.add(match[1]);
  }
  for (const trait of item?.system?.traits?.value ?? []) traits.add(String(trait));
  return [...traits];
}

function immunityTypesForTraits(traits) {
  const types = new Set();
  for (const trait of traits) {
    types.add(trait);
    if (trait === "fear") types.add("fear-effects");
    if (trait === "death") types.add("death-effects");
    if (trait === "disease") types.add("disease");
    if (trait === "poison") types.add("poison");
  }
  return [...types];
}


function actionTextForImmunityInference(message, item = null) {
  const values = [
    item?.name,
    item?.system?.description?.value,
    item?.system?.description,
    message?.flavor,
    message?.content,
  ].filter((value) => typeof value === "string" && value.trim());
  const html = values.join(" ");
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return (wrapper.textContent ?? "").replace(/\s+/g, " ").trim();
}

function applyAdaptiveConditionAlternatives(actor, descriptor) {
  if (!descriptor || Number(descriptor.note) !== 2 || !features(actor).has("cognitive-dissonance")) return descriptor;
  if (!(descriptor.effectSlugs ?? []).includes("clumsy") && !(descriptor.immunityTypes ?? []).includes("clumsy")) return descriptor;
  return {
    ...descriptor,
    effectSlugs: [...new Set([...(descriptor.effectSlugs ?? []), "stupefied"])],
    immunityTypes: [...new Set([...(descriptor.immunityTypes ?? []), "stupefied"])],
    alternativeGroups: [...(descriptor.alternativeGroups ?? []), ["clumsy", "stupefied"]],
  };
}

function knownActionNoteDescriptor(actor, message, item, slug, note) {
  const profile = ACTION_NOTE_IMMUNITY_MAP[slug]?.[note];
  if (!profile) return null;
  const traits = [...new Set([...(profile.traits ?? []), ...actionTraitsFromMessage(message, item)])];
  return sanitizeAdaptiveDescriptor(applyAdaptiveConditionAlternatives(actor, {
    note,
    effectSlugs: profile.effectSlugs ?? [],
    immunityTypes: [...new Set([...(profile.immunityTypes ?? []), ...immunityTypesForTraits(traits)])],
    actionAliases: [...new Set([slug, ...(profile.actionAliases ?? [])])],
    traits,
  }));
}

function inferredActionNoteDescriptor(actor, message, item, slug, note) {
  const patterns = NOTE_EFFECT_PATTERNS[note] ?? [];
  if (!patterns.length) return null;
  const text = actionTextForImmunityInference(message, item);
  if (!text) return null;

  const actorFeatures = features(actor);
  const matches = patterns.filter((entry) => (!entry.requiresFeature || actorFeatures.has(entry.requiresFeature)) && entry.pattern.test(text));
  // Multiple different direct results can represent a choice or a degree-of-success
  // branch. Without structured PF2e metadata we cannot know which one the player is
  // invoking, so avoid a false-positive prompt and let the concrete follow-up action
  // or condition hook handle it.
  if (matches.length !== 1) return null;

  const match = matches[0];
  const traits = actionTraitsFromMessage(message, item);
  return sanitizeAdaptiveDescriptor(applyAdaptiveConditionAlternatives(actor, {
    note,
    effectSlugs: match.effectSlug ? [match.effectSlug] : [],
    immunityTypes: [...new Set([...(match.immunityTypes ?? []), ...immunityTypesForTraits(traits)])],
    actionAliases: [...new Set([slug, ...(match.actionAliases ?? [])])],
    traits,
  }));
}

function isAttackRollMessage(message) {
  const context = message.flags?.pf2e?.context ?? {};
  return context.type === "attack-roll" || (context.domains ?? []).some((domain) => domain.includes("attack-roll"));
}

function weaponHasTrait(item, prefix) {
  const traits = [
    ...(item?.system?.traits?.value ?? []),
    ...Array.from(item?.traits ?? []),
  ].map((trait) => String(trait));
  return traits.some((trait) => trait === prefix || trait.startsWith(`${prefix}-`));
}

function signatureMotifCouldBeSatisfied(actor, message, item, slug, { requireSuccess = false, actingActor = actor } = {}) {
  const [motif] = cadenceMotif(actor);
  const target = targetActorFromMessage(message) ?? message.target?.actor ?? messageAuthorTargetActor(message) ?? null;
  const succeeded = !requireSuccess || messageSucceeded(message);

  if (motif === "Magnetic Verse") {
    if (!succeeded || !isCharismaSkillCheck(message, actingActor)) return false;
    if (target) return isEnemy(actingActor, target);
    return slug === "demoralize" && messageRollOptions(message).includes("action:demoralize");
  }
  if (motif === "Discordant Barrage") {
    return succeeded && slug === "discordant-barrage";
  }
  if (motif === "Echoing Strike") {
    const options = messageRollOptions(message);
    return succeeded && (
      slug === "echoing-strike"
      || (isAttackRollMessage(message) && (weaponHasTrait(item, "thrown") || options.some((option) => option.includes("trait:thrown"))))
    );
  }
  if (motif === "Healing Interlude") {
    const healingAction = isHealingActionMessage(message, item, slug);
    const fullHealthFallback = isAttackRollMessage(message) && isMeleeStrikeMessage(message, item) && allRelevantAlliesAtFullHP(actor);
    // A healing roll/card is only a candidate. Healing Interlude completes when
    // an Actor HP update confirms that Hit Points were actually restored. This
    // prevents Heal/Battle Medicine cards from granting a chain when no healing
    // was applied or the target was already at full HP. The all-allies-full
    // fallback is a Strike, so it still resolves directly from an explicit hit.
    if (!requireSuccess) return healingAction || fullHealthFallback;
    return messageSucceeded(message) && fullHealthFallback;
  }
  if (motif === "Iron Beat") {
    return succeeded && (slug === "iron-beat" || (isAttackRollMessage(message) && isShieldStrike(item, message)));
  }
  return false;
}

function adaptiveDescriptorForAction(actor, message, item, slug) {
  const current = state(actor);
  const note = Number(current.openingNote ?? 0);
  const base = ACTION_IMMUNITY_MAP[slug] ?? null;

  if (base && note === base.note) {
    const traits = [...new Set([...(base.traits ?? []), ...actionTraitsFromMessage(message, item)])];
    return sanitizeAdaptiveDescriptor({
      ...base,
      traits,
      immunityTypes: [...new Set([...(base.immunityTypes ?? []), ...immunityTypesForTraits(traits)])],
    });
  }

  // First cover every known Virtuoso activity that can directly apply the
  // condition required by the current note. Then use conservative text inference
  // so spells, archetype actions, and actions supplied by other modules can also
  // participate when they clearly state a single qualifying direct result.
  if ([1, 2, 4].includes(note)) {
    const known = knownActionNoteDescriptor(actor, message, item, slug, note);
    if (known) return known;
    const inferred = inferredActionNoteDescriptor(actor, message, item, slug, note);
    if (inferred) return inferred;
  }

  // Signature Motif is action-dependent. Captivating Solo accepts any
  // Charisma-based skill check against an enemy, while the other cadences use the
  // actual Strike/healing semantics defined by their motif.
  if (note !== 6 || !signatureMotifCouldBeSatisfied(actor, message, item, slug)) return null;

  const traits = [...new Set([...(base?.traits ?? []), ...actionTraitsFromMessage(message, item)])];
  const immunityTypes = [...new Set([
    ...(base?.immunityTypes ?? []),
    ...immunityTypesForTraits(traits),
  ])];
  const [signatureMotif] = cadenceMotif(actor);
  return sanitizeAdaptiveDescriptor({
    note: 6,
    effectSlugs: base?.effectSlugs ?? [],
    immunityTypes,
    actionAliases: [...new Set([slug, ...(base?.actionAliases ?? [])])],
    traits,
    signatureMotif,
  });
}

function satisfiesSignatureMotif(actor, message, slug, item = null, actingActor = actor) {
  return signatureMotifCouldBeSatisfied(actor, message, item, slug, { requireSuccess: true, actingActor });
}

function recordVirtuosoAction(actor, slug, message, item = null) {
  const adaptiveDescriptor = adaptiveDescriptorForAction(actor, message, item, slug);
  lastVirtuosoAction = {
    actorUuid: actor.uuid,
    targetUuid: targetActorFromMessage(message)?.uuid ?? null,
    messageId: message.id,
    slug,
    time: Date.now(),
    note: state(actor).openingNote,
    success: messageOutcome(message) ? messageSucceeded(message) : null,
    adaptiveDescriptor,
  };
}

async function detectACBonusFromEffect(effect) {
  if (!game.user.isActiveGM || !effect?.parent) return;

  // Check both hydrated rules and raw system.rules
  const rawRules = effect.system?.rules ?? [];
  const hydratedRules = effect.rules ?? [];
  const allRules = [...rawRules, ...hydratedRules];

  // Method 1: FlatModifier rule for AC with circumstance type
  const hasACFlatModifier = allRules.some((r) =>
    r.key === "FlatModifier" && (r.selector === "ac" || r.selectors?.includes("ac")) && r.type === "circumstance"
  );

  // Method 2: ActiveEffectLike that raises a shield (sets system.attributes.shield.raised = true)
  const isRaiseShield = allRules.some((r) =>
    r.key === "ActiveEffectLike" && r.path?.includes("shield.raised")
  );

  // Method 3: Effect slug/name matches known AC-boosting effects
  const slug = effect.slug ?? effect.system?.slug ?? "";
  const name = effect.name ?? "";
  const normalizedName = name.toLowerCase();
  const isKnownACEffect = slug.includes("raise-a-shield") || slug.includes("raise-shield")
    || normalizedName.includes("raise a shield") || normalizedName.includes("raise shield")
    || slug === "effect-raise-a-shield" || slug === "parry" || normalizedName === "parry";

  const isACBonus = hasACFlatModifier || isRaiseShield || isKnownACEffect;
  if (!isACBonus) return;

  const target = effect.parent;

  // Note 5 "Constant Refrain": "You gain a circumstance bonus to AC."
  // The virtuoso can gain the AC bonus themselves (raise-a-shield) or an ally can.
  // First check if the target IS the virtuoso (self-AC-bonus case)
  if (hasBattleTempo(target)) {
    const selfState = state(target);
    if (selfState.openingNote === 5 && !selfState.completed) {
      await gainCombo(target, 1, {
        complete: true,
        reason: `You gained AC circumstance bonus; ${NOTES[5].name} completed.`,
      });
      return;
    }
  }
  const activeAlly = game.combat?.combatant?.actor;
  if (sameActorIdentity(activeAlly, target)) {
    const passed = await checkPassTheBeatCondition(target, 5, null, `${target.name} gained a circumstance bonus to AC; the passed Constant Refrain was fulfilled.`);
    if (passed) return;
  }
  // Constant Refrain is explicitly self-only. An ally gaining AC does not satisfy it,
  // except when that ally is currently resolving Pass the Beat (handled separately).
}

const FINALE_TOGGLE_OPTION = "virtuoso-finale";
const COMBO_READY_OPTION = "combo-chain";
const FINALE_USED_OPTION = "virtuoso-finale-used";
const FINALE_RESOLVING_OPTION = "virtuoso-finale-resolving";
const ALL_FINALE_ACTION_SLUGS = [
  "crescendo-strike", "shattering-crescendo", "soothing-crescendo",
  "vibrating-crescendo", "whirling-crescendo", "shatter-point-crescendo",
];
const FINALE_TOGGLE_SLUGS = ["crescendo-strike"];
const FINALE_LABEL_KEYS = {
  "crescendo-strike": "SOW.Finale.CrescendoStrike",
  "shattering-crescendo": "SOW.Finale.ShatteringCrescendo",
  "soothing-crescendo": "SOW.Finale.SoothingCrescendo",
  "vibrating-crescendo": "SOW.Finale.VibratingCrescendo",
  "whirling-crescendo": "SOW.Finale.WhirlingCrescendo",
  "shatter-point-crescendo": "SOW.Finale.ShatterPointCrescendo",
};

function activeFinaleSelection(actor) {
  const options = actor?.rollOptions?.all ?? {};
  if (options[FINALE_TOGGLE_OPTION]) return "crescendo-strike";
  // Compatibility with actors created by the pre-0.5.1 independent toggles.
  return FINALE_TOGGLE_SLUGS.find((slug) => !!options[slug]) ?? null;
}

function finaleToggleRule(slug) {
  return {
    // Crescendo Strike is the only Strike-modifying Finale, so a selector is
    // unnecessary. Use one native PF2e toggle labelled Crescendo Strike. The
    // sheet hook below applies Combo Chain and once-per-turn requirements from
    // the authoritative actor state.
    domain: "all",
    key: "RollOption",
    label: FINALE_LABEL_KEYS[slug] ?? finaleName(slug),
    option: FINALE_TOGGLE_OPTION,
    placement: "actions",
    toggleable: true,
  };
}

function finaleActionRules(slug) {
  if (!FINALE_TOGGLE_SLUGS.includes(slug)) return [];
  const rules = [finaleToggleRule(slug)];
  if (slug === "crescendo-strike") {
    rules.push({
      damageType: "force",
      diceNumber: 0,
      dieSize: "d8",
      ignored: true,
      key: "DamageDice",
      predicate: [{ or: [
        FINALE_TOGGLE_OPTION,
        `${FINALE_RESOLVING_OPTION}:crescendo-strike`,
      ] }],
      selector: ["strike-damage"],
      slug: "crescendo-strike",
    });
    rules.push({
      ignored: true,
      keep: "higher",
      key: "RollTwice",
      predicate: [FINALE_TOGGLE_OPTION],
      selector: ["attack-roll"],
      slug: "crescendo-strike-fortune",
    });
    rules.push({
      adjustment: { success: "to-critical-success" },
      ignored: true,
      key: "AdjustDegreeOfSuccess",
      predicate: [FINALE_TOGGLE_OPTION],
      selector: "strike-attack-roll",
      slug: "crescendo-strike-seven-chain-critical",
    });
    for (const trait of ["finale", "force", "virtuoso"]) {
      rules.push({
        key: "AdjustStrike",
        mode: "add",
        property: "weapon-traits",
        value: trait,
        definition: ["item:melee"],
        predicate: [{ or: [
          FINALE_TOGGLE_OPTION,
          `${FINALE_RESOLVING_OPTION}:crescendo-strike`,
        ] }],
        slug: `crescendo-strike-trait-${trait}`,
      });
    }
  }
  return rules;
}

function normalizedFinaleActionRules(item) {
  const slug = item?.slug ?? item?.system?.slug;
  const isFinaleAction = item?.type === "action" && ALL_FINALE_ACTION_SLUGS.includes(slug);
  const isCrescendoFeature = item?.type === "feat" && item.system?.category === "classfeature" && slug === "crescendo-strike";
  if (!isFinaleAction && !isCrescendoFeature) return null;
  const current = foundry.utils.deepClone(item.system?.rules ?? []);
  const filtered = current.filter((rule) => {
    if (rule.key === "RollOption" && (ALL_FINALE_ACTION_SLUGS.includes(String(rule.option ?? "")) || rule.option === FINALE_TOGGLE_OPTION)) return false;
    if (slug === "crescendo-strike" && rule.key === "DamageDice" && ["crescendo-strike", "finale-force-damage"].includes(rule.slug)) return false;
    if (slug === "crescendo-strike" && rule.key === "RollTwice" && (rule.slug === "crescendo-strike-fortune" || JSON.stringify(rule.predicate ?? "").includes("crescendo-strike"))) return false;
    if (slug === "crescendo-strike" && rule.key === "AdjustDegreeOfSuccess" && rule.slug === "crescendo-strike-seven-chain-critical") return false;
    if (slug === "crescendo-strike" && rule.key === "AdjustStrike" && String(rule.slug ?? "").startsWith("crescendo-strike-trait-")) return false;
    return true;
  });
  return [...filtered, ...finaleActionRules(slug)];
}

function normalizeFinaleActionItem(item) {
  const rules = normalizedFinaleActionRules(item);
  if (!rules) return false;
  const update = {};
  if (JSON.stringify(rules) !== JSON.stringify(item.system?.rules ?? [])) update["system.rules"] = rules;
  // Finale workflows use module controls rather than PF2e self-effects.
  // Crescendo Strike is armed from the merged selector above Strikes; the five
  // cadence-specific Final Cadences are activated from their action rows.
  if (item.system?.selfEffect) update["system.selfEffect"] = null;
  if (!Object.keys(update).length) return false;
  item.updateSource?.(update);
  return true;
}

async function setFinaleToggle(actor, slug, value = true) {
  if (!FINALE_TOGGLE_SLUGS.includes(slug)) return false;
  const updates = [];
  for (const item of actor.items ?? []) {
    const rules = foundry.utils.deepClone(item.system?.rules ?? []);
    let changed = false;
    for (const rule of rules) {
      if (rule.key !== "RollOption" || rule.option !== FINALE_TOGGLE_OPTION) continue;
      if (Object.hasOwn(rule, "selection")) { delete rule.selection; changed = true; }
      if (Object.hasOwn(rule, "suboptions")) { delete rule.suboptions; changed = true; }
      if (Object.hasOwn(rule, "mergeable")) { delete rule.mergeable; changed = true; }
      if (rule.value !== value) { rule.value = value; changed = true; }
    }
    if (changed) updates.push({ _id: item.id, "system.rules": rules });
  }
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    await syncFinaleDamageDice(actor);
  }
  return updates.length > 0;
}

async function clearFinaleToggle(actor) {
  const updates = [];
  for (const item of actor.items ?? []) {
    const rules = foundry.utils.deepClone(item.system?.rules ?? []);
    let changed = false;
    for (const rule of rules) {
      if (rule.key === "RollOption" && rule.option === FINALE_TOGGLE_OPTION && rule.value !== false) {
        rule.value = false;
        changed = true;
      }
    }
    if (changed) updates.push({ _id: item.id, "system.rules": rules });
  }
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    await syncFinaleDamageDice(actor);
  }
}

async function armFinale(actor, slug) {
  if (state(actor).chains < 1) return ui.notifications.warn("You need at least 1 Combo Chain.");
  const armed = await setFinaleToggle(actor, slug, true);
  if (!armed) return ui.notifications.warn("The selected Finale is not present on this actor.");
  ui.notifications.info(`${finaleName(slug)} armed. Use the appropriate attack or Finale action.`);
}

async function checkFinaleToggleOnAttack(actor, message, item) {
  const current = state(actor);
  const turnKey = currentTurnKey();
  if (current.finaleUsedTurnKey === turnKey) return;
  const chains = current.chains;
  if (chains < 1) return;

  const context = message.flags?.pf2e?.context ?? {};
  const domains = context.domains ?? [];
  const isStrike = (context.type === "attack-roll" || domains.some(d => d.includes("attack-roll"))) && context.type !== "damage-roll";
  if (!isStrike) return;

  const activeFinale = activeFinaleSelection(actor);
  if (activeFinale !== "crescendo-strike") return;
  if (!isMeleeStrikeMessage(message, item)) return;

  const finaleName = activeFinale.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const slugs = features(actor);
  const measuredFinaleAvailable = actorHasMeasuredFinale(actor);
  const hasEndlessMeasure = actorHasEndlessMeasure(actor);
  let spent = chains;

  // Measured Finale: player chooses how many chains to spend (minimum 1)
  // Endless Measure: damage dice use total chains, but only spend minimum for threshold
  if (measuredFinaleAvailable && chains > 1) {
    const chosen = await showMeasuredFinaleDialog(actor, activeFinale, chains, hasEndlessMeasure);
    if (!chosen) return; // player cancelled
    spent = chosen;
    // Update DamageDice: Endless Measure uses total chains for dice, Measured Finale uses spent
    const diceChains = hasEndlessMeasure ? chains : spent;
    await preCalculateFinaleDamage(actor, activeFinale, diceChains);
  }

  const diceChains = hasEndlessMeasure ? chains : spent;
  const resolvingFinaleState = {
    chainsSpent: spent,
    activeFinale,
    totalChains: chains,
    diceChains,
    measuredFinale: measuredFinaleAvailable,
    attackMessageId: message.id,
    declaredTurnKey: turnKey,
  };

  // Spend chains and reserve the turn atomically. The resolving flag preserves
  // Crescendo Strike's damage dice after the visible resource reaches 0.
  await commitFinaleResourceSpend(actor, {
    spent,
    totalChains: chains,
    measured: measuredFinaleAvailable,
    turnKey,
    finaleState: resolvingFinaleState,
  });

  // The prepared Strike already carries the Finale, Force, and Virtuoso
  // traits through AdjustStrike. Only add the Finale name and chain count to
  // the flavor; do not imitate PF2e trait chips with raw HTML.
  try {
    const currentFlavor = message.flavor || "";
    const chainInfo = measuredFinaleAvailable && spent < chains ? ` (${spent}/${chains} chains)` : "";
    await message.update({ flavor: `${currentFlavor} <strong style="color:#8b0000">${finaleName}${chainInfo}</strong>` });
  } catch (_error) {}

  // Crescendo Strike's 5+ threshold is attached to the attack result, not the
  // damage roll. Apply it immediately so the condition is present even if the
  // player delays or skips rolling damage.
  let appliedThreshold = "";
  const outcome = context.outcome;
  if (spent >= 5 && ["success", "criticalSuccess"].includes(outcome)) {
    const target = targetActorFromMessage(message) ?? messageAuthorTargetActor(message);
    if (target) {
      const clumsyValue = outcome === "criticalSuccess" ? 2 : 1;
      await applyTemporaryCondition(actor, target, "clumsy", clumsyValue, "source-turn-start");
      appliedThreshold = `<p><strong>5+ Combo Chains:</strong> ${target.name} is @UUID[Compendium.pf2e.conditionitems.Item.i3OJZU2nk64Df3xm]{Clumsy ${clumsyValue}} until the start of your next turn.</p>`;
    } else {
      appliedThreshold = `<p><em>5+ Combo Chains: the Strike qualifies for Clumsy, but no target could be resolved from the PF2e attack message.</em></p>`;
    }
  }

  // Post header with threshold effects
  const effects = getFinaleThresholds(activeFinale, spent);
  const endlessNote = hasEndlessMeasure ? `<p><em>Endless Measure: damage dice based on ${chains} total chains.</em></p>` : '';
  await post(actor, `⚔ ${finaleName}`, `${endlessNote}<p>Spending <strong>${spent} chain${spent > 1 ? 's' : ''}</strong>${spent < chains ? ` (retaining ${chains - spent})` : ''}. Force damage (+${hasEndlessMeasure ? chains : spent}d8) included in damage roll.</p>${appliedThreshold}${effects.length ? `<ul>${effects.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}`);
}

async function showMeasuredFinaleDialog(actor, finaleSlug, totalChains, hasEndlessMeasure) {
  const finaleName = finaleSlug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const chainOptions = Array.from({ length: totalChains }, (_, i) => i + 1)
    .map(n => {
      const thresholds = getFinaleThresholds(finaleSlug, n);
      const label = `${n} chain${n > 1 ? 's' : ''}${n === totalChains ? ' (all)' : ''}${thresholds.length ? ' — ' + thresholds[thresholds.length - 1].split(':')[0] : ''}`;
      return `<option value="${n}" ${n === totalChains ? 'selected' : ''}>${label}</option>`;
    })
    .join('');

  const endlessNote = hasEndlessMeasure
    ? `<p style="margin-top:8px;padding:4px 6px;background:#e8f4e8;border-radius:3px;font-size:11px"><strong>Endless Measure:</strong> Damage dice are calculated using all ${totalChains} chains, regardless of how many you spend.</p>`
    : '';

  const allThresholds = getFinaleThresholds(finaleSlug, totalChains);
  const thresholdHTML = allThresholds.length ? `
    <div style="margin-top:8px;padding:6px;background:#f0f0f0;border-radius:3px;font-size:11px">
      <strong>Available thresholds (${totalChains} chains):</strong><br>${allThresholds.join('<br>')}
    </div>` : '';

  const content = `
    <form>
      <div class="form-group"><label>Combo Chains to spend</label><select name="chains">${chainOptions}</select></div>
      ${thresholdHTML}
      ${endlessNote}
      <p style="margin-top:8px;font-size:11px;color:#666">Unspent chains are retained after this Finale.</p>
    </form>`;

  return new Promise((resolve) => {
    new Dialog({
      title: `Measured Finale — ${finaleName}`,
      content,
      buttons: {
        apply: {
          icon: '<i class="fa-solid fa-hand-fist"></i>',
          label: "Apply",
          callback: (html) => resolve(Number(html.find('[name="chains"]').val())),
        },
        cancel: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: "Cancel",
          callback: () => resolve(null),
        },
      },
      default: "apply",
    }).render(true);
  });
}

async function preCalculateFinaleDamage(actor, activeFinale, spent) {
  const crescendoAction = actor.items.find((item) => item.type === "action" && item.slug === "crescendo-strike");
  if (!crescendoAction) return;
  const rules = foundry.utils.deepClone(crescendoAction.system?.rules ?? []);
  const ddRule = rules.find(r => r.key === 'DamageDice' && r.slug === activeFinale);
  if (ddRule) {
    ddRule.diceNumber = spent;
    ddRule.ignored = false;
  }
  await crescendoAction.update({ 'system.rules': rules });
  actor.reset();
}

// Hook into damage-roll to clean up after damage is rolled
async function onDamageRoll(message) {
  if (!game.user.isActiveGM) return;
  const actor = actorFromSpeaker(message.speaker);
  if (!actor) return;
  const finaleState = actor.getFlag(MODULE_ID, 'finaleState');
  if (!finaleState?.chainsSpent) return;

  const context = message.flags?.pf2e?.context ?? {};
  const domains = context.domains ?? [];
  const isDamage = context.type === "damage-roll" || domains.some(d => d.includes("strike-damage") || d.includes("damage-roll") || d.includes("attack-damage"));
  if (!isDamage) return;

  // Chains were already spent when the attack was declared. The damage roll
  // only ends the temporary resolving state and clears the checkbox source.
  await actor.unsetFlag(MODULE_ID, 'finaleState');
  await syncComboEffect(actor);
  await clearFinaleToggle(actor);
}

function isMeleeStrikeMessage(message, item) {
  const context = message.flags?.pf2e?.context ?? {};
  if (context.type !== "attack-roll") return false;
  const options = messageRollOptions(message);
  if (options.some((option) => option === "item:melee" || option.endsWith(":melee"))) return true;
  if (item?.type === "weapon") return item.system?.range == null;
  return false;
}

async function resolveArmedAdaptiveMeasure(actor, message, item) {
  const armed = actor.getFlag(MODULE_ID, "adaptiveMeasure");
  const options = messageRollOptions(message);
  const eligibleStrike = isMeleeStrikeMessage(message, item)
    || (isEchoingRondo(actor) && isAttackRollMessage(message) && (weaponHasTrait(item, "thrown") || options.some((option) => option.includes("trait:thrown"))));
  if (!armed || !options.includes(ADAPTIVE_ROLL_OPTION) || !eligibleStrike) return false;
  const target = targetActorFromMessage(message);
  if (armed.targetUuid && target?.uuid && armed.targetUuid !== target.uuid) return false;

  await actor.unsetFlag(MODULE_ID, "adaptiveMeasure");
  if (messageSucceeded(message)) {
    await gainCombo(actor, 1, { complete: true, reason: "Adaptive Measure Strike hit; the Opening Note is preserved." });
  } else {
    await post(actor, "Adaptive Measure", "<p>The Strike missed. No Combo Chain was gained.</p>");
  }
  return true;
}

// ── Core Cadences and Final Cadences ──────────────────────────────────────
const SUBCLASS_FINALE_SLUGS = new Set([
  "shattering-crescendo",
  "whirling-crescendo",
  "shatter-point-crescendo",
  "soothing-crescendo",
  "vibrating-crescendo",
]);

const CADENCE_FINALE_UUIDS = {
  "the-captivating-solo": `Compendium.${MODULE_ID}.sow-actions.Item.THt6W1P9xYxgp3WS`,
  "the-clashing-duet": `Compendium.${MODULE_ID}.sow-actions.Item.uiWEWmKHQMp48y10`,
  "the-echoing-rondo": `Compendium.${MODULE_ID}.sow-actions.Item.nSXX4fmpo7NxLUXr`,
  "the-mending-hymn": `Compendium.${MODULE_ID}.sow-actions.Item.KYxe9rVHnORcK4Il`,
  "the-vigorous-march": `Compendium.${MODULE_ID}.sow-actions.Item.PPDEq6y5adncEjx0`,
};

const CADENCE_FINALE_SLUGS = {
  "the-captivating-solo": "shattering-crescendo",
  "the-clashing-duet": "whirling-crescendo",
  "the-echoing-rondo": "shatter-point-crescendo",
  "the-mending-hymn": "soothing-crescendo",
  "the-vigorous-march": "vibrating-crescendo",
};

const CADENCE_STARTING_ACTIONS = {
  "the-echoing-rondo": {
    slug: "ricochet-tempo",
    uuid: `Compendium.${MODULE_ID}.sow-actions.Item.4Vhbay1pp6geDAYB`,
  },
  "the-mending-hymn": {
    slug: "vitalizing-strike",
    uuid: `Compendium.${MODULE_ID}.sow-actions.Item.Zf2iO60RWDKhVBxH`,
  },
};

const recentHealingCandidates = new Map();
const recentPassedHealingCandidates = new Map();

function currentTurnKey() {
  const combat = game.combat;
  return combat ? `${combat.id}:${combat.round ?? 0}:${combat.turn ?? -1}` : `world:${Math.floor(Date.now() / 6000)}`;
}

function actorLevel(actor) {
  return Number(actor?.system?.details?.level?.value ?? actor?.level ?? 0);
}

function actorCadenceSlug(actor) {
  const actorFeatures = features(actor);
  return Object.keys(SIGNATURE_MOTIFS).find((slug) => actorFeatures.has(slug)) ?? null;
}

function cadenceSkillSlug(actor) {
  const cadence = actorCadenceSlug(actor);
  const item = actor?.itemTypes?.feat?.find((feat) => feat.slug === cadence) ?? null;
  const selected = String(
    item?.flags?.pf2e?.rulesSelections?.cadenceSkill
      ?? item?.flags?.system?.rulesSelections?.cadenceSkill
      ?? "",
  );
  if (selected) return selected;
  return {
    "the-echoing-rondo": "thievery",
    "the-mending-hymn": "medicine",
    "the-vigorous-march": "athletics",
  }[cadence] ?? null;
}

function isEchoingRondo(actor) {
  return actorCadenceSlug(actor) === "the-echoing-rondo";
}

function isMendingHymn(actor) {
  return actorCadenceSlug(actor) === "the-mending-hymn";
}

function selectedTargetTokenUuids() {
  return [...(game.user?.targets ?? [])].map((token) => token.document?.uuid ?? token.uuid).filter(Boolean);
}

async function tokenFromUuid(uuid) {
  const document = uuid ? await fromUuid(uuid) : null;
  return document?.object ?? document ?? null;
}

function sourceTokenForActor(actor) {
  return actor?.getActiveTokens?.(true, true)?.[0] ?? actor?.token?.object ?? null;
}

function isAlly(source, target) {
  return !!source && !!target && !isEnemy(source, target);
}

function classDC(actor) {
  const statistic = actor?.getStatistic?.("virtuoso")
    ?? actor?.getStatistic?.("class-dc")
    ?? null;
  const direct = Number(statistic?.dc?.value ?? NaN);
  if (Number.isFinite(direct)) return direct;
  const data = actor?.system?.proficiencies?.classDCs?.virtuoso;
  const fallback = Number(data?.dc ?? data?.value ?? NaN);
  if (Number.isFinite(fallback)) return fallback;
  const level = actorLevel(actor);
  const rank = Number(data?.rank ?? 1);
  const ability = Math.max(Number(actor?.system?.abilities?.str?.mod ?? 0), Number(actor?.system?.abilities?.dex?.mod ?? 0));
  return 10 + (rank > 0 ? level + 2 * rank : 0) + ability;
}

function finaleName(slug) {
  return String(slug).split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

function finaleVirtualChains(actor, spent, numericalChains) {
  if (!features(actor).has("inevitable-crescendo") || spent < 5) return numericalChains;
  const bonus = spent === 10 ? 5 : spent >= 7 ? 4 : 3;
  return numericalChains + bonus;
}

async function prepareFinaleUse(actor, slug, { requestedSpend = null } = {}) {
  const before = state(actor);
  if (before.chains < 1) {
    ui.notifications.warn("You need at least 1 Combo Chain.");
    return null;
  }
  const turnKey = currentTurnKey();
  if (before.finaleUsedTurnKey === turnKey) {
    ui.notifications.warn("You can use only one Finale per turn.");
    return null;
  }

  const hasMeasured = actorHasMeasuredFinale(actor);
  const hasEndless = actorHasEndlessMeasure(actor);
  let spent = before.chains;
  if (hasMeasured && before.chains > 1) {
    const requested = Number(requestedSpend);
    if (Number.isInteger(requested) && requested >= 1 && requested <= before.chains) spent = requested;
    else {
      // Direct GM/API use can still ask locally. Player chat cards always provide
      // requestedSpend so the choice is made by the owning player, not the GM client.
      spent = await showMeasuredFinaleDialog(actor, slug, before.chains, hasEndless);
      if (!spent) return null;
    }
  }

  const numericalBase = hasMeasured && hasEndless ? before.chains : spent;
  await setFinaleToggle(actor, slug, true);
  const committed = await commitFinaleResourceSpend(actor, {
    spent,
    totalChains: before.chains,
    measured: hasMeasured,
    turnKey,
  });
  if (hasMeasured && committed.remaining > 0) {
    await post(actor, "Measured Finale", `<p>Spent <strong>${committed.spent} chain${committed.spent > 1 ? 's' : ''}</strong>. Retaining <strong>${committed.remaining}</strong>.</p>`);
  }
  await clearFinaleToggle(actor);

  return {
    spent,
    totalBefore: before.chains,
    numericalChains: finaleVirtualChains(actor, spent, numericalBase),
    measured: hasMeasured,
    endless: hasEndless,
  };
}

function finaleResolutionCard(actor, slug) {
  const chains = state(actor).chains;
  const rules = {
    "shattering-crescendo": "Target one enemy within 30 feet. At 7+ chains no target is required; all enemies within 30 feet are affected.",
    "shatter-point-crescendo": "Target one enemy within 20 feet.",
    "soothing-crescendo": "Target one ally within 30 feet, or up to two allies at 7+ chains.",
    "vibrating-crescendo": "No target is required. The 15-foot emanation is measured from your token.",
    "whirling-crescendo": "Click Resolve, then move manually within the displayed movement budget and choose each Strike from the chat card.",
  }[slug] ?? "Select the required targets.";
  const measured = actorHasMeasuredFinale(actor) && chains > 1;
  const buttons = measured
    ? Array.from({ length: chains }, (_, index) => index + 1).map((spend) => `<button type="button" data-sow-action="resolve-subclass-finale" data-finale-slug="${escapeHtml(slug)}" data-spend="${spend}" data-actor-uuid="${escapeHtml(actor.uuid)}">Spend ${spend} chain${spend === 1 ? "" : "s"}</button>`).join("")
    : `<button type="button" data-sow-action="resolve-subclass-finale" data-finale-slug="${escapeHtml(slug)}" data-spend="${chains}" data-actor-uuid="${escapeHtml(actor.uuid)}">Resolve Finale</button>`;
  const endless = actorHasEndlessMeasure(actor) ? "<p><small>Endless Measure uses your total current chains for numerical scaling, but thresholds use the number spent.</small></p>" : "";
  return `<section class="sow-card"><h3>${escapeHtml(finaleName(slug))}</h3><p>${escapeHtml(rules)}</p><p><strong>Current Combo Chains:</strong> ${chains}</p>${endless}<div class="message-buttons" style="display:flex;flex-direction:column;gap:3px">${buttons}</div></section>`;
}

async function offerSubclassFinale(actor, slug) {
  if (!SUBCLASS_FINALE_SLUGS.has(slug)) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: finaleResolutionCard(actor, slug),
    flags: { [MODULE_ID]: { actorUuid: actor.uuid, finaleOffer: { slug } } },
  });
}

async function requestSubclassFinale(actor, slug, targetTokenUuids, extra = {}) {
  const payload = {
    type: "subclassFinaleRequest",
    userId: game.user.id,
    actorUuid: actor.uuid,
    finaleSlug: slug,
    targetTokenUuids,
    extra,
  };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleSubclassFinaleRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleSubclassFinaleRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = payload?.actorUuid ? await fromUuid(payload.actorUuid) : null;
  if (!requester || !actor || !actor.testUserPermission?.(requester, "OWNER")) return;
  const slug = String(payload?.finaleSlug ?? "");
  if (!SUBCLASS_FINALE_SLUGS.has(slug)) return;
  const targets = [];
  for (const uuid of payload.targetTokenUuids ?? []) {
    const token = await tokenFromUuid(uuid);
    if (token?.actor) targets.push(token);
  }
  if (slug === "shattering-crescendo") return executeShatteringCrescendo(actor, targets, payload.extra?.requestedSpend);
  if (slug === "shatter-point-crescendo") return executeShatterPointCrescendo(actor, targets, payload.extra?.requestedSpend);
  if (slug === "soothing-crescendo") return executeSoothingCrescendo(actor, targets, payload.extra?.cleanseChoices ?? {}, payload.extra?.requestedSpend);
  if (slug === "vibrating-crescendo") return executeVibratingCrescendo(actor, payload.extra?.requestedSpend);
  if (slug === "whirling-crescendo") return beginWhirlingCrescendo(actor, payload.extra?.requestedSpend);
}

async function rollDamageAndApply(source, targetToken, formula, label, { multiplier = 1, damageType = "force", outcome = null, rollOptions = [] } = {}) {
  if (!targetToken?.actor || multiplier <= 0) return null;
  const DamageRoll = CONFIG.Dice.rolls.find((rollClass) => rollClass.name === "DamageRoll") ?? Roll;
  const typedFormula = formula.includes("[") ? formula : `${formula}[${damageType}]`;
  const roll = await new DamageRoll(typedFormula).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    flavor: `${escapeHtml(label)} → ${escapeHtml(targetToken.name ?? targetToken.actor.name)}`,
    flags: { pf2e: { suppressDamageButtons: true, context: { type: "damage-roll", options: rollOptions } } },
  });
  const damage = multiplier === 1 ? roll : roll.alter(multiplier, 0);
  await targetToken.actor.applyDamage?.({
    damage,
    token: targetToken,
    rollOptions: new Set([`damage:type:${damageType}`, ...rollOptions]),
    outcome,
  });
  return roll;
}

async function rollHealingAndApply(source, targetToken, formula, label, { multiplier = 1 } = {}) {
  if (!targetToken?.actor) return 0;
  const roll = await new Roll(formula).evaluate();
  const amount = Math.max(0, Math.trunc(Number(roll.total ?? 0) * multiplier));
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    flavor: `${escapeHtml(label)} → ${escapeHtml(targetToken.name ?? targetToken.actor.name)}${multiplier !== 1 ? ` (×${multiplier})` : ""}`,
    flags: { pf2e: { suppressDamageButtons: true } },
  });
  if (amount > 0) await targetToken.actor.applyDamage?.({ damage: -amount, token: targetToken, final: true });
  return amount;
}

async function rollSave(targetToken, save, source, label) {
  const statistic = targetToken?.actor?.getStatistic?.(save);
  if (!statistic) return null;
  return statistic.roll({
    dc: { value: classDC(source), label: `${source.name} Virtuoso DC` },
    target: sourceTokenForActor(source)?.actor ?? source,
    skipDialog: true,
    createMessage: true,
    extraRollOptions: ["sow:module-resolution", "origin:action:trait:virtuoso", `origin:action:slug:${slugify(label)}`],
    label,
  });
}

async function rollSkillCheck(source, skill, dc, targetToken, label) {
  const statistic = source?.getStatistic?.(skill);
  if (!statistic) return null;
  return statistic.roll({
    dc: { value: dc, label: `${targetToken.actor.name} ${skill === "thievery" ? "Reflex" : "DC"}` },
    target: targetToken.actor,
    skipDialog: true,
    createMessage: true,
    extraRollOptions: ["sow:module-resolution", "action:finale", "item:trait:virtuoso"],
    label,
  });
}

function runtimeEffectSource(name, slug, rules, { description = "", sourceActorUuid = null, expiryPhase = null, duration = null, extraFlags = {} } = {}) {
  const durationData = duration ?? { unit: "encounter", value: -1, expiry: null };
  return {
    name,
    type: "effect",
    img: "icons/tools/instruments/harp-yellow-teal.webp",
    system: {
      description: { value: description },
      duration: { sustained: false, ...durationData },
      level: { value: 1 },
      publication: { license: "ORC", remaster: true, title: "Symphonies of War" },
      rules,
      ...(sourceActorUuid ? { context: { origin: { actor: sourceActorUuid, item: null, rollOptions: [] }, target: null, roll: null } } : {}),
      start: { initiative: null, value: 0 },
      tokenIcon: { show: true },
      traits: { rarity: "common", value: ["virtuoso"] },
      slug,
      _migration: { version: 0.955, previous: null },
    },
    flags: {
      ...(sourceActorUuid ? { pf2e: { origin: { actor: sourceActorUuid } } } : {}),
      [MODULE_ID]: {
        temporaryFinale: {
          sourceActorUuid,
          expiryPhase,
          createdTurnKey: currentTurnKey(),
          ...extraFlags,
        },
      },
    },
  };
}

async function addRuntimeEffect(targetActor, source) {
  return (await targetActor.createEmbeddedDocuments("Item", [source]))[0] ?? null;
}

async function cleanupFinaleEffectsForSource(sourceActor, phase) {
  if (!sourceActor) return;
  const targets = new Map();
  for (const actor of game.actors ?? []) targets.set(actor.uuid, actor);
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor) targets.set(token.actor.uuid, token.actor);
  }
  for (const target of targets.values()) {
    const ids = [];
    const updates = [];
    for (const effect of target.itemTypes?.effect ?? []) {
      const data = effect.getFlag?.(MODULE_ID, "temporaryFinale");
      if (data?.sourceActorUuid !== sourceActor.uuid) continue;
      if (data.expiryPhase === "source-next-turn-end" && phase === "source-turn-end") {
        updates.push({ _id: effect.id, [`flags.${MODULE_ID}.temporaryFinale.expiryPhase`]: "source-turn-end" });
      } else if (data.expiryPhase === phase) {
        ids.push(effect.id);
      }
    }
    if (updates.length) await target.updateEmbeddedDocuments("Item", updates, { render: false });
    if (ids.length) await target.deleteEmbeddedDocuments("Item", ids);
  }
  await cleanupTemporaryConditions(sourceActor, phase);
}

async function applyTemporaryCondition(source, target, slug, value, expiryPhase) {
  const existing = target.getCondition?.(slug) ?? null;
  if (existing && (existing.value == null || Number(existing.value) >= Number(value ?? 1))) return null;
  const originalValue = existing?.value ?? 0;
  let condition = existing;
  if (condition) {
    await game.pf2e.ConditionManager.updateConditionValue(condition.id, target, value);
  } else {
    condition = await target.increaseCondition?.(slug, { value });
  }
  if (!condition) return null;
  const records = foundry.utils.deepClone(source.getFlag(MODULE_ID, "temporaryConditions") ?? []);
  records.push({
    id: foundry.utils.randomID(),
    targetUuid: target.uuid,
    conditionId: condition.id,
    slug,
    originalValue,
    appliedValue: value ?? null,
    expiryPhase,
  });
  await source.setFlag(MODULE_ID, "temporaryConditions", records);
  return condition;
}

async function cleanupTemporaryConditions(source, phase) {
  const records = foundry.utils.deepClone(source.getFlag(MODULE_ID, "temporaryConditions") ?? []);
  const keep = [];
  for (const record of records) {
    if (record.expiryPhase === "source-next-turn-end" && phase === "source-turn-end") {
      record.expiryPhase = "source-turn-end";
      keep.push(record);
      continue;
    }
    if (record.expiryPhase !== phase) {
      keep.push(record);
      continue;
    }
    const target = await fromUuid(record.targetUuid);
    const condition = target?.items?.get(record.conditionId) ?? target?.getCondition?.(record.slug);
    if (!target || !condition) continue;
    if (record.originalValue > 0 && condition.value != null && Number(condition.value) <= Number(record.appliedValue ?? condition.value)) {
      await game.pf2e.ConditionManager.updateConditionValue(condition.id, target, record.originalValue);
    } else if (record.originalValue <= 0 && condition.id === record.conditionId) {
      await target.deleteEmbeddedDocuments("Item", [condition.id]);
    }
  }
  if (keep.length) await source.setFlag(MODULE_ID, "temporaryConditions", keep);
  else await source.unsetFlag(MODULE_ID, "temporaryConditions");
}

function enemyTokensInRange(source, range) {
  return (canvas?.tokens?.placeables ?? []).filter((token) => token.actor && isEnemy(source, token.actor) && actorDistance(source, token.actor) <= range);
}

function allyTokensInRange(source, range, { includeSelf = true } = {}) {
  return (canvas?.tokens?.placeables ?? []).filter((token) => {
    if (!token.actor || !isAlly(source, token.actor)) return false;
    if (!includeSelf && token.actor.id === source.id) return false;
    return actorDistance(source, token.actor) <= range;
  });
}

function temporaryActionImmunity(target, slug, source) {
  return (target.itemTypes?.effect ?? []).some((effect) => {
    const data = effect.getFlag?.(MODULE_ID, "temporaryFinale");
    return data?.actionImmunity === slug && (!data.sourceActorUuid || data.sourceActorUuid === source.uuid);
  });
}

function previewFinaleSpend(actor, requestedSpend) {
  const chains = state(actor).chains;
  if (!actorHasMeasuredFinale(actor)) return chains;
  const requested = Number(requestedSpend);
  return Number.isInteger(requested) && requested >= 1 && requested <= chains ? requested : chains;
}

async function executeShatteringCrescendo(actor, selectedTargets, requestedSpend = null) {
  const before = state(actor);
  const thresholdChains = previewFinaleSpend(actor, requestedSpend);
  const areaTargets = thresholdChains >= 7 ? enemyTokensInRange(actor, 30) : selectedTargets;
  const targets = [...new Map(areaTargets.filter((token) => token?.actor && isEnemy(actor, token.actor) && actorDistance(actor, token.actor) <= 30).map((token) => [token.actor.uuid, token])).values()];
  if (thresholdChains < 7 && targets.length !== 1) return ui.notifications.warn("Target exactly one enemy within 30 feet.");
  if (!targets.length) return ui.notifications.warn("No eligible enemy is within range.");
  const usableTargets = targets.filter((token) => !temporaryActionImmunity(token.actor, "shattering-crescendo", actor));
  if (!usableTargets.length) return ui.notifications.warn("Every selected target is temporarily immune to your Shattering Crescendo.");

  const use = await prepareFinaleUse(actor, "shattering-crescendo", { requestedSpend });
  if (!use) return;
  for (const targetToken of usableTargets) {
    const roll = await rollSave(targetToken, "will", actor, "Shattering Crescendo");
    const outcome = adaptiveOutcomeFromRoll(roll);
    const multiplier = { criticalSuccess: 0, success: 0.5, failure: 1, criticalFailure: 2 }[outcome] ?? 1;
    await rollDamageAndApply(actor, targetToken, `${use.numericalChains}d4`, "Shattering Crescendo", { multiplier, outcome, rollOptions: ["item:trait:fear", "item:trait:mental"] });

    if (outcome === "criticalSuccess") {
      await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
        "Shattering Crescendo Immunity",
        "shattering-crescendo-immunity",
        [],
        {
          description: `<p>Temporarily immune to ${actor.name}'s Shattering Crescendo.</p>`,
          sourceActorUuid: actor.uuid,
          duration: { unit: "minutes", value: 1, expiry: null },
          extraFlags: { actionImmunity: "shattering-crescendo" },
        },
      ));
      continue;
    }

    for (const immunity of findActionSpecificImmunityEffects(targetToken.actor, "demoralize", actor)) {
      const effect = immunity.effectUuid ? await fromUuid(immunity.effectUuid) : null;
      if (effect?.parent?.uuid === targetToken.actor.uuid) await effect.delete();
    }

    const currentFrightened = Number(targetToken.actor.getCondition?.("frightened")?.value ?? 0);
    let frightenedIncrease = 0;
    if (outcome === "failure" && currentFrightened === 0) frightenedIncrease = 1;
    if (outcome === "criticalFailure") frightenedIncrease = 1;
    if (use.spent >= 3 && ["success", "failure", "criticalFailure"].includes(outcome)) frightenedIncrease += 1;
    if (frightenedIncrease > 0) {
      const frightenedImmune = preparedImmunities(targetToken.actor).some((immunity) => ["frightened", "fear-effects", "mental"].includes(String(immunity.type)));
      if (!frightenedImmune || use.spent >= 3) await targetToken.actor.increaseCondition?.("frightened", { value: frightenedIncrease });
    }

    if (["failure", "criticalFailure"].includes(outcome)) {
      await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
        "Shattering Crescendo — Frightened Hold",
        "shattering-crescendo-frightened-hold",
        [],
        {
          description: "<p>Your frightened value cannot decrease at the end of your next turn.</p>",
          sourceActorUuid: actor.uuid,
          duration: { unit: "rounds", value: 1, expiry: "turn-end" },
          extraFlags: { freezeFrightened: true },
        },
      ));
    }

    if (use.spent >= 5 && outcome === "failure") await applyTemporaryCondition(actor, targetToken.actor, "slowed", 1, "source-turn-end");
    if (use.spent >= 5 && outcome === "criticalFailure") {
      await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
        "Shattering Crescendo — Slowed",
        "shattering-crescendo-slowed",
        [{ key: "GrantItem", uuid: game.pf2e.ConditionManager.getCondition("slowed").uuid, onDeleteActions: { grantee: "cascade" } }],
        { sourceActorUuid: actor.uuid, duration: { unit: "minutes", value: 1, expiry: null } },
      ));
    }
  }
  await post(actor, "Shattering Crescendo", `<p>Resolved against <strong>${usableTargets.length}</strong> target${usableTargets.length === 1 ? "" : "s"} using ${use.spent} spent chain${use.spent === 1 ? "" : "s"}.</p>`);
}

function physicalResistanceWeaknessRules(target, spent) {
  const rules = [];
  for (const resistance of target.system?.attributes?.resistances ?? []) {
    const type = String(resistance?.type ?? "");
    if (!["physical", "bludgeoning", "piercing", "slashing", "all-damage"].includes(type)) continue;
    const value = Math.min(spent, Number(resistance?.value ?? 0));
    if (value <= 0) continue;
    rules.push({ key: "Weakness", type: type === "all-damage" ? "physical" : type, value });
  }
  return rules;
}

async function executeShatterPointCrescendo(actor, selectedTargets, requestedSpend = null) {
  const targets = selectedTargets.filter((token) => token?.actor && isEnemy(actor, token.actor) && actorDistance(actor, token.actor) <= 20);
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one enemy within 20 feet.");
  const targetToken = targets[0];
  if (temporaryActionImmunity(targetToken.actor, "shatter-point-crescendo", actor)) return ui.notifications.warn("That target is temporarily immune to your Shatter-Point Crescendo.");
  const use = await prepareFinaleUse(actor, "shatter-point-crescendo", { requestedSpend });
  if (!use) return;

  const reflexDC = Number(targetToken.actor.getStatistic?.("reflex")?.dc?.value ?? targetToken.actor.system?.saves?.reflex?.dc ?? 10);
  const roll = await rollSkillCheck(actor, "thievery", reflexDC, targetToken, "Shatter-Point Crescendo");
  const outcome = adaptiveOutcomeFromRoll(roll);
  const multiplier = { criticalSuccess: 2, success: 1, failure: 0.5, criticalFailure: 0 }[outcome] ?? 0;
  await rollDamageAndApply(actor, targetToken, `${use.numericalChains}d4`, "Shatter-Point Crescendo", { multiplier, outcome });

  if (outcome === "criticalFailure") {
    await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
      "Shatter-Point Crescendo Immunity",
      "shatter-point-crescendo-immunity",
      [],
      {
        description: `<p>Temporarily immune to ${actor.name}'s Shatter-Point Crescendo.</p>`,
        sourceActorUuid: actor.uuid,
        duration: { unit: "minutes", value: 1, expiry: null },
        extraFlags: { actionImmunity: "shatter-point-crescendo" },
      },
    ));
    return;
  }

  if (["success", "criticalSuccess"].includes(outcome)) {
    const hadOffGuard = targetToken.actor.hasCondition?.("off-guard");
    await applyTemporaryCondition(actor, targetToken.actor, "off-guard", null, "source-turn-start");
    if (use.spent >= 3 && hadOffGuard) {
      await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
        "Shatter-Point Crescendo — Exposed",
        "shatter-point-crescendo-exposed",
        [{ key: "FlatModifier", selector: "ac", type: "untyped", value: -1, predicate: [`origin:actor:uuid:${actor.uuid}`] }],
        { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-start" },
      ));
    }
    if (outcome === "criticalSuccess") await targetToken.actor.increaseCondition?.("frightened", { value: use.spent >= 3 ? 2 : 1 });
  } else if (outcome === "failure") {
    await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
      "Shatter-Point Crescendo — Open Defense",
      "shatter-point-crescendo-open-defense",
      [{ key: "FlatModifier", selector: "ac", type: "circumstance", value: -1, predicate: [`origin:actor:uuid:${actor.uuid}`] }],
      { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-start" },
    ));
  }

  const iwrRules = [];
  if (use.spent >= 5) iwrRules.push(...physicalResistanceWeaknessRules(targetToken.actor, use.spent));
  if (use.spent >= 7 && ["success", "criticalSuccess"].includes(outcome)) iwrRules.push({ key: "Weakness", type: "physical", value: use.spent });
  if (iwrRules.length) {
    await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
      "Shatter-Point Crescendo — Shattered Defenses",
      "shatter-point-crescendo-shattered-defenses",
      iwrRules,
      {
        description: `<p>Physical resistances are reduced by up to ${use.spent}; at 7+ chains the target also has weakness ${use.spent} to physical damage.</p>`,
        sourceActorUuid: actor.uuid,
        expiryPhase: "source-turn-start",
      },
    ));
  }
}

async function executeSoothingCrescendo(actor, selectedTargets, cleanseChoices = {}, requestedSpend = null) {
  const before = state(actor);
  const thresholdChains = previewFinaleSpend(actor, requestedSpend);
  const maxTargets = thresholdChains >= 7 ? 2 : 1;
  const targets = [...new Map(selectedTargets.filter((token) => token?.actor && isAlly(actor, token.actor) && actorDistance(actor, token.actor) <= 30).map((token) => [token.actor.uuid, token])).values()];
  if (targets.length < 1 || targets.length > maxTargets) return ui.notifications.warn(`Target ${maxTargets === 1 ? "one ally" : "one or two allies"} within 30 feet.`);
  const use = await prepareFinaleUse(actor, "soothing-crescendo", { requestedSpend });
  if (!use) return;

  let restored = false;
  for (const targetToken of targets) {
    const beforeHP = Number(targetToken.actor.system?.attributes?.hp?.value ?? 0);
    await rollHealingAndApply(actor, targetToken, `${use.numericalChains}d12`, "Soothing Crescendo");
    restored ||= Number(targetToken.actor.system?.attributes?.hp?.value ?? beforeHP) > beforeHP;

    if (use.spent >= 3) {
      const requested = cleanseChoices[targetToken.document?.uuid ?? targetToken.uuid] ?? cleanseChoices[targetToken.actor.uuid] ?? null;
      const eligible = ["frightened", "sickened", "clumsy"].filter((slug) => {
        const condition = targetToken.actor.getCondition?.(slug);
        return condition && Number(condition.value ?? 1) <= 2;
      });
      const chosen = eligible.includes(requested) ? requested : eligible[0];
      if (chosen) await targetToken.actor.decreaseCondition?.(chosen, { forceRemove: true });
    }

    if (use.spent >= 5) {
      await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
        "Soothing Crescendo — Temporary Hit Points",
        "soothing-crescendo-temporary-hit-points",
        [{ key: "TempHP", value: actorLevel(actor), events: { onCreate: true, onTurnStart: false } }],
        { sourceActorUuid: actor.uuid, duration: { unit: "minutes", value: 1, expiry: null } },
      ));
    }
  }

  if (restored && hasBattleTempo(actor) && state(actor).openingNote === 6 && !state(actor).completed && isMendingHymn(actor)) {
    await gainCombo(actor, 1, { complete: true, reason: "Healing Interlude satisfies Signature Motif." });
  }
}

function actorHasWieldedShield(actor) {
  const shield = actor?.attributes?.shield ?? actor?.system?.attributes?.shield;
  if (shield?.itemId && shield?.raised !== undefined) return true;
  return (actor?.itemTypes?.shield ?? []).some((item) => ["held", "worn"].includes(item.system?.equipped?.carryType) && !item.isDestroyed);
}

async function executeVibratingCrescendo(actor, requestedSpend = null) {
  if (!actorHasWieldedShield(actor)) return ui.notifications.warn("You must be wielding a shield.");
  const sourceToken = sourceTokenForActor(actor);
  if (!sourceToken) return ui.notifications.warn("Place the Virtuoso token on the current scene.");
  const allies = allyTokensInRange(actor, 15);
  const enemies = enemyTokensInRange(actor, 15);
  const use = await prepareFinaleUse(actor, "vibrating-crescendo", { requestedSpend });
  if (!use) return;

  try {
    await game.pf2e.actions.get("raise-a-shield")?.use({ actors: [actor] });
  } catch (error) {
    console.warn("Symphonies of War | Could not invoke Raise a Shield automatically.", error);
  }

  for (const allyToken of allies) {
    const rules = [{ key: "Resistance", type: "physical", value: use.spent * 2 }];
    if (use.spent >= 5) rules.push({ key: "Resistance", type: "all-damage", value: use.spent });
    await addRuntimeEffect(allyToken.actor, runtimeEffectSource(
      "Vibrating Crescendo — Resonant Protection",
      "vibrating-crescendo-resonant-protection",
      rules,
      {
        description: `<p>Resistance ${use.spent * 2} to physical damage${use.spent >= 5 ? ` and resistance ${use.spent} to all damage` : ""}.</p>`,
        sourceActorUuid: actor.uuid,
        expiryPhase: "source-turn-start",
      },
    ));
  }

  if (use.spent >= 3) {
    for (const enemyToken of enemies) {
      const save = await rollSave(enemyToken, "will", actor, "Vibrating Crescendo");
      const outcome = adaptiveOutcomeFromRoll(save);
      const rules = [];
      if (["failure", "criticalFailure"].includes(outcome)) {
        rules.push({
          key: "FlatModifier",
          selector: "attack",
          type: "status",
          value: -2,
          predicate: [{ not: `target:actor:uuid:${actor.uuid}` }],
        });
      }
      if (use.spent >= 7) rules.push({ key: "RollOption", domain: "all", option: "vibrating-crescendo-retaliation" });
      if (rules.length) {
        await addRuntimeEffect(enemyToken.actor, runtimeEffectSource(
          "Vibrating Crescendo — Resonant Reprisal",
          "vibrating-crescendo-resonant-reprisal",
          rules,
          {
            description: `<p>${rules.some((rule) => rule.key === "FlatModifier") ? "-2 status penalty to attacks that do not target the Virtuoso. " : ""}${use.spent >= 7 ? `Melee Strikes against ${actor.name} trigger ${use.spent} sonic damage.` : ""}</p>`,
            sourceActorUuid: actor.uuid,
            expiryPhase: "source-turn-start",
            extraFlags: { retaliationDamage: use.spent, retaliationTargetUuid: actor.uuid },
          },
        ));
      }
    }
  }
}

function meleeStrikeEntries(actor) {
  const roots = Array.isArray(actor?.system?.actions) ? actor.system.actions : [];
  return roots.flatMap((root, rootIndex) => [{ strike: root, rootIndex, altUsage: null }, ...(root.altUsages ?? []).map((strike, altUsage) => ({ strike, rootIndex, altUsage }))])
    .filter(({ strike }) => strike?.item && strike.ready !== false && (strike.item.isMelee ?? strike.item.system?.range == null));
}

function whirlingStrikeButtons(actor, stateData) {
  return meleeStrikeEntries(actor).map(({ strike, rootIndex, altUsage }) => `<button type="button" data-sow-action="whirling-strike" data-actor-uuid="${escapeHtml(actor.uuid)}" data-root-index="${rootIndex}" data-alt-usage="${altUsage ?? ""}"><img src="${escapeHtml(strike.item.img)}" width="24" height="24" style="border:0;vertical-align:middle;margin-right:4px">${escapeHtml(adaptiveStrikeLabel(strike))}</button>`).join("");
}

function whirlingCardContent(actor, data) {
  const remaining = Math.max(0, data.maxStrikes - data.strikesMade);
  return `<section class="sow-card"><h3>Whirling Crescendo</h3><p>Movement budget: <strong>${data.movementFeet} feet</strong>. Move the token manually; this movement does not trigger reactions.</p><p>Strikes: <strong>${data.strikesMade}/${data.maxStrikes}</strong>. Select one enemy target before each Strike.</p><p><small>The first two attacks use the same MAP. At 7+ chains, the third and fourth also use the same MAP.</small></p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${remaining ? whirlingStrikeButtons(actor, data) : ""}<button type="button" data-sow-action="finish-whirling" data-actor-uuid="${escapeHtml(actor.uuid)}">${remaining ? "Finish Early" : "Resolve Damage"}</button></div></section>`;
}

async function beginWhirlingCrescendo(actor, requestedSpend = null) {
  const use = await prepareFinaleUse(actor, "whirling-crescendo", { requestedSpend });
  if (!use) return;
  const maxStrikes = use.spent >= 7 ? 4 : use.spent >= 5 ? 3 : use.spent >= 3 ? 2 : 1;
  const data = {
    id: foundry.utils.randomID(),
    spent: use.spent,
    numericalChains: use.numericalChains,
    movementFeet: use.spent * 5,
    maxStrikes,
    strikesMade: 0,
    hits: [],
    turnKey: currentTurnKey(),
    messageId: null,
  };
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: whirlingCardContent(actor, data),
    flags: { [MODULE_ID]: { actorUuid: actor.uuid, whirling: { id: data.id } } },
  });
  data.messageId = message.id;
  await actor.setFlag(MODULE_ID, "whirlingCrescendo", data);
}

async function requestWhirlingStrike(actor, rootIndex, altUsage, targetTokenUuid) {
  const payload = { type: "whirlingStrikeRequest", userId: game.user.id, actorUuid: actor.uuid, rootIndex, altUsage, targetTokenUuid };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleWhirlingStrikeRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleWhirlingStrikeRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = await fromUuid(payload?.actorUuid);
  const data = foundry.utils.deepClone(actor?.getFlag(MODULE_ID, "whirlingCrescendo") ?? null);
  if (!requester || !actor || !data || !actor.testUserPermission?.(requester, "OWNER")) return;
  if (data.turnKey !== currentTurnKey() || data.strikesMade >= data.maxStrikes) return;
  const targetToken = await tokenFromUuid(payload.targetTokenUuid);
  if (!targetToken?.actor || !isEnemy(actor, targetToken.actor)) return ui.notifications.warn("Select one enemy target for Whirling Crescendo.");
  const strike = resolveAdaptiveStrike(actor, payload.rootIndex, payload.altUsage);
  if (!strike) return;
  const strikeNumber = data.strikesMade + 1;
  const variantIndex = strikeNumber <= 2 ? 0 : 1;
  const roll = await strike.variants?.[variantIndex]?.roll({ target: targetToken });
  const outcome = adaptiveOutcomeFromRoll(roll);
  data.strikesMade = strikeNumber;
  if (["success", "criticalSuccess"].includes(outcome)) {
    data.hits.push({ rootIndex: Number(payload.rootIndex), altUsage: payload.altUsage === "" ? null : Number(payload.altUsage), targetTokenUuid: targetToken.document?.uuid ?? payload.targetTokenUuid, outcome });
    if (data.spent >= 5) {
      await addRuntimeEffect(targetToken.actor, runtimeEffectSource(
        "Whirling Crescendo — Broken Tempo",
        "whirling-crescendo-broken-tempo",
        [{ key: "FlatModifier", selector: "speed", type: "status", value: -10 }],
        { sourceActorUuid: actor.uuid, expiryPhase: "source-turn-start" },
      ));
    }
  }
  await actor.setFlag(MODULE_ID, "whirlingCrescendo", data);
  const message = game.messages?.get(data.messageId);
  if (message) await message.update({ content: whirlingCardContent(actor, data) });
  if (data.strikesMade >= data.maxStrikes) await finalizeWhirlingCrescendo(actor);
}

function whirlingDamageCard(actor, data) {
  const buttons = data.hits.map((hit, index) => `<button type="button" data-sow-action="whirling-damage" data-actor-uuid="${escapeHtml(actor.uuid)}" data-hit-index="${index}">Roll ${hit.outcome === "criticalSuccess" ? "critical " : ""}damage for hit ${index + 1}</button>`).join("");
  return `<section class="sow-card"><h3>Whirling Crescendo — Damage</h3><p><strong>${data.hits.length}</strong> Strike${data.hits.length === 1 ? "" : "s"} hit.</p>${data.spent >= 7 && data.hits.length ? `<p>Each hit also deals <strong>${data.hits.length * 2} force damage</strong>.</p>` : ""}<div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons || "<p>No Strike hit.</p>"}<button type="button" data-sow-action="clear-whirling" data-actor-uuid="${escapeHtml(actor.uuid)}">Close</button></div></section>`;
}

async function finalizeWhirlingCrescendo(actor) {
  const data = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "whirlingCrescendo") ?? null);
  if (!data || data.finalized) return;
  data.finalized = true;
  if (data.spent >= 7 && data.hits.length) {
    const extra = data.hits.length * 2;
    for (const hit of data.hits) {
      const targetToken = await tokenFromUuid(hit.targetTokenUuid);
      if (targetToken?.actor) await rollDamageAndApply(actor, targetToken, String(extra), "Whirling Crescendo — Resonant Force", { damageType: "force" });
    }
  }
  await actor.setFlag(MODULE_ID, "whirlingCrescendo", data);
  const message = game.messages?.get(data.messageId);
  if (message) await message.update({ content: whirlingDamageCard(actor, data) });
}

async function requestWhirlingFinish(actor) {
  const payload = { type: "whirlingFinishRequest", userId: game.user.id, actorUuid: actor.uuid };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleWhirlingFinishRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleWhirlingFinishRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = payload?.actorUuid ? await fromUuid(payload.actorUuid) : null;
  if (!requester || !actor || !actor.testUserPermission?.(requester, "OWNER")) return;
  await finalizeWhirlingCrescendo(actor);
}

async function requestWhirlingClear(actor) {
  const payload = { type: "whirlingClearRequest", userId: game.user.id, actorUuid: actor.uuid };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleWhirlingClearRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleWhirlingClearRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = payload?.actorUuid ? await fromUuid(payload.actorUuid) : null;
  if (!requester || !actor || !actor.testUserPermission?.(requester, "OWNER")) return;
  const data = actor.getFlag(MODULE_ID, "whirlingCrescendo");
  const message = data?.messageId ? game.messages?.get(data.messageId) : null;
  if (message) await message.delete().catch(() => {});
  await actor.unsetFlag(MODULE_ID, "whirlingCrescendo").catch(() => {});
}

async function requestWhirlingDamage(actor, hitIndex) {
  const payload = { type: "whirlingDamageRequest", userId: game.user.id, actorUuid: actor.uuid, hitIndex };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleWhirlingDamageRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleWhirlingDamageRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = await fromUuid(payload?.actorUuid);
  const data = foundry.utils.deepClone(actor?.getFlag(MODULE_ID, "whirlingCrescendo") ?? null);
  const hit = data?.hits?.[Number(payload.hitIndex)];
  if (!requester || !actor || !data?.finalized || !hit || !actor.testUserPermission?.(requester, "OWNER")) return;
  if (hit.damageRolled) return;
  const targetToken = await tokenFromUuid(hit.targetTokenUuid);
  const strike = resolveAdaptiveStrike(actor, hit.rootIndex, hit.altUsage);
  if (!targetToken?.actor || !strike) return;
  const method = hit.outcome === "criticalSuccess" ? "critical" : "damage";
  await strike[method]?.({ target: targetToken, outcome: hit.outcome });
  hit.damageRolled = true;
  await actor.setFlag(MODULE_ID, "whirlingCrescendo", data);
  const message = game.messages?.get(data.messageId);
  if (message) await message.update({ content: whirlingDamageCard(actor, data) });
}

async function handleVibratingRetaliation(message, attacker, item) {
  if (!game.user.isActiveGM || !isMeleeStrikeMessage(message, item)) return false;
  const target = targetActorFromMessage(message);
  if (!target) return false;
  const effect = (attacker.itemTypes?.effect ?? []).find((candidate) => {
    const data = candidate.getFlag?.(MODULE_ID, "temporaryFinale");
    return Number(data?.retaliationDamage ?? 0) > 0 && data?.retaliationTargetUuid === target.uuid;
  });
  if (!effect) return false;
  const data = effect.getFlag(MODULE_ID, "temporaryFinale");
  const attackerToken = attacker.getActiveTokens?.(true, true)?.[0];
  const source = await fromUuid(data.sourceActorUuid);
  if (attackerToken && source) await rollDamageAndApply(source, attackerToken, String(data.retaliationDamage), "Vibrating Crescendo — Resonant Reprisal", { damageType: "sonic" });
  return true;
}

function isShieldStrike(item, message = null) {
  const options = message ? messageRollOptions(message) : [];
  const text = `${item?.name ?? ""} ${item?.slug ?? ""} ${item?.system?.baseItem ?? ""}`.toLowerCase();
  return item?.type === "shield"
    || /shield|buckler|klar/.test(text)
    || options.some((option) => /shield-bash|attached-to-shield|integrated-shield/.test(option));
}

function allRelevantAlliesAtFullHP(actor) {
  const allies = (canvas?.tokens?.placeables ?? []).filter((token) => token.actor && isAlly(actor, token.actor));
  return allies.length > 0 && allies.every((token) => Number(token.actor.system?.attributes?.hp?.value ?? 0) >= Number(token.actor.system?.attributes?.hp?.max ?? 0));
}

async function trackClashingDuetSignature(actor, message, item) {
  if (actorCadenceSlug(actor) !== "the-clashing-duet" || state(actor).openingNote !== 6 || state(actor).completed) return false;
  if (!isMeleeStrikeMessage(message, item) || weaponHasTrait(item, "unarmed")) return false;
  const key = currentTurnKey();
  const data = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "clashingMotif") ?? { turnKey: key, strikes: [] });
  if (data.turnKey !== key) {
    data.turnKey = key;
    data.strikes = [];
  }
  const itemId = item?.id ?? message.flags?.pf2e?.origin?.uuid ?? foundry.utils.randomID();
  const existing = data.strikes.find((entry) => entry.itemId === itemId);
  if (existing) existing.success ||= messageSucceeded(message);
  else data.strikes.push({ itemId, success: messageSucceeded(message) });
  await actor.setFlag(MODULE_ID, "clashingMotif", data);
  if (data.strikes.length >= 2 && data.strikes.some((entry) => entry.success)) {
    await gainCombo(actor, 1, { complete: true, reason: "Discordant Barrage satisfies Signature Motif." });
    return true;
  }
  return false;
}


async function trackSidestepSync(actor, message, item) {
  if (!features(actor).has("sidestep-sync") || actorCadenceSlug(actor) !== "the-clashing-duet" || !hasBattleTempo(actor) || !isMeleeStrikeMessage(message, item) || weaponHasTrait(item, "unarmed") || !messageSucceeded(message)) return false;
  const target = targetActorFromMessage(message);
  if (!target) return false;
  const key = currentTurnKey();
  const data = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "sidestepSync") ?? { turnKey: key, targetUuid: target.uuid, weaponIds: [], offered: false, used: false });
  if (data.turnKey !== key || data.targetUuid !== target.uuid) {
    data.turnKey = key;
    data.targetUuid = target.uuid;
    data.weaponIds = [];
    data.offered = false;
    data.used = false;
  }
  const weaponId = item?.id ?? message.flags?.pf2e?.origin?.uuid ?? null;
  if (weaponId && !data.weaponIds.includes(weaponId)) data.weaponIds.push(weaponId);
  if (data.weaponIds.length >= 2 && !data.offered && !data.used) {
    data.offered = true;
    const token = target.getActiveTokens?.(true, true)?.[0] ?? null;
    const targetTokenUuid = token?.document?.uuid ?? token?.uuid ?? "";
    await post(actor, "Sidestep Sync", `<p>You hit <strong>${escapeHtml(target.name)}</strong> with two different melee weapons. You can push it 5 feet to a space within your reach that is not farther from you.</p><button type="button" data-sow-action="sidestep-sync" data-target-token-uuid="${escapeHtml(targetTokenUuid)}" data-actor-uuid="${escapeHtml(actor.uuid)}">Use Sidestep Sync</button>`);
  }
  await actor.setFlag(MODULE_ID, "sidestepSync", data);
  return data.weaponIds.length >= 2;
}

async function executeSidestepSync(actor, targetToken) {
  const data = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "sidestepSync") ?? {});
  if (data.turnKey !== currentTurnKey() || data.used || data.targetUuid !== targetToken?.actor?.uuid) return ui.notifications.warn("Sidestep Sync is no longer available.");
  const descriptor = sanitizeAdaptiveDescriptor({ ...(ACTION_NOTE_IMMUNITY_MAP["sidestep-sync"]?.[4] ?? {}), note: 4, actionAliases: ["sidestep-sync", "push"] });
  if (hasBattleTempo(actor) && state(actor).openingNote === 4 && !state(actor).completed) {
    const immunity = checkTargetImmunity(targetToken.actor, "sidestep-sync", actor, descriptor);
    if (immunity) {
      data.used = true;
      await actor.setFlag(MODULE_ID, "sidestepSync", data);
      return requestAdaptiveMeasurePrompt(actor, targetToken.actor, "sidestep-sync", immunity, { targetTokenUuid: targetToken.document?.uuid ?? targetToken.uuid, descriptor });
    }
  }
  data.used = true;
  await actor.setFlag(MODULE_ID, "sidestepSync", data);
  await post(actor, "Sidestep Sync", `<p>Move <strong>${escapeHtml(targetToken.name ?? targetToken.actor.name)}</strong> 5 feet to a space within your reach that is not farther from you. This movement does not trigger reactions.</p>`);
  if (hasBattleTempo(actor) && state(actor).openingNote === 4 && !state(actor).completed) await gainCombo(actor, 1, { complete: true, reason: "Sidestep Sync pushed the target and completed Percussive Drop." });
}

function isHealingActionMessage(message, item, slug) {
  const traits = actionTraitsFromMessage(message, item);
  const options = messageRollOptions(message);
  return traits.some((trait) => ["healing", "vitality"].includes(trait))
    || options.some((option) => /(?:^|:)(healing|vitality)(?:$|:)/.test(option))
    || ["battle-medicine", "treat-wounds", "vitalizing-strike", "soothing-crescendo", "heal"].includes(slug);
}

function rememberHealingCandidate(actor, message, item, slug) {
  if (!isMendingHymn(actor) || state(actor).openingNote !== 6 || state(actor).completed) return;
  if (!isHealingActionMessage(message, item, slug)) return;
  recentHealingCandidates.set(actor.uuid, {
    sourceActorUuid: actor.uuid,
    targetActorUuid: targetActorFromMessage(message)?.uuid ?? null,
    createdAt: Date.now(),
  });
}

async function detectHealingInterludeUpdate(target, changed) {
  if (!game.user.isActiveGM) return;
  const newHP = foundry.utils.getProperty(changed, "system.attributes.hp.value");
  if (newHP == null) return;
  const oldHP = Number(target._source?.system?.attributes?.hp?.value ?? target.system?.attributes?.hp?.value ?? 0);
  if (Number(newHP) <= oldHP) return;
  for (const [sourceUuid, candidate] of recentHealingCandidates) {
    if (Date.now() - candidate.createdAt > 10_000) {
      recentHealingCandidates.delete(sourceUuid);
      continue;
    }
    if (candidate.targetActorUuid && candidate.targetActorUuid !== target.uuid) continue;
    const source = await fromUuid(candidate.sourceActorUuid);
    if (!source || !hasBattleTempo(source) || state(source).openingNote !== 6 || state(source).completed || !isMendingHymn(source)) continue;
    recentHealingCandidates.delete(sourceUuid);
    await gainCombo(source, 1, { complete: true, reason: `${target.name} regained Hit Points; Healing Interlude satisfies Signature Motif.` });
    break;
  }

  for (const [key, candidate] of recentPassedHealingCandidates) {
    if (Date.now() - candidate.createdAt > 10_000) {
      recentPassedHealingCandidates.delete(key);
      continue;
    }
    if ((candidate.targetActorId || candidate.targetActorUuid) && !actorMatchesReference(target, { uuid: candidate.targetActorUuid, id: candidate.targetActorId })) continue;
    const virtuoso = await resolveActorReference({ uuid: candidate.sourceActorUuid, id: candidate.sourceActorId });
    const ally = await resolveActorReference({ uuid: candidate.allyActorUuid, id: candidate.allyActorId });
    const current = virtuoso ? state(virtuoso) : null;
    if (!virtuoso || !ally || !hasBattleTempo(virtuoso) || !actorMatchesReference(ally, { uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId }) || current.openingNote !== 6 || current.completed || actorCadenceSlug(virtuoso) !== "the-mending-hymn") continue;
    recentPassedHealingCandidates.delete(key);
    await completePassedNote(virtuoso, ally, `${ally.name} restored Hit Points and fulfilled Healing Interlude via Pass the Beat.`);
    break;
  }
}

async function ensureRicochetTempoEffect(actor) {
  if (!isEchoingRondo(actor)) return null;
  const existing = actor.itemTypes?.effect?.find((effect) => effect.slug === "ricochet-tempo-returning");
  if (existing) return existing;
  return addRuntimeEffect(actor, runtimeEffectSource(
    "Ricochet Tempo",
    "ricochet-tempo-returning",
    [{
      key: "AdjustStrike",
      mode: "add",
      property: "property-runes",
      value: "returning",
      definition: ["item:trait:thrown"],
    }],
    {
      description: "<p>While Battle Tempo is active, your thrown weapons gain the effects of a returning rune.</p>",
      sourceActorUuid: actor.uuid,
      extraFlags: { ricochetTempo: true },
    },
  ));
}

async function cleanupRicochetTempoOnBattleTempoEnd(item) {
  if (!item?.parent || !["effect-battle-tempo", "battle-tempo"].includes(item.slug)) return;
  const actor = item.parent;
  const pending = state(actor);
  const pendingAlly = await resolveActorReference({ uuid: pending.passTheBeatAllyUuid, id: pending.passTheBeatAllyId });
  const ids = (actor.itemTypes?.effect ?? []).filter((effect) =>
    effect.slug === "ricochet-tempo-returning"
    || EFFECT_SLUG_ALIASES.openingNote.includes(effect.slug)
    || EFFECT_SLUG_ALIASES.comboChain.includes(effect.slug)
  ).map((effect) => effect.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  if (pendingAlly) await clearPassTheBeatEffects({ sourceActorUuid: actor.uuid, sourceActorId: actor.id, allyActor: pendingAlly });
  else await clearPassTheBeatEffects({ sourceActorUuid: actor.uuid, sourceActorId: actor.id });
  await clearGuidingNoteStepPromptForSource(actor);
  await actor.unsetFlag(MODULE_ID, FLAG).catch(() => {});
  for (const flag of ["flowingSweep", "guidingNote", "measuredStepGuiding", "doubleCadenzaBenefit", "doubleCadenzaDamageChoice", "attackCount", "flourishUsedTurnKey"]) {
    await actor.unsetFlag(MODULE_ID, flag).catch(() => {});
  }
}

function thrownManeuverEntries(actor, maneuver) {
  const requiredTrait = maneuver === "disarm" ? "disarm" : "trip";
  const roots = Array.isArray(actor?.system?.actions) ? actor.system.actions : [];
  return roots.flatMap((root, rootIndex) => [
    { strike: root, rootIndex, altUsage: null },
    ...(root.altUsages ?? []).map((strike, altUsage) => ({ strike, rootIndex, altUsage })),
  ]).filter(({ strike }) => {
    const item = strike?.item;
    return item && strike.ready !== false && weaponHasTrait(item, "thrown") && weaponHasTrait(item, requiredTrait);
  });
}

function strikeRangeIncrement(strike) {
  const direct = Number(strike?.item?.range?.increment ?? strike?.item?.system?.range ?? strike?.range?.increment ?? NaN);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const trait = [...(strike?.item?.system?.traits?.value ?? [])].map(String).find((value) => /^thrown-\d+$/.test(value));
  return trait ? Number(trait.split("-").at(-1)) : 0;
}

function ricochetManeuverCard(actor, note) {
  const maneuver = note === 1 ? "disarm" : "trip";
  const entries = thrownManeuverEntries(actor, maneuver);
  const buttons = entries.map(({ strike, rootIndex, altUsage }) => {
    const range = strikeRangeIncrement(strike);
    return `<button type="button" data-sow-action="ricochet-maneuver" data-maneuver="${maneuver}" data-root-index="${rootIndex}" data-alt-usage="${altUsage ?? ""}" data-actor-uuid="${escapeHtml(actor.uuid)}"><img src="${escapeHtml(strike.item.img)}" width="24" height="24" style="border:0;vertical-align:middle;margin-right:4px">${maneuver === "disarm" ? "Disarm" : "Trip"} with ${escapeHtml(adaptiveStrikeLabel(strike))}${range ? ` (${range} ft.)` : ""}</button>`;
  }).join("");
  return `<section class="sow-card"><h3>Ricochet Tempo</h3><p>Your current Opening Note lets you attempt <strong>${maneuver === "disarm" ? "Disarm" : "Trip"}</strong> with Thievery against a target within the thrown weapon's first range increment.</p><p>Target one enemy, then choose a valid thrown weapon.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons || `<p>No ready thrown weapon with the ${maneuver} trait is available.</p>`}</div></section>`;
}

async function offerRicochetManeuver(actor, note = state(actor).openingNote) {
  if (!isEchoingRondo(actor) || ![1, 4].includes(Number(note))) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: ricochetManeuverCard(actor, Number(note)),
    flags: { [MODULE_ID]: { actorUuid: actor.uuid, ricochetTempo: true } },
  });
}

async function requestRicochetManeuver(actor, maneuver, rootIndex, altUsage, targetTokenUuid) {
  const payload = { type: "ricochetManeuverRequest", userId: game.user.id, actorUuid: actor.uuid, maneuver, rootIndex, altUsage, targetTokenUuid };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleRicochetManeuverRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function handleRicochetManeuverRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = payload?.actorUuid ? await fromUuid(payload.actorUuid) : null;
  if (!requester || !actor || !actor.testUserPermission?.(requester, "OWNER") || !hasBattleTempo(actor) || !isEchoingRondo(actor)) return;
  const maneuver = String(payload?.maneuver ?? "");
  const requiredNote = maneuver === "disarm" ? 1 : maneuver === "trip" ? 4 : 0;
  if (!requiredNote || state(actor).openingNote !== requiredNote) return ui.notifications.warn("That maneuver does not match the current Opening Note.");
  const strike = resolveAdaptiveStrike(actor, payload.rootIndex, payload.altUsage);
  if (!strike || !weaponHasTrait(strike.item, "thrown") || !weaponHasTrait(strike.item, maneuver)) return ui.notifications.warn("Choose a thrown weapon with the required maneuver trait.");
  const targetToken = await tokenFromUuid(payload.targetTokenUuid);
  const range = strikeRangeIncrement(strike);
  if (!targetToken?.actor || !isEnemy(actor, targetToken.actor) || !range || actorDistance(actor, targetToken.actor) > range) return ui.notifications.warn(`Target one enemy within ${range || "the first range increment"} feet.`);
  const action = game.pf2e.actions.get(maneuver);
  if (!action) return ui.notifications.warn(`PF2e action not found: ${maneuver}`);
  await action.use({
    actors: [actor],
    statistic: "thievery",
    target: targetToken,
    message: { create: true },
    rollOptions: ["sow:ricochet-tempo", "item:trait:thrown", `item:id:${strike.item.id}`],
  });
}

function rhythmicFlowCard(actor) {
  const cadence = actorCadenceSlug(actor);
  const buttons = [];
  if (cadence === "the-captivating-solo") {
    buttons.push(["demoralize", "Demoralize"]);
    if (features(actor).has("bon-mot")) buttons.push(["bon-mot", "Bon Mot"]);
  } else if (cadence === "the-clashing-duet") {
    buttons.push(["stride", "Stride"]);
    buttons.push(["draw-two-melee", "Draw two melee weapons"]);
  } else if (cadence === "the-echoing-rondo") {
    buttons.push(["step", "Step"]);
    buttons.push(["draw-two-thrown", "Draw up to two thrown weapons"]);
  } else if (cadence === "the-mending-hymn") {
    buttons.push(["vitalizing-strike", "Vitalizing Strike"]);
    if (features(actor).has("battle-medicine")) buttons.push(["battle-medicine", "Battle Medicine"]);
  } else if (cadence === "the-vigorous-march") {
    buttons.push(["raise-a-shield", "Raise a Shield"]);
  }
  if (!buttons.length) return null;
  return `<section class="sow-card"><h3>Rhythmic Flow</h3><p>You gained one of the following free actions for this turn:</p><div class="message-buttons">${buttons.map(([slug, label]) => `<button type="button" data-sow-action="use-rhythmic-flow" data-flow-action="${slug}" data-actor-uuid="${escapeHtml(actor.uuid)}">${escapeHtml(label)}</button>`).join("")}</div></section>`;
}

async function offerRhythmicFlow(actor) {
  if (actorLevel(actor) < 3 || !virtuosoClassItem(actor) || !actorCadenceSlug(actor)) return;
  const content = rhythmicFlowCard(actor);
  if (!content) return;
  await actor.setFlag(MODULE_ID, "rhythmicFlow", { turnKey: currentTurnKey(), available: true });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, flags: { [MODULE_ID]: { actorUuid: actor.uuid } } });
}

async function useRhythmicFlow(actor, actionSlug) {
  const data = actor.getFlag(MODULE_ID, "rhythmicFlow");
  if (!data?.available || data.turnKey !== currentTurnKey()) return ui.notifications.warn("That Rhythmic Flow free action has expired.");
  await actor.setFlag(MODULE_ID, "rhythmicFlow", { ...data, available: false });
  if (["draw-two-melee", "draw-two-thrown"].includes(actionSlug)) {
    return post(actor, "Rhythmic Flow", `<p>${actionSlug === "draw-two-melee" ? "Draw two melee weapons" : "Draw up to two thrown weapons"} with a single Interact. Adjust the carried state of the items on the sheet.</p>`);
  }
  if (actionSlug === "vitalizing-strike") return offerVitalizingStrike(actor);
  const action = game.pf2e.actions.get(actionSlug);
  if (!action) return ui.notifications.warn(`PF2e action not found: ${actionSlug}`);
  try {
    await action.use({ actors: [actor] });
  } catch (error) {
    console.warn(`Symphonies of War | Rhythmic Flow could not use ${actionSlug}.`, error);
    ui.notifications.warn(error.message ?? `Could not use ${actionSlug}.`);
  }
}

function vitalizingStrikeCard(actor) {
  const buttons = meleeStrikeEntries(actor).map(({ strike, rootIndex, altUsage }) => `<button type="button" data-sow-action="vitalizing-strike" data-actor-uuid="${escapeHtml(actor.uuid)}" data-root-index="${rootIndex}" data-alt-usage="${altUsage ?? ""}"><img src="${escapeHtml(strike.item.img)}" width="24" height="24" style="border:0;vertical-align:middle;margin-right:4px">${escapeHtml(adaptiveStrikeLabel(strike))}</button>`).join("");
  return `<section class="sow-card"><h3>Vitalizing Strike</h3><p>Target one ally within melee reach, then choose the Strike.</p><div class="message-buttons" style="display:flex;flex-direction:column;gap:4px">${buttons || "<p>No ready melee Strike is available.</p>"}</div></section>`;
}

async function offerVitalizingStrike(actor) {
  const combatId = game.combat?.id ?? "no-combat";
  if (actor.getFlag(MODULE_ID, "vitalizingStrikeCombat") === combatId) return ui.notifications.warn("Vitalizing Strike has already been used in this combat.");
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: vitalizingStrikeCard(actor), flags: { [MODULE_ID]: { actorUuid: actor.uuid } } });
}

async function requestVitalizingStrike(actor, rootIndex, altUsage, targetTokenUuid) {
  const payload = { type: "vitalizingStrikeRequest", userId: game.user.id, actorUuid: actor.uuid, rootIndex, altUsage, targetTokenUuid };
  if (game.user.isActiveGM || !game.users?.activeGM) return handleVitalizingStrikeRequest(payload);
  game.socket?.emit(SOCKET_CHANNEL, payload);
}

function weaponDamageDiceCount(item) {
  const baseDice = Number(item?.system?.damage?.dice ?? 1);
  const striking = Number(item?.system?.runes?.striking ?? 0);
  return Math.max(1, baseDice + striking);
}

async function handleVitalizingStrikeRequest(payload) {
  if (game.users?.activeGM && !game.user.isActiveGM) return;
  const requester = game.users?.get(payload?.userId);
  const actor = await fromUuid(payload?.actorUuid);
  if (!requester || !actor || !actor.testUserPermission?.(requester, "OWNER")) return;
  const combatId = game.combat?.id ?? "no-combat";
  if (actor.getFlag(MODULE_ID, "vitalizingStrikeCombat") === combatId) return;
  const targetToken = await tokenFromUuid(payload.targetTokenUuid);
  if (!targetToken?.actor || !isAlly(actor, targetToken.actor) || actorDistance(actor, targetToken.actor) > reachForActor(actor)) return ui.notifications.warn("Target one ally within melee reach.");
  const strike = resolveAdaptiveStrike(actor, payload.rootIndex, payload.altUsage);
  if (!strike) return;
  await actor.setFlag(MODULE_ID, "vitalizingStrikeCombat", combatId);
  const roll = await rollAdaptiveStrikeWithoutDamage(strike, { target: targetToken, options: ["action:vitalizing-strike", "item:trait:healing"] });
  await createNonAttackResultMessage({ actor, target: targetToken.actor, strike, roll, title: "Vitalizing Strike", note: "This Strike deals no damage." });
  const outcome = adaptiveOutcomeFromRoll(roll);
  const wisdom = Number(actor.system?.abilities?.wis?.mod ?? 0);
  let formula = String(Math.max(0, wisdom));
  let multiplier = 1;
  if (["success", "criticalSuccess"].includes(outcome)) {
    formula = `${weaponDamageDiceCount(strike.item)}d8${wisdom >= 0 ? "+" : ""}${wisdom}`;
    multiplier = outcome === "criticalSuccess" ? 2 : 1;
  }
  const beforeHP = Number(targetToken.actor.system?.attributes?.hp?.value ?? 0);
  await rollHealingAndApply(actor, targetToken, formula, "Vitalizing Strike", { multiplier });
  if (Number(targetToken.actor.system?.attributes?.hp?.value ?? beforeHP) > beforeHP && hasBattleTempo(actor) && state(actor).openingNote === 6 && !state(actor).completed) {
    await gainCombo(actor, 1, { complete: true, reason: "Vitalizing Strike restored Hit Points; Healing Interlude satisfies Signature Motif." });
  }
}

async function createNonAttackResultMessage({ actor, target, strike, roll, title, note }) {
  const outcome = adaptiveOutcomeFromRoll(roll);
  const dieResult = roll?.dice?.flatMap((die) => die.results ?? []).find((result) => result.active)?.result ?? null;
  const total = Number(roll?.total ?? 0);
  const content = `<section class="sow-card"><h3>${escapeHtml(title)} — ${escapeHtml(strike?.label ?? strike?.item?.name ?? "Strike")}</h3><p><strong>Target:</strong> ${escapeHtml(target?.name ?? "Target")}</p><p><strong>Roll:</strong> ${dieResult == null ? "" : `${dieResult} → `}<strong>${total}</strong> · ${escapeHtml(adaptiveOutcomeLabel(outcome))}</p><p><em>${escapeHtml(note ?? "")}</em></p></section>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, flags: { [MODULE_ID]: { nonDamagingStrike: true } } });
}

async function preventFrozenFrightenedReduction(item, changed) {
  if (item?.slug !== "frightened" || !item.parent) return;
  const requested = foundry.utils.getProperty(changed, "system.value.value");
  if (requested == null || Number(requested) >= Number(item.value ?? 0)) return;
  const frozen = (item.parent.itemTypes?.effect ?? []).some((effect) => effect.getFlag?.(MODULE_ID, "temporaryFinale")?.freezeFrightened);
  if (frozen) foundry.utils.setProperty(changed, "system.value.value", Number(item.value ?? 0));
}


async function processActionMessage(message) {
  try {
  if (processedMessages.has(message.id) || (message.flags?.[MODULE_ID] && !isAdaptiveStrikeMessage(message))) return;
  if (messageRollOptions(message).includes("sow:module-resolution")) return;
  if (message.flags?.[MODULE_ID]?.adaptiveMeasureStrike?.manualResolution) {
    processedMessages.add(message.id);
    return;
  }
  const actor = actorFromSpeaker(message.speaker);
  if (!shouldAutomateActor(actor)) return;
  const item = await actionFromMessage(message, actor);
  await registerAttack(actor, message);
  await handleVibratingRetaliation(message, actor, item);
  await trackSidestepSync(actor, message, item);

  if (await resolveArmedAdaptiveMeasure(actor, message, item)) {
    processedMessages.add(message.id);
    return;
  }

  // Check Finale toggle BEFORE slug check (weapon attacks have no slug)
  try {
    await checkFinaleToggleOnAttack(actor, message, item);
  } catch (error) {
    console.warn("Symphonies of War | Finale attack handling failed", error);
  }

  // If attack missed and finale was active, spend chains (they're lost)
  const ctx2 = message.flags?.pf2e?.context;
  if (ctx2?.type === 'attack-roll' && ctx2?.outcome && ["failure", "criticalFailure"].includes(ctx2.outcome)) {
    const finaleState = actor.getFlag(MODULE_ID, 'finaleState');
    if (finaleState?.chainsSpent) {
      const spent = finaleState.chainsSpent;
      const finaleName = (finaleState.activeFinale || 'crescendo-strike').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const isMeasured = finaleState.measuredFinale;
      // Chains were spent on declaration; a miss only clears the resolving state.
      await actor.unsetFlag(MODULE_ID, 'finaleState');
      await syncComboEffect(actor);
      const retained = state(actor).chains;
      if (isMeasured && retained > 0) {
        await post(actor, `⚔ ${finaleName}`, `<p>Attack missed. <strong>${spent} chain${spent > 1 ? 's' : ''} spent.</strong> ${retained} unspent chain${retained === 1 ? '' : 's'} retained.</p>`);
      } else {
        await post(actor, `⚔ ${finaleName}`, `<p>Attack missed. <strong>${spent} chain${spent > 1 ? 's' : ''} spent.</strong></p>`);
      }
      await clearFinaleToggle(actor);
    }
  }

  await trackClashingDuetSignature(actor, message, item);

  const slug = actionSlugFromMessage(message, item);
  if (!slug) return;
  processedMessages.add(message.id);
  if (hasBattleTempo(actor)) recordVirtuosoAction(actor, slug, message, item);
  rememberHealingCandidate(actor, message, item, slug);

  // A passed Opening Note belongs to the selected ally, regardless of whether
  // the ally is also a Virtuoso or whether this action has its own early-return flow.
  await checkPassTheBeat(message, actor, slug, item);

  // Clean up dummy SOW Action Use effect if present
  const dummyEffect = actor.itemTypes?.effect?.find(e => e.slug === 'sow-action-use');
  if (dummyEffect) await dummyEffect.delete();

  // Cadence-specific Final Cadences are activated from their action-row Use
  // buttons. Ignore legacy PF2e action chat cards to avoid duplicate offers.
  if (SUBCLASS_FINALE_SLUGS.has(slug)) return;

  if (slug === "vitalizing-strike") {
    await offerVitalizingStrike(actor);
    return;
  }

  if (slug === "ricochet-tempo") {
    await ensureRicochetTempoEffect(actor);
    await offerRicochetManeuver(actor);
    return;
  }

  if (slug === "step" && hasBattleTempo(actor) && features(actor).has("quickening-tempo")) {
    await post(actor, "Quickening Tempo", "<p>Your Step can move up to <strong>10 feet</strong> while Battle Tempo is active.</p>");
  }

  if (slug === "pass-the-beat") {
    await beginPassTheBeat(actor);
    return;
  }

  if (slug === "battle-tempo") {
    await startBattleTempo(actor);
    return;
  }

  if (slug === "guiding-note") {
    await beginGuidingNote(actor);
    return;
  }

  if (slug === "crescendo-strike") return;

  if (slug === "double-cadenza") {
    await beginDoubleCadenza(actor);
    return;
  }

  if (slug === "flowing-sweep") {
    await beginFlowingSweep(actor);
    return;
  }

  if (slug === "measured-step") {
    await beginMeasuredStep(actor);
    return;
  }

  if (slug === "deafening-clash") {
    await beginDeafeningClash(actor);
    return;
  }
  if (slug === "heartbeat-dissonance") {
    await beginHeartbeatDissonance(actor);
    return;
  }
  if (slug === "jarring-motif") {
    await beginJarringMotif(actor);
    return;
  }
  if (slug === "staggering-display") {
    await beginStaggeringDisplay(actor);
    return;
  }
  if (slug === "staggering-strike") {
    await beginStaggeringStrike(actor);
    return;
  }

  const requiredNote = ACTION_COMPLETES_NOTE[slug];
  const current = state(actor);
  const hasOutcome = !!messageOutcome(message);

  // ── Adaptive Measure: passive immunity detection ──
  // The feature is always watching while Battle Tempo is active. There is no "Use"
  // button on the sheet: when immunity is detected, the owning player receives a
  // reaction-style prompt and decides whether to ready the replacement Strike.
  const hasAdaptiveMeasure = !!adaptiveMeasureItem(actor);
  const flowingSweep = actor.getFlag(MODULE_ID, "flowingSweep");
  const flowingProfile = flowingSweep?.turnKey === currentTurnKey() && flowingSweep?.maneuver === slug
    ? ACTION_NOTE_IMMUNITY_MAP["flowing-sweep"]?.[current.openingNote]
    : null;
  const adaptiveDescriptor = flowingProfile
    ? sanitizeAdaptiveDescriptor({ ...flowingProfile, note: current.openingNote, actionAliases: [...new Set([slug, ...(flowingProfile.actionAliases ?? [])])] })
    : adaptiveDescriptorForAction(actor, message, item, slug);
  if (hasAdaptiveMeasure && hasBattleTempo(actor) && adaptiveDescriptor?.note && !current.completed) {
    const target = targetActorFromMessage(message);
    // Give action automation modules one microtask to create source-specific temporary
    // immunity effects (for example, the 10-minute Demoralize immunity).
    await new Promise((resolve) => setTimeout(resolve, 25));
    const immunity = checkTargetImmunity(target, slug, actor, adaptiveDescriptor);
    if (immunity) {
      closeAdaptiveSourceDialogs(slug, message, item);
      const prompted = await requestAdaptiveMeasurePrompt(actor, target, slug, immunity, {
        messageId: message.id,
        targetTokenUuid: adaptiveTargetTokenUuid(message),
        descriptor: adaptiveDescriptor,
      });
      if (prompted && (message.isOwner || game.user.isGM)) {
        setTimeout(() => message.delete().catch(() => {}), 0);
      }
      return;
    }
  }

  if (CHECK_ACTIONS.has(slug) && !hasOutcome) return;

  await resolveGuidingAid(actor, slug, message);
  const target = targetActorFromMessage(message);
  if (slug === "disarm") await applyResonantDisarm(actor, message, target);

  if (flowingSweep?.turnKey === currentTurnKey() && flowingSweep?.maneuver === slug && hasOutcome) {
    if (messageSucceeded(message)) ui.notifications.info("Flowing Sweep succeeded. You may Step as a free action and must end adjacent to the target.");
    await actor.unsetFlag(MODULE_ID, "flowingSweep");
  }

  if (hasBattleTempo(actor) && current.openingNote === 6 && !current.completed) {
    if (satisfiesSignatureMotif(actor, message, slug, item)) {
      await gainCombo(actor, 1, {
        complete: true,
        reason: `${cadenceMotif(actor)[0]} satisfies ${NOTES[6].name}.`,
      });
      return;
    }
  }
  if (!hasBattleTempo(actor) || !requiredNote || current.completed || current.openingNote !== requiredNote) return;
  if (!messageSucceeded(message)) return;
  await gainCombo(actor, 1, {
    complete: true,
    reason: `${item?.name ?? slug} satisfies ${NOTES[current.openingNote].name}.`,
  });

  } catch (error) {
    console.warn("Symphonies of War | Action-message processing failed", error);
  }
}

async function completePassedNote(virtuoso, allyActor, reason) {
  const locked = state(virtuoso).heroicCadenceLocked;
  await clearPassTheBeatState(virtuoso, allyActor);
  if (locked) {
    await post(virtuoso, "Pass the Beat", `<p>${escapeHtml(allyActor.name)} fulfilled the passed Opening Note, but Heroic Cadence prevents any further Combo Chain from that note this turn.</p>`);
    return;
  }
  await gainCombo(virtuoso, 1, { complete: true, reason, viaPassTheBeat: true });
  const tempHP = Math.max(1, Number(virtuoso.system?.abilities?.cha?.mod ?? 1));
  const existing = Number(allyActor.system?.attributes?.hp?.temp ?? 0);
  if (tempHP > existing) await allyActor.update({ "system.attributes.hp.temp": tempHP });
  await allyActor.setFlag(MODULE_ID, "passBeatTempHp", { value: Math.max(existing, tempHP), sourceActorUuid: virtuoso.uuid });
  await post(virtuoso, "Pass the Beat", `<p>${escapeHtml(allyActor.name)} fulfilled your Opening Note. You gained 1 Combo Chain, and ${escapeHtml(allyActor.name)} gains ${tempHP} temporary HP until the start of their next turn.</p>`);
}

function passedActionSatisfies(virtuoso, allyActor, message, slug, item = null) {
  const current = state(virtuoso);
  const note = current.openingNote;
  if (!note || current.completed) return false;
  if (CHECK_ACTIONS.has(slug) && !message.flags?.pf2e?.context?.outcome) return false;

  if (note === 6) return satisfiesSignatureMotif(virtuoso, message, slug, item, allyActor);
  if (ACTION_COMPLETES_NOTE[slug] !== note || !messageSucceeded(message)) return false;

  const target = targetActorFromMessage(message);
  if ([1, 4].includes(note) && target && actorDistance(allyActor, target) > reachForActor(allyActor)) return false;
  if (note === 2 && target && actorDistance(allyActor, target) > 30) return false;
  return true;
}

async function trackPassedClashingDuet(virtuoso, allyActor, message, item) {
  if (!isMeleeStrikeMessage(message, item) || weaponHasTrait(item, "unarmed")) return false;
  const current = state(virtuoso);
  const progress = foundry.utils.deepClone(current.passTheBeatProgress ?? { strikes: [] });
  progress.strikes ??= [];
  const itemId = item?.id ?? message.flags?.pf2e?.origin?.uuid ?? null;
  if (!itemId) return false;
  const existing = progress.strikes.find((entry) => entry.itemId === itemId);
  if (existing) existing.success ||= messageSucceeded(message);
  else progress.strikes.push({ itemId, success: messageSucceeded(message) });
  await setState(virtuoso, { passTheBeatProgress: progress });
  return progress.strikes.length >= 2 && progress.strikes.some((entry) => entry.success);
}

function passedHealingKey(virtuoso, allyActor) {
  return `${virtuoso.id ?? virtuoso.uuid}::${allyActor.id ?? allyActor.uuid}`;
}

function rememberPassedHealingCandidate(virtuoso, allyActor, message, item, slug) {
  if (!isHealingActionMessage(message, item, slug)) return false;
  recentPassedHealingCandidates.set(passedHealingKey(virtuoso, allyActor), {
    sourceActorUuid: virtuoso.uuid,
    sourceActorId: virtuoso.id,
    allyActorUuid: allyActor.uuid,
    allyActorId: allyActor.id,
    targetActorUuid: targetActorFromMessage(message)?.uuid ?? null,
    targetActorId: targetActorFromMessage(message)?.id ?? null,
    createdAt: Date.now(),
  });
  return true;
}

async function checkPassTheBeat(message, allyActor, slug, item = null) {
  if (!game.user.isActiveGM) return false;
  for (const virtuoso of passTheBeatCandidateActors()) {
    if (!hasBattleTempo(virtuoso)) continue;
    const current = state(virtuoso);
    if (!actorMatchesReference(allyActor, { uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId }) || current.completed) continue;

    if (current.openingNote === 6) {
      const cadence = actorCadenceSlug(virtuoso);
      if (cadence === "the-clashing-duet") {
        if (await trackPassedClashingDuet(virtuoso, allyActor, message, item)) {
          await completePassedNote(virtuoso, allyActor, `${allyActor.name} completed Discordant Barrage via Pass the Beat.`);
          return true;
        }
        continue;
      }
      if (cadence === "the-mending-hymn" && isHealingActionMessage(message, item, slug)) {
        rememberPassedHealingCandidate(virtuoso, allyActor, message, item, slug);
        continue;
      }
    }

    if (!passedActionSatisfies(virtuoso, allyActor, message, slug, item)) continue;
    await completePassedNote(virtuoso, allyActor, `${allyActor.name} fulfilled ${NOTES[current.openingNote]?.name ?? "the Opening Note"} via Pass the Beat.`);
    return true;
  }
  return false;
}

async function checkPassTheBeatCondition(target, note, range, reason, actingActor = null) {
  if (!game.user.isActiveGM) return false;
  const allyActor = actingActor ?? game.combat?.combatant?.actor;
  if (!allyActor) return false;
  for (const virtuoso of passTheBeatCandidateActors()) {
    const current = state(virtuoso);
    if (!hasBattleTempo(virtuoso) || !actorMatchesReference(allyActor, { uuid: current.passTheBeatAllyUuid, id: current.passTheBeatAllyId }) || current.openingNote !== note || current.completed) continue;
    const limit = range === "reach" ? reachForActor(allyActor) : Number(range ?? Infinity);
    if (Number.isFinite(limit) && actorDistance(allyActor, target) > limit) continue;
    await completePassedNote(virtuoso, allyActor, reason);
    return true;
  }
  return false;
}

function tokenForActor(actor) {
  if (!actor) return null;
  const actorId = actor.id;
  const combatant = game.combat?.combatants?.find((c) => c.actorId === actorId || c.actor?.id === actorId);
  const combatantToken = combatant?.token?.object;
  if (combatantToken) return combatantToken;

  // Foundry 13 synthetic token actors use token-scoped UUIDs, so comparing
  // token.actor.uuid with a world Actor UUID is unreliable. Search the active
  // canvas by actor ID before falling back to getActiveTokens().
  const canvasToken = canvas?.tokens?.placeables?.find((token) => token.actor?.id === actorId);
  if (canvasToken) return canvasToken;

  return actor.getActiveTokens?.(true, true)?.[0]
    ?? actor.getActiveTokens?.(true, false)?.[0]
    ?? actor.getActiveTokens?.()?.[0]
    ?? null;
}

function actorDistance(origin, target) {
  const originToken = tokenForActor(origin);
  const targetToken = tokenForActor(target);
  if (!originToken || !targetToken) return Number.POSITIVE_INFINITY;
  return originToken.distanceTo(targetToken);
}

function reachForActor(actor) {
  return actor?.getReach?.({ action: "attack" }) ?? actor?.system?.attributes?.reach?.base ?? 5;
}

function isEnemy(origin, target) {
  if (!origin || !target || origin === target || origin.id === target.id || origin.uuid === target.uuid) return false;
  const originToken = tokenForActor(origin);
  const targetToken = tokenForActor(target);
  if (!originToken || !targetToken) return true;
  return originToken.document.disposition !== targetToken.document.disposition;
}

function activeBattleTempoActorFor(target, note, range) {
  const actor = game.combat?.combatant?.actor ?? (
    lastVirtuosoAction && Date.now() - lastVirtuosoAction.time < 10_000
      ? fromUuidSync(lastVirtuosoAction.actorUuid)
      : null
  );
  if (!actor || !hasBattleTempo(actor) || !isEnemy(actor, target)) return null;
  const current = state(actor);
  if (current.completed || current.openingNote !== note) return null;
  if (lastVirtuosoAction?.actorUuid === actor.uuid && lastVirtuosoAction.note === note && lastVirtuosoAction.success === false) return null;
  const limit = range === "reach" ? reachForActor(actor) : Number(range);
  return actorDistance(actor, target) <= limit ? actor : null;
}

function getConditionSlug(effect) {
  if (!effect) return null;
  const statuses = effect.statuses;
  if (statuses) {
    if (typeof statuses.first === "function") { const s = statuses.first(); if (s) return slugify(s); }
    if (statuses[Symbol.iterator]) { for (const s of statuses) return slugify(s); }
    if (typeof statuses.values === "function") { const it = statuses.values(); const n = it.next(); if (!n.done) return slugify(n.value); }
  }
  const flagSlug = effect.flags?.pf2e?.condition ?? effect.flags?.core?.statusId;
  if (flagSlug) return slugify(flagSlug);
  const name = effect.name ?? "";
  const match = name.match(/^([A-Za-z]+)(?:\s+\d+)?$/);
  return slugify(match ? match[1] : name);
}

async function detectAdaptiveMeasureFromImmunityEffect(item) {
  if (!game.user.isActiveGM || !isActiveTemporaryEffect(item) || !item.parent) return false;
  const recent = lastVirtuosoAction;
  if (!recent || Date.now() - recent.time > 5_000 || recent.targetUuid !== item.parent.uuid) return false;
  const descriptor = sanitizeAdaptiveDescriptor(recent.adaptiveDescriptor);
  if (!descriptor?.note) return false;

  const virtuoso = globalThis.fromUuidSync?.(recent.actorUuid);
  if (!virtuoso || !adaptiveMeasureItem(virtuoso) || !hasBattleTempo(virtuoso)) return false;
  const current = state(virtuoso);
  if (current.completed || current.openingNote !== descriptor.note) return false;

  const matchingEffect = findActionSpecificImmunityEffects(item.parent, recent.slug, virtuoso, descriptor)
    .find((entry) => entry.effectUuid === item.uuid);
  if (!matchingEffect) return false;

  return requestAdaptiveMeasurePrompt(
    virtuoso,
    item.parent,
    recent.slug,
    { immunities: [matchingEffect], note: descriptor.note, descriptor },
    { messageId: recent.messageId, descriptor },
  );
}

async function processConditionChange(item, changed = null, options = {}) {
  if (!game.user.isActiveGM || !item?.parent || !["condition", "effect"].includes(item.type)) return;
  if (item.type === "effect") await detectAdaptiveMeasureFromImmunityEffect(item);
  const slug = item.slug ?? item.system?.slug ?? getConditionSlug(item);
  
  // Only a real badge edit is authoritative. Description/rule updates made by
  // syncComboEffect must not race with a later resource spend and restore an
  // older badge value.
  if (EFFECT_SLUG_ALIASES.comboChain.includes(slug)) {
    const internalSync = !!options?.[MODULE_ID]?.internalComboSync;
    const badgeChanged = changed == null || foundry.utils.hasProperty(changed, "system.badge.value");
    if (internalSync || !badgeChanged) return;
    const badgeValue = Number(item.system?.badge?.value ?? 0);
    await item.parent.setFlag(MODULE_ID, FLAG, { ...state(item.parent), chains: badgeValue });
    await item.parent.setFlag('pf2e', 'sow', { ...(item.parent.flags?.pf2e?.sow ?? {}), chains: badgeValue });
    // Rebuild the generic combo-chain readiness option used by the native
    // Finale selector, including manual badge edits.
    await syncComboEffect(item.parent, badgeValue);
    return;
  }
  
  const match = CONDITION_COMPLETES_NOTE[slug];
  if (match) {
    const target = item.parent;
    if (await checkPassTheBeatCondition(target, match.note, match.range, `${game.combat?.combatant?.actor?.name ?? "The ally"} caused ${item.name}; the passed Opening Note was fulfilled.`)) return;
    const actor = activeBattleTempoActorFor(target, match.note, match.range);
    if (actor) {
      await gainCombo(actor, 1, {
        complete: true,
        reason: `${target.name} gained ${item.name}; ${NOTES[match.note].name} completed.`,
      });
      return;
    }
  }
  // For effects that don't match conditions, check for AC bonus (Note 5)
  if (item.type === "effect") {
    await detectACBonusFromEffect(item);
  }
}

async function processActiveEffectChange(effect) {
  if (!game.user.isActiveGM || !effect?.parent) return;
  const slug = getConditionSlug(effect);
  if (!slug) return;
  const match = CONDITION_COMPLETES_NOTE[slug];
  if (match) {
    const target = effect.parent;
    if (await checkPassTheBeatCondition(target, match.note, match.range, `${game.combat?.combatant?.actor?.name ?? "The ally"} caused ${effect.name}; the passed Opening Note was fulfilled.`)) return;
    const actor = activeBattleTempoActorFor(target, match.note, match.range);
    if (actor) {
      await gainCombo(actor, 1, {
        complete: true,
        reason: `${target.name} gained ${effect.name}; ${NOTES[match.note].name} completed.`,
      });
      return;
    }
  }
  await detectACBonusFromEffect(effect);
}

function normalizedRuleSelectionPaths(rules) {
  const source = foundry.utils.deepClone(rules ?? []);
  let changed = false;
  const visit = (value) => {
    if (typeof value === "string") {
      const replaced = value.replaceAll("flags.system.rulesSelections", "flags.pf2e.rulesSelections");
      if (replaced !== value) changed = true;
      return replaced;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) value[key] = visit(entry);
    }
    return value;
  };
  return { rules: visit(source), changed };
}

function normalizeRuleSelectionItem(item) {
  if (!item) return false;
  const normalized = normalizedRuleSelectionPaths(item.system?.rules ?? []);
  if (!normalized.changed) return false;
  item.updateSource?.({ "system.rules": normalized.rules });
  return true;
}

const SLICED_CADENZA_ITEM_ALTERATION = Object.freeze({
  key: "ItemAlteration",
  itemType: "feat",
  mode: "remove",
  property: "traits",
  value: "flourish",
  predicate: ["item:slug:double-cadenza"],
});

function slicedCadenzaRules(item) {
  const rules = foundry.utils.deepClone(item?.system?.rules ?? []).filter((rule) => !(
    rule?.key === "ItemAlteration"
    && rule?.itemType === "feat"
    && rule?.property === "traits"
    && rule?.value === "flourish"
    && (rule?.predicate ?? []).includes("item:slug:double-cadenza")
  ));
  rules.push(foundry.utils.deepClone(SLICED_CADENZA_ITEM_ALTERATION));
  return rules;
}

function normalizeSlicedCadenzaItem(item) {
  if (!item || (item.slug ?? item.system?.slug) !== "sliced-cadenza") return false;
  item.updateSource?.({ "system.rules": slicedCadenzaRules(item) });
  return true;
}

function normalizeAdaptiveMeasureItem(item) {
  if (!item || item.slug !== "adaptive-measure") return false;
  const update = {
    "system.actionType.value": "passive",
    "system.actions.value": null,
    "system.selfEffect": null,
    img: "systems/pf2e/icons/actions/Passive.webp",
  };
  if (typeof item.updateSource === "function") item.updateSource(update);
  return true;
}

async function migrateExistingActors() {
  if (!game.user.isActiveGM) return;

  const worldItemUpdates = [];
  for (const item of game.items ?? []) {
    const update = { _id: item.id };
    const itemTraits = Array.isArray(item.system?.traits?.value) ? item.system.traits.value : [];
    const cleanTraits = itemTraits.filter((trait) => !["third-party", "3rd-party"].includes(String(trait).toLowerCase()));
    const migratedTraits = ["weapon", "shield"].includes(item.type) ? normalizedAcousticTraits(cleanTraits) : cleanTraits;
    if (JSON.stringify(migratedTraits) !== JSON.stringify(itemTraits)) update["system.traits.value"] = migratedTraits;
    const selfEffectUuid = String(item.system?.selfEffect?.uuid ?? "");
    const selfEffectName = String(item.system?.selfEffect?.name ?? "");
    if (item.system?.selfEffect && (selfEffectUuid === LEGACY_SOW_ACTION_USE_UUID || selfEffectName === "SOW Action Use")) {
      update["system.selfEffect"] = null;
    }
    if (item.slug === "adaptive-measure" && (
      item.system?.actionType?.value !== "passive"
      || item.system?.selfEffect?.uuid
      || item.system?.actions?.value !== null
      || item.img !== "systems/pf2e/icons/actions/Passive.webp"
    )) {
      update["system.actionType.value"] = "passive";
      update["system.actions.value"] = null;
      update["system.selfEffect"] = null;
      update.img = "systems/pf2e/icons/actions/Passive.webp";
    }
    const itemSlug = item.slug ?? item.system?.slug;
    const archetypeActionUuids = [
      ...(ARCHETYPE_GRANTED_ACTION_UUIDS.has(itemSlug) ? [ARCHETYPE_GRANTED_ACTION_UUIDS.get(itemSlug)] : []),
      ...(ARCHETYPE_EXTRA_GRANTED_ACTION_UUIDS.get(itemSlug) ?? []),
    ].filter(Boolean);
    if (item.type === "feat" && archetypeActionUuids.length) {
      update["system.actionType.value"] = "passive";
      update["system.actions.value"] = null;
      update["system.selfEffect"] = null;
      let rules = foundry.utils.deepClone(item.system?.rules ?? []);
      for (const actionUuid of archetypeActionUuids) rules = ensureGrantedActivityRule({ system: { rules } }, actionUuid);
      update["system.rules"] = rules;
    }
    const inlineDescription = await canonicalInlineDescription(item);
    if (inlineDescription) update["system.description.value"] = inlineDescription;
    if ((item.slug ?? item.system?.slug) === "effect-giant-hyena-support-benefit") {
      const canonicalHyena = await canonicalHyenaSupportEffectData();
      if (canonicalHyena) Object.assign(update, canonicalHyena);
    }
    if (item.slug === "triumphant-chorus") update["system.prerequisites.value"] = [{ value: "Triumphant Chord" }];
    if (item.slug === "marching-troupe") update["system.prerequisites.value"] = [
      { value: "Troupe Member Dedication" },
      { value: "trained in Acrobatics, Athletics, Performance, Stealth, or Survival" },
    ];
    if (item.slug === "sliced-cadenza") {
      update["system.rules"] = slicedCadenzaRules(item);
      if (!String(item.system?.description?.value ?? "").includes("can choose to combine their damage")) {
        const canonical = await canonicalFeatDescription(item);
        if (canonical) update["system.description.value"] = canonical;
      }
    }
    if (Object.keys(update).length > 1) worldItemUpdates.push(update);
  }
  if (worldItemUpdates.length) await Item.updateDocuments(worldItemUpdates);

  const migrationActors = new Map();
  for (const actor of game.actors ?? []) migrationActors.set(actor.uuid, actor);
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor) migrationActors.set(token.actor.uuid, token.actor);
  }

  for (const actor of migrationActors.values()) {
    try {
      await syncVirtuosoClassProgression(actor);
    } catch (error) {
      console.warn(`Symphonies of War | Could not synchronize Virtuoso progression for ${actor.name}.`, error);
    }

    const updates = [];
    const deletions = [];

    // Older versions used legacy effect slugs and could leave a second copy
    // beside the canonical compendium effect. Keep one authoritative document
    // per resource so manual badge edits always target the value used by Finale.
    for (const [kind, aliases] of Object.entries(EFFECT_SLUG_ALIASES)) {
      const sourceUuid = EFFECT_UUIDS[kind];
      const candidates = (actor.itemTypes?.effect ?? []).filter((effect) =>
        effect._stats?.compendiumSource === sourceUuid
        || effect.sourceId === sourceUuid
        || aliases.includes(effect.slug)
      );
      if (!candidates.length) continue;
      if (kind === "comboChain") {
        candidates.sort((left, right) => Number(right.system?.badge?.value ?? 0) - Number(left.system?.badge?.value ?? 0));
      }
      const keep = candidates[0];
      const canonicalSlug = aliases[0];
      const canonicalName = OFFICIAL_EFFECT_NAMES[canonicalSlug];
      const update = { _id: keep.id };
      if (keep.slug !== canonicalSlug) update["system.slug"] = canonicalSlug;
      if (canonicalName && keep.name !== canonicalName) update.name = canonicalName;
      if (Object.keys(update).length > 1) updates.push(update);
      deletions.push(...candidates.slice(1).map((effect) => effect.id));
    }

    const battleTempoFeature = actor.itemTypes?.feat?.find((item) => ["battle-tempo", "battle-tempo-training"].includes(item.slug) && item.system?.category === "classfeature");
    const crescendoFeature = actor.itemTypes?.feat?.find((item) => ["crescendo-strike", "crescendo-strike-training"].includes(item.slug) && item.system?.category === "classfeature");
    const passTheBeatFeature = actor.itemTypes?.feat?.find((item) => item.slug === "pass-the-beat" && item.system?.category === "classfeature");

    if (battleTempoFeature) {
      const rules = foundry.utils.deepClone(battleTempoFeature.system?.rules ?? []).filter((rule) => !(rule?.key === "GrantItem" && String(rule?.uuid ?? "") === LEGACY_DUPLICATE_ACTION_UUIDS.battleTempo));
      updates.push({ _id: battleTempoFeature.id, name: "Battle Tempo", "system.slug": "battle-tempo", "system.actionType.value": "action", "system.actions.value": 1, "system.selfEffect": null, "system.description.value": officialFeatureDescription(battleTempoFeature, "Battle Tempo"), "system.rules": rules });
    }
    if (crescendoFeature) {
      const rules = foundry.utils.deepClone(crescendoFeature.system?.rules ?? []).filter((rule) => {
        const uuid = String(rule?.uuid ?? "");
        if (rule?.key === "GrantItem" && uuid === LEGACY_DUPLICATE_ACTION_UUIDS.crescendoStrike) return false;
        if (rule?.key === "DamageDice" && ["crescendo-strike", "finale-force-damage"].includes(rule.slug)) return false;
        if (rule?.key === "RollTwice" && JSON.stringify(rule?.predicate ?? "").includes("crescendo-strike")) return false;
        if (rule?.key === "RollOption" && String(rule?.option ?? "").includes("crescendo-strike")) return false;
        return true;
      });
      const baseRuleKeys = new Set(rules.map((rule) => `${rule.key}:${rule.slug ?? rule.option ?? ""}`));
      for (const rule of finaleActionRules("crescendo-strike")) {
        const key = `${rule.key}:${rule.slug ?? rule.option ?? ""}`;
        if (!baseRuleKeys.has(key)) { rules.push(rule); baseRuleKeys.add(key); }
      }
      updates.push({ _id: crescendoFeature.id, name: "Crescendo Strike", "system.slug": "crescendo-strike", "system.actionType.value": "passive", "system.actions.value": null, "system.selfEffect": null, "system.description.value": officialFeatureDescription(crescendoFeature, "Crescendo Strike"), "system.rules": rules });
    }
    if (passTheBeatFeature) {
      const rules = foundry.utils.deepClone(passTheBeatFeature.system?.rules ?? []).filter((rule) => !(rule?.key === "GrantItem" && String(rule?.uuid ?? "") === LEGACY_DUPLICATE_ACTION_UUIDS.passTheBeat));
      updates.push({
        _id: passTheBeatFeature.id,
        "system.actionType.value": "action",
        "system.actions.value": 1,
        "system.selfEffect": null,
        "system.description.value": passTheBeatDescriptionV11(passTheBeatFeature.system?.description?.value),
        "system.rules": rules,
      });
    }

    // The official class features are the usable items. Remove legacy action
    // duplicates that were granted only to work around PF2e's native Use button.
    for (const duplicate of actor.itemTypes?.action ?? []) {
      const source = String(duplicate.sourceId ?? duplicate._stats?.compendiumSource ?? "");
      if (["battle-tempo", "crescendo-strike", "pass-the-beat"].includes(duplicate.slug) && source.includes(MODULE_ID)) deletions.push(duplicate.id);
    }

    const adaptive = adaptiveMeasureItem(actor);
    if (adaptive && (
      adaptive.system?.actionType?.value !== "passive"
      || adaptive.system?.selfEffect?.uuid
      || adaptive.system?.actions?.value !== null
    )) {
      updates.push({
        _id: adaptive.id,
        "system.actionType.value": "passive",
        "system.actions.value": null,
        "system.selfEffect": null,
        img: "systems/pf2e/icons/actions/Passive.webp",
      });
    }

    for (const item of actor.items ?? []) {
      const slug = item.slug ?? item.system?.slug;
      const archetypeActionUuid = ARCHETYPE_GRANTED_ACTION_UUIDS.get(slug);
      const rulesWithActivity = item.type === "feat" && archetypeActionUuid
        ? ensureGrantedActivityRule(item, archetypeActionUuid)
        : foundry.utils.deepClone(item.system?.rules ?? []);
      const normalizedSelections = normalizedRuleSelectionPaths(rulesWithActivity);
      if (item.type === "feat" && archetypeActionUuid) {
        updates.push({
          _id: item.id,
          "system.actionType.value": "passive",
          "system.actions.value": null,
          "system.selfEffect": null,
          "system.rules": normalizedSelections.rules,
        });
      } else if (normalizedSelections.changed) {
        updates.push({ _id: item.id, "system.rules": normalizedSelections.rules });
      }
      const legacySelections = item.flags?.system?.rulesSelections;
      if (legacySelections && typeof legacySelections === "object") {
        const canonicalSelections = { ...(item.flags?.pf2e?.rulesSelections ?? {}), ...legacySelections };
        updates.push({
          _id: item.id,
          "flags.pf2e.rulesSelections": canonicalSelections,
          "flags.system.-=rulesSelections": null,
        });
      }
      const inlineDescription = await canonicalInlineDescription(item);
      if (inlineDescription) updates.push({ _id: item.id, "system.description.value": inlineDescription });
      if (slug === "effect-giant-hyena-support-benefit") {
        const canonicalHyena = await canonicalHyenaSupportEffectData();
        if (canonicalHyena) updates.push({ _id: item.id, ...canonicalHyena });
      }
      if (slug === "triumphant-chorus") updates.push({ _id: item.id, "system.prerequisites.value": [{ value: "Triumphant Chord" }] });
      if (slug === "sliced-cadenza") {
        updates.push({ _id: item.id, "system.rules": slicedCadenzaRules(item) });
        if (!String(item.system?.description?.value ?? "").includes("can choose to combine their damage")) {
          const canonical = await canonicalFeatDescription(item);
          if (canonical) updates.push({ _id: item.id, "system.description.value": canonical });
        }
      }
      const itemTraits = Array.isArray(item.system?.traits?.value) ? item.system.traits.value : [];
      const cleanTraits = itemTraits.filter((trait) => !["third-party", "3rd-party"].includes(String(trait).toLowerCase()));
      const migratedTraits = ["weapon", "shield"].includes(item.type) ? normalizedAcousticTraits(cleanTraits) : cleanTraits;
      if (JSON.stringify(migratedTraits) !== JSON.stringify(itemTraits)) updates.push({ _id: item.id, "system.traits.value": migratedTraits });
      const selfEffectUuid = String(item.system?.selfEffect?.uuid ?? "");
      const selfEffectName = String(item.system?.selfEffect?.name ?? "");
      if (item.system?.selfEffect && (selfEffectUuid === LEGACY_SOW_ACTION_USE_UUID || selfEffectName === "SOW Action Use")) {
        updates.push({ _id: item.id, "system.selfEffect": null });
      }
      if (slug === "pass-the-beat") {
        if (item.type === "action") {
          updates.push({
            _id: item.id,
            "system.actionType.value": "action",
            "system.actions.value": 1,
            "system.selfEffect": null,
            "system.description.value": passTheBeatDescriptionV11(item.system?.description?.value),
          });
        } else if (item.type === "feat" && item.system?.category === "classfeature") {
          updates.push({
            _id: item.id,
            "system.actionType.value": "action",
            "system.actions.value": 1,
            "system.selfEffect": null,
            "system.description.value": passTheBeatDescriptionV11(item.system?.description?.value),
          });
        }
      }
      if (slug === "use-crescendo-strike") {
        deletions.push(item.id);
        continue;
      }
      if (LEVEL_ONE_ACTION_FEATS.has(slug)) {
        const actions = LEVEL_ONE_ACTION_FEATS.get(slug)?.actions ?? 1;
        if (item.system?.selfEffect || item.system?.actions?.value !== actions || item.system?.actionType?.value !== "action") {
          updates.push({ _id: item.id, "system.actionType.value": "action", "system.actions.value": actions, "system.selfEffect": null });
        }
      }
      if (LEVEL_TWO_ACTION_FEATS.has(slug)) {
        const actions = LEVEL_TWO_ACTION_FEATS.get(slug)?.actions ?? 1;
        updates.push({ _id: item.id, "system.actionType.value": "action", "system.actions.value": actions, "system.selfEffect": null });
      }
      if (LEVEL_TWO_PASSIVE_FEATS.has(slug)) {
        const update = { _id: item.id, "system.actionType.value": "passive", "system.actions.value": null, "system.selfEffect": null };
        if (slug === "visceral-presence") {
          const description = String(item.system?.description?.value ?? "");
          if (!description.includes('data-sow-action="visceral-demoralize"')) update["system.description.value"] = `${description}<hr><p><strong>Foundry automation:</strong> while in Battle Tempo, target an enemy within 30 feet and use the button below instead of the normal Demoralize action.</p><button type="button" data-sow-action="visceral-demoralize">Visceral Demoralize</button>`;
        }
        const desired = levelTwoRules(slug, actor);
        if (desired.length) update["system.rules"] = desired;
        updates.push(update);
      }
      const finaleRules = normalizedFinaleActionRules(item);
      if (finaleRules) {
        const finaleUpdate = { _id: item.id };
        let finaleChanged = false;
        if (JSON.stringify(finaleRules) !== JSON.stringify(item.system?.rules ?? [])) {
          finaleUpdate["system.rules"] = finaleRules;
          finaleChanged = true;
        }
        if (item.system?.selfEffect) {
          finaleUpdate["system.selfEffect"] = null;
          finaleChanged = true;
        }
        if (finaleChanged) updates.push(finaleUpdate);
      }
      const levelOneRulesUpdate = normalizedLevelOneRules(item, slug);
      if (levelOneRulesUpdate && JSON.stringify(levelOneRulesUpdate) !== JSON.stringify(item.system?.rules ?? [])) {
        updates.push({ _id: item.id, "system.rules": levelOneRulesUpdate });
      }
      if (slug === "tuned-arsenal" && item.system?.maxTakable !== TUNED_ARSENAL_TRAITS.length) {
        updates.push({ _id: item.id, "system.maxTakable": TUNED_ARSENAL_TRAITS.length });
      }
      if (slug === "crescendo-strike-training") {
        const rules = foundry.utils.deepClone(item.system?.rules ?? []);
        const filtered = rules.filter((rule) => {
          if (rule.key === "GrantItem") return true;
          if (rule.key === "DamageDice" && ["crescendo-strike", "finale-force-damage"].includes(rule.slug)) return false;
          if (rule.key === "RollTwice" && JSON.stringify(rule.predicate ?? "").includes("crescendo-strike")) return false;
          if (rule.key === "RollOption" && String(rule.option ?? "").includes("crescendo-strike")) return false;
          return true;
        });
        if (JSON.stringify(filtered) !== JSON.stringify(rules)) updates.push({ _id: item.id, "system.rules": filtered });
      }
    }

    // SOW Action Use is obsolete. Every module action now has a dedicated sheet
    // button and direct runtime handler, so stale dummy effects are always removed.
    for (const effect of actor.itemTypes?.effect ?? []) {
      if (effect.slug === "sow-action-use") deletions.push(effect.id);
      const officialName = OFFICIAL_EFFECT_NAMES[effect.slug];
      if (officialName && effect.name !== officialName) updates.push({ _id: effect.id, name: officialName });
      const officialRuntimeNames = {
        "double-cadenza-guarded-refrain": "Double Cadenza",
        "measured-step-demoralize": "Measured Step — Discordant Chord",
        "measured-step-supporting-harmony": "Measured Step — Supporting Harmony",
        "measured-step-ac": "Measured Step — Constant Refrain",
        "resonant-disarm-off-balance": "Resonant Disarm",
        "jarring-motif-penalty": "Jarring Motif",
        "staggering-display-distracted": "Staggering Display",
        "staggering-strike-disrupted": "Staggering Strike",
        "ricochet-tempo-returning": "Ricochet Tempo",
      };
      const runtimeName = officialRuntimeNames[effect.slug];
      if (runtimeName && effect.name !== runtimeName) updates.push({ _id: effect.id, name: runtimeName });
    }

    // Merge multiple updates that target the same embedded item.
    const mergedUpdates = [...updates.reduce((map, update) => {
      map.set(update._id, { ...(map.get(update._id) ?? { _id: update._id }), ...update });
      return map;
    }, new Map()).values()];
    if (mergedUpdates.length) await actor.updateEmbeddedDocuments("Item", mergedUpdates);
    if (deletions.length) await actor.deleteEmbeddedDocuments("Item", [...new Set(deletions)]);

    // Heroic Cadence and Resonant Disarm are passive feats that grant separate
    // activities. Older actors only had a button injected into the feat row, so
    // restore the real action item when it is missing.
    for (const [featSlug] of LEVEL_ONE_GRANTED_ACTIONS) {
      const feat = actor.itemTypes?.feat?.find((item) => item.slug === featSlug);
      if (!feat || actor.itemTypes?.action?.some((item) => item.slug === featSlug)) continue;
      const actionUuid = LEVEL_ONE_GRANTED_ACTION_UUIDS[featSlug];
      if (!actionUuid) continue;
      try {
        const source = await sourceFromUuid(actionUuid);
        const actionId = foundry.utils.randomID();
        const grantFlag = featSlug.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        source._id = actionId;
        source.flags ??= {};
        source.flags.core ??= {};
        source.flags.core.sourceId = actionUuid;
        source.flags.pf2e ??= {};
        source.flags.pf2e.grantedBy = { id: feat.id, onDelete: "cascade" };
        await actor.createEmbeddedDocuments("Item", [source], { render: false, keepId: true });
        await feat.update({
          [`flags.pf2e.itemGrants.${grantFlag}`]: { id: actionId, onDelete: "detach" },
        }, { render: false });
        console.info(`Symphonies of War | Restored ${featSlug} action for ${actor.name}.`);
      } catch (error) {
        console.warn(`Symphonies of War | Could not restore ${featSlug} action for ${actor.name}.`, error);
      }
    }

    // Archetype activity feats were split into feat and action documents in
    // 0.6.22. Restore the action for existing actors that already own the feat.
    for (const [featSlug, actionUuid] of ARCHETYPE_GRANTED_ACTION_UUIDS) {
      const feat = actor.itemTypes?.feat?.find((item) => item.slug === featSlug);
      if (!feat || actor.itemTypes?.action?.some((item) => item.slug === featSlug)) continue;
      try {
        const source = await sourceFromUuid(actionUuid);
        const actionId = foundry.utils.randomID();
        const grantFlag = `${featSlug.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())}Activity`;
        source._id = actionId;
        source.flags ??= {};
        source.flags.core ??= {};
        source.flags.core.sourceId = actionUuid;
        source.flags.pf2e ??= {};
        source.flags.pf2e.grantedBy = { id: feat.id, onDelete: "cascade" };
        await actor.createEmbeddedDocuments("Item", [source], { render: false, keepId: true });
        await feat.update({
          [`flags.pf2e.itemGrants.${grantFlag}`]: { id: actionId, onDelete: "detach" },
        }, { render: false });
        console.info(`Symphonies of War | Restored ${featSlug} archetype activity for ${actor.name}.`);
      } catch (error) {
        console.warn(`Symphonies of War | Could not restore ${featSlug} archetype activity for ${actor.name}.`, error);
      }
    }

    // Signature Formation grants two separate activities. Restore either one
    // independently for characters created before 0.6.27.
    for (const [featSlug, actionUuids] of ARCHETYPE_EXTRA_GRANTED_ACTION_UUIDS) {
      const feat = actor.itemTypes?.feat?.find((item) => item.slug === featSlug);
      if (!feat) continue;
      for (const actionUuid of actionUuids) {
        const sourceId = String(actionUuid).split(".").at(-1);
        const expectedSlug = actionUuid.endsWith(".ejBihOLb06075LJO") ? "call-position"
          : actionUuid.endsWith(".K5Pox5GCk8ox2kk6") ? "strike-the-pose"
            : null;
        if (expectedSlug && actor.itemTypes?.action?.some((item) => item.slug === expectedSlug)) continue;
        try {
          const source = await sourceFromUuid(actionUuid);
          const actionId = foundry.utils.randomID();
          const grantFlag = `${expectedSlug ?? sourceId}`.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
          source._id = actionId;
          source.flags ??= {};
          source.flags.core ??= {};
          source.flags.core.sourceId = actionUuid;
          source.flags.pf2e ??= {};
          source.flags.pf2e.grantedBy = { id: feat.id, onDelete: "cascade" };
          await actor.createEmbeddedDocuments("Item", [source], { render: false, keepId: true });
          await feat.update({
            [`flags.pf2e.itemGrants.${grantFlag}`]: { id: actionId, onDelete: "detach" },
          }, { render: false });
          console.info(`Symphonies of War | Restored ${source.name ?? expectedSlug} for ${actor.name}.`);
        } catch (error) {
          console.warn(`Symphonies of War | Could not restore a ${featSlug} activity for ${actor.name}.`, error);
        }
      }
    }

    // Restore cadence-specific starting actions for actors created with older packs.
    const cadence = actorCadenceSlug(actor);
    const startingAction = cadence ? CADENCE_STARTING_ACTIONS[cadence] : null;
    if (startingAction && !actor.items.some((item) => item.slug === startingAction.slug)) {
      try {
        const source = await sourceFromUuid(startingAction.uuid);
        await actor.createEmbeddedDocuments("Item", [source]);
        console.info(`Symphonies of War | Restored ${startingAction.slug} for ${actor.name}.`);
      } catch (error) {
        console.warn(`Symphonies of War | Could not restore ${startingAction.slug} for ${actor.name}.`, error);
      }
    }

    // Existing Virtuoso actors created before full Core Cadence automation may not
    // have received their level-9 Final Cadence action. Restore it from the module
    // compendium without duplicating documents already granted by PF2e rule elements.
    const finaleSlug = cadence ? CADENCE_FINALE_SLUGS[cadence] : null;
    const finaleUuid = cadence ? CADENCE_FINALE_UUIDS[cadence] : null;
    if (actorLevel(actor) >= 9 && finaleSlug && finaleUuid && !actor.items.some((item) => item.slug === finaleSlug)) {
      try {
        const source = await sourceFromUuid(finaleUuid);
        await actor.createEmbeddedDocuments("Item", [source]);
        console.info(`Symphonies of War | Restored ${finaleSlug} for ${actor.name}.`);
      } catch (error) {
        console.warn(`Symphonies of War | Could not restore ${finaleSlug} for ${actor.name}.`, error);
      }
    }
  }
}

const finaleToggleOfferKeys = new Map();

function selectedFinaleToggle(actor) {
  for (const item of actor.items ?? []) {
    for (const rule of item.system?.rules ?? []) {
      if (rule.key !== "RollOption" || rule.option !== FINALE_TOGGLE_OPTION) continue;
      if (rule.value === true) return "crescendo-strike";
    }
  }
  return null;
}

async function handleFinaleRuleUpdate(item, changed, _options, userId) {
  const slug = item?.slug ?? item?.system?.slug;
  if (!item?.parent || item.type !== "action" || !FINALE_TOGGLE_SLUGS.includes(slug)) return;
  if (!foundry.utils.hasProperty(changed, "system.rules")) return;

  const actor = item.parent;
  await syncFinaleDamageDice(actor);

  // Every client observes the document update. Only the client that clicked the
  // native PF2e toggle may launch the selected Finale workflow, preserving that
  // player's targets and avoiding duplicate prompts from the merged rules.
  if (userId && userId !== game.user.id) return;
  const selected = selectedFinaleToggle(actor);
  if (!selected) return;

  const current = state(actor);
  if (current.chains < 1 || current.finaleUsedTurnKey === currentTurnKey()) {
    await clearFinaleToggle(actor);
    return;
  }

  // Crescendo Strike remains armed until the next valid melee Strike. It has no
  // Use button and requires no additional prompt.
  if (selected === "crescendo-strike") return;
  if (!SUBCLASS_FINALE_SLUGS.has(selected)) return;

  const offerKey = `${actor.uuid}:${currentTurnKey()}:${selected}`;
  const previous = finaleToggleOfferKeys.get(offerKey) ?? 0;
  if (Date.now() - previous < 1_000) return;
  finaleToggleOfferKeys.set(offerKey, Date.now());
  await offerSubclassFinale(actor, selected);
}

function tunedArsenalItemAffectsStrikes(item) {
  return item?.slug === "tuned-arsenal"
    || item?.type === "weapon"
    || ["battle-tempo", "effect-battle-tempo"].includes(item?.slug);
}

async function repairTunedArsenalRules(item) {
  if (!item || item.slug !== "tuned-arsenal" || !tunedArsenalSelection(item)) return false;
  const rules = normalizedLevelOneRules(item, "tuned-arsenal");
  if (!rules || JSON.stringify(rules) === JSON.stringify(item.system?.rules ?? [])) return false;
  await item.update({ "system.rules": rules }, { [MODULE_ID]: { tunedArsenalRepair: true }, render: false });
  return true;
}

function onTunedArsenalItemCreated(item) {
  const actor = item?.parent;
  if (!actor) return;
  if (item.slug === "tuned-arsenal") {
    void finalizeTunedArsenalCreation(item).catch((error) => console.warn("Symphonies of War | Tuned Arsenal creation validation failed", error));
  }
  if (tunedArsenalItemAffectsStrikes(item)) scheduleVirtuosoUiRefresh(actor);
}

function onTunedArsenalItemUpdated(item, changed, options = {}) {
  const actor = item?.parent;
  if (!actor || !tunedArsenalItemAffectsStrikes(item)) return;
  const selectionChanged = foundry.utils.hasProperty(changed, `flags.pf2e.rulesSelections.${TUNED_ARSENAL_SELECTION_FLAG}`)
    || foundry.utils.hasProperty(changed, `flags.system.rulesSelections.${TUNED_ARSENAL_SELECTION_FLAG}`);
  const weaponChanged = item.type === "weapon" && [
    "system.equipped",
    "system.usage",
    "system.traits",
    "system.category",
    "system.range",
  ].some((path) => foundry.utils.hasProperty(changed, path));
  if (selectionChanged && !options?.[MODULE_ID]?.tunedArsenalRepair && !options?.[MODULE_ID]?.tunedArsenalReselection) {
    void repairTunedArsenalRules(item).catch((error) => console.warn("Symphonies of War | Tuned Arsenal repair failed", error));
  }
  if (selectionChanged || weaponChanged || item.slug === "tuned-arsenal") scheduleVirtuosoUiRefresh(actor);
}

function onTunedArsenalItemDeleted(item) {
  const actor = item?.parent;
  if (actor && tunedArsenalItemAffectsStrikes(item)) scheduleVirtuosoUiRefresh(actor);
}

function onTechnicalPrecisionItemCreated(item) {
  if (item?.slug !== "technical-precision" || !item.parent || !technicalPrecisionSelection(item)) return;
  void repairTechnicalPrecisionRules(item).catch((error) => console.warn("Symphonies of War | Technical Precision repair failed", error));
  scheduleVirtuosoUiRefresh(item.parent);
}

function onTechnicalPrecisionItemUpdated(item, changed, options = {}) {
  if (item?.slug !== "technical-precision" || !item.parent) return;
  const selectionChanged = foundry.utils.hasProperty(changed, `flags.pf2e.rulesSelections.${TECHNICAL_PRECISION_SELECTION_FLAG}`)
    || foundry.utils.hasProperty(changed, `flags.system.rulesSelections.${TECHNICAL_PRECISION_SELECTION_FLAG}`)
    || foundry.utils.hasProperty(changed, "system.rules");
  if (selectionChanged && !options?.[MODULE_ID]?.technicalPrecisionRepair && !options?.[MODULE_ID]?.technicalPrecisionReselection) {
    void repairTechnicalPrecisionRules(item).catch((error) => console.warn("Symphonies of War | Technical Precision repair failed", error));
  }
  if (selectionChanged) scheduleVirtuosoUiRefresh(item.parent);
}

Hooks.once("init", () => {
  registerTraits();
  registerIconManager();
});

Hooks.once("ready", async () => {
  game.socket?.on(SOCKET_CHANNEL, onModuleSocket);
  globalThis.SymphoniesOfWar = {
    startBattleTempo,
    rollOpeningNote,
    gainCombo,
    resetCombo,
    showFinaleDialog,
    armFinale,
    beginPassTheBeat,
    delayBattleTempo,
    syncVirtuosoClassProgression,
    openIconManager,
    applyIconOverrides,
  };
  try {
    await migrateExistingActors();
    await repairPassTheBeatEffects();
    await organizeCompendiumPacks();
    await configureCompanionPack();
    await captureBundledIconDefaults();
    await applyIconOverrides();
  } catch (e) {
    console.warn("Symphonies of War | startup migration, pack organization, or Pass the Beat repair error:", e.message);
  }
  // Sync DamageDice/RollTwice rules for all virtuoso actors at startup (fixes stale values from previous sessions)
  if (game.user.isActiveGM) {
    for (const actor of game.actors ?? []) {
      if (effectForActor(actor, "comboChain")) {
        syncComboEffect(actor).catch((error) => console.warn("Symphonies of War | startup Finale sync error:", error.message));
      }
    }
  }
});

Hooks.on("pf2e.startTurn", onStartTurn);
Hooks.on("pf2e.endTurn", onEndTurn);
Hooks.on("deleteCombat", onCombatEnd);
Hooks.on("updateCombat", (combat, changed) => { if (foundry.utils.hasProperty(changed, "round")) expireDelayedBattleTempo(combat).catch((error) => console.warn("Symphonies of War | delayed turn expiry error:", error)); });
Hooks.on("preCreateChatMessage", preCreateAdaptiveMeasureMessage);
Hooks.on("createChatMessage", processActionMessage);
Hooks.on("createChatMessage", onDamageRoll);
Hooks.on("deleteChatMessage", cleanAdaptivePromptKey);
Hooks.on("preCreateItem", preventUnavailableCompanionCreation);
Hooks.on("preCreateItem", (item) => {
  if (prepareTunedArsenalCreation(item) === false) return false;
  normalizeRuleSelectionItem(item);
  normalizeAdaptiveMeasureItem(item);
  normalizeSlicedCadenzaItem(item);
  normalizeCoreClassFeatureItem(item);
  normalizeLevelOneItem(item);
  normalizeArchetypeGrantedActionFeat(item);
  normalizeLevelTwoItem(item);
  normalizePassTheBeatItem(item);
  normalizeFinaleActionItem(item);
  stripLegacyCrescendoRules(item);
  stripSowActionUseFromItem(item);
  stripThirdPartyTrait(item);
  normalizeAcousticItemTraits(item);
  applyIconOverrideToItemSource(item);
});
Hooks.on("createItem", (item, options) => {
  processConditionChange(item, null, options);
  void refreshEmbeddedIcon(item).catch((error) => console.warn("Symphonies of War | Could not apply an embedded icon override.", error));
});
Hooks.on("createItem", onTunedArsenalItemCreated);
Hooks.on("createItem", onTechnicalPrecisionItemCreated);
Hooks.on("updateItem", (item, changed, options) => processConditionChange(item, changed, options));
Hooks.on("updateItem", onTunedArsenalItemUpdated);
Hooks.on("updateItem", onTechnicalPrecisionItemUpdated);
Hooks.on("updateItem", handleFinaleRuleUpdate);
Hooks.on("createActiveEffect", processActiveEffectChange);
Hooks.on("updateActiveEffect", processActiveEffectChange);
Hooks.on("preUpdateActor", detectHealingInterludeUpdate);
Hooks.on("updateActor", (actor, changed) => {
  if (!game.user.isActiveGM || !foundry.utils.hasProperty(changed, "system.details.level.value")) return;
  syncVirtuosoClassProgression(actor).catch((error) => console.warn("Symphonies of War | level progression sync error:", error));
});
Hooks.on("createItem", (item) => {
  if (!game.user.isActiveGM || item?.type !== "class" || item?.slug !== "virtuoso" || !item.parent) return;
  syncVirtuosoClassProgression(item.parent).catch((error) => console.warn("Symphonies of War | class creation progression sync error:", error));
});
Hooks.on("preUpdateItem", preventFrozenFrightenedReduction);
Hooks.on("deleteItem", cleanupRicochetTempoOnBattleTempoEnd);
Hooks.on("deleteItem", onTunedArsenalItemDeleted);
function actorSheetRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function variableActionCost(item) {
  if (!item || item.type !== "action") return null;
  const flagged = item.flags?.[MODULE_ID]?.variableActionCost;
  if (typeof flagged === "string" && flagged.trim()) return flagged.trim();
  return VARIABLE_ACTION_COSTS.get(item.slug) ?? null;
}

function variableActionGlyph(cost) {
  if (cost === "1 or 2") return "1/2";
  if (cost === "1 to 3") return "1 - 3";
  if (cost === "2 or 3") return "2/3";
  return String(cost ?? "");
}

function wireVariableActionCostItemSheet(app, html) {
  const item = app?.item ?? app?.document ?? null;
  const cost = variableActionCost(item);
  const root = actorSheetRoot(html);
  if (!root || !cost) return;

  const glyph = variableActionGlyph(cost);
  const headerDetails = root.querySelector(".sheet-header .details");
  let headerGlyph = headerDetails?.querySelector(":scope > .action-glyph")
    ?? root.querySelector(".sheet-header .action-glyph");
  if (!headerGlyph && headerDetails) {
    headerGlyph = document.createElement("span");
    headerGlyph.className = "action-glyph";
    const level = headerDetails.querySelector(":scope > .level");
    if (level) level.insertAdjacentElement("beforebegin", headerGlyph);
    else headerDetails.append(headerGlyph);
  }
  if (headerGlyph) {
    headerGlyph.textContent = glyph;
    headerGlyph.title = `${cost} actions`;
    headerGlyph.setAttribute("aria-label", `${cost} actions`);
    headerGlyph.dataset.sowVariableActionCost = cost;
  }

  // A normal PF2e Ability item only stores one numeric action cost. Keep the
  // minimum (1) in the editable schema, but make the published variable cost
  // explicit beside that field so a GM never mistakes it for a fixed cost.
  const actionSelect = root.querySelector('select[name="system.actions.value"]');
  const fields = actionSelect?.parentElement;
  if (fields && !fields.querySelector(".sow-variable-action-cost-hint")) {
    const hint = document.createElement("span");
    hint.className = "sow-variable-action-cost-hint";
    hint.innerHTML = `<span class="action-glyph">${escapeHtml(glyph)}</span><span>${escapeHtml(cost)} actions</span>`;
    fields.append(hint);
  }
}

function wireVariableActionCostActorRows(root, actor) {
  if (!root || !actor) return;
  for (const item of actor.itemTypes?.action ?? []) {
    const cost = variableActionCost(item);
    if (!cost) continue;
    const row = [...root.querySelectorAll("[data-item-id]")].find((element) => element.dataset.itemId === item.id);
    if (!row) continue;
    const glyph = variableActionGlyph(cost);
    row.querySelectorAll(".use-action .action-glyph").forEach((element) => {
      element.textContent = glyph;
      element.title = `${cost} actions`;
      element.setAttribute("aria-label", `${cost} actions`);
    });
  }
}

function refreshVirtuosoUi(actor) {
  try { actor?.reset?.(); } catch (_error) {}

  try { actor?.sheet?.render?.(false); } catch (_error) {}

  const apps = actor?.apps instanceof Map
    ? [...actor.apps.values()]
    : Object.values(actor?.apps ?? {});
  for (const app of apps) {
    try {
      const root = actorSheetRoot(app?.element);
      if (root) syncFinaleSelectorUi(root, actor);
      app?.render?.(false);
    } catch (_error) {}
  }

  for (const container of document.querySelectorAll(`[data-option="${FINALE_TOGGLE_OPTION}"][data-sow-actor-id="${actor.id}"]`)) {
    const root = container.closest('.window-app, .application') ?? document;
    syncFinaleSelectorUi(root, actor);
  }
}

function scheduleVirtuosoUiRefresh(actor) {
  for (const delay of [0, 75, 250]) setTimeout(() => refreshVirtuosoUi(actor), delay);
}

function findFinaleControlContainer(root) {
  return root.querySelector('[data-option="virtuoso-finale"]');
}

function syncFinaleSelectorUi(root, actor) {
  const container = findFinaleControlContainer(root);
  if (!container || !actor) return;

  container.dataset.sowActorUuid = actor.uuid;
  container.dataset.sowActorId = actor.id;

  const comboEffect = effectForActor(actor, "comboChain");
  const chains = comboEffect
    ? Number(comboEffect.system?.badge?.value ?? 0)
    : Number(state(actor).chains ?? 0);
  const alreadyUsed = state(actor).finaleUsedTurnKey === currentTurnKey();
  const ready = chains > 0 && !alreadyUsed;
  const checkbox = container.querySelector('input[type="checkbox"]');
  const disabledReason = chains < 1
    ? 'You need at least 1 Combo Chain to use a Finale.'
    : alreadyUsed
      ? 'You can use only one Finale per turn.'
      : '';

  container.dataset.sowFinaleReady = String(ready);
  container.dataset.sowChains = String(chains);

  if (checkbox) {
    // Keep the control clickable so stale PF2e preparation cannot permanently
    // lock it. The capture handler below enforces the real requirements.
    checkbox.disabled = false;
    checkbox.setAttribute('aria-disabled', String(!ready));
    checkbox.title = disabledReason;
    checkbox.dataset.sowFinaleCheckbox = 'true';
    const label = checkbox.nextElementSibling;
    label?.classList?.toggle('unchecked-disabled', !ready && !checkbox.checked);
  }

}

const SHEET_ACTION_CONFIG = new Map([
  ["battle-tempo", { label: "USE", glyph: "1" }],
  ["guiding-note", { label: "USE", glyph: "1" }],
  ["pass-the-beat", { label: "USE", glyph: "1" }],
  ["double-cadenza", { label: "USE", glyph: "2" }],
  ["flowing-sweep", { label: "USE", glyph: "1" }],
  ["measured-step", { label: "USE", glyph: "1" }],
  ["heroic-cadence", { label: "USE", glyph: "F" }],
  ["resonant-disarm", { label: "USE", glyph: "1" }],
  ["deafening-clash", { label: "USE", glyph: "2" }],
  ["heartbeat-dissonance", { label: "USE", glyph: "1" }],
  ["jarring-motif", { label: "USE", glyph: "1" }],
  ["staggering-display", { label: "USE", glyph: "2" }],
  ["staggering-strike", { label: "USE", glyph: "2" }],
  ["ricochet-tempo", { label: "USE", glyph: "F" }],
  ["vitalizing-strike", { label: "USE", glyph: "1" }],
  ["rhythm-recovery", { label: "USE", glyph: "R" }],
  ["shattering-crescendo", { label: "USE", glyph: "1" }],
  ["shatter-point-crescendo", { label: "USE", glyph: "1" }],
  ["soothing-crescendo", { label: "USE", glyph: "1" }],
  ["vibrating-crescendo", { label: "USE", glyph: "1" }],
  ["whirling-crescendo", { label: "USE", glyph: "1" }],
]);

function sheetItemForSlug(actor, slug) {
  const action = actor.itemTypes?.action?.find((item) => item.slug === slug) ?? null;
  if (action) return action;

  // Heroic Cadence and Resonant Disarm deliberately live in the Actions tab as
  // granted activities. Never fall back to placing their controls on the feat row.
  if (LEVEL_ONE_GRANTED_ACTIONS.has(slug)) return null;
  return actor.itemTypes?.feat?.find((item) => item.slug === slug) ?? null;
}

function addSowSheetButton(group, actor, item, { action, label, glyph, ariaLabel }) {
  let button = group.querySelector(`[data-sow-action="${action}"]`);
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "sow-action-button";
    group.append(button);
  }
  button.dataset.sowAction = action;
  button.dataset.sowActorUuid = actor.uuid;
  button.dataset.sowItemId = item.id;
  button.dataset.sowItemSlug = item.slug;
  button.setAttribute("aria-label", ariaLabel ?? label);
  button.innerHTML = `<span>${escapeHtml(label)}</span>${glyph ? `<span class="action-glyph">${escapeHtml(glyph)}</span>` : ""}`;
  return button;
}

function wireActorSheetButtons(app, html) {
  const root = actorSheetRoot(html);
  const actor = app?.actor ?? app?.document ?? null;
  if (!root || !actor) return;

  syncFinaleSelectorUi(root, actor);

  for (const [slug, config] of SHEET_ACTION_CONFIG) {
    const item = sheetItemForSlug(actor, slug);
    if (!item) continue;
    const row = [...root.querySelectorAll("[data-item-id]")].find((element) => element.dataset.itemId === item.id);
    if (!row) continue;

    const nativeButtons = [...row.querySelectorAll(".use-action")];
    let group = nativeButtons[0]?.parentElement ?? row.querySelector(".button-group");
    nativeButtons.forEach((element) => element.remove());
    if (!group) {
      group = document.createElement("div");
      group.className = "button-group";
      row.querySelector(".name")?.insertAdjacentElement("afterend", group);
    }
    if (!group) continue;

    addSowSheetButton(group, actor, item, {
      action: "sheet-use-action",
      label: config.label,
      glyph: config.glyph,
      ariaLabel: `Use ${item.name}`,
    });
    if (slug === "battle-tempo") {
      addSowSheetButton(group, actor, item, {
        action: "delay-battle-tempo",
        label: "DELAY",
        glyph: null,
        ariaLabel: "Preserve Battle Tempo while Delaying",
      });
      addSowSheetButton(group, actor, item, {
        action: "complete-opening-note",
        label: "COMPLETE NOTE",
        glyph: null,
        ariaLabel: "Mark the current Opening Note as complete",
      });
    }
  }

  for (const item of tunedArsenalFeats(actor)) {
    const row = [...root.querySelectorAll("[data-item-id]")].find((element) => element.dataset.itemId === item.id);
    if (!row) continue;
    let group = row.querySelector(".button-group");
    if (!group) {
      group = document.createElement("div");
      group.className = "button-group";
      row.querySelector(".name")?.insertAdjacentElement("afterend", group);
    }
    if (!group) continue;

    const selection = tunedArsenalSelection(item);
    const label = selection ? selection.toUpperCase() : "CHOOSE TRAIT";
    const button = addSowSheetButton(group, actor, item, {
      action: "choose-tuned-arsenal",
      label,
      glyph: null,
      ariaLabel: selection
        ? `Tuned Arsenal currently grants ${selection}. Click to change it.`
        : "Choose Tuned Arsenal trait",
    });
    button.title = selection
      ? `Tuned Arsenal: ${selection[0].toUpperCase() + selection.slice(1)}. Click to change.`
      : "Choose the trait granted by Tuned Arsenal.";
  }

  const technicalPrecision = technicalPrecisionFeat(actor);
  if (technicalPrecision) {
    const row = [...root.querySelectorAll("[data-item-id]")].find((element) => element.dataset.itemId === technicalPrecision.id);
    if (row) {
      let group = row.querySelector(".button-group");
      if (!group) {
        group = document.createElement("div");
        group.className = "button-group";
        row.querySelector(".name")?.insertAdjacentElement("afterend", group);
      }
      if (group) {
        const selection = technicalPrecisionSelection(technicalPrecision);
        const label = selection ? `NOTE ${selection}` : "CHOOSE NOTE";
        const button = addSowSheetButton(group, actor, technicalPrecision, {
          action: "choose-technical-precision",
          label,
          glyph: null,
          ariaLabel: selection
            ? `Technical Precision currently rerolls ${selection}. ${NOTES[selection].name}. Click to change it.`
            : "Choose the Opening Note for Technical Precision",
        });
        button.title = selection
          ? `Technical Precision: ${selection}. ${NOTES[selection].name}. Click to change.`
          : "Choose the Opening Note that Technical Precision can reroll.";
      }
    }
  }

  wireVariableActionCostActorRows(root, actor);
  queueMicrotask(() => syncFinaleSelectorUi(root, actor));
  setTimeout(() => {
    syncFinaleSelectorUi(root, actor);
    wireVariableActionCostActorRows(root, actor);
  }, 100);
}

async function activateSheetAction(button) {
  if (button.dataset.sowPending === "true") return;
  button.dataset.sowPending = "true";
  button.disabled = true;
  try {
    const actor = button.dataset.sowActorUuid ? await fromUuid(button.dataset.sowActorUuid) : null;
    if (!actor || !canEdit(actor)) return ui.notifications.warn("You cannot edit that actor.");
    const slug = String(button.dataset.sowItemSlug ?? "");
    if (button.dataset.sowAction === "choose-tuned-arsenal") {
      const item = actor.items?.get(button.dataset.sowItemId) ?? actor.items?.find((candidate) => candidate.id === button.dataset.sowItemId);
      if (!item || item.slug !== "tuned-arsenal") return ui.notifications.warn("Tuned Arsenal could not be found on this actor.");
      return promptTunedArsenalChoice(item);
    }
    if (button.dataset.sowAction === "choose-technical-precision") {
      const item = actor.items?.get(button.dataset.sowItemId) ?? actor.items?.find((candidate) => candidate.id === button.dataset.sowItemId);
      if (!item || item.slug !== "technical-precision") return ui.notifications.warn("Technical Precision could not be found on this actor.");
      return promptTechnicalPrecisionChoice(item);
    }
    if (button.dataset.sowAction === "delay-battle-tempo") return delayBattleTempo(actor);
    if (button.dataset.sowAction === "complete-opening-note") return completeOpeningNoteManually(actor);
    if (slug === "battle-tempo") return startBattleTempo(actor);
    if (slug === "guiding-note") return beginGuidingNote(actor);
    if (slug === "pass-the-beat") return beginPassTheBeat(actor);
    if (slug === "double-cadenza") return beginDoubleCadenza(actor);
    if (slug === "flowing-sweep") return beginFlowingSweep(actor);
    if (slug === "measured-step") return beginMeasuredStep(actor);
    if (slug === "heroic-cadence") return useHeroicCadence(actor);
    if (slug === "resonant-disarm") return beginResonantDisarm(actor);
    if (slug === "deafening-clash") return beginDeafeningClash(actor);
    if (slug === "heartbeat-dissonance") return beginHeartbeatDissonance(actor);
    if (slug === "jarring-motif") return beginJarringMotif(actor);
    if (slug === "staggering-display") return beginStaggeringDisplay(actor);
    if (slug === "staggering-strike") return beginStaggeringStrike(actor);
    if (slug === "ricochet-tempo") {
      await ensureRicochetTempoEffect(actor);
      return offerRicochetManeuver(actor);
    }
    if (slug === "vitalizing-strike") return offerVitalizingStrike(actor);
    if (SUBCLASS_FINALE_SLUGS.has(slug)) return offerSubclassFinale(actor, slug);
    if (slug === "rhythm-recovery") {
      const today = new Date().toISOString().slice(0, 10);
      const current = state(actor);
      if (!features(actor).has("dynamic-composition")) return ui.notifications.warn("You do not have Dynamic Composition.");
      if (current.rhythmRecoveryUsedDay === today) return ui.notifications.warn("Rhythm Recovery has already been used today.");
      if (current.chains < 1) return ui.notifications.warn("You have no Combo Chains to preserve.");
      await setState(actor, { preserveReset: true, rhythmRecoveryUsedDay: today });
      return post(actor, "Rhythm Recovery", "<p>Your Combo Chains will not reset at the next eligible end-of-turn check.</p>");
    }
    ui.notifications.warn(`No Symphonies of War handler is registered for ${slug}.`);
  } catch (error) {
    console.error("Symphonies of War | Sheet action failed", error);
    ui.notifications.error("The Symphonies of War action could not be activated. Check the console.");
  } finally {
    delete button.dataset.sowPending;
    button.disabled = false;
  }
}

document.addEventListener("change", (event) => {
  const control = event.target?.closest?.(`[data-option="${FINALE_TOGGLE_OPTION}"]`);
  if (!control) return;

  const checkbox = control.querySelector('input[type="checkbox"]');
  const actorUuid = control.dataset.sowActorUuid;
  const actorId = control.dataset.sowActorId;
  const actor = actorUuid ? fromUuidSync?.(actorUuid) : game.actors?.get(actorId);
  if (!actor || !checkbox) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const current = state(actor);
  const slug = "crescendo-strike";

  if (current.chains < 1) {
    checkbox.checked = false;
    ui.notifications.warn("You need at least 1 Combo Chain to use a Finale.");
    scheduleVirtuosoUiRefresh(actor);
    return;
  }
  if (current.finaleUsedTurnKey === currentTurnKey()) {
    checkbox.checked = false;
    ui.notifications.warn("You can use only one Finale per turn.");
    scheduleVirtuosoUiRefresh(actor);
    return;
  }

  void setFinaleToggle(actor, slug, checkbox.checked).then(() => scheduleVirtuosoUiRefresh(actor));
}, true);

document.addEventListener("click", (event) => {
  const sheetButton = event.target.closest?.('[data-sow-action="sheet-use-action"], [data-sow-action="delay-battle-tempo"], [data-sow-action="complete-opening-note"], [data-sow-action="pass-the-beat"], [data-sow-action="choose-tuned-arsenal"], [data-sow-action="choose-technical-precision"]');
  if (sheetButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void activateSheetAction(sheetButton);
    return;
  }

  const damageButton = event.target.closest?.(
    '[data-action="strike-damage"], [data-action="strike-critical"], [data-action^="strike-damage"]',
  );
  if (damageButton) {
    const messageElement = damageButton.closest(".chat-message, [data-message-id], [data-document-id]");
    const messageId = messageElement?.dataset?.messageId ?? messageElement?.dataset?.documentId ?? null;
    const message = messageId ? game.messages?.get(messageId) : null;
    if (message && isAdaptiveStrikeMessage(message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      ui.notifications.warn("Adaptive Measure Strikes deal no damage.");
      return;
    }
  }

  const button = event.target.closest?.("[data-sow-action]");
  if (button) void handleAction(button);
}, true);

Hooks.on("renderChatMessageHTML", wireChatButtons);
Hooks.on("renderActorSheet", (app, html) => wireActorSheetButtons(app, html));
Hooks.on("renderActorSheetPF2e", (app, html) => wireActorSheetButtons(app, html));
Hooks.on("renderCharacterSheetPF2e", (app, html) => wireActorSheetButtons(app, html));
Hooks.on("renderItemSheet", (app, html) => wireVariableActionCostItemSheet(app, html));
Hooks.on("renderItemSheetPF2e", (app, html) => wireVariableActionCostItemSheet(app, html));
