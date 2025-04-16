import prisma from '../db.js';
import path from 'path';

// Store jobs in memory for quick access, but persist in database
let jobs = [];

/**
 * Initialize database and resume incomplete jobs
 * @returns {Array} - Array of incomplete jobs
 */
async function initializeJobs() {
  try {
    // Find all running jobs that need to be resumed
    const runningJobs = await prisma.job.findMany({
      where: {
        isRunning: true
      },
      include: {
        urls: true
      }
    });

    console.log(`Found ${runningJobs.length} incomplete jobs to resume`);
    return runningJobs;
  } catch (error) {
    console.error('Database initialization error:', error);
    return [];
  }
}

/**
 * Load jobs from database into memory
 * @param {Array} incompleteJobs - Array of incomplete jobs from database
 * @returns {Array} - Array of jobs in memory format
 */
function loadJobsIntoMemory(incompleteJobs) {
  if (incompleteJobs.length > 0) {
    jobs = incompleteJobs.map(job => ({
      jobId: job.jobId,
      sitemapUrl: job.sitemapUrl,
      totalUrls: job.totalUrls,
      processedUrls: job.processedUrls,
      isRunning: job.isRunning,
      startTime: job.startTime.toISOString(),
      completedTime: job.completedTime ? job.completedTime.toISOString() : null,
      urls: job.urls.map(url => ({
        url: url.url,
        status: url.status,
        // Convert filesystem paths to web-accessible paths
        imagePath: url.imagePath && !url.imagePath.startsWith('/api/screenshots/') 
          ? `/api/screenshots/${job.jobId}/screenshots/${path.basename(url.imagePath)}` 
          : url.imagePath
      }))
    }));
    
    console.log(`Loaded ${incompleteJobs.length} jobs into memory`);
  }
  return jobs;
}

/**
 * Create a new job
 * @param {string} jobId - The job ID
 * @param {string} sitemapUrl - The sitemap URL
 * @param {Array} urls - Array of URLs to process
 * @param {boolean} highlightLinks - Whether to highlight external links
 * @returns {Object} - The created job
 */
async function createJob(jobId, sitemapUrl, urls, highlightLinks = true) {
  // Create job record in database
  const job = await prisma.job.create({
    data: {
      jobId,
      sitemapUrl,
      totalUrls: urls.length,
      processedUrls: 0,
      isRunning: true,
      startTime: new Date(),
      highlightLinks,
      urls: {
        create: urls.map(url => ({
          url,
          status: 'to_do'
        }))
      }
    },
    include: {
      urls: true
    }
  });
  
  // Add job to memory array
  jobs.unshift({
    jobId,
    sitemapUrl,
    totalUrls: urls.length,
    processedUrls: 0,
    isRunning: true,
    highlightLinks,
    startTime: job.startTime.toISOString(),
    urls: job.urls.map(url => ({
      url: url.url,
      status: url.status,
      imagePath: null
    }))
  });
  
  return job;
}

/**
 * Get a job by ID
 * @param {string} jobId - The job ID
 * @returns {Object} - The job
 */
async function getJob(jobId) {
  return await prisma.job.findUnique({
    where: { jobId },
    include: { urls: true }
  });
}

/**
 * Get all jobs
 * @returns {Array} - Array of jobs
 */
async function getAllJobs() {
  return await prisma.job.findMany({
    include: { urls: true },
    orderBy: { startTime: 'desc' }
  });
}

/**
 * Update URL status
 * @param {string} jobId - The job ID
 * @param {string} url - The URL
 * @param {string} status - The new status
 * @param {string} imagePath - The image path
 */
async function updateUrlStatus(jobId, url, status, imagePath = null) {
  // Update URL status in database
  await prisma.url.updateMany({
    where: {
      jobId: jobId,
      url: url
    },
    data: {
      status: status,
      imagePath: imagePath,
      processedAt: new Date()
    }
  });
  
  // Update job status in memory
  const job = jobs.find(j => j.jobId === jobId);
  if (job) {
    if (status === 'completed') {
      job.processedUrls += 1;
    }
    
    // Update URL status in memory
    const urlObj = job.urls?.find(u => u.url === url);
    if (urlObj) {
      urlObj.status = status;
      urlObj.imagePath = imagePath;
    }
  }
  
  // Update job processed URLs count in database if status is completed
  if (status === 'completed') {
    await prisma.job.update({
      where: { jobId },
      data: { processedUrls: { increment: 1 } }
    });
  }
}

/**
 * Mark job as completed
 * @param {string} jobId - The job ID
 */
async function completeJob(jobId) {
  // Mark job as completed in database
  await prisma.job.update({
    where: { jobId },
    data: {
      isRunning: false,
      completedTime: new Date()
    }
  });
  
  // Mark job as completed in memory
  const job = jobs.find(j => j.jobId === jobId);
  if (job) {
    job.isRunning = false;
    job.completedTime = new Date().toISOString();
  }
}

/**
 * Get pending URLs for a job
 * @param {string} jobId - The job ID
 * @returns {Array} - Array of pending URLs
 */
async function getPendingUrls(jobId) {
  const dbJob = await prisma.job.findUnique({
    where: { jobId },
    include: { urls: true }
  });
  
  if (dbJob) {
    // Filter URLs that are still in 'to_do' status
    const pendingUrlObjects = dbJob.urls.filter(u => u.status === 'to_do');
    return pendingUrlObjects.map(u => u.url);
  }
  
  return [];
}

// Export functions and jobs array
export {
  jobs,
  initializeJobs,
  loadJobsIntoMemory,
  createJob,
  getJob,
  getAllJobs,
  updateUrlStatus,
  completeJob,
  getPendingUrls
};