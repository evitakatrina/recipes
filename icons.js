/* ============================================================
   Sift — ingredient glyph system
   Every ingredient draws from a small library of shared shapes.
   One 24x24 box, one 1.7 stroke, one 8-hue palette. Reuse is the
   point: a system of 30 shapes reads as designed, 139 bespoke
   drawings would not.
   ============================================================ */
(function (global) {
  "use strict";

  // --- 8 hues, identical saturation/lightness so nothing shouts ---
  const HUES = {
    green:  { h: 128, s: 30 },
    leaf:   { h: 96,  s: 34 },
    red:    { h: 8,   s: 46 },
    orange: { h: 26,  s: 52 },
    yellow: { h: 44,  s: 54 },
    brown:  { h: 22,  s: 30 },
    purple: { h: 288, s: 22 },
    stone:  { h: 30,  s: 12 },
  };

  const S = (d, extra) => '<path d="' + d + '"' + (extra || "") + "/>";
  const F = d => '<path d="' + d + '" fill="currentColor" stroke="none"/>';

  // --- shape library (outline, drawn on a 24x24 box) ---
  const SHAPES = {
    bulb:     S("M12 20.5c-3.4 0-5.6-2.4-5.6-5.6C6.4 11 9 8.6 12 5.2c3 3.4 5.6 5.8 5.6 9.7 0 3.2-2.2 5.6-5.6 5.6z") + S("M12 5.2V3"),
    leaf:     S("M19 5c0 7.7-4.2 11.6-9.1 11.6A4.9 4.9 0 015 11.7C5 7.3 10.4 5 19 5z") + S("M15.3 8.7C11.6 10.4 8.2 13.9 6.6 19"),
    chili:    S("M6.2 18.4c5.6.9 10.8-2.4 10.8-7.4 0-2.3-1.3-4-3.2-4-1.7 0-2.9 1.3-2.9 3 0 4.6-2.2 7.4-4.7 8.4z") + S("M13.8 7C14.3 4.7 15.7 3.6 18 3.6"),
    pepper:   S("M7 10.4c0-1.8 2.2-2.6 5-2.6s5 .8 5 2.6c0 5.4-1.2 9.8-5 9.8s-5-4.4-5-9.8z") + S("M12 7.8V5.4c0-.9.7-1.6 1.6-1.6"),
    round:    S("M12 20.6a7.6 7.6 0 100-15.2 7.6 7.6 0 000 15.2z") + S("M12 5.4V3.2"),
    citrus:   S("M12 20.6a7.6 7.6 0 100-15.2 7.6 7.6 0 000 15.2z") + S("M12 13a7.6 7.6 0 007.5-1.5M12 13a7.6 7.6 0 01-7.5-1.5M12 13v7.6"),
    berry:    S("M9 20.4a4.3 4.3 0 100-8.6 4.3 4.3 0 000 8.6zM15.6 16.6a4.3 4.3 0 100-8.6 4.3 4.3 0 000 8.6z") + S("M12.6 7.2c.4-2 1.7-3 3.6-3"),
    root:     S("M17.6 5.2c-6 1.4-10.6 6-11.9 12 6-1.4 10.6-6 11.9-12z") + S("M17.6 5.2c1-.9 1.6-1.6 2.2-2.4M13.4 4.7c.7-.6 1.5-.8 2.4-.8"),
    squash:   S("M12 20.2c3.6 0 6-2.7 6-6.4S15.6 7 12 7s-6 2.7-6 6.8 2.4 6.4 6 6.4z") + S("M12 7V4.2M12 4.2h2.6"),
    tree:     S("M8.2 11.2a3 3 0 01.6-5.9 3.3 3.3 0 016.4 0 3 3 0 01.6 5.9z") + S("M9 11.2l.9 8.6h4.2l.9-8.6"),
    mushroom: S("M4.8 11.6a7.2 7.2 0 0114.4 0z") + S("M10 11.6v6.2a2 2 0 004 0v-6.2"),
    long:     S("M8.6 4.6c3.4 0 6 2.6 6 6.4v5.4a3.4 3.4 0 01-6.8 0V6.4a1.8 1.8 0 01.8-1.8z") + S("M8.4 8.6h6"),
    avocado:  S("M12 20.4c3.2 0 5.6-2.8 5.6-6.4 0-4.6-2.4-9.6-5.6-9.6S6.4 9.4 6.4 14c0 3.6 2.4 6.4 5.6 6.4z") + S("M12 16.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2"),
    tropical: S("M12 20.4c3 0 5.4-2.9 5.4-6.6S15 5.6 12 5.6 6.6 10.1 6.6 13.8s2.4 6.6 5.4 6.6z") + S("M12 5.6c0-1.4 1.1-2.4 2.6-2.4M12 5.6c0-1.4-1.1-2.4-2.6-2.4"),
    bottle:   S("M9.7 3.4h4.6v3l1.8 2.9a4 4 0 01.6 2.1v7.2a1.8 1.8 0 01-1.8 1.8H9.1a1.8 1.8 0 01-1.8-1.8v-7.2a4 4 0 01.6-2.1l1.8-2.9v-3z") + S("M7.5 13.4h9"),
    jar:      S("M7.4 8.6h9.2v9.8a2.2 2.2 0 01-2.2 2.2H9.6a2.2 2.2 0 01-2.2-2.2V8.6z") + S("M6.6 5.4h10.8v3.2H6.6zM9.8 5.4V3.6h4.4v1.8"),
    can:      S("M7 6.6h10v11.2a2 2 0 01-2 2H9a2 2 0 01-2-2V6.6z") + S("M7 6.6c0-1.1 2.2-2 5-2s5 .9 5 2-2.2 2-5 2-5-.9-5-2zM7.6 10.4h8.8"),
    carton:   S("M7.4 9.6h9.2v9a1.8 1.8 0 01-1.8 1.8H9.2a1.8 1.8 0 01-1.8-1.8v-9z") + S("M7.4 9.6l2.2-5.2h4.8l2.2 5.2M12 4.4v5.2"),
    bag:      S("M6.6 9.4h10.8l1 9.1a1.8 1.8 0 01-1.8 2H7.4a1.8 1.8 0 01-1.8-2l1-9.1z") + S("M9.4 9.4V6.6a2.6 2.6 0 015.2 0v2.8"),
    grain:    S("M12 20.4V9.2") + S("M12 9.4c0-2.8 1.6-4.8 4.4-5.6.4 3.2-1.2 5.4-4.4 5.6zM12 13.6c0-2.8-1.6-4.8-4.4-5.6-.4 3.2 1.2 5.4 4.4 5.6zM12 17.4c0-2.6 1.5-4.4 4-5.2.4 3-1.1 5-4 5.2z"),
    noodle:   S("M5.4 8.4c2.2 0 2.2 2.6 4.4 2.6s2.2-2.6 4.4-2.6 2.2 2.6 4.4 2.6") + S("M5.4 13c2.2 0 2.2 2.6 4.4 2.6s2.2-2.6 4.4-2.6 2.2 2.6 4.4 2.6"),
    disc:     S("M12 20.4a8.4 8.4 0 100-16.8 8.4 8.4 0 000 16.8z") + S("M12 16.6a4.6 4.6 0 100-9.2 4.6 4.6 0 000 9.2"),
    bread:    S("M5 12.4c0-3.3 3.1-5.6 7-5.6s7 2.3 7 5.6v4.8a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 17.2v-4.8z") + S("M9 12.4v6.6M15 12.4v6.6"),
    nut:      S("M12 20.2c3.4 0 5.8-2.7 5.8-6.4 0-4.4-2.6-9.6-5.8-9.6s-5.8 5.2-5.8 9.6c0 3.7 2.4 6.4 5.8 6.4z") + S("M12 6.4v12.4"),
    seed:     S("M8.2 14.4a2.9 2.9 0 100-5.8 2.9 2.9 0 000 5.8zM16.2 18.4a2.9 2.9 0 100-5.8 2.9 2.9 0 000 5.8zM15.4 9.4a2.4 2.4 0 100-4.8 2.4 2.4 0 000 4.8z"),
    bar:      S("M4.6 8.4h14.8v8.4a1.8 1.8 0 01-1.8 1.8H6.4a1.8 1.8 0 01-1.8-1.8V8.4z") + S("M4.6 8.4l2-2.6h11l1.8 2.6M9.4 8.4v10.2M14.4 8.4v10.2"),
    egg:      S("M12 20.4c3.2 0 5.6-2.5 5.6-5.9 0-4.3-2.5-10.9-5.6-10.9S6.4 10.2 6.4 14.5c0 3.4 2.4 5.9 5.6 5.9z"),
    fish:     S("M3.6 12c3-3.6 6.4-5.4 10-5.4 3.4 0 5.8 1.8 6.8 5.4-1 3.6-3.4 5.4-6.8 5.4-3.6 0-7-1.8-10-5.4z") + S("M6.8 9.4L4.4 6.6M6.8 14.6l-2.4 2.8M16.6 11.4v.1"),
    meat:     S("M6.6 17.4c-2.2-2.2-2-5.9.6-8.5 2.6-2.6 6.3-2.8 8.5-.6 2.2 2.2 2 5.9-.6 8.5-2.6 2.6-6.3 2.8-8.5.6z") + S("M10.6 13.4a2.2 2.2 0 103.1-3.1"),
    bean:     S("M9.4 16.8c-2.6 0-4.4-1.7-4.4-4.2 0-3.4 3.2-5.8 6.6-5.8 2.6 0 4.4 1.7 4.4 4.2 0 3.4-3.2 5.8-6.6 5.8z") + S("M14.6 17.2c1.9 0 3.4-1.3 3.4-3.3"),
    tub:      S("M6.6 9.4h10.8l-1 9.2a1.8 1.8 0 01-1.8 1.6h-5.2a1.8 1.8 0 01-1.8-1.6l-1-9.2z") + S("M5.8 6.2h12.4v3.2H5.8z"),
    coconut:  S("M12 20.4a8.4 8.4 0 100-16.8 8.4 8.4 0 000 16.8z") + S("M8.4 9.4v.1M15.4 9.4v.1M12 14.6v.1"),
    droplet:  S("M12 20.4c3 0 5.2-2.3 5.2-5.3C17.2 11.4 12 3.6 12 3.6S6.8 11.4 6.8 15.1c0 3 2.2 5.3 5.2 5.3z"),
    mill:     S("M9 8.6h6v9.6a2.2 2.2 0 01-2.2 2.2h-1.6A2.2 2.2 0 019 18.2V8.6z") + S("M9.4 5.4h5.2v3.2H9.4zM12 3.4v2M9.6 12.2h4.8M9.6 15.4h4.8"),
    garlicBulb: S("M12 20.4c-3.3 0-5.5-2.3-5.5-5.5 0-3.8 2.5-6.2 5.5-9.5 3 3.3 5.5 5.7 5.5 9.5 0 3.2-2.2 5.5-5.5 5.5z") + S("M12 5.4V3.2M9.2 10.4c-.6 3.4-.4 6.6.6 9.6M14.8 10.4c.6 3.4.4 6.6-.6 9.6"),
    pouch:    S("M6.4 8.8h11.2v9.6a2 2 0 01-2 2H8.4a2 2 0 01-2-2V8.8z") + S("M6.4 8.8l1.4-3.2h8.4l1.4 3.2M10 12.6h4"),
    pot:      S("M5.6 9.6h12.8v6.6a4 4 0 01-4 4h-4.8a4 4 0 01-4-4V9.6z") + S("M4 9.6h16M9 6.4c0-1.2.8-2 2-2M13.4 6.4c0-1.2.8-2 2-2"),
    salt:     S("M8.6 20.4l-1-9.6h8.8l-1 9.6z") + S("M9.4 7.6h5.2v3.2H9.4zM11 5.2v.1M13 4.4v.1M12 3v.1"),
  };

  // --- key -> [shape, hue] ---------------------------------------------
  const M = {};
  const set = (shape, hue, keys) => keys.forEach(k => { M[k] = [shape, hue]; });

  set("bulb", "purple", ["onion"]);
  set("garlicBulb", "stone", ["garlic"]);
  set("leaf", "leaf", ["scallions", "cilantro", "parsley", "basil", "kale or spinach", "lettuce", "cabbage", "curry leaves", "bay leaf", "oregano", "thyme"]);
  set("chili", "red", ["serrano pepper", "jalapeno", "green chilies", "chipotle in adobo"]);
  set("pepper", "red", ["bell pepper"]);
  set("round", "red", ["tomato"]);
  set("citrus", "yellow", ["lemon", "orange"]);
  set("citrus", "leaf", ["lime"]);
  set("berry", "purple", ["blueberries", "mixed berries"]);
  set("berry", "red", ["strawberries"]);
  set("root", "orange", ["carrot", "sweet potato", "ginger"]);
  set("root", "brown", ["potatoes"]);
  set("squash", "orange", ["butternut squash", "pineapple"]);
  set("tree", "green", ["broccoli"]);
  set("mushroom", "brown", ["mushrooms"]);
  set("long", "green", ["cucumber", "celery"]);
  set("avocado", "green", ["avocado"]);
  set("tropical", "orange", ["papaya"]);
  set("tropical", "leaf", ["kiwi"]);

  set("jar", "brown", ["cumin", "cumin seeds", "coriander", "garam masala", "curry powder", "cinnamon", "onion powder", "garlic powder", "achiote paste", "golden milk blend", "fajita seasoning"]);
  set("jar", "red", ["paprika", "chili powder", "chili flakes", "cayenne"]);
  set("jar", "yellow", ["turmeric", "mustard seeds"]);
  set("salt", "stone", ["salt", "salt & pepper"]);
  set("mill", "brown", ["black pepper"]);

  set("bottle", "green", ["olive oil"]);
  set("bottle", "yellow", ["vegetable oil", "neutral oil", "sesame oil"]);
  set("bottle", "stone", ["coconut oil", "rice vinegar", "red wine vinegar"]);
  set("bottle", "brown", ["gf tamari", "coconut aminos", "maple syrup", "agave", "honey"]);
  set("bottle", "red", ["hot sauce", "sweet and sour sauce"]);
  set("bottle", "yellow", ["dijon mustard"]);
  set("droplet", "brown", ["vanilla"]);

  set("can", "red", ["canned tomatoes", "tomato sauce", "tomato paste", "red curry paste"]);
  set("can", "stone", ["coconut milk", "coconut cream"]);
  set("pot", "brown", ["vegetable broth", "chicken broth", "beef broth"]);
  set("can", "leaf", ["capers"]);

  set("grain", "yellow", ["rice", "quinoa", "cornmeal"]);
  set("grain", "brown", ["rolled oats"]);
  set("noodle", "yellow", ["gf pasta"]);
  set("disc", "orange", ["corn tortillas", "tortilla chips"]);
  set("bread", "brown", ["gf bread", "gf cookies"]);

  set("nut", "brown", ["cashews", "peanuts", "walnuts", "pecans", "almonds"]);
  set("tub", "brown", ["peanut butter", "almond butter", "cashew butter", "sunflower seed butter", "tahini"]);
  set("tub", "stone", ["coconut butter", "vegan yogurt", "vegan sour cream"]);
  set("seed", "brown", ["chia seeds", "flaxseed meal", "pumpkin seeds"]);
  set("bag", "stone", ["almond flour", "oat flour", "coconut flour", "gf flour"]);
  set("pouch", "stone", ["cornstarch", "arrowroot starch", "sugar"]);
  set("bag", "brown", ["brown sugar", "cocoa powder", "protein powder"]);
  set("coconut", "stone", ["shredded coconut"]);
  set("nut", "purple", ["medjool dates", "dried fruit"]);
  set("bar", "brown", ["dark chocolate", "dairy-free chocolate", "dairy-free chocolate chips"]);

  set("egg", "yellow", ["eggs"]);
  set("fish", "orange", ["salmon"]);
  set("meat", "red", ["beef", "chicken thighs", "ham"]);
  set("bean", "orange", ["red lentils", "lentils", "chickpeas"]);
  set("bean", "purple", ["black beans", "pinto beans"]);
  set("squash", "yellow", ["jackfruit"]);
  set("bar", "yellow", ["vegan butter"]);
  set("carton", "stone", ["almond milk", "non-dairy milk"]);

  // Members of the same shape+hue family get one of three depths, cycled in
  // declaration order. The family still reads as one set - like a spice rack -
  // but no two neighbours are ever the same tile.
  const TONE = {};
  (function assignTones() {
    const seen = {};
    Object.keys(M).forEach(k => {
      const sig = M[k].join("/");
      seen[sig] = (seen[sig] === undefined ? 0 : seen[sig] + 1);
      TONE[k] = seen[sig] % 3;
    });
  })();


  // --- 2026 dataset additions: all reuse existing shapes on purpose ---
  set("bulb", "purple", ["shallot"]);
  set("bulb", "leaf", ["fennel"]);
  set("leaf", "leaf", ["chard","chives","dill","mint","rosemary","sage","tarragon","romaine"]);
  set("long", "green", ["asparagus","green beans","zucchini"]);
  set("long", "leaf", ["leek"]);
  set("long", "yellow", ["banana","plantain"]);
  set("tree", "green", ["brussels sprouts","artichoke"]);
  set("tree", "stone", ["cauliflower"]);
  set("root", "purple", ["beets"]);
  set("root", "red", ["radish"]);
  set("round", "red", ["apple","pomegranate"]);
  set("round", "orange", ["peach","apricots"]);
  set("round", "leaf", ["watermelon"]);
  set("squash", "leaf", ["pear"]);
  set("squash", "orange", ["pumpkin"]);
  set("pepper", "purple", ["eggplant"]);
  set("tropical", "yellow", ["mango"]);
  set("berry", "red", ["cherries","cranberries","sun-dried tomatoes"]);
  set("berry", "green", ["olives"]);
  set("grain", "yellow", ["corn"]);

  set("jar", "brown", ["allspice","nutmeg"]);
  set("jar", "leaf", ["cardamom","italian seasoning","pickles"]);
  set("jar", "red", ["chipotle powder","sumac","roasted red peppers"]);
  set("jar", "orange", ["saffron","ginger paste"]);
  set("jar", "stone", ["mayonnaise"]);
  set("bottle", "brown", ["balsamic vinegar","fish sauce"]);
  set("bottle", "red", ["sriracha"]);
  set("bottle", "stone", ["white vinegar"]);
  set("can", "red", ["harissa","salsa"]);
  set("can", "stone", ["tuna"]);
  set("pot", "brown", ["bone broth"]);
  set("carton", "stone", ["coconut water"]);

  set("pouch", "stone", ["baking powder","baking soda","gelatin","sweetener","tapioca starch"]);
  set("pouch", "yellow", ["nutritional yeast"]);
  set("seed", "brown", ["cacao nibs"]);
  set("seed", "stone", ["sesame seeds"]);
  set("seed", "leaf", ["hemp seeds"]);
  set("nut", "brown", ["hazelnuts"]);
  set("coconut", "stone", ["coconut flakes"]);

  set("meat", "red", ["bacon","lamb","chicken wings"]);
  set("meat", "orange", ["chicken","chicken breast"]);
  set("meat", "brown", ["sausage","turkey"]);
  set("meat", "stone", ["pork"]);
  set("fish", "stone", ["cod"]);
  set("fish", "orange", ["shrimp"]);
  set("bean", "stone", ["cannellini beans"]);
  set("bean", "red", ["kidney beans"]);
  set("bean", "green", ["edamame"]);
  set("bar", "stone", ["tofu"]);


  // --- chips added after the ingredient-coverage audit ---
  set("fish", "stone", ["anchovies","clams","white fish"]);
  set("jar", "brown", ["baharat","cloves"]);
  set("jar", "orange", ["ras el hanout"]);
  set("jar", "leaf", ["zaatar","marjoram"]);
  set("bottle", "brown", ["barbecue sauce"]);
  set("bottle", "red", ["ketchup"]);
  set("bottle", "yellow", ["yellow mustard"]);
  set("can", "red", ["pico de gallo","red pepper paste"]);
  set("tub", "stone", ["hummus","tzatziki"]);
  set("tropical", "orange", ["cantaloupe"]);
  set("root", "stone", ["jicama","parsnips"]);
  set("long", "green", ["okra","snap peas"]);
  set("leaf", "leaf", ["marjoram"]);
  set("bean", "green", ["fava beans"]);
  set("bag", "stone", ["chickpea flour"]);
  set("pouch", "stone", ["erythritol"]);
  set("nut", "brown", ["mixed nuts"]);
  set("seed", "stone", ["pine nuts","sunflower seeds"]);
  set("coconut", "stone", ["shredded coconut"]);
  set("bread", "brown", ["gf cookies"]);

  function glyph(key) {
    const [shape, hue] = M[key] || ["round", "stone"];
    const tone = HUES[hue] || HUES.stone;
    const t = TONE[key] || 0;
    return {
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
           'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + SHAPES[shape] + "</svg>",
      h: tone.h,
      s: tone.s,
      t: t,
    };
  }

  // Filename an ingredient cutout would live at, if one exists.
  // Backgrounds are removed, so the tile's own tint shows through and the
  // photographs inherit the design system rather than fighting it.
  // "salt & pepper" -> img/ingredients/salt-pepper.png
  function slug(key) {
    return key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function photoPath(key) {
    return "img/ingredients/" + slug(key) + ".png";
  }

  global.SIFT_ICONS = { glyph, photoPath, slug, shapes: SHAPES, map: M };
})(window);
