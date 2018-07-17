const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
// const Product = require('./models/product');
const StyleId = require('./models/styleId');

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();
  // Searching just through women's clothing
  const searchUrl = `https://shop.nordstrom.com/c/womens-clothing?top=72&offset=9&sort=Newest`;
  await page.goto(searchUrl, {waitUntil: 'networkidle2'});
  const height = 1400;
  const width = 1200;
  // Necessary to set viewport or else the screen isn't big enough to click every 3rd item
  await page.setViewport({height, width});

  const numPages = await getNumPages(page);
  const LIST_PRODUCT_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div:nth-child(1) > div > div > div:nth-child(5) > div > div > div > section > div > div > div:nth-child(INDEX) > article > div.media_12txnm > a';
  let count = 0;

  for (let h = 1; h <= numPages; h++) {
    let pageUrl = searchUrl + '&page=' + h;
    await page.goto(pageUrl);

    // Closes random feedback popup if shows up on the page
    try { await page.click(CLOSE_POPUP_SELECTOR); }
    catch(error) { }
    
    // Max of 72 items per page
    for (let i = 1; i <= 72; i++) {
        let productSelector = LIST_PRODUCT_SELECTOR.replace("INDEX", i);

        // Sample href: https://shop.nordstrom.com/s/vince-camuto-sleeveless-smocked-mock-neck-blouse-regular-petite/4999900?origin=category-personalizedsort&breadcrumb=Home%2FWomen%2FAll%20Women&color=classic%20navy
        let styleId = await page.evaluate((sel) => {
            try {
                let href = document.querySelector(sel).getAttribute('href');
            }
            catch (error) {
                return null;
            }
            let href = document.querySelector(sel).getAttribute('href');
            questionIndex = href.indexOf('?');
            href = href.slice(questionIndex - 7, questionIndex);
            return href ? href: null;
          }, productSelector);
        
        if (!styleId)
          continue;

        console.log('styleId: ', styleId);

        upsertProduct({
            styleId: styleId,
            dateCrawled: new Date()
        });
        count += 1;
    }
    console.log('Total saved: ', count);
  }

  browser.close();
}

async function getNumPages(page) {
  const NUM_PAGES_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div:nth-child(1) > div > div > div:nth-child(5) > div > div > div > section > footer > ul > li:nth-child(1) > ul > li:nth-child(6) > a > span';
  
  let inner = await page.evaluate((sel) => {
    let html = document.querySelector(sel).innerHTML;
    return html;
    }, NUM_PAGES_SELECTOR);

    return parseInt(inner);
}

function upsertProduct(styleIdObj) {
  // Added :27017 to avoid error
  const DB_URL = 'mongodb://localhost:27017/styleIds';

  if (mongoose.connection.readyState == 0) {
    // Added useNewUrlParser to avoid error
    mongoose.connect(DB_URL, { useNewUrlParser: true}); 
  }

  // if this styleId exists, update the entry, don't insert
  const conditions = { styleId: styleIdObj.styleId };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  StyleId.findOneAndUpdate(conditions, styleIdObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
}

run();