// Authoritative prices in USD cents, matching the storefront catalog.
// Browser-supplied prices, names, currencies, and URLs are never trusted.
const storefrontCatalog = new Map([
  [11, { name: "Giyu Tomioka Battle Version Figure", amount: 6720, origin: "https://www.etsy.com/listing/4539791730/anime-demon-slayer-tomioka-giyuu-battle" }],
  [10, { name: "Toji Fushiguro", amount: 5818, origin: "https://www.etsy.com/listing/4505075964/jujutsu-kaisen-toji-fushiguro-figure" }],
  [12, { name: "Anime Embroidered Keychain Jet Tag", amount: 1789, origin: "https://www.etsy.com/listing/1821496421/anime-keychain-embroidered-jet-tag" }],
  [13, { name: "Kurapika Judgment Chain Necklace", amount: 560, origin: "https://www.etsy.com/listing/4485445200/kurapiksa-judgment-chain-necklace-anime" }],
  [14, { name: "Valorant Champions Karambit", amount: 2999, origin: "https://www.etsy.com/listing/4328087767/metal-handmade-valorant-champions" }],
  [15, { name: "Re:Zero Rem & Emilia Figure", amount: 6990, origin: "https://www.etsy.com/listing/4338527511/rezero-starting-life-in-another-world" }],
  [16, { name: "Gojo & Geto Sitting Figures", amount: 3555, origin: "https://www.etsy.com/listing/4563978230/gojo-satoru-suguru-geto-sitting-figures" }],
  [17, { name: "Pirate Crew Plushies", amount: 3699, origin: "https://www.etsy.com/listing/4544915599/pirate-anime-plushies" }],
  [18, { name: "Power Sitting Plush", amount: 2499, origin: "https://www.temu.com/-power-casual-outfit-1-sitting--plush-7-h-g-603070406709704.html" }],
]);

// Legacy IDs remain resolvable for old orders and test fixtures, but are not
// part of the storefront catalog or available to new customer checkouts.
const legacyCatalog = new Map([
  [1, { name: "One Piece", amount: 1199 }], [2, { name: "Jujutsu Kaisen", amount: 1199 }],
  [3, { name: "Satoru Gojo", amount: 3499 }], [4, { name: "Demon Slayer", amount: 1199 }],
  [5, { name: "The Amazing Spider-Man", amount: 599 }], [6, { name: "Monkey D. Luffy", amount: 3999 }],
  [7, { name: "Chainsaw Man", amount: 1199 }], [8, { name: "Batman", amount: 599 }],
  [9, { name: "Acrylic Display Case", amount: 1999 }],
]);

export const catalog = {
  size: storefrontCatalog.size,
  get(id) { return storefrontCatalog.get(id) || legacyCatalog.get(id); },
  has(id) { return storefrontCatalog.has(id) || legacyCatalog.has(id); },
};
