const puppeteer = require('puppeteer');
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
  const width = 1200;
  // Necessary to set viewport or else the screen isn't big enough to click every 3rd item
  await page.setViewport({height, width});

  const numPages = await getNumPages(page);
  const LIST_PRODUCT_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div:nth-child(1) > div > div > div:nth-child(5) > div > div > div > section > div > div > div:nth-child(INDEX) > article > div.media_12txnm > a';
  const NAME_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.Z2e29B3 > div > div > div:nth-child(1) > div.productTitleWrapper_ZOyw7k > h1';
  const DESCRIPTION_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.Z2e29B3 > div > div > div.Z1jyCce > div';
  const BRAND_SELECTOR = '#root > div > div.Z1sM77l > div > div:nth-child(2) > div.dark_Z19mnhH.brandon_Z18sClN.medium_jDd9A._1bxrUw > div > div > div._2duATC > div.olmJG > div.Z1vcOzQ > div.Z2e29B3 > div > div > div:nth-child(1) > section > h2 > a > span > span';
  const CLOSE_POPUP_SELECTOR = '#acsMainInvite > div > a.acsInviteButton.acsDeclineButton';
  
  for (let h = 1; h <= numPages; h++) {
    let pageUrl = searchUrl + '&page=' + h;
    await page.goto(pageUrl);
    
    // Max of 72 items per page
    for (let i = 1; i <= 73; i++) {
        let productSelector = LIST_PRODUCT_SELECTOR.replace("INDEX", i);

        // Set up the wait for navigation before clicking the link.
        const navigationPromise = page.waitForNavigation();
        
        // Closes random feedback popup if shows up on the page
        try { await page.click(CLOSE_POPUP_SELECTOR); }
        catch(error) { }

        // Tries to click on the product... if no product, continue to the next product
        try { await page.click(productSelector); }
        catch(error) { continue; }

        await navigationPromise;
    
        // Closes random feedback popup if shows up on the product page
        try { await page.click(CLOSE_POPUP_SELECTOR) }
        catch(error) { }

        let name = await page.evaluate((sel) => {
            let html = document.querySelector(sel).innerHTML;
            return html;
         }, NAME_SELECTOR);
        // console.log('name: ', name);

        let description = await page.evaluate((sel) => {
            let element = document.querySelector(sel);
            return element ? element.innerHTML: null;
        }, DESCRIPTION_SELECTOR);
        // console.log('description: ', description);

        let brand = await page.evaluate((sel) => {
            let element = document.querySelector(sel);
            return element ? element.innerHTML: null;
        }, BRAND_SELECTOR);

        // Replaces random copyright logo with nothing
        brand = brand.replace('<sup>®</sup>', '');
        // console.log('brand: ', brand);

        console.log('--------------')
        console.log(name, ' -> ', brand, ' -> ', description);

        upsertProduct({
            name: name,
            brand: brand,
            description: description,
            dateCrawled: new Date()
        });
        
        await page.goBack({waitUntil: ['load','domcontentloaded','networkidle0','networkidle2']});
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