import express from 'express';
import { parseString } from 'xml2js';
import axios from 'axios';
import { createJobDirectories, createScreenshotsZip, getJobFiles } from '../utils/fileSystem.js';
import { createJob, getJob, getAllJobs, jobs } from '../models/jobManager.js';
import { crawlWebsite } from '../services/crawler.js';

const router = express.Router();

/**
 * Start crawling a website from a sitemap URL
 */
router.post('/crawl', async (req, res) => {
  try {
    const { sitemapUrl, highlightLinks = true } = req.body;
    
    if (!sitemapUrl) {
      return res.status(400).json({ error: 'Sitemap URL is required' });
    }
    
    // Create a job-specific directory
    const jobId = Date.now().toString();
    const { jobDir, jobScreenshotDir, jobPdfDir } = createJobDirectories(jobId);
    
    // Fetch and parse sitemap
    const response = await axios.get(sitemapUrl);
    const sitemapXml = response.data;
    
    let urls = [];
    parseString(sitemapXml, (err, result) => {
      if (err) {
        return res.status(400).json({ error: 'Invalid sitemap XML' });
      }
      
      if (result.urlset && result.urlset.url) {
        urls = result.urlset.url.map(urlObj => urlObj.loc[0]);
      }
    });
    
    if (urls.length === 0) {
      return res.status(400).json({ error: 'No URLs found in sitemap' });
    }
    
    // Create job record in database and memory
    await createJob(jobId, sitemapUrl, urls, highlightLinks);
    
    // Start crawling process
    res.json({ 
      message: 'Crawling started', 
      totalUrls: urls.length,
      jobId
    });
    
    // Launch browser and start crawling
    await crawlWebsite(urls, jobId, false, highlightLinks);
    
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
      status: dbJob.isRunning ? 'running' : 'completed',
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
router.get('/download/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Create ZIP file
    const { zipFilePath, zipFileName } = createScreenshotsZip(jobId);
    
    res.download(zipFilePath, zipFileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Error creating zip file' });
  }
});

/**
 * Default download endpoint for backward compatibility
 */
router.get('/download', (req, res) => {
  try {
    // Default to latest job
    const latestJob = jobs[0];
    if (!latestJob) {
      return res.status(404).json({ error: 'No jobs found' });
    }
    
    // Create ZIP file
    const { zipFilePath, zipFileName } = createScreenshotsZip(latestJob.jobId);
    
    res.download(zipFilePath, zipFileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Error creating zip file' });
  }
});

export default router;