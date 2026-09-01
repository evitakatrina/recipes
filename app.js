(() => {
  "use strict";

  const STORAGE_KEYS = {
    pantry: "sift_pantry_v1",
    checked: "sift_checked_v1",
    openShelves: "sift_open_shelves_v1",
  };

  const CARD_W = 150, CARD_GAP = 14, REEL_STEP = CARD_W + CARD_GAP;

  let RECIPES = [];
  let pantry = new Set(loadJSON(STORAGE_KEYS.pantry, []));
  let checkedByRecipe = loadJSON(STORAGE_KEYS.checked, {});
  let openShelves = new Set(loadJSON(STORAGE_KEYS.openShelves, []));
  let currentSheetRecipe = null;
  let wheelSpinning = false;
  let lastFocused = null;

  const $ = id => document.getElementById(id);
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  const savePantry = () => save(STORAGE_KEYS.pantry, [...pantry]);
  const saveChecked = () => save(STORAGE_KEYS.checked, checkedByRecipe);

  function announce(msg) { $("liveRegion").textContent = msg; }

  // ---------- Matching ----------
  // Ingredients with key === null (water, dairy garnishes, serving suggestions)
  // stay in the list but never count toward the match or the shopping list.
  const trackable = recipe => recipe.ingredients.filter(i => i.key);

  function matchStats(recipe) {
    if (!recipe.ingredientsVerified || !recipe.ingredients.length) {
      return { have: 0, total: 0, pct: null };
    }
    const items = trackable(recipe);
    if (!items.length) return { have: 0, total: 0, pct: null };
    const have = items.filter(i => pantry.has(i.key)).length;
    return { have, total: items.length, pct: Math.round((have / items.length) * 100) };
  }

  // ---------- Dietary facts ----------
  // Most dfNotes just reassure ("Naturally vegan/dairy-free"). Those become
  // quiet capsules. Only a note that asks the cook to do something becomes a
  // line of guidance, and only a real "not GF as written" gets the accent.
  function dietTags(recipe) {
    const n = (recipe.dfNote || "").toLowerCase();
    const tags = [];
    if (!/not gluten-free/.test(n)) tags.push("Gluten-free");
    tags.push("Dairy-free");
    if (/\bvegan\b/.test(n)) tags.push("Vegan");
    if (/\bpaleo\b/.test(n)) tags.push("Paleo");
    if (/nut-free/.test(n)) tags.push("Nut-free");
    if (/oil-free/.test(n)) tags.push("Oil-free");
    return tags;
  }

  const ACTION = /\b(skip|use|swap|leave out|replace|top with|make it with|not gluten-free)\b/i;

  function dietNote(recipe) {
    const note = recipe.dfNote || "";
    if (!note) return null;
    const parts = note.split(/;\s*|\s+-\s+/).map(x => x.trim()).filter(Boolean);
    const actionable = parts.filter(x => ACTION.test(x));
    if (!actionable.length) return null;
    const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
    const text = actionable
      .map(x => cap(x.replace(/[.\s]+$/, "")))
      .join(". ") + ".";
    return { text, warning: /not gluten-free/i.test(note) };
  }

  // ---------- Init ----------
  async function init() {
    $("todayLabel").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric",
    });

    setupNav();
    setupSheet();

    try {
      // Reuse the ?v= stamped on this script tag so the data file can never be
      // served from cache while the code that reads it is fresh.
      const tag = document.querySelector('script[src^="app.js"]');
      const ver = (tag && tag.src.split("?v=")[1]) || "";
      const res = await fetch("recipes.json" + (ver ? "?v=" + ver : ""));
      if (!res.ok) throw new Error("HTTP " + res.status);
      RECIPES = await res.json();
      if (!Array.isArray(RECIPES) || !RECIPES.length) throw new Error("No recipes in file");
    } catch (err) {
      showLoadError(err);
      return;
    }

    $("todaySkeleton").hidden = true;
    $("todayContent").hidden = false;

    renderToday();
    renderBrowse();
    renderPantry();
    setupWheel();

    $("startPantryBtn").addEventListener("click", () => switchTo("pantry"));
    $("pantryActionBtn").addEventListener("click", () => {
      renderBrowse("Ready to cook");
      switchTo("browse");
    });
  }

  function showLoadError(err) {
    const offline = !navigator.onLine;
    const isFile = location.protocol === "file:";
    $("todaySkeleton").innerHTML =
      '<div class="error-box">' +
        "<h2>Recipes didn't load</h2>" +
        "<p>" + (
          isFile
            ? "Sift needs to be served over http, not opened straight from a folder. Run a local server in this folder, or open the deployed URL."
            : offline
              ? "You appear to be offline. Reconnect and try again."
              : "Something went wrong fetching recipes.json (" + err.message + ")."
        ) + "</p>" +
        '<button class="btn btn-primary" type="button" id="retryBtn">Try again</button>' +
      "</div>";
    $("retryBtn").addEventListener("click", () => location.reload());
    announce("Recipes failed to load.");
  }

  // ---------- Navigation ----------
  let switchTo = () => {};
  function setupNav() {
    const tabs = [...document.querySelectorAll(".tab")];
    switchTo = function (view) {
      document.querySelectorAll(".view").forEach(v => { v.hidden = true; });
      $("view-" + view).hidden = false;
      tabs.forEach(t => {
        const on = t.dataset.view === view;
        if (on) t.setAttribute("aria-current", "page");
        else t.removeAttribute("aria-current");
      });
      window.scrollTo({ top: 0, behavior: "instant" });
      $("pantryAction").classList.toggle("show", view === "pantry" && pantry.size > 0);
    };
    tabs.forEach(t => t.addEventListener("click", () => switchTo(t.dataset.view)));
  }

  // ---------- Cards ----------
  function recipeCard(r, subtitle, isMatch) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "card";
    const img = document.createElement("img");
    img.className = "card-img";
    img.src = r.image;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      const ph = document.createElement("span");
      ph.className = "card-fallback";
      ph.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 10.8h16.8a8.4 8.4 0 01-16.8 0z"/><path d="M12 3.6c1.8 1.1 1.8 2.9 0 4"/></svg>';
      img.replaceWith(ph);
    }, { once: true });
    const body = document.createElement("div");
    body.className = "card-body";
    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = r.name;
    const sub = document.createElement("div");
    sub.className = "card-sub" + (isMatch ? " is-match" : "");
    sub.textContent = subtitle;
    body.append(name, sub);
    el.append(img, body);
    el.addEventListener("click", () => openSheet(r, el));
    return el;
  }

  // ---------- Today ----------
  // The hero renders ~620pt wide, so it needs a ~1240px image to stay sharp.
  // Small photos are fine on a 168pt card but not here - pick only from the
  // wide ones, and fall back to the whole set if none qualify.
  function recipeOfTheDay() {
    const d = new Date();
    const seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
    const sharp = RECIPES.filter(r => (r.imgW || 0) >= 1000);
    const pool = sharp.length ? sharp : RECIPES;
    return pool[seed % pool.length];
  }

  function renderToday() {
    $("startCard").hidden = pantry.size > 0;
    const r = recipeOfTheDay();
    $("heroImg").src = r.image;
    $("heroImg").alt = r.name;
    $("heroName").textContent = r.name;
    $("heroMeta").textContent = [r.category, r.cuisine, r.source].join(" · ");
    $("heroCard").onclick = () => openSheet(r, $("heroCard"));

    const hm = matchStats(r);
    const heroMatch = $("heroMatch");
    if (hm.pct !== null && pantry.size) {
      heroMatch.hidden = false;
      heroMatch.textContent = hm.pct === 100
        ? "You have everything"
        : hm.have + " of " + hm.total + " ingredients in your pantry";
    } else {
      heroMatch.hidden = true;
    }

    // "Ready to cook" — best pantry matches
    const scored = RECIPES
      .map(x => ({ r: x, m: matchStats(x) }))
      .filter(x => x.m.pct !== null && x.m.pct >= 50)
      .sort((a, b) => b.m.pct - a.m.pct || a.r.name.localeCompare(b.r.name))
      .slice(0, 12);

    const wrap = $("readyWrap");
    wrap.innerHTML = "";
    $("readyCount").textContent = pantry.size ? scored.length + " recipes" : "";

    if (!pantry.size) {
      wrap.innerHTML = '<p class="empty">Tell Sift what\'s in your <b>Pantry</b> and the recipes you can cook right now show up here.</p>';
    } else if (!scored.length) {
      wrap.innerHTML = '<p class="empty">Nothing above a 50% match yet. Add a few more staples in <b>Pantry</b>.</p>';
    } else {
      const rail = document.createElement("div");
      rail.className = "rail";
      scored.forEach(({ r: x, m }) => rail.appendChild(recipeCard(x, m.pct + "% match", true)));
      wrap.appendChild(rail);
    }

    // Drifting marquee of the whole catalogue. Track is duplicated so the
    // -50% keyframe loops seamlessly.
    const track = $("marqueeTrack");
    track.innerHTML = "";
    const shuffled = [...RECIPES].sort(() => Math.random() - 0.5);
    $("allCount").textContent = RECIPES.length + " recipes";
    [...shuffled, ...shuffled].forEach(x => track.appendChild(recipeCard(x, x.cuisine || x.meals[0], false)));
    // duplicated cards are decorative for assistive tech
    [...track.children].slice(shuffled.length).forEach(c => c.setAttribute("aria-hidden", "true"));
    if (reduceMotion()) track.style.animation = "none";
  }

  // ---------- Browse ----------
  let browseScope = "All";                 // "Ready" | "All" | a category
  function renderBrowse(scope) {
    if (scope) browseScope = scope;
    const categories = ["Ready to cook", "All", ...new Set(RECIPES.map(r => r.category))];
    const filterRow = $("categoryFilters");
    const grid = $("browseGrid");
    filterRow.innerHTML = "";

    function listFor(cat) {
      if (cat === "Ready to cook") {
        return RECIPES
          .map(r => ({ r, m: matchStats(r) }))
          .filter(x => x.m.pct !== null && x.m.pct >= 50)
          .sort((a, b) => b.m.pct - a.m.pct || a.r.name.localeCompare(b.r.name))
          .map(x => x.r);
      }
      return cat === "All" ? RECIPES : RECIPES.filter(r => r.category === cat);
    }

    function draw() {
      grid.innerHTML = "";
      const list = listFor(browseScope);
      if (!list.length) {
        grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Nothing reaches a 50% match yet. Add a few more staples in <b>Pantry</b>.</p>';
        announce("No recipes ready to cook yet");
        return;
      }
      list.forEach(r => {
        const m = matchStats(r);
        const showMatch = pantry.size && m.pct !== null && m.pct >= 50;
        grid.appendChild(recipeCard(r, showMatch ? m.pct + "% match" : (r.cuisine || r.meals[0]), showMatch));
      });
      announce(list.length + " recipes in " + browseScope);
    }

    categories.forEach(cat => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = cat;
      chip.setAttribute("aria-selected", cat === browseScope ? "true" : "false");
      chip.addEventListener("click", () => {
        browseScope = cat;
        [...filterRow.children].forEach(c =>
          c.setAttribute("aria-selected", c === chip ? "true" : "false"));
        draw();
      });
      filterRow.appendChild(chip);
    });
    draw();
  }

  // ---------- Pantry ----------
  const PANTRY_GROUPS = {
    "Produce & aromatics": ["garlic", "onion", "lemon", "tomato", "lime", "parsley", "cilantro", "oregano", "bell pepper", "carrot", "potatoes", "scallions", "ginger", "kale or spinach", "avocado", "orange", "thyme", "cauliflower", "dill", "sweet potato", "shallot", "basil", "bay leaf", "celery", "rosemary", "cabbage", "cucumber", "apple", "jalapeno", "mint", "mushrooms", "butternut squash", "green beans", "mango", "banana", "green chilies", "zucchini", "broccoli", "chives", "mixed berries", "beets", "chipotle in adobo", "leek", "brussels sprouts", "corn", "pineapple", "pomegranate", "radish", "romaine", "serrano pepper", "strawberries", "artichoke", "blueberries", "eggplant", "lettuce", "sage", "watermelon", "apricots", "asparagus", "chard", "cherries", "cranberries", "fennel", "papaya", "plantain", "pumpkin", "cantaloupe", "jicama", "marjoram", "okra", "parsnips", "peach", "snap peas", "tarragon"],
    "Spices & seasoning": ["salt", "black pepper", "cumin", "paprika", "garlic powder", "chili flakes", "salt & pepper", "cinnamon", "chili powder", "coriander", "onion powder", "turmeric", "cayenne", "italian seasoning", "sumac", "chipotle powder", "curry powder", "allspice", "cardamom", "garam masala", "nutmeg", "saffron", "fajita seasoning", "ras el hanout", "baharat", "cloves", "cumin seeds", "zaatar"],
    "Oils, vinegars & sauces": ["olive oil", "neutral oil", "red wine vinegar", "coconut oil", "dijon mustard", "maple syrup", "gf tamari", "vanilla", "honey", "mayonnaise", "sesame oil", "fish sauce", "rice vinegar", "hot sauce", "pickles", "capers", "salsa", "balsamic vinegar", "harissa", "ketchup", "white vinegar", "agave", "barbecue sauce", "ginger paste", "hummus", "pico de gallo", "red curry paste", "red pepper paste", "sriracha", "tzatziki", "vegetable oil", "yellow mustard"],
    "Cans, broths & grains": ["coconut milk", "vegetable broth", "rice", "tomato paste", "chicken broth", "olives", "canned tomatoes", "quinoa", "bone broth", "tomato sauce", "corn tortillas", "rolled oats", "beef broth", "coconut cream", "coconut water", "roasted red peppers", "gf cookies", "sun-dried tomatoes"],
    "Nuts, seeds & baking": ["brown sugar", "nutritional yeast", "almonds", "medjool dates", "walnuts", "cocoa powder", "sesame seeds", "tahini", "cashews", "sugar", "dairy-free chocolate chips", "hazelnuts", "coconut flakes", "peanut butter", "almond butter", "arrowroot starch", "dried fruit", "pumpkin seeds", "dark chocolate", "chia seeds", "flaxseed meal", "pecans", "almond flour", "cornstarch", "sweetener", "tapioca starch", "baking powder", "baking soda", "coconut butter", "gelatin", "hemp seeds", "shredded coconut", "cacao nibs", "cashew butter", "chickpea flour", "erythritol", "mixed nuts", "peanuts", "pine nuts", "sunflower seeds"],
    "Proteins & dairy-free": ["eggs", "beef", "chicken thighs", "chickpeas", "pork", "chicken breast", "black beans", "salmon", "bacon", "chicken", "sausage", "almond milk", "tofu", "cod", "lentils", "cannellini beans", "chicken wings", "lamb", "shrimp", "turkey", "kidney beans", "anchovies", "clams", "edamame", "fava beans", "pinto beans", "red lentils", "tuna", "white fish"]
  };

  const TICK = '<span class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  function readyCount() {
    return RECIPES.filter(r => { const m = matchStats(r); return m.pct !== null && m.pct >= 50; }).length;
  }

  function updatePantryCount() {
    const total = Object.values(PANTRY_GROUPS).flat().length;
    $("pantryCount").textContent = pantry.size + " of " + total;

    // The payoff sits with the chips that produce it, so the cause and the
    // effect are never separated by a tab switch.
    const bar = $("pantryAction");
    const btn = $("pantryActionBtn");
    const n = readyCount();
    if (pantry.size === 0) {
      bar.classList.remove("show");
    } else {
      btn.textContent = n === 0
        ? "Keep going — no matches yet"
        : "Show " + n + (n === 1 ? " recipe" : " recipes") + " I can cook \u2192";
      btn.disabled = n === 0;
      bar.classList.toggle("show", !$("view-pantry").hidden);
    }
  }

  function renderPantry() {
    const container = $("pantryGroups");
    container.innerHTML = "";

    Object.entries(PANTRY_GROUPS).forEach(([group, items]) => {
      const wrap = document.createElement("section");
      wrap.className = "pantry-group";

      const title = document.createElement("button");
      title.type = "button";
      title.className = "group-title";
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = group;
      const count = document.createElement("span");
      count.className = "group-count";
      const chev = document.createElement("span");
      chev.className = "group-chevron";
      chev.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
      title.append(label, count, chev);

      const shelf = document.createElement("div");
      shelf.className = "shelf";

      const open = openShelves.has(group);
      shelf.classList.toggle("open", open);
      title.setAttribute("aria-expanded", open ? "true" : "false");
      title.addEventListener("click", () => {
        const now = !shelf.classList.contains("open");
        shelf.classList.toggle("open", now);
        title.setAttribute("aria-expanded", now ? "true" : "false");
        if (now) openShelves.add(group); else openShelves.delete(group);
        save(STORAGE_KEYS.openShelves, [...openShelves]);
        announce(group + (now ? " expanded" : " collapsed"));
      });

      items.forEach(item => {
        const g = SIFT_ICONS.glyph(item);
        const jar = document.createElement("button");
        jar.type = "button";
        jar.className = "jar";
        jar.dataset.item = item;
        jar.setAttribute("aria-pressed", pantry.has(item) ? "true" : "false");

        const thumb = document.createElement("span");
        thumb.className = "jar-thumb" + (g.t ? " t" + g.t : "");
        thumb.style.setProperty("--h", g.h + "deg");
        thumb.style.setProperty("--s", g.s + "%");
        thumb.innerHTML = g.svg +
          '<span class="jar-tick"><svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

        // If a photo exists for this ingredient it covers the glyph; if the file
        // is missing the drawn glyph simply stays. No manifest to keep in sync.
        const photo = new Image();
        photo.className = "jar-photo";
        photo.alt = "";
        photo.loading = "lazy";
        photo.decoding = "async";
        photo.addEventListener("load", () => thumb.classList.add("has-photo"), { once: true });
        photo.addEventListener("error", () => photo.remove(), { once: true });
        photo.src = SIFT_ICONS.photoPath(item);
        thumb.insertBefore(photo, thumb.firstChild);

        const name = document.createElement("span");
        name.className = "jar-label";
        name.textContent = item;

        jar.append(thumb, name);
        jar.addEventListener("click", () => {
          const now = !pantry.has(item);
          if (now) pantry.add(item); else pantry.delete(item);
          savePantry();
          jar.setAttribute("aria-pressed", now ? "true" : "false");
          updateShelfCounts();
          updatePantryCount();
          renderToday();
          renderBrowse();
          announce(readyCount() + " recipes you can cook");
        });
        shelf.appendChild(jar);
      });

      wrap.append(title, shelf);
      container.appendChild(wrap);
    });

    updateShelfCounts();
    updatePantryCount();

    $("pantrySearch").addEventListener("input", e => {
      const q = e.target.value.trim().toLowerCase();
      let shown = 0;
      container.querySelectorAll(".pantry-group").forEach(g => {
        let any = false;
        g.querySelectorAll(".jar").forEach(j => {
          const hit = !q || j.dataset.item.includes(q);
          j.hidden = !hit;
          if (hit) { any = true; shown++; }
        });
        g.hidden = !any;
      });
      $("pantryEmpty").hidden = shown > 0;
      updateShelfCounts();
    });
  }

  // "3 of 34" per shelf, so a collapsed horizontal rail still reports itself
  function updateShelfCounts() {
    document.querySelectorAll("#pantryGroups .pantry-group").forEach(g => {
      const jars = [...g.querySelectorAll(".jar")].filter(j => !j.hidden);
      const on = jars.filter(j => j.getAttribute("aria-pressed") === "true").length;
      const el = g.querySelector(".group-count");
      el.textContent = on ? on + " of " + jars.length : jars.length;
      el.classList.toggle("has", on > 0);
    });
  }

  // ---------- Spin: a fanned deck ----------
  // Seven slots held in an arc. Spinning riffles the fan while the faces
  // cycle, then the winning slot rises out and squares up.
  const DECK_SLOTS = 7;

  // Meal times map onto recipe categories. Lunch on its own holds a single
  // recipe, so soups, sides and snacks join it; soup also counts for dinner.
  // A meal is a filter, not a partition - overlap is intentional.
  // Recipes carry a meals[] array - many dishes are equally lunch or dinner,
  // so a meal is membership, not a single bucket.
  const MEALS = [
    { label: "Anything",  m: null },
    { label: "Lunch",     m: "Lunch" },
    { label: "Dinner",    m: "Dinner" },
    { label: "Side",      m: "Side" },
    { label: "Snack",     m: "Snack" },
    { label: "Dessert",   m: "Dessert" },
    { label: "Breakfast", m: "Breakfast" },
  ];

  function setupWheel() {
    const deck = $("deck");
    const caption = $("deckCaption");
    let meal = MEALS[0];
    let pantryOnly = false;
    let pool = RECIPES;
    let slots = [];
    let spinning = false;
    let cycle = null;

    const restAngle = i => (i - (DECK_SLOTS - 1) / 2) * 11;
    const restLift = i => Math.abs(i - (DECK_SLOTS - 1) / 2) * 5;

    function buildDeck() {
      deck.innerHTML = "";
      slots = [];
      for (let i = 0; i < DECK_SLOTS; i++) {
        const el = document.createElement("div");
        el.className = "deck-card" + (i === (DECK_SLOTS - 1) / 2 ? " is-front" : "");
        el.style.setProperty("--a", restAngle(i) + "deg");
        el.style.setProperty("--y", restLift(i) + "px");
        el.style.zIndex = String(10 - Math.abs(i - (DECK_SLOTS - 1) / 2));
        const img = document.createElement("img");
        img.alt = ""; img.loading = "lazy";
        const name = document.createElement("span");
        name.className = "deck-name";
        el.append(img, name);
        deck.appendChild(el);
        slots.push({ el, img, name });
      }
      deck.setAttribute("aria-hidden", "true");
      dealFaces();
    }

    function faceFor(slot, r) {
      slot.img.src = r.image;
      slot.name.textContent = r.name;
      slot.el.dataset.id = r.id;
    }
    function dealFaces() {
      for (let i = 0; i < DECK_SLOTS; i++) faceFor(slots[i], pool[Math.floor(Math.random() * pool.length)]);
    }

    function resetFan() {
      deck.classList.remove("settled");
      slots.forEach((s, i) => {
        s.el.classList.remove("is-winner");
        s.el.classList.toggle("is-front", i === (DECK_SLOTS - 1) / 2);
        s.el.style.setProperty("--a", restAngle(i) + "deg");
        s.el.style.setProperty("--y", restLift(i) + "px");
      });
    }

    function baseFor(meal) {
      return meal.m ? RECIPES.filter(r => (r.meals || [r.category]).includes(meal.m)) : RECIPES;
    }

    function recomputePool() {
      let next = baseFor(meal);
      if (pantryOnly) {
        const matched = next.filter(r => { const st = matchStats(r); return st.pct !== null && st.pct >= 50; });
        if (matched.length) next = matched;
        else {
          $("pantryOnlyToggle").checked = pantryOnly = false;
          announce("No " + meal.label.toLowerCase() + " recipes match your pantry yet, showing all.");
        }
      }
      pool = next;
      dealFaces();
      updateHint();
    }

    function updateHint() {
      const scope = meal.cats ? meal.label.toLowerCase() + " recipes" : "recipes";
      $("spinHint").textContent = "Deals from " + pool.length + " " + scope +
        (pantryOnly ? " you can mostly make" : "") + ". Tap again to stop it early.";
    }

    function buildMealRow() {
      const row = $("mealRow");
      row.innerHTML = "";
      MEALS.forEach(m => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.setAttribute("aria-selected", m === meal ? "true" : "false");
        const label = document.createElement("span");
        label.textContent = m.label;
        const n = document.createElement("span");
        n.className = "n";
        n.textContent = baseFor(m).length;
        chip.append(label, n);
        chip.addEventListener("click", () => {
          meal = m;
          [...row.children].forEach(c => c.setAttribute("aria-selected", c === chip ? "true" : "false"));
          resetFan();
          caption.className = "deck-caption";
          caption.textContent = "Tap spin to deal a recipe";
          $("spinBtn").textContent = "Spin";
          recomputePool();
          announce(pool.length + " " + m.label.toLowerCase() + " recipes to spin");
        });
        row.appendChild(chip);
      });
    }

    function finish(chosen, mid) {
      clearInterval(cycle);
      spinning = false;
      deck.classList.remove("spinning");
      deck.classList.add("settled");
      resetFanAngles();
      faceFor(slots[mid], chosen);
      slots.forEach(s => s.el.classList.remove("is-front"));
      slots[mid].el.classList.add("is-winner");
      // the winning card already carries the name - repeating it above the fan
      // was the same string twice on one screen
      caption.className = "deck-caption is-result";
      $("spinBtn").textContent = "Spin again";
      announce("Spin landed on " + chosen.name);
      setTimeout(() => { if (!spinning) openSheet(chosen, $("spinBtn")); }, 620);
    }
    function resetFanAngles() {
      slots.forEach((s, i) => {
        s.el.style.setProperty("--a", restAngle(i) + "deg");
        s.el.style.setProperty("--y", restLift(i) + "px");
      });
    }

    $("spinBtn").addEventListener("click", () => {
      const mid = (DECK_SLOTS - 1) / 2;
      const chosen = pool[Math.floor(Math.random() * pool.length)];

      if (spinning) { finish(chosen, mid); return; }   // second tap stops it

      if (reduceMotion()) { finish(chosen, mid); return; }

      spinning = true;
      resetFan();
      caption.className = "deck-caption";
      caption.textContent = "Dealing\u2026";
      deck.classList.add("spinning");

      // riffle: jitter every card's angle and swap faces on a short interval
      cycle = setInterval(() => {
        slots.forEach((s, i) => {
          s.el.style.setProperty("--a", (restAngle(i) + (Math.random() * 26 - 13)) + "deg");
          s.el.style.setProperty("--y", (restLift(i) + (Math.random() * 22 - 11)) + "px");
          faceFor(s, pool[Math.floor(Math.random() * pool.length)]);
        });
      }, 150);

      announce("Spinning");
      setTimeout(() => { if (spinning) finish(chosen, mid); }, 1500);
    });

    $("pantryOnlyToggle").addEventListener("change", e => {
      pantryOnly = e.target.checked;
      recomputePool();
    });

    buildMealRow();
    buildDeck();
    updateHint();
  }

  // ---------- Sheet ----------
  function setupSheet() {
    $("closeSheetBtn").addEventListener("click", closeSheet);

    // collapse the photo into a compact title bar on scroll
    const scroller = $("sheetScroll");
    const img = $("sheetImg");
    scroller.addEventListener("scroll", () => {
      const y = scroller.scrollTop;
      const h = img.offsetHeight || 1;
      $("sheetBar").classList.toggle("show", y > h - 72);
      // gentle parallax while the photo is still on screen
      img.style.transform = y < h ? "translateY(" + (y * 0.34) + "px)" : "translateY(" + (h * 0.34) + "px)";
    }, { passive: true });
    $("sheetScrim").addEventListener("click", e => {
      if (e.target.id === "sheetScrim") closeSheet();
    });
    $("calendarBtn").addEventListener("click", sendShoppingList);

    document.addEventListener("keydown", e => {
      if (!$("sheetScrim").classList.contains("open")) return;
      if (e.key === "Escape") { closeSheet(); return; }
      if (e.key === "Tab") trapFocus(e);
    });
  }

  function focusables() {
    return [...$("sheet").querySelectorAll('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null);
  }
  function trapFocus(e) {
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function refreshSheetFooter() {
    const r = currentSheetRecipe;
    if (!r) return;
    const btn = $("calendarBtn");
    const checked = new Set(checkedByRecipe[r.id] || []);
    const missing = trackable(r).filter(i => !checked.has(i.key) && !pantry.has(i.key));
    if (!missing.length) {
      btn.disabled = true;
      btn.querySelector("#calendarBtnLabel").textContent = "You have everything";
    } else {
      btn.disabled = false;
      btn.querySelector("#calendarBtnLabel").textContent = "Add " + missing.length + " to my list";
    }
  }

  function openSheet(recipe, opener) {
    currentSheetRecipe = recipe;
    lastFocused = opener || document.activeElement;

    $("sheetImg").src = recipe.image;
    $("sheetImg").alt = recipe.name;
    $("sheetSource").textContent = recipe.source + " · " + recipe.category + " · " + recipe.cuisine;
    $("sheetName").textContent = recipe.name;
    $("sheetBarTitle").textContent = recipe.name;
    $("sheetBar").classList.remove("show");
    $("sheetImg").style.transform = "";
    $("sheetMethod").textContent = recipe.method;
    $("sheetLink").href = recipe.url;
    $("sheetLinkSource").textContent = recipe.source;

    const tagRow = $("sheetTags");
    tagRow.innerHTML = "";
    dietTags(recipe).forEach(t => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = t;
      tagRow.appendChild(el);
    });

    const note = dietNote(recipe);
    const noteEl = $("sheetNote");
    if (note) {
      noteEl.hidden = false;
      noteEl.className = "recipe-note" + (note.warning ? " is-warning" : "");
      noteEl.innerHTML = note.warning
        ? '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 8.4v4.8"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8.8"/></svg><span></span>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.8"/><path d="M12 11.4v5"/><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none"/></svg><span></span>';
      noteEl.querySelector("span").textContent = note.text;
    } else {
      noteEl.hidden = true;
    }

    const list = $("ingredientList");
    list.innerHTML = "";
    const checked = new Set(checkedByRecipe[recipe.id] || []);
    const items = trackable(recipe);
    $("ingredientsCount").textContent = items.length + " to check";

    recipe.ingredients.forEach(ing => {
      const li = document.createElement("li");
      if (!ing.key) {
        li.className = "ing-item untracked";
        li.innerHTML = '<span class="ing-box"></span><span class="ing-text"></span>';
        li.querySelector(".ing-text").textContent = ing.text;
        list.appendChild(li);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ing-item";
      const on = checked.has(ing.key) || pantry.has(ing.key);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.innerHTML = '<span class="ing-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="ing-text"></span>';
      btn.querySelector(".ing-text").textContent = ing.text;
      btn.addEventListener("click", () => {
        const now = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", now ? "true" : "false");
        const set = new Set(checkedByRecipe[recipe.id] || []);
        if (now) set.add(ing.key); else set.delete(ing.key);
        checkedByRecipe[recipe.id] = [...set];
        saveChecked();
        refreshSheetFooter();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    refreshSheetFooter();
    $("sheetScrim").classList.add("open");
    $("sheet").querySelector(".sheet-scroll").scrollTop = 0;
    // the scrim goes visibility:hidden -> visible on this class change; wait for
    // the style flush before moving focus or the focus() call is dropped.
    // focus the dialog itself, not a control, so tapping does not leave a
    // focus ring on the close button; keyboard users still land inside.
    requestAnimationFrame(() => $("sheet").focus());
    announce(recipe.name + " opened");
  }

  function closeSheet() {
    $("sheetScrim").classList.remove("open");
    currentSheetRecipe = null;
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }

  // ---------- Shopping list ----------
  // On iPhone the native share sheet is the only route into Reminders and
  // Notes - neither app exposes a URL scheme a web page may call. Sharing
  // hands the list to the system and lets you pick Reminders, Notes,
  // Messages or anything else. Elsewhere we fall back to the clipboard.
  function shoppingList(r) {
    const checked = new Set(checkedByRecipe[r.id] || []);
    return trackable(r).filter(i => !checked.has(i.key) && !pantry.has(i.key));
  }

  function listText(r, missing) {
    return "Shopping list — " + r.name + "\n\n"
      + missing.map(m => "\u2022 " + m.text).join("\n")
      + "\n\n" + r.source + "\n" + r.url;
  }

  async function sendShoppingList() {
    const r = currentSheetRecipe;
    if (!r) return;
    const missing = shoppingList(r);
    if (!missing.length) return;

    const text = listText(r, missing);
    const btn = $("calendarBtn");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Shopping list — " + r.name, text });
        announce("Shopping list shared");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;   // user dismissed
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      const lbl = btn.querySelector("#calendarBtnLabel");
      const was = lbl.textContent;
      lbl.textContent = "Copied to clipboard";
      announce("Shopping list copied");
      setTimeout(() => { lbl.textContent = was; }, 2000);
    } catch (e) {
      announce("Could not share the list.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
