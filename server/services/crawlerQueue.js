import puppeteer from 'puppeteer';
import os from 'os';
import prisma from '../db.js';
import { updateUrlStatus, completeJob } from '../models/jobManager.js';
import { createJobZip } from './zipCreator.js';
import { handleCookieBanners } from './crawler.js';

/**
 * CrawlerQueue class to manage URL processing across jobs
 */
class CrawlerQueue {
  constructor(workerCount = Math.max(1, Math.floor(os.cpus().length / 2))) {
    this.queue = [];
    this.workers = [];
    this.workerCount = workerCount;
    this.isProcessing = false;
    this.jobCounters = new Map(); // Tracks URLs per job for fair scheduling
    this.activeWorkers = 0;
    this.jobBrowsers = new Map(); // Stores browser instances for each job
    this.cookieBannersHandled = new Set(); // Track jobs for which cookie banners have been handled
    
    console.log(`Initializing crawler queue with ${workerCount} workers`);
  }

  // Add URLs to the queue with their job ID
  addUrls(urls, jobId, highlightLinks = true, processUrlFunction, width) {
    // Add job to counters if not exists
    if (!this.jobCounters.has(jobId)) {
      this.jobCounters.set(jobId, 0);
    }
    
    // Format URLs with their metadata
    const urlsToAdd = urls.map((url, index) => ({
      url,
      jobId,
      index,
      highlightLinks,
      added: Date.now(),
      processUrlFunction,
      width
    }));
    
    this.queue.push(...urlsToAdd);
    console.log(`Added ${urls.length} URLs for job ${jobId} to the queue`);
    
    // Start processing if not already
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  // Get job browser or create if not exists
  async getJobBrowser(jobId) {
    if (!this.jobBrowsers.has(jobId)) {
      console.log(`Creating new browser instance for job ${jobId}`);
      const browser = await puppeteer.launch({args: ['--no-sandbox']});
      this.jobBrowsers.set(jobId, browser);
      
      // Get the first URL for this job to handle cookie banners
      const firstItem = this.queue.find(item => item.jobId === jobId);
      if (firstItem && !this.cookieBannersHandled.has(jobId)) {
        console.log(`Handling cookie banners for job ${jobId} before starting processing`);
        
        // Create a temporary page to handle cookie banners
        const tempPage = await browser.newPage();
        try {
          // Navigate to the first URL of the job
          await tempPage.goto(firstItem.url, { waitUntil: 'networkidle2', timeout: 30000 });
          
          // Handle cookie banners
          await handleCookieBanners(tempPage);
          
          // Mark this job as having had cookie banners handled
          this.cookieBannersHandled.add(jobId);
          
          console.log(`Successfully handled cookie banners for job ${jobId}`);
        } catch (err) {
          console.error(`Error handling cookie banners for job ${jobId}:`, err);
        } finally {
          // Close the temporary page
          await tempPage.close();
        }
      }
      
      // Set up cleanup when the job is done
      const closeAndCleanup = async () => {
        // Check if all URLs for this job are processed
        const remainingItems = this.queue.filter(item => item.jobId === jobId).length;
        if (remainingItems === 0) {
          // Give it a short delay to make sure all operations are complete
          setTimeout(async () => {
            // Double-check if there are any new items for this job
            const currentRemainingItems = this.queue.filter(item => item.jobId === jobId).length;
            if (currentRemainingItems === 0) {
              const browser = this.jobBrowsers.get(jobId);
              if (browser) {
                try {
                  console.log(`Closing browser for completed job ${jobId}`);
                  await browser.close();
                } catch (err) {
                  console.error(`Error closing browser for job ${jobId}:`, err);
                } finally {
                  this.jobBrowsers.delete(jobId);
                  this.cookieBannersHandled.delete(jobId);
                }
              }
            }
          }, 5000); // 5-second delay before cleanup
        }
      };
      
      // Set up event listener to trigger cleanup
      browser.on('disconnected', () => {
        this.jobBrowsers.delete(jobId);
        this.cookieBannersHandled.delete(jobId);
      });
    }
    
    return this.jobBrowsers.get(jobId);
  }
  
  // Get next URL using fair scheduling algorithm
  getNextUrl() {
    if (this.queue.length === 0) return null;
    
    // Find the job with the least processed URLs
    let minProcessedJob = null;
    let minProcessed = Infinity;
    
    for (const [jobId, count] of this.jobCounters.entries()) {
      if (count < minProcessed && this.queue.some(item => item.jobId === jobId)) {
        minProcessed = count;
        minProcessedJob = jobId;
      }
    }
    
    // If we found a job, get the oldest URL from that job
    if (minProcessedJob) {
      const jobItems = this.queue.filter(item => item.jobId === minProcessedJob);
      jobItems.sort((a, b) => a.added - b.added);
      
      const selectedItem = jobItems[0];
      const index = this.queue.findIndex(item => 
        item.url === selectedItem.url && item.jobId === selectedItem.jobId);
      
      // Remove from queue and increment counter for this job
      if (index !== -1) {
        const [item] = this.queue.splice(index, 1);
        this.jobCounters.set(minProcessedJob, this.jobCounters.get(minProcessedJob) + 1);
        return item;
      }
    }
    
    // Fallback: just take the oldest item in the queue
    this.queue.sort((a, b) => a.added - b.added);
    return this.queue.shift();
  }
  
  // Start processing the queue
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Launch workers up to the configured limit
    for (let i = 0; i < this.workerCount; i++) {
      this.launchWorker();
    }
  }
  
  // Launch a single worker
  async launchWorker() {
    if (this.activeWorkers >= this.workerCount) return;
    
    this.activeWorkers++;
    
    // Worker function
    const worker = async () => {
      while (this.isProcessing) {
        const item = this.getNextUrl();
        
        if (!item) {
          // No items in queue, wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        try {
          // Check if job is still running
          const dbJob = await prisma.job.findUnique({
            where: { jobId: item.jobId },
            select: { isRunning: true }
          });
          
          // Skip if job was cancelled
          if (!dbJob || !dbJob.isRunning) {
            console.log(`Job ${item.jobId} no longer running, skipping URL: ${item.url}`);
            continue;
          }
          
          // Get or create the job-specific browser
          const browser = await this.getJobBrowser(item.jobId);
          
          // Process the URL
          await item.processUrlFunction(browser, item.url, item.jobId, item.index, item.highlightLinks, item.width);
          
          // Check if this was the last URL for this job
          const remainingForJob = this.queue.filter(qItem => qItem.jobId === item.jobId).length;
          if (remainingForJob === 0) {
            // Check if all URLs in the job are completed
            const dbJob = await prisma.job.findUnique({
              where: { jobId: item.jobId },
              include: { urls: true }
            });
            
            if (dbJob) {
              const pendingUrls = dbJob.urls.filter(u => u.status === 'to_do').length;
              if (pendingUrls === 0) {
                try {
                  // Mark job as completed
                  await completeJob(item.jobId);
                  console.log(`All URLs processed for job ${item.jobId}, marked as completed`);
                  
                  // Create a zip file for the job
                  await createJobZip(item.jobId);
                  
                  // Close the browser for this job
                  try {
                    if (this.jobBrowsers.has(item.jobId)) {
                      const jobBrowser = this.jobBrowsers.get(item.jobId);
                      await jobBrowser.close();
                      this.jobBrowsers.delete(item.jobId);
                      this.cookieBannersHandled.delete(item.jobId);
                      console.log(`Closed browser for completed job ${item.jobId}`);
                    }
                  } catch (err) {
                    console.error(`Error closing browser for job ${item.jobId}:`, err);
                  }
                } catch (error) {
                  console.error(`Error completing job ${item.jobId}:`, error);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Worker error processing ${item.url}:`, error);
          
          // Update URL status to error
          await updateUrlStatus(item.jobId, item.url, 'error');
        }
      }
    };
    
    // Start the worker
    worker().catch(async (error) => {
      console.error('Worker crashed:', error);
      
      // Decrease active worker count
      this.activeWorkers--;
      
      // Relaunch worker if still processing
      if (this.isProcessing) {
        this.launchWorker();
      }
    });
  }
  
  // Stop processing the queue
  stopProcessing() {
    this.isProcessing = false;
    
    // Close all browsers
    for (const [jobId, browser] of this.jobBrowsers.entries()) {
      try {
        browser.close();
        console.log(`Closed browser for job ${jobId} during shutdown`);
      } catch (err) {
        console.error(`Error closing browser for job ${jobId} during shutdown:`, err);
      }
    }
    
    // Clear the maps and sets
    this.jobBrowsers.clear();
    this.cookieBannersHandled.clear();
  }
  
  // Get queue statistics
  getStats() {
    const jobStats = {};
    for (const [jobId, count] of this.jobCounters.entries()) {
      const remaining = this.queue.filter(item => item.jobId === jobId).length;
      jobStats[jobId] = { 
        processed: count, 
        remaining,
        hasBrowser: this.jobBrowsers.has(jobId),
        cookieBannersHandled: this.cookieBannersHandled.has(jobId)
      };
    }
    
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      activeBrowsers: this.jobBrowsers.size,
      jobStats
    };
  }
}

// Singleton instance of the crawler queue
const crawlerQueue = new CrawlerQueue();

// For debugging and status monitoring
async function getCrawlerStats() {
  return crawlerQueue.getStats();
}

export { crawlerQueue, getCrawlerStats }; 