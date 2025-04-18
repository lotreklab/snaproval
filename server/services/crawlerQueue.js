import puppeteer from 'puppeteer';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import prisma from '../db.js';
import { updateUrlStatus, completeJob } from '../models/jobManager.js';
import { outputDir } from '../utils/fileSystem.js';

/**
 * Create a zip file for all screenshots in a job
 * @param {string} jobId - Job ID
 * @returns {Promise<string>} Path to the created zip file
 */
async function createJobZip(jobId) {
  return new Promise(async (resolve, reject) => {
    try {
      const jobDir = path.join(outputDir, jobId);
      const screenshotsDir = path.join(jobDir, 'screenshots');
      const zipPath = path.join(jobDir, `screenshots-${jobId}.zip`);
      const webAccessiblePath = `/api/screenshots/${jobId}/screenshots-${jobId}.zip`;
      
      // Check if screenshots directory exists
      if (!fs.existsSync(screenshotsDir)) {
        throw new Error(`Screenshots directory not found for job ${jobId}`);
      }
      
      console.log(`Creating zip file for job ${jobId}`);
      
      // Create a file to stream archive data to
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 6 } // Compromise between compression and speed
      });
      
      // Set up event listeners
      output.on('close', async () => {
        console.log(`Zip file created for job ${jobId}: ${zipPath} (${archive.pointer()} bytes)`);
        
        // Update job with zip file path
        await prisma.job.update({
          where: { jobId },
          data: { 
            zipPath: webAccessiblePath,
            zipSize: archive.pointer()
          }
        });
        
        resolve(zipPath);
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn(`Warning while creating zip for job ${jobId}:`, err);
        } else {
          reject(err);
        }
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      // Pipe archive data to the output file
      archive.pipe(output);
      
      // Add all screenshot files to the archive
      // Use glob-style pattern to avoid loading file list in memory
      archive.directory(screenshotsDir, 'screenshots');
      
      // Finalize the archive (write footer and close streams)
      await archive.finalize();
    } catch (error) {
      console.error(`Error creating zip file for job ${jobId}:`, error);
      reject(error);
    }
  });
}

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
    
    console.log(`Initializing crawler queue with ${workerCount} workers`);
  }

  // Add URLs to the queue with their job ID
  addUrls(urls, jobId, highlightLinks = true, processUrlFunction) {
    const urlsToAdd = urls.map((url, index) => ({
      url,
      jobId,
      index,
      highlightLinks,
      added: Date.now(),
      processUrlFunction
    }));
    
    // Add job to counters if not exists
    if (!this.jobCounters.has(jobId)) {
      this.jobCounters.set(jobId, 0);
    }
    
    this.queue.push(...urlsToAdd);
    console.log(`Added ${urls.length} URLs for job ${jobId} to the queue`);
    
    // Start processing if not already
    if (!this.isProcessing) {
      this.startProcessing();
    }
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
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    
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
          
          // Process the URL
          await item.processUrlFunction(browser, item.url, item.jobId, item.index, item.highlightLinks);
          
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
      
      // Clean up browser
      try {
        await browser.close();
      } catch (e) {
        console.error('Error closing browser:', e);
      }
      
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
  }
  
  // Get queue statistics
  getStats() {
    const jobStats = {};
    for (const [jobId, count] of this.jobCounters.entries()) {
      const remaining = this.queue.filter(item => item.jobId === jobId).length;
      jobStats[jobId] = { processed: count, remaining };
    }
    
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
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

// Export the zip creation function for direct use
export { crawlerQueue, getCrawlerStats, createJobZip }; 