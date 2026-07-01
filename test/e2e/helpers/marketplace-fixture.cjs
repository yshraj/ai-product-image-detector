// Deterministic HTML fixtures that mimic marketplace listing + product pages.

const BATCH1 = ['ai0', 'real1', 'ai2', 'real3', 'ai4', 'real5', 'ai6', 'real7'];
const BATCH2 = ['ai2', 'real7', 'ai4', 'real1', 'ai6', 'real3', 'ai0', 'real5'];

const PRODUCT_META = {
  title: 'Test Brand Men Blue Cotton Casual Shirt',
  brand: 'Test Brand',
  price: '1299',
  image: 'https://assets.myntassets.com/real1.png?product=1',
  seller: 'Test Seller Pvt Ltd',
};

function imgCard(src, label, cardClass, imgClass, wrapClass) {
  return `<div class="${cardClass}" style="display:inline-block;width:200px;min-height:340px;margin:6px;vertical-align:top">
    <div class="${wrapClass}" style="position:relative;width:200px;height:260px">
      <img class="${imgClass}" width="200" height="260" src="${src}" alt="${label}">
    </div>
    <div>${label}</div>
  </div>`;
}

function myntraCard(name, i) {
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
  const first = BATCH1.map((n, i) => myntraCard(n, i)).join('');
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

function flipkartListingHtml() {
  const cards = BATCH1.map((n, i) => imgCard(
    `https://assets.myntassets.com/${n}.png?fk=${i}`,
    `${n} product ${i}`,
    '_1AtVbE',
    '_396cs4',
    '_4WELSP',
  )).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Flipkart Test</title></head>
  <body><div class="_1YokD2 _3Mn1Gg">${cards}</div></body></html>`;
}

function meeshoListingHtml() {
  const cards = BATCH1.map((n, i) => `
    <div class="ProductList__GridCol-sc"><div data-testid="product-card">
      ${imgCard(`https://assets.myntassets.com/${n}.png?ms=${i}`, `${n} ${i}`, 'ProductCard', 'sc-img', 'ProductCard')}
    </div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Meesho Test</title></head>
  <body><main><div class="ProductList__GridCol-sc">${cards}</div></main></body></html>`;
}

function nykaaListingHtml() {
  const cards = BATCH1.map((n, i) => imgCard(
    `https://assets.myntassets.com/${n}.png?nk=${i}`,
    `${n} product ${i}`,
    'css-d5z3ro',
    'img',
    'imageContainer',
  )).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Nykaa Test</title></head>
  <body><div class="css-uo0ckf">${cards}</div></body></html>`;
}

function productHtml(site = 'myntra') {
  const p = PRODUCT_META;
  return `<!doctype html><html><head><meta charset="utf-8">
    <title>${p.title} - Buy Online</title>
    <meta property="og:title" content="${p.title}" />
    <meta property="og:image" content="${p.image}" />
    <meta property="product:brand" content="${p.brand}" />
    <meta property="product:price:amount" content="${p.price}" />
    <script type="application/ld+json">
    {"@type":"Product","name":"${p.title}","brand":{"name":"${p.brand}"},
     "aggregateRating":{"ratingValue":"4.3","bestRating":"5"},
     "offers":{"seller":{"name":"${p.seller}"},"price":"${p.price}"}}
    </script>
  </head><body data-site="${site}">
    <h1>${p.title}</h1>
    <p>₹${Number(p.price).toLocaleString('en-IN')}</p>
    <p>4.3 ★</p>
    <p>Sold by ${p.seller}</p>
    <img src="${p.image}" width="400" height="500" alt="shirt">
  </body></html>`;
}

/** Mock SerpApi Google Shopping response for compare tests. */
function serpShoppingResponse(query) {
  return {
    shopping_results: [
      {
        title: 'Test Brand Men Blue Cotton Casual Shirt',
        price: '₹1,299',
        link: 'https://www.amazon.in/dp/B00TEST',
        thumbnail: 'https://assets.myntassets.com/real1.png',
      },
      {
        title: 'Test Brand Cotton Shirt Similar',
        price: '₹1,199',
        link: 'https://www.flipkart.com/test-shirt/p/itm123',
        thumbnail: 'https://assets.myntassets.com/real3.png',
      },
      {
        title: 'Test Brand Casual Shirt',
        price: '₹1,350',
        link: 'https://www.myntra.com/shirts/test-brand/test-product/1234567/buy',
        thumbnail: 'https://assets.myntassets.com/real1.png',
      },
    ],
    search_metadata: { q: query },
  };
}

module.exports = {
  listingHtml,
  flipkartListingHtml,
  meeshoListingHtml,
  nykaaListingHtml,
  productHtml,
  serpShoppingResponse,
  BATCH1,
  BATCH2,
  PRODUCT_META,
};
