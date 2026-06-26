// test/e2e/_setup.cjs — shared Playwright helpers for loading the extension.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EXT_DIR = path.resolve(__dirname, '../..');
const ASSET_DIR = path.resolve(__dirname, '../assets');

const BATCH1 = ['ai0', 'real1', 'ai2', 'real3', 'ai4', 'real5', 'ai6', 'real7'];
const BATCH2 = ['ai2', 'real7', 'ai4', 'real1', 'ai6', 'real3', 'ai0', 'real5'];

function card(name, i) {
  const kind = name.replace(/[0-9]/g, '');
  return `
    <li class="product-base" data-testimg="${name}-${i}" style="display:inline-block;width:200px;min-height:340px;vertical-align:top;margin:6px;">
      <div class="product-imageSliderContainer" style="position:relative;width:200px;height:260px;">
        <img class="product-image" width="200" height="260" src="https://assets.myntassets.com/${name}.png?i=${i}" alt="${kind}">
      </div>
      <div class="product-product">${kind} product ${i}</div>
    </li>`;
}

function fixtureHtml() {
  const first = BATCH1.map((n, i) => card(n, i)).join('');
  const second = JSON.stringify(BATCH2);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Myntra Test</title>
  <style>body{margin:0;font-family:sans-serif}.results-base{padding:8px}</style></head>
  <body>
    <ul class="results-base">${first}</ul>
    <div style="height:1200px"></div>
    <script>
      var loaded=false, BATCH2=${second};
      function mkCard(name,i){
        var li=document.createElement('li');
        li.className='product-base'; li.setAttribute('data-testimg', name+'-x'+i);
        li.style.cssText='display:inline-block;width:200px;min-height:340px;vertical-align:top;margin:6px';
        li.innerHTML='<div class="product-imageSliderContainer" style="position:relative;width:200px;height:260px">'+
          '<img class="product-image" width="200" height="260" src="https://assets.myntassets.com/'+name+'.png?b2='+i+'"></div>'+
          '<div class="product-product">'+name+'</div>';
        return li;
      }
      window.addEventListener('scroll', function(){
        if(loaded) return;
        if(window.scrollY+window.innerHeight > document.body.scrollHeight-400){
          loaded=true;
          var grid=document.querySelector('.results-base');
          BATCH2.forEach(function(n,i){ grid.appendChild(mkCard(n,i)); });
        }
      }, {passive:true});
    </script>
  </body></html>`;
}

async function launch() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      '--no-sandbox',
    ],
  });

  await context.addInitScript(() => { try { localStorage.setItem('RMF_DEBUG', '1'); } catch {} });

  // Myntra page → fixture
  await context.route('https://www.myntra.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml() });
  });

  // CDN images, CROSS-ORIGIN, NO CORS header (production-like).
  await context.route('https://assets.myntassets.com/**', (route) => {
    const name = route.request().url().split('/').pop().split('?')[0];
    const file = path.join(ASSET_DIR, name);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'no' });
    route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(file) });
  });

  return context;
}

async function serviceWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
  return sw;
}

async function extensionId(context) {
  const sw = await serviceWorker(context);
  return new URL(sw.url()).host;
}

// Set chrome.storage.sync from the extension's own service-worker context.
async function setSyncStorage(context, obj) {
  const sw = await serviceWorker(context);
  await sw.evaluate((o) => new Promise((r) => chrome.storage.sync.set(o, r)), obj);
}

module.exports = { EXT_DIR, ASSET_DIR, fixtureHtml, launch, serviceWorker, extensionId, setSyncStorage };
