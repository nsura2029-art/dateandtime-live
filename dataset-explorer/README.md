# Dataset Explorer — Region → Subregion → Country → State → City

A single-page HTML visualization of the `consolidated-cities-for-ai.json` dataset (152,970 cities) compared to our `dateandtime.live` D1 database.

## Files

- `index.html` — single-page viewer (32 KB)
- `data.json` — extracted/flattened dataset (1.7 MB)
- `screenshot.png` — full-page screenshot
- `screenshot-japan.png` — search filter demo
- `screenshot-modal.png` — country detail modal

## Run

```bash
cd dataset-explorer
python3 -m http.server 8000
# open http://localhost:8000/
```

(Cannot open directly via `file://` because browsers block `fetch()` of local files.)

## Headline numbers

| Hierarchy | Dataset | Our DB | Gap |
|---|---|---|---|
| Regions | 5 | 6 | +1 (we split Americas into 4) |
| Subregions | 22 | 25 | −3 (we split Americas) |
| Countries | 223 | 242 | +19 (we have 21 territories: AI, CC, CW, GI, MO, MS, PN, SH, SJ, SX, TC, VA, VG, etc.) |
| States | 4,266 | 3,865 | −401 (we filter out `adm2`/`section` types) |
| Cities | 152,970 | 33,945 | **−119,025 (78% missing)** |

## What we'd gain by ingesting the full dataset

1. **+119K cities** → 4.5x our current coverage. Most missing are small/medium European cities (Romania, France, Italy, Germany, Spain) and full US coverage (currently 21% of dataset).
2. **+401 states** → full adm2 (counties, departments) and section (statistical regions) coverage. Great for hyperlocal SEO.
3. **`state_native` field** → 19-language state name localization (Arabic, Hindi, Russian, etc.). Currently missing.
4. **Sub-region pages** → 22 UN M49 sub-regions could each get a landing page. Currently we have only `Europe` and `Asia`.
5. **Country emoji + phone code + currency** → already in our DB but this dataset normalizes them.

## Top 10 countries by city gap

| Country | Dataset | Ours | Gap | Coverage |
|---|---|---|---|---|
| United States | 16,731 | 3,407 | 10,906 | 35% |
| France | 10,534 | 692 | 9,904 | 6% |
| Italy | 9,852 | 658 | 9,226 | 6% |
| Mexico | 9,321 | 643 | 8,386 | 10% |
| Spain | 8,405 | 735 | 7,845 | 7% |
| Romania | 7,949 | 134 | 7,791 | 2% |
| Germany | 7,104 | 1,139 | 5,989 | 16% |
| Philippines | 5,357 | 531 | 4,588 | 14% |
| Russia | 5,523 | 1,108 | 4,338 | 21% |
| Australia | 4,147 | 313 | 3,800 | 8% |

## Technical notes

- The dataset uses GeoNames-style hierarchy with `adm1` (state), `adm2` (county), `adm3` (municipality), `adm4` (village), `section` (statistical), and `city` (populated place) types.
- City IDs are from a separate namespace (max ID is much higher than ours). To merge, we need to match on `(name + cca2 + state)`, not on ID.
- 90% timezone overlap between dataset (371 IANA zones) and ours (356). Missing 37 zones are mostly small North American ones (`America/Adak`, `America/Nome`).
