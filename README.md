# Piraeus Real Estate Market Tracker

A self-contained, client-side website for tracking the Piraeus property market,
built from a snapshot dataset of listings scraped from spitogatos.gr.

## Features

**📊 Market Dashboard**
- Headline KPIs: total listings, median price, median €/m², median area, price range, parking availability
- Charts: price distribution, listings by property type, median €/m² by type, price-vs-area scatter, size bands, bedroom mix
- A per-type breakdown table (median price, €/m², area, cheapest & priciest)
- Filter the entire market view by property type

**🏠 Listings Explorer**
- Filter by type, price, area, bedrooms, bathrooms and parking
- Sort by price, area, or €/m²
- Each card shows price, €/m², size, beds/baths, parking and a link to the original listing
- Live summary stats for the current filtered set

## Running it

It's a static site — no build step or server required.

- **Locally:** just open `index.html` in a browser.
- **Hosted:** serve the folder with any static host (e.g. GitHub Pages), or run
  `python3 -m http.server` and visit `http://localhost:8000`.

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Page markup and layout |
| `styles.css` | All styling |
| `app.js` | Dashboard analytics + listings filtering/rendering |
| `data.js` | The dataset as `window.PIRAEUS_LISTINGS` (loads under `file://` too) |
| `piraeus_listings.json` | Raw dataset (same data, JSON form) |
| `vendor/chart.umd.min.js` | Chart.js, vendored so the site works offline |

## Updating the data

Replace `piraeus_listings.json` with a fresh export (same field names:
`Link`, `Price_EUR`, `SQM`, `Bedrooms`, `Bathrooms`, `Parking`, `Property_Type`),
then regenerate `data.js`:

```bash
python3 - <<'PY'
import json
d = json.load(open('piraeus_listings.json'))
with open('data.js', 'w') as f:
    f.write('// Auto-generated dataset of Piraeus real estate listings (source: spitogatos.gr)\n')
    f.write('window.PIRAEUS_LISTINGS = ' + json.dumps(d, ensure_ascii=False) + ';\n')
PY
```
