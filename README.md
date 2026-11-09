# larambladepto

A bilingual (Spanish / English) tourist guide with an interactive map, built **for a client**: guests of a short-term rental apartment near Paseo Aldrey, Mar del Plata, Argentina. It lists the owner's own picks for breakfast, lunch, dinner, craft beer, cocktails, sweets and things to do.

This is a client project. It is maintained by its owner only: nobody else commits or pushes to this repository, and outside contributions are not accepted.

## What it does

- Mobile-first landing screen with a day or night background photo, chosen from the real sunrise and sunset times in Mar del Plata.
- Draggable bottom menu with seven categories.
- Interactive map per category (Leaflet + OpenStreetMap), with a draggable list of places.
- Place detail card with photo, description and walking directions. Swipe sideways to move to the next or previous place.
- Spanish by default, English with the ES | EN switch.

It is a static site: plain HTML, CSS and JavaScript, no build step and no backend.

## Project layout

```
index.html        page skeleton
css/style.css     all styles
js/app.js         screens, map, drag gestures, language switch
js/places.js      the content: categories and places
img/bg-day.jpg    landing background (day)
img/bg-night.jpg  landing background (night)
img/places/       one photo per place, named <place id>.webp
```

## Editing the content

Everything a guest reads lives in `js/places.js`. A place looks like this:

```js
{ id: "ola", cats: ["cena"], name: "Ola", rec: true, rom: true, ll: [-38.0, -57.5],
  es: "Para una cena romántica. Recomendado.",
  en: "For a romantic dinner. Recommended." }
```

| Field | Meaning |
|---|---|
| `id` | Unique id. The photo must be `img/places/<id>.webp`. |
| `cats` | One or more of `desayuno`, `almuerzo`, `cena`, `cerveza`, `tragos`, `dulce`, `actividad`. |
| `ll` | `[lat, lng]`. Without it the place is listed but has no pin, and "Get directions" searches by name. |
| `rec` / `rom` | Adds the star (recommended) or heart (romantic) tag. |
| `by` | Optional text per category, for places that appear in more than one section. |
| `pos` | Optional photo framing, as a CSS `object-position` value. |

Photos: WebP, about 900 px wide, quality around 75. The sheet shows them at 4:3.

## Run locally

```bash
python3 -m http.server 8123
```

Then open `http://localhost:8123/`. Append `?fondo=noche` or `?fondo=dia` to force the night or day background.

## Deploy

Hosted on GitHub Pages from the `main` branch, root folder. Every push to `main` republishes the site, so there is nothing to build or run.
