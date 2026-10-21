# obcAtlas

An interactive world atlas built for exploring geography.

obcAtlas started as a personal project to make looking up places easier while playing geography games like Worldle. Instead of switching between different maps and websites, the idea was to have a simple, detailed map with everything in one place.

## Features

- Interactive world map with countries, cities, roads, and islands
- Light and dark map themes
- Location search
- Turkish and English language options
- Province boundaries and license plate codes for all 81 provinces of Türkiye
- Zoom and navigation controls

## Built With

- HTML, CSS, JavaScript
- MapLibre GL JS
- OpenStreetMap-based map data
- OpenFreeMap

## Getting Started

You can use obcAtlas directly in your browser:

**[Open obcAtlas](https://heyobc.github.io/obcAtlas/)**

To run it locally, clone the repository and start a local web server:

```bash
git clone https://github.com/heyobc/obcAtlas.git
cd obcAtlas
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

An internet connection is required to load map data.

## Project Status

obcAtlas is still in development. More geographic details, map customization options, and improvements to the mobile experience are planned.

## Credits

Map data © OpenStreetMap contributors.

Built using MapLibre GL JS and OpenFreeMap.
