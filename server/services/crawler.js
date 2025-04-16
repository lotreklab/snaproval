import puppeteer from 'puppeteer';
import path from 'path';
import prisma from '../db.js';
import { updateUrlStatus, completeJob } from '../models/jobManager.js';
import { outputDir } from '../utils/fileSystem.js';

/**
 * Handle cookie consent banners on a page
 * @param {Object} page - Puppeteer page object
 */
async function handleCookieBanners(page) {
  console.log('Attempting to dismiss cookie banners...');
  
  try {
    // Wait a bit for cookie banners to appear
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
    
    // List of common cookie banner selectors and their accept button selectors
    const cookieBanners = [
      // Iubenda
      {
        bannerSelector: '.iubenda-cs-container',
        acceptSelector: '.iubenda-cs-accept-btn'
      },
      // CookieBot
      { 
        bannerSelector: '#CybotCookiebotDialog', 
        acceptSelector: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept' 
      },
      // OneTrust
      { 
        bannerSelector: '#onetrust-banner-sdk', 
        acceptSelector: '#onetrust-accept-btn-handler, .onetrust-close-btn-handler' 
      },
      // Cookielaw.org / OneTrust variant
      { 
        bannerSelector: '.optanon-alert-box-wrapper', 
        acceptSelector: '.optanon-allow-all, .optanon-button-allow' 
      },
      // TrustArc / TRUSTe
      { 
        bannerSelector: '.truste_box_overlay, .truste_overlay', 
        acceptSelector: '.pdynamicbutton .call, .trustarc-agree-btn' 
      },
      // Evidon
      { 
        bannerSelector: '#_evidon_banner', 
        acceptSelector: '#_evidon-accept-button, #_evidon-banner-acceptbutton' 
      },
      // Quantcast
      { 
        bannerSelector: '.qc-cmp2-container', 
        acceptSelector: '.qc-cmp2-button[mode="primary"]' 
      },
      // Osano
      { 
        bannerSelector: '.osano-cm-window', 
        acceptSelector: '.osano-cm-accept-all, .osano-cm-button--type_accept' 
      },
      // Generic selectors (common patterns)
      { 
        bannerSelector: '[class*="cookie-banner"], [class*="cookie-consent"], [class*="cookie-notice"], [id*="cookie-banner"], [id*="cookie-consent"]', 
        acceptSelector: 'button[contains(text(), "Accept")], button[contains(text(), "Agree")], button[contains(text(), "Allow")]' 
      },
      // GDPR consent
      { 
        bannerSelector: '.gdpr, .gdpr-banner, #gdpr-banner, #gdpr-cookie-notice', 
        acceptSelector: '.gdpr-consent-button, #gdpr-consent-accept, .gdpr-agree-btn' 
      }
    ];
    
    // Try each banner type
    for (const banner of cookieBanners) {
      // Check if banner exists
      const bannerExists = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null;
      }, banner.bannerSelector);
      
      if (bannerExists) {
        console.log(`Found cookie banner matching selector: ${banner.bannerSelector}`);
        
        // Try clicking the accept button
        try {
          await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            if (button) button.click();
          }, banner.acceptSelector);
          
          console.log('Clicked accept button on cookie banner');
        } catch (err) {
          console.log(`Failed to click accept button: ${err.message}`);
        }
      }
    }
    
    // Additional approach: Try to handle cookie banners using keyboard (ESC key)
    await page.keyboard.press('Escape');
    
    // Additional approach: Try to handle cookie banners using custom JavaScript
    await page.evaluate(() => {
      // Hide elements that might be cookie banners based on common class/id patterns
      const possibleBanners = document.querySelectorAll(
        '[class*="cookie"], [class*="consent"], [class*="gdpr"], [id*="cookie"], [id*="consent"], [id*="gdpr"]'
      );
      
      possibleBanners.forEach(el => {
        // Check if it's likely a banner (positioned fixed or has high z-index)
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || parseInt(style.zIndex) > 100) {
          el.style.display = 'none';
        }
      });
    });
    
  } catch (error) {
    console.log('Error handling cookie banners:', error.message);
  }
}

/**
 * Add link highlighting and numbering to a page
 * @param {Object} page - Puppeteer page object
 * @param {string} domain - Domain of the website
 */
async function addLinkHighlighting(page, domain) {
  await page.evaluate((domain) => {
    const links = document.querySelectorAll('a');
    const urlMap = [];
    const linksToHighlight = [];
    // First pass: collect all URLs
    links.forEach(link => {
      if (link.href && !urlMap.includes(link.href)) {
        const domainRegex = new RegExp(`^https?://(?:www\\.)?${domain.replace(/\./g, '\\.')}`, 'i');
        if (!link.href.match(domainRegex) && link.href.match(/^https?/i)) {
            urlMap.push(link.href);
            linksToHighlight.push(link);
        }
      }
    });
    // Second pass: add numbered labels
    linksToHighlight.forEach(link => {
      // Add red border
      link.style.border = '2px solid red';
      
      // Create and add number label above the link
      const urlIndex = urlMap.indexOf(link.href) + 1; // 1-based indexing for human readability
      const urlLabel = document.createElement('div');
      urlLabel.textContent = urlIndex.toString();
      urlLabel.style.position = 'fixed';
      // Get position of the link
      const rect = link.getBoundingClientRect();
      // Calculate the position of the label
      const labelX = rect.left 
      const labelY = rect.bottom + urlLabel.offsetHeight + 30; // Adjust as needed
      urlLabel.style.top = labelY + 'px';
      urlLabel.style.left = labelX + 'px';
      urlLabel.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      urlLabel.style.color = 'white';
      urlLabel.style.padding = '10px 15px';
      urlLabel.style.border = '2px solid white';
      urlLabel.style.borderRadius = '3px';
      urlLabel.style.fontSize = '24px';
      urlLabel.style.fontWeight = 'bold';
      urlLabel.style.zIndex = '9999999999999999999999999999';
      link.appendChild(urlLabel);
    });
    
    if (linksToHighlight.length > 0) {
        // Create a legend at the bottom of the page
        const legend = document.createElement('div');
        legend.style.position = 'inherit';
        legend.style.backgroundColor = 'white';
        legend.style.padding = '15px';
        legend.style.marginTop = '30px';
        legend.style.borderRadius = '5px';
        legend.style.fontFamily = 'Arial, sans-serif';
        legend.style.zIndex = '10000';
        
        // Add title to the legend
        const legendTitle = document.createElement('h2');
        legendTitle.textContent = 'URL Reference';
        legendTitle.style.marginTop = '0';
        legendTitle.style.marginBottom = '10px';
        legend.appendChild(legendTitle);
        
        // Add URL list to the legend
        const urlList = document.createElement('ul');
        urlList.style.paddingLeft = '20px';
        urlList.style.margin = '0';
        
        urlMap.forEach((url, index) => {
        const urlItem = document.createElement('li');
        urlItem.style.marginBottom = '5px';
        urlItem.style.wordBreak = 'break-all';
        
        const urlLink = document.createElement('a');
        urlLink.href = url;
        urlLink.style.textDecoration = 'none';
        const urlIndex = document.createElement('span');
        urlIndex.textContent = (index + 1).toString();
        urlIndex.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        urlIndex.style.color = 'white';
        urlIndex.style.padding = '2px 5px';
        urlIndex.style.borderRadius = '3px';
        urlIndex.style.fontSize = '12px';
        urlIndex.style.fontWeight = 'bold';
        urlIndex.style.marginRight = '5px';
        const urlText = document.createElement('span');
        urlText.textContent = url;
        urlText.style.color = 'rgba(255, 0, 0, 0.7)';
        urlText.style.textDecoration = 'none';
        urlLink.appendChild(urlIndex);
        urlLink.appendChild(urlText);

        urlItem.appendChild(urlLink);
        urlList.appendChild(urlItem);
        });
        
        legend.appendChild(urlList);
        
        // Append the legend to the body
        document.body.appendChild(legend);
    };
  }, domain);
}

/**
 * Process a single URL and generate a screenshot
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} url - URL to process
 * @param {string} jobId - Job ID
 * @param {number} index - URL index
 * @param {boolean} highlightLinks - Whether to highlight external links
 */
async function processUrl(browser, url, jobId, index, highlightLinks = true) {
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set user agent to avoid bot detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  try {
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for loader animations to finish
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));


    // Scroll down the page until bottom to trigger scrolling animations
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            window.scrollTo(0, 0);
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait a bit more to ensure animations are done
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    const domain = new URL(url).hostname;
    
    // Add link highlighting and numbering if enabled
    if (highlightLinks) {
      await addLinkHighlighting(page, domain);
    }
    
    // Generate a safe filename from URL
    const filename = `page-${index+1}-${url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100)}.png`;
    const jobScreenshotDir = path.join(outputDir, jobId, 'screenshots');
    const outputPath = path.join(jobScreenshotDir, filename);
    
    // Create web-accessible path for the screenshot
    const webAccessiblePath = `/api/screenshots/${jobId}/screenshots/${filename}`;
    
    // Generate full-page screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png'
    });

     // Update URL status in database and memory
     await updateUrlStatus(jobId, url, 'completed', webAccessiblePath);

    
    console.log(`Generated screenshot for ${url}`);
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    // Update URL status to error
    await updateUrlStatus(jobId, url, 'error');
  } finally {
    await page.close();
  }
}

/**
 * Crawl a list of URLs and generate screenshots
 * @param {Array} urls - Array of URLs to crawl
 * @param {string} jobId - Job ID
 * @param {boolean} isResuming - Whether this is resuming an existing job
 * @param {boolean} highlightLinks - Whether to highlight external links
 */
async function crawlWebsite(urls, jobId, isResuming = false, highlightLinks = true) {
  const browser = await puppeteer.launch();

  // Handle cookie banners before launching the browser
  const page = await browser.newPage();
  await page.goto(urls[0], { waitUntil: 'networkidle2', timeout: 60000 });
  await handleCookieBanners(page);
  
  try {
    // If resuming, only process URLs that are still in 'to_do' status
    let urlsToProcess = urls;
    
    if (isResuming) {
      // Get the current status of URLs from the database
      const dbJob = await prisma.job.findUnique({
        where: { jobId },
        include: { urls: true }
      });
      
      if (dbJob) {
        // Filter URLs that are still in 'to_do' status
        const pendingUrlObjects = dbJob.urls.filter(u => u.status === 'to_do');
        urlsToProcess = pendingUrlObjects.map(u => u.url);
        console.log(`Resuming job ${jobId} with ${urlsToProcess.length} pending URLs`);
      }
    }
    
    // Process each URL
    for (let i = 0; i < urlsToProcess.length; i++) {
      await processUrl(browser, urlsToProcess[i], jobId, i, highlightLinks);
    }
  } finally {
    await browser.close();
    
    // Mark job as completed
    await completeJob(jobId);
  }
}

export { crawlWebsite, handleCookieBanners };