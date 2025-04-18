import express from 'express';
import { 
  getJob, 
  getJobInfo, 
} from '../../models/jobManager.js';
import { createJobZip } from '../../services/zipCreator.js';

const router = express.Router();

/**
 * Get all jobs
 */
router.get('/', async (req, res) => {
  // ... existing code ...
});

/**
 * Get job by ID
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Use getJobInfo instead of getJob to include download link
    const job = await getJobInfo(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(job);
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: 'Error getting job' });
  }
});

/**
 * Create a new job
 */
router.post('/', async (req, res) => {
  // ... existing code ...
});

/**
 * Cancel a job
 */
router.delete('/:jobId', async (req, res) => {
  // ... existing code ...
});

/**
 * Create a zip file for a job
 */
router.post('/:jobId/zip', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if job exists
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Create the zip file
    await createJobZip(jobId);
    
    // Get updated job info with download link
    const updatedJob = await getJobInfo(jobId);
    
    res.json({
      success: true,
      job: updatedJob
    });
  } catch (error) {
    console.error('Error creating zip file:', error);
    res.status(500).json({ error: 'Error creating zip file' });
  }
});

export default router; 