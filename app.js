import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const STYLES = {
  light:'https://tiles.openfreemap.org/styles/positron',
  dark:'https://tiles.openfreemap.org/styles/dark'
};
const PROVINCES_URL='https://raw.githubusercontent.com/theaiagent/turkiye_iller_geojson/main/turkiye_iller.geojson';
const els=Object.fromEntries(['searchForm','searchInput','searchButton','turkeyButton','themeButton','themeText','platesButton','platesText','languageButton','info','closeInfo','infoKind','infoTitle','infoDescription','infoCoords','status','legend','hint','subtitle'].map(id=>[id,document.getElementById(id)]));
const labels={
  tr:{subtitle:'Dünya Rehberi',search:'Ülke, şehir, ada veya yer ara…',go:'Ara ↗',turkey:'Türkiye',dark:'Koyu',light:'Açık',platesOn:'Plakalar: Açık',platesOff:'Plakalar: Kapalı',hint:'Haritada bir yere tıkla veya arama yap',province:'TÜRKİYE / İL',plate:'Plaka kodu',coords:'Koordinatlar',noresult:'Konum bulunamadı. Daha ayrıntılı bir ad dene.',loaderror:'İl sınırları yüklenemedi. İnternet bağlantını kontrol et.',searching:'Konum aranıyor…',zoom:'Plaka etiketlerini görmek için Türkiye’ye yakınlaş.',location:'KONUM'},
  en:{subtitle:'World Reference',search:'Search a country, city, island or place…',go:'Search ↗',turkey:'Türkiye',dark:'Dark',light:'Light',platesOn:'Plates: On',platesOff:'Plates: Off',hint:'Click anywhere on the map or search for a place',province:'TÜRKİYE / PROVINCE',plate:'Plate code',coords:'Coordinates',noresult:'Place not found. Try a more specific name.',loaderror:'Could not load province boundaries. Check your internet connection.',searching:'Searching…',zoom:'Zoom in to Türkiye to see plate labels.',location:'LOCATION'}
};
let lang='tr',theme='light',showPlates=false,provinceData=null,plateMarkers=[];
const t=k=>labels[lang][k];

const map=new maplibregl.Map({
  container:'map',
  style:STYLES.light,
  center:[17,24],
  zoom:1.65,
  minZoom:1,
  maxZoom:18,
  renderWorldCopies:false,
  attributionControl:true
});

map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
map.addControl(new maplibregl.ScaleControl({maxWidth:130,unit:'metric'}),'bottom-right');

const setStatus=s=>{els.status.textContent=s};

function updateUI(){
  document.documentElement.lang=lang;
  els.subtitle.textContent=t('subtitle');
  els.searchInput.placeholder=t('search');
  els.searchButton.textContent=t('go');
  els.turkeyButton.textContent=t('turkey');
  els.themeText.textContent=t(theme==='light'?'dark':'light');
  els.platesText.textContent=t(showPlates?'platesOn':'platesOff');
  els.hint.textContent=t('hint');
  els.languageButton.textContent=lang.toUpperCase()+' ▾';
  els.platesButton.classList.toggle('active',showPlates);
  els.platesButton.setAttribute('aria-pressed',String(showPlates));
  els.legend.hidden=!showPlates;
  els.legend.innerHTML=lang==='tr'
    ? 'Türkiye • <strong>81 il / plaka kodları</strong><span>Yakınlaşınca etiketler görünür</span>'
    : 'Türkiye • <strong>81 provinces / plate codes</strong><span>Labels appear when zoomed in</span>';
}

function showInfo(title,desc,latlng,kind){
  els.info.hidden=false;
  els.infoTitle.textContent=title;
  els.infoDescription.textContent=desc;
  els.infoKind.textContent=kind||t('location');
  els.infoCoords.textContent=`${t('coords')}: ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`;
}

function applyMapLanguage(){
  const style=map.getStyle();
  if(!style?.layers)return;

  for(const layer of style.layers){
    if(layer.type!=='symbol' || !layer.layout?.['text-field']) continue;
    const id=layer.id.toLowerCase();
    if(!/(label|place|country|state|city|town|village|settlement|capital)/.test(id)) continue;

    try{
      const original=layer.layout['text-field'];
      if(!layer.metadata?.atlasOriginalText){
        layer.metadata={...layer.metadata,atlasOriginalText:original};
      }
      map.setLayoutProperty(layer.id,'text-field',[
        'coalesce',
        ['get',lang==='tr'?'name:tr':'name:en'],
        ['get','name:latin'],
        ['get','name'],
        typeof original==='string'?original:''
      ]);
    }catch(_e){}
  }
}

function enhanceBaseMapStyle(){
  const style=map.getStyle();
  if(!style?.layers) return;

  for(const layer of style.layers){
    const id=(layer.id||'').toLowerCase();

    try{
      if(theme==='dark'){
        if(layer.type==='background'){
          map.setPaintProperty(layer.id,'background-color','#132238');
        }

        if(layer.type==='fill'){
          if(/water|ocean|sea|lake|river/.test(id)){
            map.setPaintProperty(layer.id,'fill-color','#18314f');
          }else if(/land|landcover|park|wood|forest|grass|glacier/.test(id)){
            map.setPaintProperty(layer.id,'fill-color','#1a2740');
          }
        }

        if(layer.type==='line' && /boundary|admin|border/.test(id)){
          map.setPaintProperty(layer.id,'line-color','#5f86bf');
          map.setPaintProperty(layer.id,'line-opacity',0.9);
          map.setPaintProperty(layer.id,'line-width',[
            'interpolate',['linear'],['zoom'],
            1,0.45,
            4,0.8,
            7,1.2,
            10,1.8
          ]);
        }

        if(layer.type==='symbol'){
          if(/capital/.test(id)){
            map.setPaintProperty(layer.id,'text-color','#ffd166');
            map.setPaintProperty(layer.id,'text-halo-color','#0c1524');
            map.setPaintProperty(layer.id,'text-halo-width',1.4);
          }else if(/country/.test(id)){
            map.setPaintProperty(layer.id,'text-color','#eef5ff');
            map.setPaintProperty(layer.id,'text-halo-color','#122033');
            map.setPaintProperty(layer.id,'text-halo-width',1.2);
          }else if(/city|town|village|settlement|place/.test(id)){
            map.setPaintProperty(layer.id,'text-color','#a9c8ff');
            map.setPaintProperty(layer.id,'text-halo-color','#122033');
            map.setPaintProperty(layer.id,'text-halo-width',1.1);
          }
        }
      } else {
        if(layer.type==='background'){
          map.setPaintProperty(layer.id,'background-color','#eef4fb');
        }

        if(layer.type==='fill'){
          if(/water|ocean|sea|lake|river/.test(id)){
            map.setPaintProperty(layer.id,'fill-color','#cae3ff');
          }else if(/land|landcover|park|wood|forest|grass|glacier/.test(id)){
            map.setPaintProperty(layer.id,'fill-color','#f6f8fc');
          }
        }

        if(layer.type==='line' && /boundary|admin|border/.test(id)){
          map.setPaintProperty(layer.id,'line-color','#6e8fbe');
          map.setPaintProperty(layer.id,'line-opacity',0.8);
          map.setPaintProperty(layer.id,'line-width',[
            'interpolate',['linear'],['zoom'],
            1,0.35,
            4,0.65,
            7,1.05,
            10,1.55
          ]);
        }

        if(layer.type==='symbol'){
          if(/capital/.test(id)){
            map.setPaintProperty(layer.id,'text-color','#b45309');
            map.setPaintProperty(layer.id,'text-halo-color','#ffffff');
            map.setPaintProperty(layer.id,'text-halo-width',1.3);
          }else if(/country/.test(id)){
            map.setPaintProperty(layer.id,'text-color','#0f172a');
            map.setPaintProperty(layer.id,'text-halo-color','#ffffff');
            map.setPaintProperty(layer.id,'text-halo-width',1.2);
          }else if(/city|town|village|settlement|place/.test(id)){
            map.setPaintProperty(layer.id,'text-color','#1e3a5f');
            map.setPaintProperty(layer.id,'text-halo-color','#ffffff');
            map.setPaintProperty(layer.id,'text-halo-width',1.1);
          }
        }
      }
    }catch(_e){}
  }
}

function ensureProvinceLayers(){
  if(!provinceData || !map.isStyleLoaded()) return;

  if(!map.getSource('turkey-provinces')){
    map.addSource('turkey-provinces',{type:'geojson',data:provinceData});
  }

  if(!map.getLayer('turkey-province-fill')){
    map.addLayer({
      id:'turkey-province-fill',
      type:'fill',
      source:'turkey-provinces',
      paint:{
        'fill-color': theme==='dark' ? '#3b82f6' : '#60a5fa',
        'fill-opacity': ['interpolate',['linear'],['zoom'],4,0.00,5.5,0.04,7,0.08,9,0.11]
      }
    });
  }

  if(!map.getLayer('turkey-boundaries')){
    map.addLayer({
      id:'turkey-boundaries',
      type:'line',
      source:'turkey-provinces',
      paint:{
        'line-color': theme==='dark' ? '#8db6ff' : '#2563eb',
        'line-width':['interpolate',['linear'],['zoom'],4,0.7,6,1.5,8,2.2,11,3],
        'line-opacity':0.95
      }
    });
  }

  map.setPaintProperty('turkey-province-fill','fill-color',theme==='dark' ? '#60a5fa' : '#60a5fa');
  map.setPaintProperty('turkey-boundaries','line-color',theme==='dark' ? '#a7c8ff' : '#2563eb');
  map.setLayoutProperty('turkey-province-fill','visibility',showPlates?'visible':'none');
  map.setLayoutProperty('turkey-boundaries','visibility',showPlates?'visible':'none');
}

function centroidOfGeometry(geometry){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  let best=null,largest=-1;
  for(const poly of polygons){
    const ring=poly[0];
    if(!ring?.length) continue;
    let minX=180,maxX=-180,minY=90,maxY=-90;
    for(const [x,y] of ring){
      minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
    }
    const area=(maxX-minX)*(maxY-minY);
    if(area>largest){
      largest=area;
      best=[(minX+maxX)/2,(minY+maxY)/2];
    }
  }
  return best;
}

function updatePlateMarkers(){
  for(const m of plateMarkers) m.remove();
  plateMarkers=[];
  if(!showPlates || !provinceData || map.getZoom()<5.5) return;

  const zoom=map.getZoom();
  for(const feature of provinceData.features){
    const p=feature.properties||{};
    const c=centroidOfGeometry(feature.geometry);
    if(!c) continue;
    const number=String(p.plaka??p.il_kodu??'').padStart(2,'0');
    const name=p.il_adi||'';
    if(!number.trim()) continue;

    const el=document.createElement('div');
    el.className='plate-label';
    el.textContent=zoom>=6.7?`${number} · ${name}`:number;
    el.title=`${name} (${number})`;
    el.addEventListener('click',e=>{
      e.stopPropagation();
      showInfo(name,`${t('plate')}: ${number}`,{lat:c[1],lng:c[0]},t('province'));
    });

    plateMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(c).addTo(map));
  }
}

els.closeInfo.addEventListener('click',()=>{els.info.hidden=true});
els.turkeyButton.addEventListener('click',()=>map.flyTo({center:[35.0,39.1],zoom:5.45,duration:1500}));
els.languageButton.addEventListener('click',()=>{lang=lang==='tr'?'en':'tr';updateUI();applyMapLanguage();updatePlateMarkers();refreshGeographyMarkers();});
els.themeButton.addEventListener('click',()=>{theme=theme==='light'?'dark':'light';document.body.classList.toggle('dark',theme==='dark');map.setStyle(STYLES[theme]);updateUI();});
els.platesButton.addEventListener('click',()=>{
  showPlates=!showPlates;
  updateUI();
  ensureProvinceLayers();
  updatePlateMarkers();
  if(showPlates && !provinceData) setStatus(t('zoom'));
});

map.on('style.load',()=>{
  applyMapLanguage();
  enhanceBaseMapStyle();
  ensureProvinceLayers();
  updatePlateMarkers();
});

map.on('zoomend',updatePlateMarkers);

map.on('click',e=>{
  const features=showPlates&&map.getLayer('turkey-boundaries')
    ? map.queryRenderedFeatures(e.point,{layers:['turkey-boundaries']})
    : [];
  if(features.length){
    const p=features[0].properties;
    showInfo(p.il_adi,`${t('plate')}: ${String(p.plaka??p.il_kodu).padStart(2,'0')}`,e.lngLat,t('province'));
    return;
  }
  showInfo(`${e.lngLat.lat.toFixed(3)}°, ${e.lngLat.lng.toFixed(3)}°`,lang==='tr'?'Seçtiğin harita noktası.':'Selected map point.',e.lngLat,t('location'));
});

async function fetchProvinces(){
  try{
    const response=await fetch(PROVINCES_URL);
    if(!response.ok) throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.type!=='FeatureCollection'||data.features.length!==81) throw Error('Unexpected province format');
    provinceData=data;
    ensureProvinceLayers();
    updatePlateMarkers();
    setStatus('');
  }catch(err){
    console.warn(err);
    setStatus(t('loaderror'));
  }
}

const resultPanel=document.getElementById('searchResults');
const flagsBtn=document.getElementById('flagsButton'), capitalsBtn=document.getElementById('capitalButton');
let countries=[],flagMarkers=[],capitalMarkers=[],showFlags=false,showCapitals=true;
const flagIcon=code=>code?.replace(/./g,ch=>String.fromCodePoint(127397+ch.charCodeAt(0)))||'⚑';
const countryCode=c=>c.cca2?.toLowerCase();
const cleanName=c=>c.translations?.[lang==='tr'?'tur':'eng']?.common||c.name?.common||c.cca2;
function countryFact(c){const capital=c.capital?.[0]||'—';return lang==='tr'?`${cleanName(c)} için başkent ${capital}. ${c.region||''} bölgesinde yer alır.`:`The capital of ${cleanName(c)} is ${capital}. Region: ${c.region||'—'}.`;}
function findCountry(place){const a=place.address||{};const code=a.country_code?.toUpperCase();if(code)return countries.find(c=>c.cca2===code);return null;}
function showCountry(c,coord){const place=coord||{lat:c.latlng?.[0]||0,lng:c.latlng?.[1]||0};showInfo(`${flagIcon(c.cca2)} ${cleanName(c)}`,countryFact(c),place,lang==='tr'?'ÜLKE':'COUNTRY');const image=document.createElement('div');image.className='country-card';const flag=document.createElement('img');flag.src=`https://flagcdn.com/w160/${countryCode(c)}.png`;flag.alt=cleanName(c);flag.loading='lazy';const name=document.createElement('strong');name.textContent=cleanName(c);image.append(flag,name);const stats=document.createElement('div');stats.className='country-stats';const rows=[[lang==='tr'?'Başkent':'Capital',c.capital?.join(', ')||'—'],[lang==='tr'?'Bölge':'Region',c.region||'—'],[lang==='tr'?'Nüfus':'Population',(c.population||0).toLocaleString(lang==='tr'?'tr-TR':'en-US')],[lang==='tr'?'Yüzölçümü':'Area',`${(c.area||0).toLocaleString()} km²`]];for(const [label,value] of rows){const cell=document.createElement('div');const b=document.createElement('b');b.textContent=label;cell.append(b,document.createTextNode(value));stats.append(cell)}els.infoDescription.replaceChildren(image,stats);sayCat(countryFact(c),'explore');}
function refreshGeographyMarkers(){for(const m of [...flagMarkers,...capitalMarkers])m.remove();flagMarkers=[];capitalMarkers=[];if(!countries.length)return;for(const c of countries){if(showFlags&&c.latlng?.length===2&&c.cca2?.length===2){const el=document.createElement('button');el.type='button';el.className='map-flag';el.title=cleanName(c);const img=document.createElement('img');img.src=`https://flagcdn.com/w40/${countryCode(c)}.png`;img.alt=cleanName(c);img.loading='lazy';el.append(img);el.addEventListener('click',ev=>{ev.stopPropagation();showCountry(c)});flagMarkers.push(new maplibregl.Marker({element:el}).setLngLat([c.latlng[1],c.latlng[0]]).addTo(map));}if(showCapitals&&c.capitalInfo?.latlng?.length===2){const loc=c.capitalInfo.latlng;const el=document.createElement('button');el.type='button';el.className='capital-marker';el.title=`★ ${c.capital?.[0]||''} — ${cleanName(c)}`;el.addEventListener('click',ev=>{ev.stopPropagation();showCountry(c,{lat:loc[0],lng:loc[1]})});capitalMarkers.push(new maplibregl.Marker({element:el}).setLngLat([loc[1],loc[0]]).addTo(map));}}}
flagsBtn.addEventListener('click',()=>{showFlags=!showFlags;flagsBtn.classList.toggle('active',showFlags);flagsBtn.setAttribute('aria-pressed',String(showFlags));refreshGeographyMarkers()});
capitalsBtn.addEventListener('click',()=>{showCapitals=!showCapitals;capitalsBtn.classList.toggle('active',showCapitals);capitalsBtn.setAttribute('aria-pressed',String(showCapitals));refreshGeographyMarkers()});
async function fetchCountries(){try{const r=await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags,capital,latlng,capitalInfo,region,population,area,translations');if(!r.ok)throw Error('countries '+r.status);countries=await r.json();refreshGeographyMarkers()}catch(e){console.warn('Country details unavailable',e);setStatus(lang==='tr'?'Ülke bilgileri şu anda yüklenemedi.':'Country details are unavailable.')}}
const catPanel=document.getElementById('catPanel'),catBubble=document.getElementById('catBubble'),catState=document.getElementById('catState'),catEffect=document.getElementById('catEffect');
const catEls={happiness:document.getElementById('happiness'),fullness:document.getElementById('fullness'),style:document.getElementById('catStyle'),color:document.getElementById('catColor'),motion:document.getElementById('catMotion'),facts:document.getElementById('catFacts')};
const defaults={style:'cartoon',color:'orange',motion:true,facts:true,happiness:75,fullness:70,hidden:false};let catPrefs;try{catPrefs={...defaults,...JSON.parse(localStorage.getItem('irocero'))}}catch{catPrefs={...defaults}}
let catActionTimer=null;function saveCat(){try{localStorage.setItem('irocero',JSON.stringify(catPrefs))}catch{}}
function updateCat(){catPanel.classList.toggle('pixel',catPrefs.style==='pixel');catPanel.classList.toggle('minimal',catPrefs.style==='minimal');catPanel.classList.toggle('black',catPrefs.color==='black');catPanel.classList.toggle('white',catPrefs.color==='white');catPanel.classList.toggle('no-motion',!catPrefs.motion);catPanel.hidden=catPrefs.hidden;document.getElementById('restoreCat').hidden=!catPrefs.hidden;catEls.happiness.value=catPrefs.happiness;catEls.fullness.value=catPrefs.fullness;catEls.style.value=catPrefs.style;catEls.color.value=catPrefs.color;catEls.motion.checked=catPrefs.motion;catEls.facts.checked=catPrefs.facts;saveCat();}
function sayCat(message,action='idle'){if(action==='explore'&&!catPrefs.facts)return;catBubble.textContent=message;catPanel.classList.remove('sleeping','eating','happy','explore');catPanel.classList.add(({feed:'eating',pet:'happy',sleep:'sleeping',explore:'explore'})[action]||'idle');catEffect.textContent=({feed:'🐟',pet:'♥',sleep:'Zzz',explore:'🔎'})[action]||'';catState.textContent=action==='sleep'?'◌':'●';if(catActionTimer)clearTimeout(catActionTimer);if(action!=='sleep')catActionTimer=setTimeout(()=>{catPanel.classList.remove('eating','happy','explore');catEffect.textContent=''},3200)}
document.getElementById('feedButton').onclick=()=>{catPrefs.fullness=Math.min(100,catPrefs.fullness+20);sayCat(lang==='tr'?'Miyav! Çok lezzetliydi!':'Meow! Delicious!','feed');updateCat()};
function petCat(){catPrefs.happiness=Math.min(100,catPrefs.happiness+15);sayCat(lang==='tr'?'Prrrr... teşekkürler!':'Prrrr... thank you!','pet');updateCat()}
document.getElementById('petButton').onclick=petCat;document.getElementById('catAvatar').onclick=petCat;
document.getElementById('napButton').onclick=()=>sayCat(lang==='tr'?'Biraz uyuyorum...':'Taking a little nap...','sleep');
document.getElementById('catSettingsButton').onclick=()=>{const s=document.getElementById('catSettings');s.hidden=!s.hidden};
for(const [key,el] of [['style',catEls.style],['color',catEls.color],['motion',catEls.motion],['facts',catEls.facts]])el.addEventListener('change',()=>{catPrefs[key]=el.type==='checkbox'?el.checked:el.value;updateCat()});
document.getElementById('hideCat').onclick=()=>{catPrefs.hidden=true;updateCat()};document.getElementById('restoreCat').onclick=()=>{catPrefs.hidden=false;updateCat()};
updateCat();fetchCountries();
function closeSearchResults(){resultPanel.hidden=true;resultPanel.replaceChildren();}
function focusPlace(place){
  const lon=Number(place.lon),lat=Number(place.lat);
  if(place.boundingbox){
    const b=place.boundingbox.map(Number);
    map.fitBounds([[b[2],b[0]],[b[3],b[1]]],{padding:90,maxZoom:12,duration:1300});
  }else map.flyTo({center:[lon,lat],zoom:9});
  const match=findCountry(place);if(match&&(place.addresstype==='country'||place.type==='administrative'&&place.addresstype==='country'||place.class==='boundary'&&place.type==='administrative'&&place.address?.country===place.name))showCountry(match,{lat,lng:lon});else{showInfo(place.name||place.display_name.split(',')[0],place.display_name,{lat,lng:lon},t('location'));if(match)sayCat(countryFact(match),'explore');}
  closeSearchResults();setStatus('');
}
function renderSearchResults(places){
  resultPanel.replaceChildren();
  const heading=document.createElement('div');
  heading.className='search-results-heading';
  heading.textContent=lang==='tr'?`${places.length} konum bulundu — birini seç`:`${places.length} places found — choose one`;
  resultPanel.append(heading);
  for(const place of places){
    const button=document.createElement('button');
    button.type='button';button.className='search-result';
    const title=document.createElement('strong');
    title.textContent=place.name||place.display_name.split(',')[0];
    const address=document.createElement('small');
    address.textContent=place.display_name;
    button.append(title,address);
    button.addEventListener('click',()=>focusPlace(place));
    resultPanel.append(button);
  }
  resultPanel.hidden=false;
}
async function searchPlace(query){
  closeSearchResults();setStatus(t('searching'));els.searchButton.disabled=true;
  try{
    const endpoint=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&dedupe=1&accept-language=${lang}&q=${encodeURIComponent(query)}`;
    const response=await fetch(endpoint);
    if(!response.ok)throw Error('Search '+response.status);
    const places=await response.json();
    if(!places.length){setStatus(t('noresult'));return;}
    renderSearchResults(places);
    setStatus('');
  }catch(err){
    console.warn(err);
    setStatus(lang==='tr'?'Arama şu anda kullanılamıyor.':'Search is currently unavailable.');
  }finally{els.searchButton.disabled=false;}
}
resultPanel.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearchResults();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearchResults();});
document.addEventListener('pointerdown',e=>{if(!els.searchForm.contains(e.target))closeSearchResults();});

els.searchForm.addEventListener('submit',event=>{
  event.preventDefault();
  const q=els.searchInput.value.trim();
  if(q) searchPlace(q);
});

map.on('error',e=>{console.warn('Map:',e.error);});

updateUI();
fetchProvinces();
