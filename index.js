const puppeteer = require('puppeteer');
// const CREDS = require('./creds');
const mongoose = require('mongoose');
const Product = require('./models/product');

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();
  const searchUrl = `https://shop.nordstrom.com/c/womens-clothing?top=72&offset=9`;
  await page.goto(searchUrl, {waitUntil: 'networkidle2'});
  const height = 1400;
  const width = 1000;
  await page.setViewport({height, width});

  const LIST_PRODUCT_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div:nth-child(1) > div > div > div:nth-child(5) > div > div > div > section > div > div > div:nth-child(INDEX) > article > div.media_12txnm > a';

  const numPages = await getNumPages(page);

  const LENGTH_SELECTOR_CLASS = 'productModule_1pCIbl npr-product-module';
  const NAME_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.Z2e29B3 > div > div > div:nth-child(1) > div.productTitleWrapper_ZOyw7k > h1';
  const DESCRIPTION_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.Z2e29B3 > div > div > div.Z1jyCce > div';
  const BRAND_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.Z2e29B3 > div > div > div:nth-child(1) > section > h2 > a > span > span';
  const PHOTO_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.opGe5 > div > section > div.scrollbar_yV9D > div.scrollableContent_Zh0XVk > div > div > img';
  const POPUP_SELECTOR_CLASS = '__acs';
  const CLOSE_POPUP_SELECTOR = '#acsMainInvite > div > a.acsInviteButton.acsDeclineButton';

  console.log('Numpages: ', numPages);

  for (let h = 1; h <= numPages; h++) {
    let pageUrl = searchUrl + '&page=' + h;
    await page.goto(pageUrl);

    let listLength = await page.evaluate((sel) => {
      return document.getElementsByClassName(sel).length;
    }, LENGTH_SELECTOR_CLASS);
    let listProducts = await page.evaluate((sel) => {
        return document.getElementsByClassName(sel);
      }, LENGTH_SELECTOR_CLASS);
    console.log('List length: ', listLength);
    console.log('List: ', listProducts);
    
    for (let i = 1; i <= listLength; i++) {
      let productSelector = LIST_PRODUCT_SELECTOR.replace("INDEX", i);

        // Set up the wait for navigation before clicking the link.
        const navigationPromise = page.waitForNavigation();
        try {
            page.click(CLOSE_POPUP_SELECTOR).then(r => console.log(r));
        }
        finally {
            console.log("No popup!");
        }

        // Clicking the link will indirectly cause a navigation
        await page.click(productSelector);

        // The navigationPromise resolves after navigation has finished
        await navigationPromise;

      console.log('MADE IT');
    
      try {
          page.click(CLOSE_POPUP_SELECTOR);
      }
      finally {
          console.log("No popup!");
      }

      let name = await page.evaluate((sel) => {
        let html = document.querySelector(sel).innerHTML;
        return html;
        }, NAME_SELECTOR);
      console.log('name: ', name);

      let description = await page.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element ? element.innerHTML: null;
      }, DESCRIPTION_SELECTOR);
      console.log('description: ', description);

      let brand = await page.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element ? element.innerHTML: null;
      }, BRAND_SELECTOR);
      brand = brand.replace('<sup>®</sup>', '');
      console.log('brand: ', brand);

      await page.goBack({waitUntil: ['load','domcontentloaded','networkidle0','networkidle2']});

      console.log(name, ' -> ', brand, ' -> ', description);

      upsertProduct({
        name: name,
        brand: brand,
        description: description,
        dateCrawled: new Date()
      });
    }
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

function upsertProduct(productObj) {
  // Added :27017 to avoid error
  const DB_URL = 'mongodb://localhost:27017/products';

  if (mongoose.connection.readyState == 0) {
    // Added useNewUrlParser to avoid error
    mongoose.connect(DB_URL, { useNewUrlParser: true}); 
  }

  // if this name exists, update the entry, don't insert
  const conditions = { name: productObj.name };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  Product.findOneAndUpdate(conditions, productObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
}

run();