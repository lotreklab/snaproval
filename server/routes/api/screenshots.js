import express from 'express';
import path from 'path';
import fs from 'fs';
import { outputDir } from '../../utils/fileSystem.js';
import prisma from '../../db.js';
import { createJobZip } from '../../services/zipCreator.js';
import { createJobPdf } from '../../services/pdfCreator.js';

const router = express.Router();

// Serve static screenshot files
router.use('/:jobId/:filename', async (req, res, next) => {
  try {
    const { jobId, filename } = req.params;
    
    // Determine if we're serving a zip file or a regular screenshot
    if (filename === `screenshots-${jobId}.zip`) {
      // Check if the job exists and belongs to the user
      const job = await prisma.job.findUnique({
        where: { jobId }
      });
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const zipPath = path.join(outputDir, jobId, filename);
      
      // Check if zip exists
      if (!fs.existsSync(zipPath)) {
        // Try to create it on-demand if it doesn't exist
        try {
          await createJobZip(jobId);
          
          // Check again after creation attempt
          if (!fs.existsSync(zipPath)) {
            return res.status(404).json({ error: 'Zip file not found' });
          }
        } catch (error) {
          console.error(`Error creating zip file on demand:`, error);
          return res.status(500).json({ error: 'Failed to create zip file' });
        }
      }
      
      // Set appropriate headers for zip download
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="screenshots-${jobId}.zip"`,
        'Content-Length': fs.statSync(zipPath).size
      });
      
      // Stream the file instead of loading it all in memory
      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);
    }
    // PDF file
    else if (filename === `screenshots-${jobId}.pdf`) {
      // Check if the job exists
      const job = await prisma.job.findUnique({
        where: { jobId }
      });
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const pdfPath = path.join(outputDir, jobId, filename);
      
      // Check if PDF exists
      if (!fs.existsSync(pdfPath)) {
        // Try to create it on-demand if it doesn't exist
        try {
          await createJobPdf(jobId);
          
          // Check again after creation attempt
          if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ error: 'PDF file not found' });
          }
        } catch (error) {
          console.error(`Error creating PDF file on demand:`, error);
          return res.status(500).json({ error: 'Failed to create PDF file' });
        }
      }
      
      // Set appropriate headers for PDF download
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="screenshots-${jobId}.pdf"`,
        'Content-Length': fs.statSync(pdfPath).size
      });
      
      // Stream the file instead of loading it all in memory
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
    }
    // Regular screenshot file
    else {
      // Validate the job ID and filename format
      const screenshotPath = path.join(outputDir, jobId, 'screenshots', filename);
      if (!fs.existsSync(screenshotPath)) {
        return res.status(404).json({ error: 'Screenshot not found' });
      }
      
      res.sendFile(screenshotPath);
    }
  } catch (error) {
    next(error);
  }
});

// Add a specific endpoint to force create/refresh the zip file
router.post('/:jobId/create-zip', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if the job exists
    const job = await prisma.job.findUnique({
      where: { jobId }
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Create the zip file
    await createJobZip(jobId);
    
    // Return the download URL
    res.json({ 
      success: true, 
      downloadUrl: `/api/screenshots/${jobId}/screenshots-${jobId}.zip`
    });
  } catch (error) {
    console.error('Error creating zip file:', error);
    res.status(500).json({ error: 'Failed to create zip file' });
  }
});

// Add a specific endpoint to force create/refresh the PDF file
router.post('/:jobId/create-pdf', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if the job exists
    const job = await prisma.job.findUnique({
      where: { jobId }
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Create the PDF file
    await createJobPdf(jobId);
    
    // Return the download URL
    res.json({ 
      success: true, 
      downloadUrl: `/api/screenshots/${jobId}/screenshots-${jobId}.pdf`
    });
  } catch (error) {
    console.error('Error creating PDF file:', error);
    res.status(500).json({ error: 'Failed to create PDF file' });
  }
});

export default router; 