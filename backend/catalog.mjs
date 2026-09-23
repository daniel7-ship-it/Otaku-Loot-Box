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
  [19, { name: "Jujutsu Kaisen Geto Bear 6-inch Plush", amount: 2000, origin: "https://tohoanimationstore.us/products/jujutsu-kaisen-geto-bear-6-plush" }],
  [20, { name: "Jujutsu Kaisen Megumi Divine Dogs Black Hound Plush", amount: 2500, origin: "https://tohoanimationstore.us/products/jujutsu-kaisen-megumi-divine-dogs-black-hound-8-plush" }],
  [21, { name: "Jujutsu Kaisen Shibuya Incident 5-Piece Pin Set", amount: 1500, origin: "https://tohoanimationstore.us/products/jujutsu-kaisen-shibuya-incident-5-piece-pin-set" }],
  [22, { name: "Jujutsu Kaisen Shibuya Incident 5-Piece Acrylic Keychain Set", amount: 2000, origin: "https://tohoanimationstore.us/products/jujutsu-kaisen-shibuya-incident-5-piece-acrylic-keychain-set" }],
  [23, { name: "SPY x FAMILY 4-Piece Pin Set", amount: 1200, origin: "https://tohoanimationstore.us/products/spy-x-family-4-piece-pin-set" }],
  [24, { name: "Frieren: Beyond Journey's End Fuwa Petit Plush", amount: 2000, origin: "https://tohoanimationstore.us/products/frieren-beyond-journeys-end-frieren-fuwa-petit-plush" }],
  [25, { name: "My Hero Academia Izuku Midoriya Post-Final War Figure", amount: 2299, origin: "https://tohoanimationstore.us/products/my-hero-academia-izuku-midoriya-post-final-war-figure" }],
  [26, { name: "Batman Mask Light", amount: 3795, origin: "https://shop.dc.com/products/batman-mask-light" }],
  [27, { name: "Superman: The Movie (1978) McFarlane DC Multiverse Deluxe Figure", amount: 3499, origin: "https://shop.dc.com/products/superman-the-movie-1978-mcfarlane-toys-dc-multiverse-deluxe-theatrical-edition-superman-action-figure" }],
  [28, { name: "Marvel Legends Secret Wars Constrictor", amount: 2799, origin: "https://www.hasbropulse.com/product/marvel-legends-series-secret-wars-constrictor/G24155X01" }],
  [29, { name: "Marvel Legends Avengers Iron Spider (Aaron Davis)", amount: 3499, origin: "https://www.hasbropulse.com/product/marvel-legends-series-avengers-iron-spider-aaron-davis/G20885L00" }],
  [30, { name: "Marvel Legends Spider-Gwen (Across the Spider-Verse)", amount: 2499, origin: "https://www.hasbropulse.com/product/marvel-legends-series-spider-gwen-action-figure/F91755X00.html" }],
  [31, { name: "Marvel Legends Ultimate Miles Morales Spider-Man", amount: 2499, origin: "https://www.hasbropulse.com/product/marvel-legends-series-ultimate-miles-morales-spiderman/G15915X00" }],
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
