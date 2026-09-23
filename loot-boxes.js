(() => {
  "use strict";

  // Public preview only. This data is deliberately separate from the store's
  // purchasable catalog and can never be added to checkout.
  const boxes = [
    { id: "jujutsu-kaisen", name: "Jujutsu Kaisen", family: "Anime", accent: "#586b65", candidates: [
      "Satoru Gojo · Shibuya Incident pin", "Kento Nanami · Shibuya Incident pin", "Yuji Itadori · Shibuya Incident pin", "Nobara Kugisaki · Shibuya Incident pin", "Megumi Fushiguro · Shibuya Incident pin",
      "Satoru Gojo · Shibuya Incident acrylic keychain", "Kento Nanami · Shibuya Incident acrylic keychain", "Yuji Itadori · Shibuya Incident acrylic keychain", "Nobara Kugisaki · Shibuya Incident acrylic keychain", "Megumi Fushiguro · Shibuya Incident acrylic keychain"
    ] },
    { id: "naruto", name: "Naruto", family: "Anime", accent: "#b8733e", candidates: [
      "Naruto Uzumaki · NRZ06-SSR-151L3", "Zabuza Momochi · NRB07-UR-135L3", "Kakashi Hatake · NRB07-UR-134L3", "Chocho Akimichi · NRB07-SSR-176L3", "Sasuke Uchiha · NRB07-SSR-171L3",
      "Iruka · NRB07-SSR-170L3", "Naruto Uzumaki · NRB07-SSR-168L3", "Naruto Uzumaki · NRB07-SSR-167L3", "Naruto Uzumaki · NRB07-SSR-165L3", "Sasuke Uchiha · NRB07-SSR-164L3"
    ] },
    { id: "one-piece", name: "One Piece", family: "Anime", accent: "#517a83", candidates: [
      "Usopp · OP17-080 · near mint foil", "Yasopp · OP17-031 · near mint foil", "Gloriosa · OP17-046 · near mint foil", "Charlotte Pudding · OP17-109 · near mint foil", "Shanks · OP17-022 · near mint foil",
      "Don!! card · Rocks alternate art · near mint", "Yamato · OP17-074 · near mint foil", "Yamato · OP16-098 · near mint foil", "Nami · OP15-086 · near mint foil", "Vander Decken IX · OP06-033 · near mint foil"
    ] },
    { id: "bleach", name: "Bleach", family: "Anime", accent: "#725f86", note: "Some early card candidates are listed as lightly played; condition must be approved before any final lineup.", candidates: [
      "Uryu Ishida · Quincy Cross pin", "Quincy Cross · Bleach pin", "Renji Abarai · Union Arena card · lightly played", "Byakuya Kuchiki · Winner card · lightly played", "Ichigo Kurosaki · participation card · lightly played",
      "Byakuya Kuchiki · Union Arena card · lightly played", "Yachiru Kusajishi · Union Arena card · lightly played", "Genryusai Yamamoto · Union Arena card · lightly played", "Ichigo Kurosaki · Union Arena card · lightly played", "Toshiro Hitsugaya · Union Arena card · lightly played"
    ] },
    { id: "spy-x-family", name: "SPY x FAMILY", family: "Anime", accent: "#b77d69", candidates: [
      "Bond · winter pin", "Anya Forger · winter pin", "Yor Forger · winter pin", "Loid Forger · winter pin"
    ] },
    { id: "spider-man", name: "Spider-Man", family: "Marvel", accent: "#a84f49", candidates: [
      "Miles Morales: Spider-Man #37 · Peach Momoko variant", "Amazing Spider-Man #68.Deaths", "Amazing Spider-Man #58 · Chris Allen variant", "Miles Morales: Spider-Man #41 · Luigi Zagaria variant", "Amazing Spider-Man #63 · Rafael Albuquerque variant",
      "Radioactive Spider-Man #3 · Mike McKone variant", "Spider-Man Noir #5 · Erik Larsen variant", "Amazing Spider-Man #67 · Roge Antonio variant", "Radioactive Spider-Man #2", "Miles Morales: Spider-Man #35 · Logan Lubera variant"
    ] },
    { id: "avengers", name: "Avengers", family: "Marvel", accent: "#aa8148", candidates: [
      "Avengers Assemble #4", "Avengers #26", "Avengers #20 · Sergio Davila variant", "Avengers #21 · Matteo Lolli variant", "Avengers #22 · Todd Nauck variant",
      "West Coast Avengers #9 · Scott Godlewski variant", "Superior Avengers #2 · Iban Coello variant", "Uncanny Avengers #17", "West Coast Avengers #8 · Godtail variant", "Avengers #19 · Paco Medina variant"
    ] },
    { id: "batman", name: "Batman", family: "DC", accent: "#596b62", candidates: [
      "Batman #157 · Tony S. Daniel variant", "All Star Batman #11", "Batman / Superman Vol. 2 #21B", "Batman #114 · Jorge Molina variant", "Batman #109 · Joshua Middleton variant",
      "Batman Faze Clan #1 · Jason Badower variant", "Batman #162 · Gabriele Dell'Otto variant", "Batman and Robin #18", "Batman Superman: World's Finest #36", "Batman Superman: World's Finest #42"
    ] },
    { id: "dc-heroes", name: "DC Heroes", family: "DC", accent: "#557d86", candidates: [
      "The Terrifics #10", "Cyborg #14", "Supergirl #1 · Nicola Scott variant", "Teen Titans Go! #5", "Green Lantern #38 · Jessica Luna variant",
      "Secret Six #2", "Secret Six #5", "New History of the DC Universe #3", "Superman: Lex Luthor Special #1", "Justice League: The Atom Project #1"
    ] }
  ];

  const grid = document.getElementById("lootBoxGrid");
  const dialog = document.getElementById("lootBoxDialog");
  const title = document.getElementById("lootBoxDialogTitle");
  const content = document.getElementById("lootBoxDialogContent");
  const close = document.getElementById("lootBoxDialogClose");
  if (!grid || !dialog || !title || !content || !close) return;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  grid.innerHTML = boxes.map((box) => {
    const lineup = box.candidates.length;
    return `<article class="loot-box-card p-5 sm:p-6 flex flex-col min-h-[220px]">
      <div class="flex items-start justify-between gap-3"><span class="text-[10px] tracking-[.18em] font-bold text-[#7b8073]">${escapeHtml(box.family.toUpperCase())}</span><span aria-hidden="true" class="w-3 h-3 rounded-full mt-0.5" style="background:${box.accent}"></span></div>
      <h3 class="display text-3xl font-semibold mt-4">${escapeHtml(box.name)}</h3>
      <p class="text-xs text-[#727667] mt-2">${lineup ? `${lineup} preview ${lineup === 1 ? "item" : "items"} identified · lineup in progress` : "Selection in progress"}</p>
      <button type="button" class="loot-box-preview mt-auto self-start border border-[#344332] px-4 py-2.5 text-xs font-semibold hover:bg-[#344332] hover:text-white" data-box-id="${box.id}" aria-haspopup="dialog">Preview theme</button>
    </article>`;
  }).join("");

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-box-id]");
    if (!button) return;
    const box = boxes.find((entry) => entry.id === button.dataset.boxId);
    if (!box) return;
    title.textContent = `${box.name} Loot box`;
    const items = box.candidates.length
      ? `<h4 class="text-sm font-semibold">Preview candidates (${box.candidates.length} identified; 10 needed)</h4><ul class="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">${box.candidates.map((item) => `<li class="border-b border-[#e8e2d6] py-2">${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<div class="border border-dashed border-[#cfc5b2] p-5 text-sm"><p class="font-semibold">Selection in progress</p><p class="text-[#727667] mt-2">We’re checking suitable items and current US availability for this theme.</p></div>`;
    content.innerHTML = `<p class="text-sm leading-6 text-[#5d685e] mb-5">A proposed opening is $10 and awards one physical item. Openings are not available yet.</p>${items}${box.note ? `<p class="text-xs leading-5 text-[#727667] mt-5">${escapeHtml(box.note)}</p>` : ""}<p class="text-xs leading-5 text-[#727667] mt-5">Preview items are not reserved inventory. The final lineup may change as inventory is secured.</p>`;
    dialog.showModal();
  });

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
