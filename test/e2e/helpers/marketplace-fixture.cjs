// Deterministic HTML fixtures that mimic marketplace listing + product pages.

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

function listingHtml() {
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
          BATCH2.forEach(function(n,i){ document.body.appendChild(mkCard(n,i)); });
        }
      }, {passive:true});
    </script>
  </body></html>`;
}

function productHtml() {
  return `<!doctype html><html><head><meta charset="utf-8">
    <title>Test Cotton Shirt - Buy Online</title>
    <meta property="og:title" content="Test Brand Men Cotton Casual Shirt" />
    <meta property="og:image" content="https://assets.myntassets.com/real1.png?product=1" />
    <meta property="product:brand" content="Test Brand" />
    <meta property="product:price:amount" content="1299" />
    <script type="application/ld+json">
    {"@type":"Product","name":"Test Brand Men Cotton Casual Shirt","brand":{"name":"Test Brand"},
     "aggregateRating":{"ratingValue":"4.3","bestRating":"5"},
     "offers":{"seller":{"name":"Test Seller Pvt Ltd"},"price":"1299"}}
    </script>
  </head><body>
    <h1>Test Brand Men Cotton Casual Shirt</h1>
    <p>₹1,299</p>
    <p>4.3 ★</p>
    <p>Sold by Test Seller Pvt Ltd</p>
    <img src="https://assets.myntassets.com/real1.png?product=1" width="400" height="500" alt="shirt">
  </body></html>`;
}

module.exports = { listingHtml, productHtml, BATCH1, BATCH2 };
