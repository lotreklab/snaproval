import express from 'express';
import cors from 'cors';
import { initializeFileSystem, outputDir } from './utils/fileSystem.js';
import { initializeJobs, loadJobsIntoMemory } from './models/jobManager.js';
import { crawlWebsite } from './services/crawler.js';
import { scheduleCleanup } from './utils/cleanup.js';
import apiRoutes from './routes/api.js';

/**
 * Initialize the application by setting up file system and resuming jobs
 */
async function initializeApp() {
  // Initialize file system
  initializeFileSystem();
  
  // Schedule cleanup of old exports (run every 24 hours, remove exports older than 7 days)
  scheduleCleanup(24, 7);
  
  // Initialize database and resume incomplete jobs
  const incompleteJobs = await initializeJobs();
  
  // Load jobs into memory
  const jobs = loadJobsIntoMemory(incompleteJobs);
  
  // Resume crawling for incomplete jobs
  for (const job of incompleteJobs) {
    const pendingUrls = job.urls.filter(url => url.status === 'to_do').map(url => url.url);
    if (pendingUrls.length > 0) {
      console.log(`Resuming job ${job.jobId} with ${pendingUrls.length} pending URLs`);
      crawlWebsite(pendingUrls, job.jobId, true);
    }
  }
}

/**
 * Create and configure the Express application
 * @returns {Object} - Express app
 */
export const createExpressApp = () => {
  const app = express();
  
  // Initialize the application
  initializeApp();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Serve static files from output directory
  app.use('/api/screenshots', express.static(outputDir));
  
  // API routes
  app.use('/api', apiRoutes);
  
  return app;
};