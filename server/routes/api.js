import express from 'express';
import { parseString } from 'xml2js';
import axios from 'axios';
import { createJobDirectories, createScreenshotsZip, getJobFiles } from '../utils/fileSystem.js';
import { createJob, getJob, getAllJobs, jobs, cancelJob } from '../models/jobManager.js';
import { crawlWebsite } from '../services/crawler.js';
import { createJobPdf } from '../services/pdfCreator.js';

const router = express.Router();

/**
 * Start crawling a website from a sitemap URL or direct URLs
 */
router.post('/crawl', async (req, res) => {
  try {
    const { sitemapUrl, urls, highlightLinks = true } = req.body;
    
    // Create a job-specific directory
    const jobId = Date.now().toString();
    const { jobDir, jobScreenshotDir, jobPdfDir } = createJobDirectories(jobId);
    
    let urlsToProcess = [];
    
    // Handle sitemap URL input
    if (sitemapUrl) {
      if (!sitemapUrl) {
        return res.status(400).json({ error: 'Sitemap URL is required' });
      }
      
      // Fetch and parse sitemap
      const response = await axios.get(sitemapUrl);
      const sitemapXml = response.data;
      
      parseString(sitemapXml, (err, result) => {
        if (err) {
          return res.status(400).json({ error: 'Invalid sitemap XML' });
        }
        
        if (result.urlset && result.urlset.url) {
          urlsToProcess = result.urlset.url.map(urlObj => urlObj.loc[0]);
        }
      });
    } 
    // Handle direct URLs input
    else if (urls && Array.isArray(urls)) {
      urlsToProcess = urls.filter(url => url && typeof url === 'string' && url.trim() !== '');
    }
    else {
      return res.status(400).json({ error: 'Either a sitemap URL or a list of URLs is required' });
    }
    
    if (urlsToProcess.length === 0) {
      return res.status(400).json({ error: 'No valid URLs found to process' });
    }
    
    // Create job record in database and memory
    await createJob(jobId, sitemapUrl || 'Direct URLs', urlsToProcess, highlightLinks);
    
    // Start crawling process
    res.json({ 
      message: 'Crawling started', 
      totalUrls: urlsToProcess.length,
      jobId
    });
    
    // Launch browser and start crawling
    await crawlWebsite(urlsToProcess, jobId, false, highlightLinks);
    
  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get crawling status for a specific job
 */
router.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  try {
    // Find job by ID from database
    const dbJob = await getJob(jobId);
    
    if (!dbJob) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get files for this job
    const files = getJobFiles(jobId);
    
    // Count completed URLs
    const completedUrls = dbJob.urls.filter(url => url.status === 'completed').length;
    
    res.json({
      jobId: dbJob.jobId,
      status: dbJob.status,
      isRunning: dbJob.isRunning,
      filesGenerated: completedUrls,
      totalUrls: dbJob.totalUrls,
      processedUrls: completedUrls,
      files: files,
      urls: dbJob.urls.map(url => ({
        url: url.url,
        status: url.status,
        imagePath: url.imagePath
      }))
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get all jobs
 */
router.get('/jobs', async (req, res) => {
  try {
    const dbJobs = await getAllJobs();
    
    res.json({
      jobs: dbJobs.map(job => ({
        jobId: job.jobId,
        sitemapUrl: job.sitemapUrl,
        totalUrls: job.totalUrls,
        processedUrls: job.urls.filter(url => url.status === 'completed').length,
        isRunning: job.isRunning,
        status: job.status,
        startTime: job.startTime.toISOString(),
        completedTime: job.completedTime ? job.completedTime.toISOString() : null
      }))
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Download all screenshots as ZIP for a specific job
 */
router.get('/download/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if job exists and get its status
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Prevent downloads for cancelled jobs
    if (job.status === 'cancelled') {
      return res.status(403).json({ error: 'Downloads are not available for cancelled jobs' });
    }
    
    // Create ZIP file
    const { zipFilePath, zipFileName } = createScreenshotsZip(jobId);
    
    res.download(zipFilePath, zipFileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Error creating zip file' });
  }
});

/**
 * Download all screenshots as PDF for a specific job
 */
router.get('/download-pdf/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if job exists and get its status
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Prevent downloads for cancelled jobs
    if (job.status === 'cancelled') {
      return res.status(403).json({ error: 'Downloads are not available for cancelled jobs' });
    }
    
    // Create PDF file by calling createJobPdf function
    try {
      const pdfPath = await createJobPdf(jobId);
      const pdfFileName = `screenshots-${jobId}.pdf`;
      
      res.download(pdfPath, pdfFileName);
    } catch (error) {
      console.error('PDF creation error:', error);
      res.status(500).json({ error: 'Error creating PDF file' });
    }
  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({ error: 'Error creating PDF file' });
  }
});

/**
 * Default download endpoint for backward compatibility
 */
router.get('/download', async (req, res) => {
  try {
    // Default to latest job
    const latestJob = jobs[0];
    if (!latestJob) {
      return res.status(404).json({ error: 'No jobs found' });
    }
    
    // Check job status from database
    const dbJob = await getJob(latestJob.jobId);
    
    // Prevent downloads for cancelled jobs
    if (dbJob && dbJob.status === 'cancelled') {
      return res.status(403).json({ error: 'Downloads are not available for cancelled jobs' });
    }
    
    // Create ZIP file
    const { zipFilePath, zipFileName } = createScreenshotsZip(latestJob.jobId);
    
    res.download(zipFilePath, zipFileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Error creating zip file' });
  }
});

/**
 * Cancel a running job
 */
router.post('/cancel/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  try {
    // Find job by ID from database
    const dbJob = await getJob(jobId);
    
    if (!dbJob) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!dbJob.isRunning) {
      return res.status(400).json({ error: 'Job is not running' });
    }
    
    // Cancel the job
    await cancelJob(jobId);
    
    res.json({
      jobId: dbJob.jobId,
      status: 'cancelled',
      message: 'Job canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling job:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;