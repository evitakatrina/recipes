# Sift — your GF/DF recipe wheel

A no-build, static site. Five files do all the work: `index.html`, `style.css`, `app.js`, `icons.js` for the ingredient glyphs, and `recipes.json` for the data.

## Run it locally

`recipes.json` is loaded with `fetch()`, which browsers block on `file://`. Opening `index.html` by double-clicking will show a "Recipes didn't load" message. Serve the folder instead:

```bash
cd sift-recipe-app
python3 -m http.server 8777
# then open http://localhost:8777
```

## Deploy it

**Netlify (easiest)** — go to https://app.netlify.com/drop and drag this folder onto the page. You get a live URL immediately.

**GitHub Pages** — create a repo, upload these files, then Settings → Pages → source = `main` branch, root folder.

Either way, add it to your phone's home screen (Share → Add to Home Screen) and it opens full-screen like a native app. The status-bar and safe-area handling is already in place for that.

## How it works

- **Today** — recipe of the day (same one all day, changes daily), a "Ready to cook" rail of your best pantry matches, and a drifting rail of the whole catalogue.
- **Spin** — a fanned deck of cards. Pick a meal (Anything / Breakfast / Lunch / Dinner), tap Spin and the fan riffles before the winner rises out of it. Tap again to stop it early. The toggle narrows the deck to recipes you can mostly make, and stacks with the meal filter.
  Meals map onto categories rather than one-to-one, because Lunch on its own holds a single recipe: Lunch also pulls Soup, Side and Snack; Dinner also pulls Soup.
- **Browse** — filter by category, tap any card for the full recipe.
- **Pantry** — each group is a horizontal shelf of ingredient tiles. Tap what you keep on hand; a live bar counts the recipes it unlocks and takes you straight to them. Search filters across every shelf. Saved in your browser (`localStorage`), and it drives the match percentages and the shopping list.
- **Recipe sheet** — tap ingredients to tick off what you already have. "Add missing to Calendar" opens Google Calendar with a pre-filled event listing what you still need to buy. No login or API setup. When nothing is missing, the button says so instead.

## The data

All 41 recipes have verified ingredient lists, a unique photo, and a working link to the original recipe. Ingredients, images and source URLs were pulled from each publisher's own structured recipe data.

Each ingredient is `{ text, key }`. The `key` is the pantry term it matches. **A `key` of `null` means the line is shown in the recipe but never counted** — that covers water, dairy garnishes (this is a dairy-free app), and serving suggestions. Without this, some recipes could never reach a 100% match.

Every one of the 139 pantry chips is used by at least one recipe, and every ingredient key has a chip. If you add a recipe with a new ingredient, add the matching chip to `PANTRY_GROUPS` in `app.js` or it will never be matchable.

`dfNote` carries the gluten-free / dairy-free caveat where the original recipe isn't GF/DF as written — for example the edible cookie dough needs a 1:1 GF flour swap, and the quinoa salad needs the feta left out.

## The ingredient glyphs

`icons.js` draws all 139 pantry tiles from **38 shared shapes** and an 8-hue palette — one 24x24 box, one 1.7 stroke. Reuse is deliberate: a system of shared shapes reads as designed, where 139 bespoke drawings would not.

Members of the same shape+hue family get one of three depths, cycled in declaration order, so no two neighbours on a shelf are ever the same tile. Nothing is fetched — the glyphs are inline SVG, so they cost no requests and adapt to light and dark automatically.

To add an ingredient, map it in `icons.js` with `set("<shape>", "<hue>", ["<key>"])`. An unmapped key falls back to a generic circle rather than breaking.

## Adding recipes

Open `recipes.json` and append an object in the same shape:

```json
{
  "id": "r42",
  "name": "...",
  "source": "...",
  "url": "https://...",
  "image": "https://...",
  "category": "Dinner",
  "cuisine": "...",
  "method": "One-line summary of how it's cooked.",
  "dfNote": "Any GF/DF caveat, or how it's naturally fine",
  "ingredientsVerified": true,
  "ingredients": [{ "text": "2 tbsp olive oil", "key": "olive oil" }]
}
```

Nothing else needs updating — recipe counts, category filters and the pantry match all derive from the file.

## Known trade-off

Images are hot-linked from the original recipe blogs. They all load today, but a publisher can move or block them at any time. Cards degrade to a text-only card if an image fails. To make it bulletproof, download the images into an `img/` folder and point `image` at the local paths.

## Editing later

No build step — edit the files and re-upload. On Netlify, drag the updated folder onto the same site to replace it.

A copy of the previous version is in `.backup-20260831/`.
