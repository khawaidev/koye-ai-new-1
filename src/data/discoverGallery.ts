// ─── Discover Gallery Data ─────────────────────────────────────────────────
//
// Add your images here. Each item has:
//   - id:   unique string
//   - url:  path to the image (import or URL)
//   - name: display name
//   - tags: array of lowercase tag strings (must match filter option IDs)
//
// Images with the tag "default" will be shown when NO filters are active.
// Tags should match the filter option values below (case-insensitive matching is used).
//
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscoverItem {
  id: string
  url: string
  name: string
  tags: string[]
  type: "image" | "video"
}

// ─── Filter Definitions ────────────────────────────────────────────────────
// Each filter group can optionally have a `showWhen` condition:
//   { filterGroupId: string, values: string[] }
// meaning "only show this group when the given filterGroupId has one of those values selected".

export interface FilterOption {
  value: string
  label: string
}

export interface FilterGroup {
  id: string
  label: string
  options: FilterOption[]
  /** If set, this filter group only appears when the parent group has one of these values selected */
  showWhen?: { filterGroupId: string; values: string[] }
}

export const FILTER_GROUPS: FilterGroup[] = [
  // ── Primary: Asset Type ──
  {
    id: "assetType",
    label: "Asset Type",
    options: [
      { value: "character", label: "Character" },
      { value: "creature", label: "Creature / Monster" },
      { value: "weapon", label: "Weapon" },
      { value: "armor", label: "Armor" },
      { value: "item", label: "Item / Prop" },
      { value: "environment", label: "Environment" },
      { value: "vehicle", label: "Vehicle" },
      { value: "ui", label: "UI / Icons" },
      { value: "animals", label: "Animals" },
    ],
  },

  // ── Animal Type (if assetType = animals) ──
  {
    id: "animalType",
    label: "Animal Type",
    showWhen: { filterGroupId: "assetType", values: ["animals"] },
    options: [
      { value: "dog", label: "Dog" },
      { value: "cat", label: "Cat" },
      { value: "fish", label: "Fish" },
      { value: "reptile", label: "Reptile" },
      { value: "insect", label: "Insect" },
      { value: "horse", label: "Horse" },
      { value: "bull", label: "Bull" },
      { value: "eagle", label: "Eagle" },
    ],
  },

  // ── Creature / Monster Type (if assetType = creature) ──
  {
    id: "creatureType",
    label: "Creature / Monster Type",
    showWhen: { filterGroupId: "assetType", values: ["creature"] },
    options: [
      { value: "dragon", label: "Dragon" },
      { value: "griffin", label: "Griffin" },
      { value: "unicorn", label: "Unicorn" },
      { value: "phoenix", label: "Phoenix" },
      { value: "kraken", label: "Kraken" },
      { value: "golem", label: "Golem" },
      { value: "elemental", label: "Elemental" },
    ],
  },

  // ── Species (if assetType = character) ──
  {
    id: "species",
    label: "Species",
    showWhen: { filterGroupId: "assetType", values: ["character"] },
    options: [
      { value: "elf", label: "Elf" },
      { value: "dwarf", label: "Dwarf" },
      { value: "orc", label: "Orc" },
      { value: "demon", label: "Demon" },
      { value: "undead", label: "Undead" },
      { value: "beastfolk", label: "Beastfolk" },
      { value: "human", label: "Human" },
    ],
  },

  // ── Character Class / Role (always visible, but most useful for characters) ──
  {
    id: "characterClass",
    label: "Character Class / Role",
    showWhen: { filterGroupId: "assetType", values: ["character"] },
    options: [
      { value: "knight", label: "Knight" },
      { value: "samurai", label: "Samurai" },
      { value: "mage", label: "Mage" },
      { value: "assassin", label: "Assassin" },
      { value: "archer", label: "Archer" },
      { value: "shaman", label: "Shaman" },
      { value: "berserker", label: "Berserker" },
      { value: "healer", label: "Healer" },
      { value: "noblemen", label: "Noblemen" },
      { value: "ronin", label: "Ronin" },
      { value: "commoner", label: "Commoner" },
      { value: "thief", label: "Thief" },
      { value: "merchant", label: "Merchant" },
    ],
  },

  // ── Theme / Setting ──
  {
    id: "theme",
    label: "Theme / Setting",
    options: [
      { value: "fantasy", label: "Fantasy" },
      { value: "sci-fi", label: "Sci-Fi" },
      { value: "cyberpunk", label: "Cyberpunk" },
      { value: "medieval", label: "Medieval" },
      { value: "post-apocalyptic", label: "Post-Apocalyptic" },
      { value: "modern", label: "Modern / Military" },
      { value: "steampunk", label: "Steampunk" },
      { value: "mythological", label: "Mythological" },
    ],
  },

  // ── Cultural Inspiration ──
  {
    id: "culture",
    label: "Cultural Inspiration",
    options: [
      { value: "japanese", label: "Japanese" },
      { value: "chinese", label: "Chinese" },
      { value: "european", label: "European" },
      { value: "norse", label: "Norse" },
      { value: "indian", label: "Indian" },
      { value: "tribal", label: "Tribal" },
    ],
  },

  // ── Weapon Type (if assetType = weapon) ──
  {
    id: "weaponType",
    label: "Weapon Type",
    showWhen: { filterGroupId: "assetType", values: ["weapon"] },
    options: [
      { value: "sword", label: "Sword" },
      { value: "bow", label: "Bow" },
      { value: "spear", label: "Spear" },
      { value: "gun", label: "Gun" },
      { value: "staff", label: "Staff" },
      { value: "dagger", label: "Dagger" },
      { value: "axe", label: "Axe" },
    ],
  },

  // ── Armor Type (if assetType = armor) ──
  {
    id: "armorType",
    label: "Armor Type",
    showWhen: { filterGroupId: "assetType", values: ["armor"] },
    options: [
      { value: "light-armor", label: "Light Armor" },
      { value: "medium-armor", label: "Medium Armor" },
      { value: "heavy-armor", label: "Heavy Armor" },
      { value: "robes", label: "Robes" },
    ],
  },

  // ── Item Type (if assetType = item) ──
  {
    id: "itemType",
    label: "Item Type",
    showWhen: { filterGroupId: "assetType", values: ["item"] },
    options: [
      { value: "consumables", label: "Consumables" },
      { value: "artifact", label: "Artifact" },
      { value: "loot", label: "Loot" },
      { value: "quest-item", label: "Quest Item" },
      { value: "magic-item", label: "Magic Item" },
    ],
  },

  // ── Consumables sub-type (if itemType = consumables) ──
  {
    id: "consumableType",
    label: "Consumable Type",
    showWhen: { filterGroupId: "itemType", values: ["consumables"] },
    options: [
      { value: "potions", label: "Potions" },
      { value: "food", label: "Food" },
      { value: "scrolls", label: "Scrolls" },
      { value: "elixirs", label: "Elixirs" },
      { value: "drinks", label: "Drinks" },
    ],
  },

  // ── Loot sub-type (if itemType = loot) ──
  {
    id: "lootType",
    label: "Loot Type",
    showWhen: { filterGroupId: "itemType", values: ["loot"] },
    options: [
      { value: "coins", label: "Coins" },
      { value: "gems", label: "Gems" },
      { value: "jewelry", label: "Jewelry" },
    ],
  },

  // ── Environment Type (if assetType = environment) ──
  {
    id: "environmentType",
    label: "Environment Type",
    showWhen: { filterGroupId: "assetType", values: ["environment"] },
    options: [
      { value: "forest", label: "Forest" },
      { value: "mountain", label: "Mountain" },
      { value: "desert", label: "Desert" },
      { value: "ocean", label: "Ocean" },
      { value: "city", label: "City" },
      { value: "space", label: "Space" },
      { value: "underground", label: "Underground" },
      { value: "sky", label: "Sky" },
    ],
  },

  // ── Vehicle Type (if assetType = vehicle) ──
  {
    id: "vehicleType",
    label: "Vehicle Type",
    showWhen: { filterGroupId: "assetType", values: ["vehicle"] },
    options: [
      { value: "car", label: "Car" },
      { value: "bike", label: "Bike" },
      { value: "plane", label: "Plane" },
      { value: "ship", label: "Ship" },
      { value: "spaceship", label: "Spaceship" },
      { value: "train", label: "Train" },
      { value: "truck", label: "Truck" },
    ],
  },

  // ── UI / Icons Type (if assetType = ui) ──
  {
    id: "uiType",
    label: "UI / Icons Type",
    showWhen: { filterGroupId: "assetType", values: ["ui"] },
    options: [
      { value: "icon", label: "Icon" },
      { value: "button-ui", label: "Button" },
      { value: "menu", label: "Menu" },
      { value: "panel", label: "Panel" },
      { value: "window", label: "Window" },
      { value: "popup", label: "Popup" },
      { value: "tooltip", label: "Tooltip" },
    ],
  },
]

// ─── Gallery Items ─────────────────────────────────────────────────────────
//
// ★ ADD YOUR IMAGES HERE ★
//
// Each image needs:
//   - A unique id
//   - A url (can be an imported image or a URL string)
//   - A descriptive name
//   - An array of tags that match the filter option values above
//   - Include "default" in tags to show the image when no filters are active
//
// Example:
//   {
//     id: "1",
//     url: "/images/my-knight.png",       // or import and use variable
//     name: "Dark Knight",
//     tags: ["default", "character", "knight", "fantasy", "medieval", "human", "heavy-armor"],
//     type: "image",
//   },
//

export const DISCOVER_GALLERY: DiscoverItem[] = [

  {
    id: "1",
    url: "/images/discover/noble-men1.jpg",
    name: "Example Character",
    tags: ["default", "character", "noblemen", "fantasy", "european", "human"],
    type: "image",
  },
  {
    id: "2",
    url: "/images/discover/archer-eu-medival1.jpg",
    name: "Example Character",
    tags: ["default", "character", "archer", "medival", "european", "human"],
    type: "image",
  },

  {
    id: "3",
    url: "/images/discover/archer-as1.jpg",
    name: "Example Character",
    tags: ["default", "character", "archer", "medival", "asian", "human"],
    type: "image",
  },

  {
    id: "4",
    url: "/images/discover/wizard-eu-med1.jpg",
    name: "Example Character",
    tags: ["default", "character", "wizard", "medival", "european", "human"],
    type: "image",
  },

  {
    id: "5",
    url: "/images/discover/knight-med-dark-demon.jpg",
    name: "Example Character",
    tags: ["default", "character", "knight", "medival", "european", "demon"],
    type: "image",
  },
  {
    id: "6",
    url: "/images/discover/knight-med-as.jpg",
    name: "Example Character",
    tags: ["default", "character", "knight", "medival", "asian", "human"],
    type: "image",
  },
  {
    id: "7",
    url: "/images/discover/bone-spear1.jpg",
    name: "Example Character",
    tags: ["default", "character", "weapon", "olden", "tribal", "spear"],
    type: "image",
  },
  {
    id: "8",
    url: "/images/discover/ronin1.jpg",
    name: "Example Character",
    tags: ["default", "character", "ronin", "medival", "asian", "human"],
    type: "image",
  },
  {
    id: "9",
    url: "/images/discover/beat-tiger1.jpg",
    name: "Example Character",
    tags: ["default", "character", "animals", "beast", "medival", "asian", "tiger"],
    type: "image",
  },
  {
    id: "10",
    url: "/images/discover/swordsmen-as-med1.jpg",
    name: "Example Character",
    tags: ["default", "character", "knight", "medival", "asian", "demon"],
    type: "image",
  },
  {
    id: "11",
    url: "/images/discover/knight-med-eu2.jpg",
    name: "Example Character",
    tags: ["default", "character", "knight", "medival", "european", "human"],
    type: "image",
  },
  {
    id: "12",
    url: "/images/discover/creature-demon-knight1.jpg",
    name: "Example Character",
    tags: ["default", "character", "knight", "medival", "demon", "creature"],
    type: "image",
  },




]
