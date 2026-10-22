# obcAtlas

A personal interactive world atlas for exploring countries, cities, islands and geography while playing games such as Worldle.

## Features

- Global interactive maps with light and navy dark modes
- Search results for places sharing a name
- Country flags and country information cards (capital, population, area, region)
- Capital markers and highlighted political boundaries
- Türkiye province borders and license-plate labels (toggleable)
- Turkish and English interface
- **irocero**, an animated explorer cat with geography facts, feeding, petting, sleeping, three visual styles, three coat colors, and locally saved settings
- Desktop and mobile web support

## Open

[Open obcAtlas](https://heyobc.github.io/obcAtlas/)

For local development, run `python -m http.server 8000` in the project directory and visit `http://localhost:8000`. Internet access is required for map tiles, place search and geographic data.

## Technology and data

HTML, CSS, JavaScript, MapLibre GL JS, OpenFreeMap, OpenStreetMap/Nominatim, REST Countries and FlagCDN. Geography is provided by independent public data sources. Place names, country status and administrative boundaries may differ among sources. Country markers are approximate reference points rather than full political boundary polygons.

Map © OpenStreetMap contributors.


### v3.2 map controls
- Capital markers use high-contrast golden stars in dark mode.
- Flags and capitals toggles explicitly show their current on/off state.
- Native capital labels are also hidden when capitals are turned off (for style layers identified as capitals).


## v3.4 — irocero Adventures (prototype)

- The explorer cat can be dragged independently of its fixed control panel.
- Sleeping changes the cat into a curled-up pose, with breathing motion.
- Country cards include curated regional dishes for selected countries; selecting a dish feeds irocero.
- The food list is not exhaustive, and dishes are not presented as official national dishes.
- Map tiles, country information, and geocoding require an internet connection.

### v3.5 — irocero geography facts

Click a country on the map or select a place in search to hear an irocero geography fact. Country cards also include a button to request another fact. Identification of map clicks uses OpenStreetMap Nominatim reverse geocoding and requires an internet connection; service limits apply.

## v3.6 map readability

- Navy theme uses a separate Natural Earth country outline overlay (world-atlas 50m).
- Capitals use smaller dots; names show only after zooming in to reduce clutter.
- Boundaries load from a public CDN and need an internet connection.


### v3.7
- Find a Turkish province by entering a plate code such as `07`, `34` or `plaka 61` in search.
- Open the **Oyunlar** menu to add, remove and open daily game links.
- Game shortcuts are stored in each browser's local storage; they are not automatically synced between devices or friends.
