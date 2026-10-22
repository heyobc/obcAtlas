import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {mesh as topoMesh} from 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';

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


// Toggle settlement labels without hiding country names and administrative borders.
let showCities=false;
let boundaryMode='country';
function isSettlementLabel(layer){
  if(layer.type!=='symbol' || !layer.layout?.['text-field'])return false;
  const id=layer.id.toLowerCase();
  if(id.startsWith('obc-') || /country|continent|ocean|sea|marine|water|road|highway|state|province|boundary|airport|poi|park|mountain|peak|river|lake/.test(id))return false;
  return /city|town|village|hamlet|suburb|neighbou?rhood|settlement|place|capital|locality/.test(id);
}
function syncCityLabels(){
  const layers=map.getStyle()?.layers||[];
  for(const layer of layers){
    if(!isSettlementLabel(layer))continue;
    try{
      // Native capital labels count as cities, so they must be hidden as well.
      map.setLayoutProperty(layer.id,'visibility',showCities?'visible':'none');
      if(showCities){
        const id=layer.id.toLowerCase();
        const min=/village|hamlet|suburb|neighbou?rhood|locality/.test(id)?9: /town/.test(id)?7.5:6;
        map.setLayerZoomRange(layer.id,min,24);
      }
    }catch(_){}
  }
  const b=document.getElementById('citiesButton');
  b.classList.toggle('active',showCities);
  b.setAttribute('aria-pressed',String(showCities));
  document.getElementById('citiesText').textContent=lang==='tr'
    ?`Şehirler: ${showCities?'Açık':'Kapalı'}`:`Cities: ${showCities?'On':'Off'}`;
}
document.getElementById('citiesButton').addEventListener('click',()=>{
  showCities=!showCities;
  syncCityLabels();
});
const boundaryButton=document.getElementById('boundaryButton');
function syncBoundaryMode(){
  const label=({country:lang==='tr'?'Ülkeler':'Countries',
     states:lang==='tr'?'Ülke + Bölge':'Country + States',
     all:lang==='tr'?'Tüm sınırlar':'All boundaries'})[boundaryMode];
  document.getElementById('boundaryText').textContent=label;
  boundaryButton.title=lang==='tr'?'Sınır ayrıntısını değiştir':'Change boundary detail';
  const detailed=boundaryMode!=='country';
  for(const layer of map.getStyle()?.layers||[]){
    if(layer.type!=='line')continue;
    if(layer.id.startsWith('obc-')||layer.id==='turkey-boundaries')continue;
    const id=layer.id.toLowerCase();
    // Hide subordinate administrative boundaries in country-only mode.
    if(/admin|boundary|border/.test(id)&&!/country|national|admin-0|admin_0|admin0/.test(id)){
      try{map.setLayoutProperty(layer.id,'visibility',detailed?'visible':'none')}catch(_){}
    }
  }
  if(map.getLayer('turkey-boundaries'))
    map.setLayoutProperty('turkey-boundaries','visibility',showPlates&&detailed?'visible':'none');
  if(map.getLayer('obc-country-borders-line'))
    map.setLayoutProperty('obc-country-borders-line','visibility','visible');
}
boundaryButton.addEventListener('click',()=>{
  boundaryMode=boundaryMode==='country'?'states':boundaryMode==='states'?'all':'country';
  syncBoundaryMode();
});
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
els.languageButton.addEventListener('click',()=>{lang=lang==='tr'?'en':'tr';updateUI();syncGeographyControls();applyMapLanguage();syncCityLabels();syncBoundaryMode();updatePlateMarkers();refreshGeographyMarkers();});
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
  syncCityLabels();
  syncNativeCapitalLayers();
  syncBoundaryMode();
  syncCountryBorders();
  syncCapitalMapLayers();
  ensureProvinceLayers();
  updatePlateMarkers();
});

map.on('zoomend',updatePlateMarkers);

// Resolve a clicked land location to a country instead of only showing coordinates.
let countryClickRequest=0;
map.on('click',async e=>{
  const requestId=++countryClickRequest;
  const features=showPlates&&map.getLayer('turkey-boundaries')
    ? map.queryRenderedFeatures(e.point,{layers:['turkey-boundaries']}) : [];
  if(features.length){
    const p=features[0].properties;
    showInfo(p.il_adi,`${t('plate')}: ${String(p.plaka??p.il_kodu).padStart(2,'0')}`,e.lngLat,t('province'));
    showSpecial(p.il_adi);
    const tr=countries.find(c=>c.cca2==='TR');
    if(tr){chosenCountry=tr;addCountryPopulation(tr);sayCat(countryFact(tr),'explore');addFactReplayButton(tr);}
    return;
  }
  if(!countries.length){
    showInfo(`${e.lngLat.lat.toFixed(3)}°, ${e.lngLat.lng.toFixed(3)}°`,lang==='tr'?'Ülke verileri henüz yüklenmedi.':'Country data is not loaded yet.',e.lngLat,t('location'));
    return;
  }
  try{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&addressdetails=1&accept-language=${lang}&lat=${e.lngLat.lat}&lon=${e.lngLat.lng}`;
    const response=await fetch(url);
    if(!response.ok)throw Error(`Reverse lookup HTTP ${response.status}`);
    const place=await response.json();
    if(requestId!==countryClickRequest)return;
    const country=findCountry(place);
    if(country)showCountry(country,e.lngLat);
    else showInfo(`${e.lngLat.lat.toFixed(3)}°, ${e.lngLat.lng.toFixed(3)}°`,lang==='tr'?'Bu konum için ülke bilgisi bulunamadı.':'No country found for this location.',e.lngLat,t('location'));
  }catch(err){
    console.warn('Country identification failed',err);
    if(requestId===countryClickRequest)showInfo(`${e.lngLat.lat.toFixed(3)}°, ${e.lngLat.lng.toFixed(3)}°`,lang==='tr'?'Konum bilgisi alınamadı. Ülkeyi arama kutusundan seçebilirsin.':'Location lookup failed. Try the search box.',e.lngLat,t('location'));
  }
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
let countries=[],flagMarkers=[],capitalMarkers=[],showFlags=true,showCapitals=true;
function syncGeographyControls(){for(const [el,on] of [[flagsBtn,showFlags],[capitalsBtn,showCapitals]]){el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));}document.getElementById('flagsText').textContent=lang==='tr'?`Bayraklar: ${showFlags?'Açık':'Kapalı'}`:`Flags: ${showFlags?'On':'Off'}`;document.getElementById('capitalText').textContent=lang==='tr'?`Başkentler: ${showCapitals?'Açık':'Kapalı'}`:`Capitals: ${showCapitals?'On':'Off'}`;}
function syncNativeCapitalLayers(){
  // Native capital labels are disabled; only our dedicated capital layer renders them.
  for(const layer of map.getStyle()?.layers||[]){
    if(layer.type==='symbol'&&/capital/i.test(layer.id)&&!layer.id.startsWith('obc-')){
      try{map.setLayoutProperty(layer.id,'visibility','none')}catch(_){}
    }
  }
}

const flagIcon=code=>code?.replace(/./g,ch=>String.fromCodePoint(127397+ch.charCodeAt(0)))||'⚑';
const countryCode=c=>c.cca2?.toLowerCase();
const cleanName=c=>c.translations?.[lang==='tr'?'tur':'eng']?.common||c.name?.common||c.cca2;
const GEO_FACTS={
 TR:['Türkiye hem Avrupa hem Asya kıtalarında yer alır.','Türkiye üç tarafı denizlerle çevrili bir ülkedir.'],
 JP:['Japonya binlerce adadan oluşan bir takımadalar ülkesidir.','Fuji Dağı, Japonya’nın en tanınan doğal simgelerinden biridir.'],
 IT:['İtalya’nın haritadaki şekli bir çizmeye benzetilir.','İtalya sınırlarında Vatikan ve San Marino adlı iki bağımsız devlet yer alır.'],
 BR:['Amazon Nehri ve Amazon yağmur ormanlarının önemli bir bölümü Brezilya’dadır.'],
 AU:['Avustralya hem bir ülke hem de bir kıta olarak anılır.'],
 CA:['Kanada dünyanın yüzölçümü en büyük ikinci ülkesidir.'],
 EG:['Nil Nehri Mısır’dan geçerek Akdeniz’e dökülür.'],
 ID:['Endonezya binlerce adadan oluşur.'],
 IS:['İzlanda, Kuzey Atlantik’te volkanik bir ada ülkesidir.'],
 GR:['Yunanistan’ın Ege ve İyon denizlerinde çok sayıda adası bulunur.']
};
let factIndex=0;
function countryFact(c){
  const capital=c.capital?.[0]||'—';
  const facts=GEO_FACTS[c.cca2];
  if(lang==='tr'&&facts?.length)return `${cleanName(c)}: ${facts[factIndex++%facts.length]}`;
  const pop=formatPopulation(c);
  return lang==='tr'
    ? `${cleanName(c)} ülkesinin başkenti ${capital}. Bölge: ${c.region||'—'}. Nüfus: ${pop}.`
    : `${cleanName(c)} — Capital: ${capital}. Region: ${c.region||'—'}. Population: ${pop}.`;
}
function addFactReplayButton(c){
  let button=document.getElementById('countryFactReplay');
  if(!button){button=document.createElement('button');button.id='countryFactReplay';button.type='button';button.className='fact-replay';}
  button.textContent=lang==='tr'?'🐱 irocero’dan bilgi al':'🐱 Ask irocero for a fact';
  button.onclick=()=>{
    if(!catPrefs.facts){catPrefs.facts=true;updateCat();}
    sayCat(countryFact(c),'explore');
  };
  els.infoDescription.append(button);
}

function findCountry(place){const a=place.address||{};const code=a.country_code?.toUpperCase();if(code)return countries.find(c=>c.cca2===code);return null;}
// Curated examples: food identities are culturally shared; no claim of an official national dish.
const FOOD_EXAMPLES={
 TR:[['İskender kebap','🍖'],['Baklava','🥮'],['Mantı','🥟']],JP:[['Sushi','🍣'],['Ramen','🍜'],['Onigiri','🍙']],IT:[['Pizza Margherita','🍕'],['Pasta','🍝'],['Gelato','🍨']],
 FR:[['Croissant','🥐'],['Ratatouille','🥘']],DE:[['Bratwurst','🌭'],['Pretzel','🥨']],ES:[['Paella','🥘'],['Tortilla española','🍳']],
 GR:[['Moussaka','🍆'],['Souvlaki','🍢']],US:[['Burger','🍔'],['Apple pie','🥧']],MX:[['Tacos','🌮'],['Tamales','🫔']],
 BR:[['Feijoada','🥘'],['Pão de queijo','🧀']],AR:[['Empanadas','🥟'],['Asado','🍖']],CA:[['Poutine','🍟']],
 IN:[['Biryani','🍚'],['Dosa','🥞']],CN:[['Dumplings','🥟'],['Hot pot','🍲']],KR:[['Bibimbap','🍚'],['Kimchi','🥬']],
 TH:[['Pad thai','🍜'],['Tom yum','🍲']],VN:[['Phở','🍜'],['Bánh mì','🥖']],ID:[['Nasi goreng','🍚'],['Satay','🍢']],
 EG:[['Koshari','🍚']],MA:[['Tagine','🥘'],['Couscous','🍚']],GB:[['Fish and chips','🐟']],UA:[['Borshch','🍲']],
 AU:[['Meat pie','🥧']],NZ:[['Pavlova','🍰']],PT:[['Pastel de nata','🥧']],PL:[['Pierogi','🥟']],
 SE:[['Köttbullar','🍖']],NO:[['Fårikål','🍲']],FI:[['Karjalanpiirakka','🥧']],IL:[['Shakshuka','🍳']],
 LB:[['Tabbouleh','🥗']],ET:[['Injera','🫓']],NG:[['Jollof rice','🍚']],ZA:[['Bobotie','🥘']]
};
let chosenCountry=null;
function addCountryFoods(c){
  chosenCountry=c;
  const foods=FOOD_EXAMPLES[c.cca2]||[];
  const section=document.createElement('section');section.className='country-foods';
  const title=document.createElement('strong');title.textContent=lang==='tr'?'Yerel yemekler · irocero ile dene':'Local dishes · feed irocero';section.append(title);
  if(!foods.length){const note=document.createElement('p');note.textContent=lang==='tr'?'Bu ülke için yemekler henüz eklenmedi.':'Dishes for this country are not added yet.';section.append(note);return section;}
  const list=document.createElement('div');list.className='food-options';
  for(const [name,emoji] of foods){const b=document.createElement('button');b.type='button';b.textContent=emoji+' '+name;
    b.addEventListener('click',()=>feedLocalFood(name,emoji,c));list.append(b);
  }section.append(list);return section;
}
function feedLocalFood(name,emoji,c){
  catPrefs.fullness=Math.min(100,catPrefs.fullness+16);
  catPrefs.happiness=Math.min(100,catPrefs.happiness+7);
  sayCat((lang==='tr'?'Mmm! ':'Yum! ')+name+' '+emoji+' · '+cleanName(c),'feed');
  const floating=document.getElementById('floatingCat');
  floating.classList.add('food-action');
  floating.style.setProperty('--food-emoji',`"${emoji}"`);
  clearTimeout(window.__foodAnimationTimer);
  window.__foodAnimationTimer=setTimeout(()=>floating.classList.remove('food-action'),3100);
  updateCat();
}
// World Bank WDI: total population (SP.POP.TOTL), latest nonempty annual observation.
// The response includes the observation year. Requests are cached in this tab.
const worldBankPopulationCache=new Map();
async function worldBankPopulation(iso2){
  const code=String(iso2||'').toUpperCase();
  if(!/^[A-Z]{2}$/.test(code))return null;
  if(!worldBankPopulationCache.has(code)){
    const task=(async()=>{
      const url=`https://api.worldbank.org/v2/country/${code}/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=10`;
      const res=await fetch(url);
      if(!res.ok)throw new Error(`World Bank HTTP ${res.status}`);
      const data=await res.json();
      const row=Array.isArray(data?.[1])?data[1].find(x=>Number.isFinite(Number(x.value))&&Number(x.value)>0):null;
      return row?{value:Number(row.value),year:String(row.date),source:'World Bank'}:null;
    })().catch(error=>{console.warn('Population lookup:',code,error);return null});
    worldBankPopulationCache.set(code,task);
  }
  return worldBankPopulationCache.get(code);
}
function applyPopulationToElement(element,c){
  if(!element)return;
  const fallback=Number(c?.population);
  element.textContent=Number.isFinite(fallback)&&fallback>0
    ?fallback.toLocaleString(lang==='tr'?'tr-TR':'en-US')+' (kaynak: ülke verisi)'
    :(lang==='tr'?'Nüfus yükleniyor…':'Loading population…');
  worldBankPopulation(c?.cca2).then(result=>{
    if(!element.isConnected)return;
    if(result){
      element.textContent=`${result.value.toLocaleString(lang==='tr'?'tr-TR':'en-US')} (${result.year} · World Bank)`;
    }else if(!(fallback>0)){
      element.textContent=lang==='tr'?'Nüfus verisi alınamadı':'Population unavailable';
    }
  });
}
function formatPopulation(c){
  const pop=Number(c?.population);
  return Number.isFinite(pop)&&pop>0?pop.toLocaleString(lang==='tr'?'tr-TR':'en-US'):(lang==='tr'?'Veri bulunamadı':'Data unavailable');
}
function addCountryPopulation(c){
  if(!c)return;
  const row=document.createElement('div');row.className='country-population-extra';
  const b=document.createElement('strong');b.textContent=lang==='tr'?'Ülke nüfusu':'Country population';
  const val=document.createElement('span');applyPopulationToElement(val,c);
  row.append(b,val);els.infoDescription.append(row);
}
function showCountry(c,coord){const place=coord||{lat:c.latlng?.[0]||0,lng:c.latlng?.[1]||0};showInfo(`${flagIcon(c.cca2)} ${cleanName(c)}`,countryFact(c),place,lang==='tr'?'ÜLKE':'COUNTRY');const image=document.createElement('div');image.className='country-card';const flag=document.createElement('img');flag.src=`https://flagcdn.com/w160/${countryCode(c)}.png`;flag.alt=cleanName(c);flag.loading='lazy';flag.onerror=()=>{flag.replaceWith(document.createTextNode(flagIcon(c.cca2)+' '));};const name=document.createElement('strong');name.textContent=cleanName(c);image.append(flag,name);const stats=document.createElement('div');stats.className='country-stats';const rows=[[lang==='tr'?'Başkent':'Capital',c.capital?.join(', ')||'—'],[lang==='tr'?'Bölge':'Region',c.region||'—'],[lang==='tr'?'Nüfus':'Population','__POPULATION_LOADING__'],[lang==='tr'?'Yüzölçümü':'Area',`${(c.area||0).toLocaleString()} km²`]];for(const [label,value] of rows){const cell=document.createElement('div');const b=document.createElement('b');b.textContent=label;cell.append(b,document.createTextNode(value));stats.append(cell);if(value==='__POPULATION_LOADING__'){
    const valueNode=cell.lastChild;
    const valueSpan=document.createElement('span');
    valueNode.replaceWith(valueSpan);
    applyPopulationToElement(valueSpan,c);
  }}els.infoDescription.replaceChildren(image,stats,addCountryFoods(c));addFactReplayButton(c);sayCat(countryFact(c),'explore');}
function capitalFeatures(){
  return countries.filter(c=>showCapitals && Array.isArray(c.capitalInfo?.latlng) && c.capitalInfo.latlng.length===2 && c.capital?.[0]).map(c=>({
    type:'Feature', geometry:{type:'Point',coordinates:[Number(c.capitalInfo.latlng[1]),Number(c.capitalInfo.latlng[0])]},
    properties:{code:c.cca2,name:c.capital[0]}
  })).filter(f=>f.geometry.coordinates.every(Number.isFinite));
}
// A lightweight coastline + international boundary overlay independent of the tile theme.
// Natural Earth 1:50m polygons, distributed in TopoJSON by world-atlas.
let countryBorders=null;
const BORDERS_URL='https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
async function loadCountryBorders(){
  try{
    const response=await fetch(BORDERS_URL);
    if(!response.ok)throw new Error(`Boundaries HTTP ${response.status}`);
    const topology=await response.json();
    // Shared arcs only: draw international land borders, not each country's coastline.
    countryBorders=topoMesh(topology,topology.objects.countries,(a,b)=>a!==b);
    syncCountryBorders();
  }catch(e){console.warn('Country boundary overlay unavailable; using base map boundaries',e);}
}
function syncCountryBorders(){
  if(!countryBorders||!map.isStyleLoaded())return;
  if(!map.getSource('obc-country-borders'))map.addSource('obc-country-borders',{type:'geojson',data:countryBorders});
  const firstSymbol=map.getStyle()?.layers?.find(l=>l.type==='symbol')?.id;
  if(!map.getLayer('obc-country-borders-line')){
    map.addLayer({id:'obc-country-borders-line',type:'line',source:'obc-country-borders',paint:{
      'line-color':theme==='dark'?'#d6e8ff':'#4a6790',
      'line-width':['interpolate',['linear'],['zoom'],1,0.55,3,0.85,5,1.25,8,1.65],
      'line-opacity':theme==='dark'?0.95:0.65,
      'line-blur':0
    }},firstSymbol);
  }
  map.setPaintProperty('obc-country-borders-line','line-color',theme==='dark'?'#d6e8ff':'#4a6790');
  map.setPaintProperty('obc-country-borders-line','line-opacity',theme==='dark'?1:0.85);
  map.setPaintProperty('obc-country-borders-line','line-width',
    ['interpolate',['linear'],['zoom'],1,1.1,3,1.6,5,2.2,8,2.7,12,3.2]);
  syncBoundaryMode();
}
function syncCapitalMapLayers(){
  if(!map.isStyleLoaded())return;
  const data={type:'FeatureCollection',features:capitalFeatures()};
  if(!map.getSource('obc-capitals'))map.addSource('obc-capitals',{type:'geojson',data});
  else map.getSource('obc-capitals').setData(data);
  if(!map.getLayer('obc-capital-halo'))map.addLayer({id:'obc-capital-halo',type:'circle',source:'obc-capitals',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],1,1.6,4,2.1,7,2.8,11,3.3],
    'circle-color':theme==='dark'?'#ffda80':'#a65a07',
    'circle-stroke-color':theme==='dark'?'#253854':'#ffffff',
    'circle-stroke-width':1,
    'circle-opacity':0.92
  }});
  if(!map.getLayer('obc-capital-names'))map.addLayer({id:'obc-capital-names',type:'symbol',source:'obc-capitals',minzoom:4.5,layout:{
    'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],4.5,9,9,11],
    'text-anchor':'left','text-offset':[0.65,0],
    'text-font':['Noto Sans Regular'],
    'text-optional':true,'text-allow-overlap':false,'symbol-sort-key':0
  },paint:{'text-color':theme==='dark'?'#ffd994':'#8a4600',
    'text-halo-color':theme==='dark'?'#17283f':'#ffffff','text-halo-width':1.3,
    'text-halo-blur':0.2}});
  map.setPaintProperty('obc-capital-halo','circle-color',theme==='dark'?'#ffda80':'#a65a07');
  map.setPaintProperty('obc-capital-halo','circle-stroke-color',theme==='dark'?'#253854':'#ffffff');
  map.setPaintProperty('obc-capital-names','text-color',theme==='dark'?'#ffd994':'#8a4600');
  map.setPaintProperty('obc-capital-names','text-halo-color',theme==='dark'?'#17283f':'#ffffff');
  for(const id of ['obc-capital-halo','obc-capital-names'])map.setLayoutProperty(id,'visibility',showCapitals?'visible':'none');
}
function refreshGeographyMarkers(){
  for(const m of [...flagMarkers,...capitalMarkers])m.remove();
  flagMarkers=[];capitalMarkers=[];
  for(const c of countries){
    if(showFlags&&c.latlng?.length===2&&c.cca2?.length===2){
      const el=document.createElement('button');el.type='button';el.className='map-flag';el.title=cleanName(c);
      const img=document.createElement('img');img.src=`https://flagcdn.com/w40/${countryCode(c)}.png`;img.alt=cleanName(c);img.loading='lazy';
      img.onerror=()=>{img.remove();el.textContent=flagIcon(c.cca2);};el.append(img);
      el.addEventListener('click',ev=>{ev.stopPropagation();showCountry(c)});
      flagMarkers.push(new maplibregl.Marker({element:el}).setLngLat([c.latlng[1],c.latlng[0]]).addTo(map));
    }
  }
  syncCapitalMapLayers();
}
flagsBtn.addEventListener('click',()=>{showFlags=!showFlags;syncGeographyControls();refreshGeographyMarkers()});
capitalsBtn.addEventListener('click',()=>{showCapitals=!showCapitals;syncGeographyControls();syncNativeCapitalLayers();refreshGeographyMarkers()});
async function fetchCountries(){
  const sources=[
    'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
  ];
  for(const url of sources){
    try{
      const r=await fetch(url,{cache:'no-cache'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const data=await r.json();
      if(!Array.isArray(data)||data.length<150)throw Error('Countries data invalid');
      countries=data.filter(c=>c.cca2&&Array.isArray(c.latlng));
      refreshGeographyMarkers();
      setStatus('');
      return;
    }catch(e){console.warn('Country source error',url,e)}
  }
  setStatus(lang==='tr'?'Bayraklar için ülke verileri yüklenemedi. Bağlantıyı kontrol et.':'Country data for flags could not be loaded. Check connection.');
}
const catPanel=document.getElementById('catPanel'),catBubble=document.getElementById('catBubble'),catState=document.getElementById('catState'),catEffect=document.getElementById('catEffect');
const catEls={happiness:document.getElementById('happiness'),fullness:document.getElementById('fullness'),style:document.getElementById('catStyle'),color:document.getElementById('catColor'),eye:document.getElementById('catEye'),motion:document.getElementById('catMotion'),facts:document.getElementById('catFacts')};
const defaults={style:'cartoon',color:'orange',eye:'amber',motion:true,facts:true,happiness:75,fullness:70,hidden:false,position:null};let catPrefs;try{catPrefs={...defaults,...JSON.parse(localStorage.getItem('irocero'))}}catch{catPrefs={...defaults}}
let catActionTimer=null;function saveCat(){try{localStorage.setItem('irocero',JSON.stringify(catPrefs))}catch{}}
function updateCat(){catPanel.classList.toggle('pixel',catPrefs.style==='pixel');catPanel.classList.toggle('minimal',catPrefs.style==='minimal');catPanel.classList.toggle('black',catPrefs.color==='black');catPanel.classList.toggle('white',catPrefs.color==='white');catPanel.classList.toggle('no-motion',!catPrefs.motion);catPanel.hidden=catPrefs.hidden;document.getElementById('restoreCat').hidden=!catPrefs.hidden;catEls.happiness.value=catPrefs.happiness;catEls.fullness.value=catPrefs.fullness;catEls.style.value=catPrefs.style;catEls.color.value=catPrefs.color;catEls.eye.value=catPrefs.eye||'amber';catPanel.style.setProperty('--cat-eye',({amber:'#e5a742',green:'#66cf8e',blue:'#78bafa'})[catPrefs.eye]||'#e5a742');catEls.motion.checked=catPrefs.motion;catEls.facts.checked=catPrefs.facts;saveCat();}
function sayCat(message,action='idle'){if(action==='explore'&&!catPrefs.facts)return;catBubble.textContent=message;catPanel.classList.remove('sleeping','eating','happy','explore');catPanel.classList.add(({feed:'eating',pet:'happy',sleep:'sleeping',explore:'explore'})[action]||'idle');catEffect.textContent=({feed:'🐟',pet:'♥',sleep:'Zzz',explore:'🔎'})[action]||'';catState.textContent=action==='sleep'?'◌':'●';if(catActionTimer)clearTimeout(catActionTimer);if(action!=='sleep')catActionTimer=setTimeout(()=>{catPanel.classList.remove('eating','happy','explore');catEffect.textContent=''},3200)}
document.getElementById('feedButton').onclick=()=>{catPrefs.fullness=Math.min(100,catPrefs.fullness+20);sayCat(lang==='tr'?'Miyav! Çok lezzetliydi!':'Meow! Delicious!','feed');updateCat()};
function petCat(){catPrefs.happiness=Math.min(100,catPrefs.happiness+15);sayCat(lang==='tr'?'Prrrr... teşekkürler!':'Prrrr... thank you!','pet');updateCat()}
document.getElementById('petButton').onclick=petCat;document.getElementById('catAvatar').onclick=petCat;
document.getElementById('napButton').onclick=()=>sayCat(lang==='tr'?'Biraz uyuyorum...':'Taking a little nap...','sleep');
document.getElementById('catSettingsButton').onclick=()=>{const s=document.getElementById('catSettings');s.hidden=!s.hidden};
for(const [key,el] of [['style',catEls.style],['color',catEls.color],['eye',catEls.eye],['motion',catEls.motion],['facts',catEls.facts]])el.addEventListener('change',()=>{catPrefs[key]=el.type==='checkbox'?el.checked:el.value;updateCat()});
document.getElementById('hideCat').onclick=()=>{catPrefs.hidden=true;updateCat()};document.getElementById('restoreCat').onclick=()=>{catPrefs.hidden=false;updateCat()};
// Detach only the mascot illustration: the original controls panel remains anchored.
const floatingCat=document.createElement('div');
floatingCat.id='floatingCat';floatingCat.className='floating-cat';
const mascotSlot=document.createElement('div');mascotSlot.className='mascot-slot';
const detachedAvatar=document.getElementById('catAvatar');
detachedAvatar.parentNode.insertBefore(mascotSlot,detachedAvatar);
floatingCat.appendChild(detachedAvatar);
document.body.appendChild(floatingCat);
function syncFloatingAppearance(){
  floatingCat.className='floating-cat '+['pixel','minimal','black','white','sleeping','eating','happy','explore','no-motion'].filter(c=>catPanel.classList.contains(c)).join(' ');
  floatingCat.style.setProperty('--cat-eye',getComputedStyle(catPanel).getPropertyValue('--cat-eye')||'#e5a742');
  floatingCat.hidden=catPrefs.hidden;
}
const syncMascotObserver=new MutationObserver(syncFloatingAppearance);
syncMascotObserver.observe(catPanel,{attributes:true,attributeFilter:['class','style','hidden']});
syncFloatingAppearance();
// Independent dragging coordinates; old saved panel positions are intentionally reset once.
if(!localStorage.getItem('irocero-v34-migrated')){catPrefs.position=null;saveCat();localStorage.setItem('irocero-v34-migrated','1');}
// Drag irocero by its illustration (mouse or touch). A short tap still pets it.
const catAvatar=document.getElementById('catAvatar');
let draggingCat=null,ignoreNextPet=false;
function placeCat(x,y){
  const rect=floatingCat.getBoundingClientRect();
  const nx=Math.max(4,Math.min(window.innerWidth-rect.width-4,x));
  const ny=Math.max(4,Math.min(window.innerHeight-rect.height-4,y));
  floatingCat.style.left=nx+'px';floatingCat.style.top=ny+'px';
  floatingCat.style.right='auto';floatingCat.style.bottom='auto';
  return {x:nx,y:ny};
}
catAvatar.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const r=floatingCat.getBoundingClientRect();
  draggingCat={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:r.left,y:r.top,moved:false};
  catAvatar.setPointerCapture(e.pointerId);
});
catAvatar.addEventListener('pointermove',e=>{
  if(!draggingCat||draggingCat.id!==e.pointerId)return;
  const dx=e.clientX-draggingCat.startX,dy=e.clientY-draggingCat.startY;
  if(Math.hypot(dx,dy)>7)draggingCat.moved=true;
  if(draggingCat.moved){placeCat(draggingCat.x+dx,draggingCat.y+dy);e.preventDefault();}
});
function finishCatDrag(e){
  if(!draggingCat||draggingCat.id!==e.pointerId)return;
  if(draggingCat.moved){
    const r=floatingCat.getBoundingClientRect();
    catPrefs.position={x:r.left,y:r.top};saveCat();
    ignoreNextPet=true;
  }
  draggingCat=null;
}
catAvatar.addEventListener('pointerup',finishCatDrag);
catAvatar.addEventListener('pointercancel',finishCatDrag);
catAvatar.addEventListener('click',e=>{if(ignoreNextPet){e.stopImmediatePropagation();ignoreNextPet=false;}},true);
window.addEventListener('resize',()=>{if(catPrefs.position){catPrefs.position=placeCat(catPrefs.position.x,catPrefs.position.y);saveCat();}});
updateCat();
if(catPrefs.position)catPrefs.position=placeCat(catPrefs.position.x,catPrefs.position.y);
fetchCountries();

// Anıtkabir: permanent real-world map marker (no automatic tribute overlay).
const ANITKABIR=[32.83778,39.92556];
const monumentEl=document.createElement('button');
monumentEl.type='button';
monumentEl.className='anitkabir-marker';
monumentEl.title='Anıtkabir';
monumentEl.setAttribute('aria-label','Anıtkabir');
monumentEl.textContent='★';
const monumentPopup=new maplibregl.Popup({offset:22,maxWidth:'280px'}).setHTML(
  '<strong>Anıtkabir</strong><p>Mustafa Kemal Atatürk’ün anıt mezarı · Çankaya, Ankara</p><a href="https://www.anitkabir.tsk.tr/" target="_blank" rel="noopener noreferrer">Resmî web sitesi ↗</a>'
);
new maplibregl.Marker({element:monumentEl,anchor:'bottom'})
  .setLngLat(ANITKABIR).setPopup(monumentPopup).addTo(map);
function syncMonumentMarker(){monumentEl.hidden=map.getZoom()<6;}
map.on('zoom',syncMonumentMarker);
syncMonumentMarker();

// Personal location experiences. Text is original, not presented as an Atatürk quotation.
const specialPanel=document.getElementById('specialPanel');
let lastSpecial='';
const specialLines={
  bucak:['mrbbb','sellllaammmmm','ne diyosunnn fistik'],
  kastamonu:['sellllaammmmm','mrbbb','ne diyosunnn fistik']
};
function showSpecial(place){
  const normalized=(place||'').toLocaleLowerCase('tr-TR');
  const isBucak=/\bbucak\b/.test(normalized);
  const isKastamonu=/\bkastamonu\b/.test(normalized);
  if(!isBucak && !isKastamonu)return;
  const key=isBucak?'bucak':'kastamonu';
  const n=Number(sessionStorage.getItem('obcAtlas.specialVisits.'+key)||'0');
  sessionStorage.setItem('obcAtlas.specialVisits.'+key,String(n+1));
  const line=specialLines[key][n%specialLines[key].length];
  sayCat(line,'explore');
  specialPanel.replaceChildren();
  const h=document.createElement('h2');h.textContent=key==='bucak'?'Bucak sürprizi!':'Kastamonu sürprizi!';
  const p=document.createElement('p');p.textContent=`irocero: ${line}`;
  specialPanel.append(h,p);
  specialPanel.hidden=false;
  const seq=JSON.parse(sessionStorage.getItem('obcAtlas.secretRoute')||'[]');
  seq.push(key);
  const last=seq.slice(-2);
  sessionStorage.setItem('obcAtlas.secretRoute',JSON.stringify(last));
  if(last.join('>')==='bucak>kastamonu' || last.join('>')==='kastamonu>bucak'){
    const secret=document.createElement('p');secret.className='secret-message';
    secret.textContent='Gizli rota bulundu! Bucak ve Kastamonu aynı haritada buluştu. irocero: sellllaammmmm! ✨';
    specialPanel.append(secret);
    sayCat('sellllaammmmm! Gizli rota bulundu!','explore');
  }
  lastSpecial=key;
}
document.getElementById('closeSpecial').addEventListener('click',()=>specialPanel.hidden=true);

function closeSearchResults(){resultPanel.hidden=true;resultPanel.replaceChildren();}
function focusPlace(place){
  const lon=Number(place.lon),lat=Number(place.lat);
  if(place.boundingbox){
    const b=place.boundingbox.map(Number);
    map.fitBounds([[b[2],b[0]],[b[3],b[1]]],{padding:90,maxZoom:12,duration:1300});
  }else map.flyTo({center:[lon,lat],zoom:9});
  const match=findCountry(place);if(match&&(place.addresstype==='country'||place.type==='administrative'&&place.addresstype==='country'||place.class==='boundary'&&place.type==='administrative'&&place.address?.country===place.name))showCountry(match,{lat,lng:lon});else{showInfo(place.name||place.display_name.split(',')[0],place.display_name,{lat,lng:lon},t('location'));if(match){chosenCountry=match;addCountryPopulation(match);sayCat(countryFact(match),'explore');addFactReplayButton(match);}}
  showSpecial(place.display_name||place.name||'');
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
function focusPlate(code){
  if(!provinceData){setStatus(lang==='tr'?'İl verileri henüz yüklenmedi. Tekrar dene.':'Province data is not ready. Try again.');return;}
  const f=provinceData.features.find(f=>Number(f.properties?.plaka??f.properties?.il_kodu)===code);
  if(!f){setStatus(lang==='tr'?'Plaka bulunamadı.':'Plate code not found.');return;}
  const pts=[];
  function scan(v){if(!Array.isArray(v))return;if(typeof v[0]==='number'&&typeof v[1]==='number')pts.push(v);else v.forEach(scan)}
  scan(f.geometry.coordinates);if(!pts.length)return;
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const lo=Math.min(...xs),hi=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
  map.fitBounds([[lo,bottom],[hi,top]],{padding:90,maxZoom:10,duration:1100});
  const name=f.properties?.il_adi||f.properties?.name||String(code);
  showInfo(name,`${lang==='tr'?'Plaka kodu':'Plate code'}: ${String(code).padStart(2,'0')}`,{lat:(bottom+top)/2,lng:(lo+hi)/2},t('province'));
  addCountryPopulation(countries.find(c=>c.cca2==='TR'));
  showSpecial(name);
  closeSearchResults();setStatus('');
}
async function searchPlace(query){
  const plate=query.trim().match(/^(?:plaka\s*[:#-]?\s*)?(\d{1,2})$/i);
  if(plate){const code=Number(plate[1]);if(code>=1&&code<=81)focusPlate(code);else setStatus(lang==='tr'?'Plaka 01–81 arasında olmalı.':'Plate code must be 01–81.');return;}
  // Offline lookup for the custom easter-egg locations.
  const normalized=query.toLocaleLowerCase('tr-TR').trim();
  const local=(/^(?:bucak)(?:,|$|\s)/.test(normalized))
    ? {name:'Bucak',display_name:'Bucak, Burdur, Türkiye',lat:37.459,lon:30.595}
    : (/^(?:kastamonu)(?:,|$|\s)/.test(normalized))
      ? {name:'Kastamonu',display_name:'Kastamonu, Türkiye',lat:41.389,lon:33.783}
      : null;
  if(local){focusPlace(local);return;}
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
    setStatus(lang==='tr'
      ? `Arama servisine ulaşılamadı (${err?.message||'bağlantı hatası'}). Bucak, Kastamonu ve plakaları doğrudan arayabilirsin.`
      : `Search service unavailable (${err?.message||'connection error'}). Bucak, Kastamonu and plate searches work offline.`);
  }finally{els.searchButton.disabled=false;}
}
resultPanel.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearchResults();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearchResults();});
document.addEventListener('pointerdown',e=>{if(!els.searchForm.contains(e.target) && !resultPanel.contains(e.target))closeSearchResults();});

els.searchForm.addEventListener('submit',event=>{
  event.preventDefault();
  const q=els.searchInput.value.trim();
  if(q) searchPlace(q);
});

map.on('error',e=>{console.warn('Map:',e.error);});

updateUI();
syncGeographyControls();
loadCountryBorders();
fetchProvinces();

// Shared daily games: committed in games.json and displayed in the author's order.
const gamesButton=document.getElementById('gamesButton');
const gamesPanel=document.getElementById('gamesPanel');
const gamesList=document.getElementById('gamesList');
const gameFilters=document.getElementById('gameFilters');
let sharedGames=[];
let activeGameFilter='all';
const gameCategories={
  all:{tr:'Hepsi',en:'All'},
  word:{tr:'Kelime',en:'Words'},
  logic:{tr:'Mantık / Bilgi',en:'Logic / Trivia'},
  gaming:{tr:'Oyun karakterleri',en:'Game Characters'},
  geo:{tr:'Coğrafya',en:'Geography'}
};
function gameTranslation(key){return gameCategories[key]?.[lang]||key;}
function renderGames(){
  document.getElementById('gamesHeading').textContent=lang==='tr'?'Günlük Oyunlar':'Daily Games';
  document.getElementById('gamesIntro').textContent=lang==='tr'?'Arkadaşlarınla oynadığın oyunlar. Bağlantılar yeni sekmede açılır.':'Your daily games. Links open in a new tab.';
  document.getElementById('gamesFooter').textContent=lang==='tr'?'Ortak liste GitHub’daki games.json dosyasından yüklenir.':'Shared list loads from games.json on GitHub.';
  gameFilters.replaceChildren();
  for(const key of Object.keys(gameCategories)){
    const button=document.createElement('button');
    button.type='button';button.textContent=gameTranslation(key);
    button.className='game-filter'+(key===activeGameFilter?' is-active':'');
    button.setAttribute('aria-pressed',String(key===activeGameFilter));
    button.addEventListener('click',()=>{activeGameFilter=key;renderGames();});
    gameFilters.append(button);
  }
  gamesList.replaceChildren();
  const displayed=sharedGames.filter(g=>activeGameFilter==='all'||g.category===activeGameFilter);
  if(!displayed.length){
    const empty=document.createElement('p');empty.className='games-empty';
    empty.textContent=lang==='tr'?'Bu kategoride oyun bulunamadı.':'No games in this category.';
    gamesList.append(empty);return;
  }
  for(const g of displayed){
    const item=document.createElement('div');item.className='game-item';
    const order=document.createElement('span');order.className='game-order';order.textContent=String(g.order).padStart(2,'0');
    const link=document.createElement('a');link.textContent=g.name;link.href=g.url;
    link.target='_blank';link.rel='noopener noreferrer';
    const category=document.createElement('span');category.className='game-category';category.textContent=gameTranslation(g.category);
    const arrow=document.createElement('span');arrow.className='game-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
    item.append(order,link,category,arrow);gamesList.append(item);
  }
}
async function loadSharedGames(){
  try{
    const response=await fetch('./games.json',{cache:'no-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(!Array.isArray(data))throw Error('Invalid games.json');
    sharedGames=data.filter(g=>Number.isInteger(g.order)&&typeof g.name==='string'&&typeof g.category==='string'&&gameCategories[g.category]&&typeof g.url==='string'&&/^https?:\/\//i.test(g.url))
      .sort((a,b)=>a.order-b.order);
    renderGames();
  }catch(e){
    console.warn('Game list could not be loaded:',e);
    gamesList.textContent=lang==='tr'?'Oyun listesi yüklenemedi. games.json dosyasını kontrol et.':'Could not load games.json.';
  }
}
gamesButton.addEventListener('click',()=>{gamesPanel.hidden=!gamesPanel.hidden;gamesButton.setAttribute('aria-expanded',String(!gamesPanel.hidden));});
document.getElementById('closeGames').addEventListener('click',()=>{gamesPanel.hidden=true;gamesButton.setAttribute('aria-expanded','false');});
// Translation is refreshed whenever the existing language button is used.
els.languageButton.addEventListener('click',renderGames);
renderGames();loadSharedGames();

window.addEventListener('keydown',e=>{if(e.key==='Escape')specialPanel.hidden=true;});
