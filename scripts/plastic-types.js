'use strict';
/**
 * plastic-types.js — central plastic type library for all DiscDrop scrapers
 *
 * Brand keys must exactly match the 'brand' field in data/discs.js / DISC_CATALOG.
 * Each entry has:
 *   prefix: plastics that appear before the disc name (most common)
 *   suffix: plastics that appear after the disc name (rare)
 * Lists are ordered longest-to-shortest within each group so the first match wins.
 */

const PLASTIC_TYPES = {
  Kastaplast: {
    prefix: [
      'K1 Soft Glow', 'K1 Hard Glow', 'K3 Hard Glow',
      'K1 Grind', 'K1 Swirl', 'K1 Glow',
      'K1 Soft', 'K1 Hard', 'K3 Soft', 'K3 Glow', 'K3 Hard',
      'K4 Glow', 'K1', 'K3', 'K4',
    ],
    suffix: [],
  },
  Innova: {
    prefix: [
      'Halo Star', 'Metal Flake Champion', 'Metal Flake',
      'Halo Champion', 'Halo Nexus',
      'KC Pro Glow', 'Star Glow', 'Proto Glow',
      'I-Dye Champion', 'I-Dye Star',
      'Champion Glow', 'Color Glow',
      'Blizzard Champion', 'Color Glow Pro', 'Color Glow Champion',
      'Gummy Champion', 'Gummy Star', 'Echo Star', 'Shimmer Star', 'Swirly Star',
      'Champion', 'Blizzard', 'GStar', 'G-Star',
      'R-Pro', 'KC Pro', 'JK Pro',
      'Soft Pro',
      'Star', 'Glow DX', 'Glow', 'DX', 'XT', 'Pro',
      'Luster', 'Duo',
    ],
    suffix: [],
  },
  Discmania: {
    prefix: [
      'Metal Flake C-Line', 'Metal Flake P-Line', 'Metal Flake',
      'Color Glow C-Line', 'Swirly S-Line', 'Swirl D-Line',
      'Luster Vapor', 'Luster C-Line', 'Luster P-Line', 'Luster S-Line',
      'C-Line Horizon', 'S-Line Swirl', 'P-Line Swirl', 'S-Line Glow', 'C-Line Glow',
      'Horizon C-Line', 'Horizon S-Line', 'Horizon P-Line',
      'D-Line Glow', 'Extra Soft Exo',
      'Active Premium Glow', 'Active Premium', 'Active Soft',
      'Luster', 'Horizon', 'Lux Vapor', 'Neo Lumen',
      'Soft Exo', 'Exo',
      'Geo', 'Lux', 'Meta', 'Forge', 'Neo',
      'Active', 'S-Line', 'C-Line', 'P-Line', 'Q-Line', 'D-Line',
      'Vapor',
    ],
    suffix: [],
  },
  'Dynamic Discs': {
    prefix: [
      'Lucid Air', 'Lucid Ice', 'Lucid X',
      'Fuzion Air', 'Fuzion X',
      'Classic Soft', 'Classic Burst', 'Classic Blend',
      'BioFuzion Air', 'BioFuzion',
      'Moonshine', 'Emac', 'Supreme',
      'Fuzion', 'Lucid', 'Classic', 'Prime',
    ],
    suffix: [],
  },
  'Latitude 64': {
    prefix: [
      'Opto-X Chameleon', 'Opto-X Glimmer', 'Opto Chameleon', 'Opto-X',
      'Opto Glimmer', 'Opto Ice', 'Opto Air',
      'Gold Orbit', 'Gold Glimmer', 'Gold Ice', 'Gold Line',
      'Grand Orbit', 'Retro Burst', 'Royal Grand',
      'Zero Soft', 'Zero Medium', 'Zero Hard',
      'BioGold', 'Moonshine',
      'Royal', 'Opto', 'Gold', 'Grand', 'Sense', 'Frost',
      'Retro', 'Zero', 'VIP',
    ],
    suffix: [],
  },
  'Westside Discs': {
    prefix: [
      'VIP X Moonshine', 'VIP Ice', 'VIP Air', 'VIP Glimmer', 'VIP Moonshine',
      'BT Soft', 'BT Medium', 'BT Hard',
      'Magic Super Soft', 'Voodoo Super Soft', 'Stupid Soft',
      'Organic Hemp',
      'Origio Burst', 'Moonshine VIP', 'Moonshine',
      'Tournament', 'Origio', 'Elasto', 'Frost',
      'VIP', 'BT', 'Nylon',
    ],
    suffix: [],
  },
  Discraft: {
    prefix: [
      'CryZtal FLX Sparkle', 'CryZtal Glo FLX', 'CryZtal Glo', 'CryZtal FLX',
      'CryZtal Sparkle', 'CryZtal', 'Cryztal',
      'Titanium FLX', 'Ti Colorshift', 'Ti Swirl', 'Ti FLX', 'Titanium',
      'Z Metallic FLX', 'Z Metallic', 'Z Glo FLX', 'Z Glo',
      'Z Swirl', 'Z FLX', 'Z Lite',
      'Big Z FLX', 'Big Z',
      'ESP Glo Sparkle', 'ESP Glo', 'ESP Swirl', 'ESP FLX', 'ESP',
      'Jawbreaker Z FLX', 'Jawbreaker Swirl', 'Jawbreaker Glo',
      'Jawbreaker Z', 'Jawbreaker',
      'Putter Line Super Soft', 'Putter Line Swirl Soft',
      'Putter Line Soft', 'Putter Line Hard', 'Putter Line',
      'Rubber Blend Swirl', 'Rubber Blend',
      'Recycled ESP', 'Fused Line',
      'Colorshift Z', 'Midnight Z', 'UV Z', 'Crazy Tuff',
      'X Line', 'Pro-D',
      'Total Eclipse',
      'X', 'Z',
    ],
    suffix: [],
  },
  MVP: {
    prefix: [
      'Cosmic Electron Soft', 'Cosmic Electron Firm', 'Cosmic Electron',
      'Cosmic Neutron', 'Prism Neutron', 'Prism Proton', 'Prism Plasma',
      'R2 Neutron', 'Soft Neutron', 'Neutron Soft', 'Proton Soft',
      'Total Eclipse', 'Eclipse',
      'Electron Soft', 'Electron Firm',
      'Electron', 'Fission', 'Plasma Soft', 'Plasma', 'Proton', 'Neutron',
    ],
    suffix: [],
  },
  Axiom: {
    prefix: [
      'Cosmic Electron Soft', 'Cosmic Electron Firm', 'Cosmic Electron',
      'Cosmic Neutron', 'Prism Neutron', 'Prism Proton', 'Prism Plasma',
      'R2 Neutron', 'Soft Neutron', 'Neutron Soft', 'Proton Soft',
      'Total Eclipse', 'Eclipse',
      'Electron Soft', 'Electron Firm',
      'Electron', 'Fission', 'Plasma Soft', 'Plasma', 'Proton', 'Neutron',
    ],
    suffix: [],
  },
  Streamline: {
    prefix: [
      'Electron Soft', 'Electron Firm',
      'Electron', 'Neutron', 'Proton',
    ],
    suffix: [],
  },
  'RPM Discs': {
    prefix: [
      'RPM Glow',
      'Cosmic', 'Magma Soft', 'Magma Hard', 'Strata Soft', 'Strata Hard',
      'Magma', 'Strata', 'Atomic',
    ],
    suffix: [],
  },
  Prodigy: {
    prefix: [
      '500 Ultra Soft', '400 Ultra Soft', '300 Ultra Soft',
      '500 Glimmer', '400G Spectrum', '400 Glimmer', '400 Spectrum',
      '300 Firm', '300 Soft', 'Glimmer Glow',
      'Special Blend', 'ProFlex', 'ReBlend',
      'Spectrum', 'Glimmer',
      '750G', '400G', '500', '350G', '350', '300G', '200G',
      'Halo', 'Air', 'ET', 'AIR',
      '750', '400', '300', '200',
    ],
    suffix: [],
  },
  'Viking Discs': {
    prefix: [
      'Warpaint', 'Ground', 'Explorer', 'Warrior',
      'Armor', 'Swirl', 'Storm', 'Air', 'Ice', 'Origin', 'Fire',
    ],
    suffix: [],
  },
  Millennium: {
    prefix: ['Quantum', 'Sirius', 'Polaris LS', 'Polaris', 'Lunar'],
    suffix: [],
  },
  'Infinite Discs': {
    prefix: [
      'Metal Flake C-Blend', 'Glow C-Blend',
      'S-Blend', 'I-Blend', 'X-Blend', 'C-Blend',
      'Luster', 'Glow',
    ],
    suffix: [],
  },
  Gateway: {
    prefix: ['OG Soft', 'OG Medium', 'OG Firm', 'OG', 'Base'],
    suffix: [],
  },
  'Lone Star Discs': {
    prefix: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
    suffix: [],
  },
  'Clash Discs': {
    prefix: ['Tone', 'Premium'],
    suffix: [],
  },
  'Thought Space Athletics': {
    prefix: ['Nebula Ethereal', 'Nebula Aura', 'Ethereal', 'Ethos Soft', 'Ethos', 'Aura'],
    suffix: [],
  },
  'EggShell Discs': {
    prefix: ['Egg Shell Glow', 'Egg Shell'],
    suffix: [],
  },
  Prodiscus: {
    prefix: ['NS Line', 'Major Line', 'Trophy Line', 'Competition Line'],
    suffix: [],
  },
};

// ── Player names ──────────────────────────────────────────────────────────────
// Ordered longest / most-specific first to avoid partial matches.

const PLAYER_NAMES = [
  // Full names (must stay before surname-only variants)
  'Anniken Kristiansen Steen',
  'Eagle McMahon', 'Calvin Heimburg', 'Ricky Wysocki', 'Simon Lizotte',
  'Paige Pierce', 'Brodie Smith', 'Paul McBeth', 'Niklas Anttila',
  'Bradley Williams', 'Gannon Buhr', 'Clay Edwards', 'Isaac Robinson',
  'Casey White', 'Nate Sexton', 'Anthony Barela', 'Catrina Allen',
  'Henna Blomroos', 'Eveliina Salonen', 'Vaino Makela', 'Kristofer Hivju',
  'Joel Freeman', 'Thomas Gilbert', 'Ellen Widbom', 'Kona Star Panis',
  'Seppo Paju', 'Reeta Piho', 'Albert Tamm', 'Kristin Lätt', 'Kristin Latt',
  'Kristin Tattar',
  'JohnE McCray', 'Dallas Garber', 'Joseph Anderson', 'Silva Saarinen',
  'Jeremy Koling', 'James Conrad', 'Kona Montgomery',
  'Ida Emilie Nesse', 'Anniken Steen',
  'Julia Fors', 'Juliana Korver', 'Josef Berg', 'Cadence Burge',
  'Kyle Klein', 'Aaron Gossage', 'Holyn Handley', 'Ella Hansen',
  'Silas Schultz', 'Adam Hammes', 'Chris Dickerson', 'Matthew Orum',
  'Kevin Jones', 'Austin Turner',
  // Nicknames / signatures
  'Sockibomb',
];

// ── Edition keywords ──────────────────────────────────────────────────────────
// Ordered longest first so "Team Championship Series" beats "Team Series".

const EDITION_KEYWORDS = [
  'Team Championship Series', 'European Disc Golf Championship',
  'World Championship', 'Nordic Phenom',
  'Signature Series', 'Tour Series', 'Team Series',
  'Special Edition', 'Limited Edition', 'First Run', 'Primal Run',
  'Project Lab Coat', 'Lab Coat',
  'Get Freaky', 'Show Stopper', 'Mold Team',
  'Ledgestone', 'OTB Open', 'Gyropalooza', 'MVP Open', 'USDGC', 'EDGF',
  'Nordic', 'Sky Stone', 'Solar Flare', 'Fly Dye', 'Color Glow', 'Swirly',
  'Bottom Stamp', 'Triple Foil', 'Bar Stamp',
  'Prototype', 'Retooled', 'Pre-Sale',
  'Confetti', 'DyeMax', 'Supercolor', 'Goliath', 'Caprap',
  '2026', '2025', '2024',
];

// ── Used / B-grade filter ─────────────────────────────────────────────────────

const USED_KEYWORDS = [
  'second hand', 'brukt', 'x-out', ' xout', 'x out',
  'blank stamp', 'blank disc', 'nice not perfect', 'recycled', 'recycling',
  'b-grade', 'b grade', 'factory second', 'lab second', 'practice disc',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts ALL CAPS product names (e.g. WeAreDiscGolf format) to Title Case.
 * Only converts when ≥70% of alphabetic characters are uppercase.
 *
 * @param {string} rawName
 * @returns {string}
 */
function normalizeProductName(rawName) {
  const letters = rawName.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 4) {
    const uppercaseCount = (rawName.match(/[A-Z]/g) || []).length;
    if (uppercaseCount / letters.length >= 0.7) {
      return rawName
        .toLowerCase()
        .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
    }
  }
  return rawName;
}

/**
 * Parses a raw product name into its semantic components.
 *
 * Handles:
 * - Dash/em-dash separated editions: "Neutron Engine – Eagle McMahon Team Series 2026"
 * - ALL CAPS product names (WeAreDiscGolf): "HALO STAR MAMBA JULIANA KORVER 2026"
 * - Standard format: "ESP Buzzz Tour Series", "Star Destroyer Paul McBeth"
 *
 * @param {string} rawName
 * @param {string} brand - must match a key in PLASTIC_TYPES
 * @returns {{ discName: string, plastic: string|null, edition: string|null }}
 */
function parseProductName(rawName, brand) {
  // Normalize ALL CAPS first (WeAreDiscGolf uses all-caps product names)
  let remaining = normalizeProductName(rawName.trim());
  let plastic = null;
  let edition = null;

  // 1. Plastic — try prefix (appears at start), then suffix, then contains
  const def = PLASTIC_TYPES[brand];
  if (def) {
    for (const p of def.prefix) {
      const re = new RegExp('^' + escapeRe(p) + '(?=[\\s\\-–—]|$)', 'i');
      if (re.test(remaining)) {
        plastic = p;
        remaining = remaining.slice(p.length).replace(/^[\s\-–—,]+/, '').trim();
        break;
      }
    }
    if (!plastic) {
      for (const p of def.suffix) {
        const re = new RegExp('[\\s\\-–—]' + escapeRe(p) + '$', 'i');
        if (re.test(remaining)) {
          plastic = p;
          remaining = remaining.slice(0, remaining.length - p.length).replace(/[\s\-–—,]+$/, '').trim();
          break;
        }
      }
    }
    if (!plastic) {
      const allPlastics = [...def.prefix, ...def.suffix];
      for (const p of allPlastics) {
        const re = new RegExp('(?:^|\\s)' + escapeRe(p) + '(?:\\s|$)', 'i');
        if (re.test(remaining)) {
          plastic = p;
          remaining = remaining.replace(new RegExp('\\s*' + escapeRe(p) + '\\s*', 'i'), ' ').trim();
          break;
        }
      }
    }
  }

  // 2. Dash-based edition splitting
  // "Neutron Engine – Eagle McMahon Team Series 2026" → discZone="Engine", editionZone="Eagle McMahon Team Series 2026"
  // "C-Line Glow FD - Show Stopper 3 - Ella Hansen Signature Series" → discZone="FD", editionZone="Show Stopper 3 - Ella Hansen Signature Series"
  // Note: only split on em-dash/en-dash (always edition separator) or hyphen surrounded by spaces
  const emDashMatch = /^(.*?)\s+[–—]\s+(.+)$/.exec(remaining);
  const hyphenMatch = !emDashMatch && /^([\w\s'().]+?)\s+-\s+(.+)$/.exec(remaining);
  const sepMatch = emDashMatch || hyphenMatch;

  let discZone = remaining;
  let editionZone = null;
  if (sepMatch) {
    discZone = sepMatch[1].trim();
    editionZone = sepMatch[2].trim();
  }

  // 3. Search for player names and edition keywords
  // When we have a dash separator, prioritize searching the edition zone
  const primarySearch = editionZone || remaining;
  const secondarySearch = editionZone ? null : null; // only search remaining once

  for (const player of PLAYER_NAMES) {
    const re = new RegExp('(?:^|[\\s\\-–—])' + escapeRe(player) + '(?:[\\s\\-–—,0-9]|$)', 'i');
    if (re.test(primarySearch)) {
      edition = player;
      if (editionZone) {
        remaining = discZone;
      } else {
        remaining = remaining.replace(
          new RegExp('[\\s\\-–—,]*' + escapeRe(player) + '.*$', 'i'), ''
        ).trim();
      }
      break;
    }
  }
  if (!edition) {
    for (const kw of EDITION_KEYWORDS) {
      const re = new RegExp('(?:^|[\\s\\-–—])' + escapeRe(kw) + '(?:[\\s\\-–—,]|$)', 'i');
      if (re.test(primarySearch)) {
        edition = kw;
        if (editionZone) {
          remaining = discZone;
        } else {
          remaining = remaining.replace(
            new RegExp('[\\s\\-–—,]*' + escapeRe(kw) + '.*$', 'i'), ''
          ).trim();
        }
        break;
      }
    }
  }

  // 4. If there's a dash separator but no specific keyword matched,
  // check if the edition zone contains a year — that signals a special run
  if (!edition && editionZone) {
    if (/\b(202[4-9]|202\d)\b/.test(editionZone)) {
      edition = editionZone;
      remaining = discZone;
    }
  }

  // 5. Strip trailing colour / weight noise ("- Blue 175g", "(167-169g)", etc.)
  const discName = remaining
    .replace(/\s*[-–—]\s*(blue|red|green|yellow|orange|purple|black|white|pink|gold|silver|teal|grey|gray)\b.*/i, '')
    .replace(/\s*\(?\d{3}(?:-\d{3})?g\)?.*$/i, '')
    .replace(/\s*[-–—]\s*\d+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { discName, plastic, edition };
}

/**
 * Returns true when the product name suggests a used, B-grade, or
 * otherwise non-new disc that should be excluded from price comparison.
 */
function isUsedDisc(rawName) {
  const lower = rawName.toLowerCase();
  return USED_KEYWORDS.some((kw) => lower.includes(kw));
}

module.exports = {
  PLASTIC_TYPES,
  PLAYER_NAMES,
  EDITION_KEYWORDS,
  USED_KEYWORDS,
  normalizeProductName,
  parseProductName,
  isUsedDisc,
};
