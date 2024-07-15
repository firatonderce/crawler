// Require section
const {executablePath} = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const fs = require('fs');

// Crawl baseurl, initial extension and constants
const baseUrl = 'YOUR_BASE_URL';
const initialExtension = '/' + 'YOUR_EXTENSION';
const initialElementQuery = 'YOUR_ELEMENT_QUERY';
const initialHrefQuery = 'YOUR_HREF_QUERY';
const initialLevel = 0; // replace it with your initial level for the element

const minDelay = 10;
const maxDelay = 25;

// Apply stealth plugin
puppeteerExtra.use(StealthPlugin());

//IIFE
(async () => {
  //Methods
  const delay = time => new Promise(resolve => setTimeout(resolve, time * 1000));

  const goTo = async extension => {
    try {
      const url = `${baseUrl}${extension}`;
      await page.goto(url, {waitUntil: 'networkidle2'});
      return {status: true, message: ''};
    } catch (error) {
      return {status: false, message: error.message};
    }
  };

  const getCategories = async () => {
    const categories = await page.evaluate(
      (initialElementQuery, initialHrefQuery) => {
        const categories = {};
        const elements = document.querySelectorAll(initialElementQuery);
        const hrefs = document.querySelectorAll(initialHrefQuery);

        const elementArray = Array.from(elements);
        const hrefsArray = Array.from(hrefs);

        elementArray.map((element, index) => {
          const displayName = element?.textContent?.trim?.();
          const extension = hrefsArray?.[index]?.getAttribute?.('href');

          if (displayName && extension) {
            categories[displayName] = {displayName, extension, subCategories: {}};
          }
        });
        return categories;
      },
      initialElementQuery,
      initialHrefQuery,
    );

    return categories;
  };

  const getSubCategories = async (category, level) => {
    if (!category.extension) return {};

    const timeOut = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await delay(timeOut);

    const result = await goTo(category.extension, timeOut);
    if (!result.status) return {error: `CAN_NOT_TRAVERSE`, reason: result.message};

    const subCategories = await page.evaluate(level => {
      //Query generator
      const elementGenerator = level => 'YOUR_LEVEL_BASED_ELEMENT_QUERY';
      const hrefGenerator = level => 'YOUR_LEVEL_BASED_HREF_QUERY';
      const additionalGenerator = () => 'OPTIONAL_LEVEL_BASED_ADDITIONAL_QUERY';

      const subCategories = {};
      const elements = document.querySelectorAll(elementGenerator(level));
      const hrefs = document.querySelectorAll(hrefGenerator(level));
      const additional = document.querySelectorAll(additionalGenerator());

      const elementArray = Array.from(elements);
      const hrefsArray = Array.from(hrefs);
      const additionalArray = Array.from(additional);

      elementArray.map((element, index) => {
        const displayName = element?.textContent?.trim?.();
        const extension = hrefsArray?.[index]?.getAttribute('href');

        if (displayName && extension) {
          subCategories[displayName] = {displayName, extension, subCategories: {}};
        }
      });
      if (additionalArray.length) {
        subCategories.additional = additionalArray?.map(e => e.textContent?.trim?.());
      }
      return subCategories;
    }, level);

    for (let key in subCategories) {
      const subCategory = subCategories[key];
      subCategory.subCategories = await getSubCategories(subCategory, level + 1);
    }

    return subCategories;
  };

  // Launch browser
  const browser = await puppeteerExtra.launch({
    headless: true,
    executablePath: executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process'],
  });

  // Create page
  const page = await browser.newPage();

  //Go to the url and get main categories
  const result = await goTo(initialExtension);
  if (!result.status) {
    await browser.close();
    return console.log('An error occured when getting main categories, aborting due to the error =>', result.message);
  }

  let categories = await getCategories();

  //Get each main category and its subcategories
  for (let key in categories) {
    const category = categories[key];
    category.subCategories = await getSubCategories(category, initialLevel);
  }

  //Write response as file.
  const jsonData = JSON.stringify(categories, null, 2);
  fs.writeFile('output.json', jsonData, err => {
    if (err) return console.error('An error occured when writing the file', err);

    console.log('File has been written successfully.');
  });

  //Finish operation by closing the browser
  await browser.close();
})();
