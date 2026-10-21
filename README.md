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
