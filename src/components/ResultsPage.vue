<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const jobs = ref([]);
const selectedJob = ref(null);
const isLoading = ref(false);
const error = ref('');
const cancelLoading = ref(false);

// Helper function to determine the CSS class based on status
const getStatusClass = (status) => {
  return status === 'running' ? 'running' :
         status === 'completed' ? 'completed' :
         status === 'cancelled' ? 'cancelled' : '';
};

// Fetch all jobs when component is mounted
const fetchJobs = async () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    const response = await axios.get('/api/jobs');
    jobs.value = response.data.jobs;
  } catch (err) {
    console.error('Error fetching jobs:', err);
    error.value = 'Failed to load jobs';
  } finally {
    isLoading.value = false;
  }
};

// Fetch job details including URL statuses
const fetchJobDetails = async (jobId) => {
  isLoading.value = true;
  error.value = '';
  
  try {
    const response = await axios.get(`/api/status/${jobId}`);
    selectedJob.value = response.data;
  } catch (err) {
    console.error('Error fetching job details:', err);
    error.value = 'Failed to load job details';
  } finally {
    isLoading.value = false;
  }
};

// Download specific job results
const downloadJob = (jobId) => {
  // Find the job in our local data
  const job = jobs.value.find(j => j.jobId === jobId);
  
  // Prevent download if job was cancelled
  if (job && job.status === 'cancelled') {
    error.value = 'Download not available for cancelled jobs';
    return;
  }
  
  window.open(`/api/download/${jobId}`, '_blank');
};

// Download job results as PDF
const downloadPdf = (jobId) => {
  // Find the job in our local data
  const job = jobs.value.find(j => j.jobId === jobId);
  
  // Prevent download if job was cancelled
  if (job && job.status === 'cancelled') {
    error.value = 'Download not available for cancelled jobs';
    return;
  }
  
  window.open(`/api/download-pdf/${jobId}`, '_blank');
};

// Cancel a running job
const cancelJob = async (jobId) => {
  if (!jobId) return;
  
  try {
    cancelLoading.value = true;
    error.value = '';
    
    const response = await axios.post(`/api/cancel/${jobId}`);
    
    if (response.data.status === 'cancelled') {
      // Update the job status in the jobs list
      const jobIndex = jobs.value.findIndex(job => job.jobId === jobId);
      if (jobIndex !== -1) {
        jobs.value[jobIndex].isRunning = false;
        jobs.value[jobIndex].status = 'cancelled';
      }
      
      // Also update the selected job if it's the same one
      if (selectedJob.value && selectedJob.value.jobId === jobId) {
        selectedJob.value.status = 'cancelled';
        selectedJob.value.isRunning = false;
      }
      
      error.value = 'Job canceled successfully';
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to cancel job';
  } finally {
    cancelLoading.value = false;
  }
};

// View job details
const viewJobDetails = (jobId) => {
  fetchJobDetails(jobId);
};

// Close job details view
const closeJobDetails = () => {
  selectedJob.value = null;
};

onMounted(() => {
  fetchJobs();
});
</script>

<template>
  <div class="results-page">
    
    <div class="actions-container">
      <router-link to="/" class="back-link" title="Back to Crawler">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </router-link>
      <button @click="fetchJobs" class="refresh-button" :disabled="isLoading" title="Refresh">
        <span v-if="isLoading">Loading...</span>
        <span v-else>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </span>
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-if="isLoading" class="loading-message">
      Loading jobs...
    </div>
    
    <div v-else-if="jobs.length === 0" class="no-jobs-message">
      No crawling jobs found. Start a new job from the main page.
    </div>
    
    <div v-else class="jobs-container">
      <div v-for="job in jobs" :key="job.jobId" class="job-card" @click="viewJobDetails(job.jobId)">
        <div class="job-header">
          <h3>Job ID: {{ job.jobId }}</h3>
          <span class="job-status" :class="getStatusClass(job.status)">
            {{ job.status.charAt(0).toUpperCase() + job.status.slice(1) }}
          </span>
        </div>
        
        <div class="job-details">
          <p><strong>Source:</strong> 
            <span v-if="job.sitemapUrl === 'Direct URLs'">
              Direct URLs
            </span>
            <span v-else>
              {{ job.sitemapUrl }}
            </span>
          </p>
          <p><strong>Progress:</strong> {{ job.processedUrls }} / {{ job.totalUrls }} URLs</p>
          <p><strong>Started:</strong> {{ new Date(job.startTime).toLocaleString() }}</p>
          <p v-if="job.completedTime"><strong>Completed:</strong> {{ new Date(job.completedTime).toLocaleString() }}</p>
        </div>
        
        <div class="job-actions">
          <div class="download-buttons">
            <button 
              @click.stop="downloadJob(job.jobId)" 
              class="download-button"
              :disabled="job.status === 'cancelled'"
              :title="job.status === 'cancelled' ? 'Download not available for cancelled jobs' : 'Download job results as ZIP'"
            >ZIP</button>
            <button 
              @click.stop="downloadPdf(job.jobId)" 
              class="download-button pdf-button"
              :disabled="job.status === 'cancelled'"
              :title="job.status === 'cancelled' ? 'Download not available for cancelled jobs' : 'Download job results as PDF'"
            >PDF</button>
          </div>
          <button @click.stop="viewJobDetails(job.jobId)" class="view-details-button">View Details</button>
          <button 
            v-if="job.isRunning" 
            @click.stop="cancelJob(job.jobId)" 
            class="cancel-button"
            :disabled="cancelLoading"
          >
            {{ cancelLoading ? 'Canceling...' : 'Cancel Job' }}
          </button>
        </div>
      </div>
    </div>
      
    <!-- Job Details Modal -->
    <div v-if="selectedJob" class="job-details-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2># {{ selectedJob.jobId }}</h2>
          <button @click="closeJobDetails" class="close-button">×</button>
        </div>
        
        <div class="modal-body">
          <p><strong>Status:</strong> <span class="job-status-text" :class="getStatusClass(selectedJob.status)">{{ selectedJob.status.charAt(0).toUpperCase() + selectedJob.status.slice(1) }}</span></p>
          <p><strong>Progress:</strong> {{ selectedJob.processedUrls }} / {{ selectedJob.totalUrls }} URLs</p>
          
          <div v-if="selectedJob.isRunning" class="modal-actions">
            <button 
              @click="cancelJob(selectedJob.jobId)" 
              class="cancel-button"
              :disabled="cancelLoading"
            >
              {{ cancelLoading ? 'Canceling...' : 'Cancel Job' }}
            </button>
          </div>
          
          <div v-if="!selectedJob.isRunning && selectedJob.status !== 'cancelled'" class="modal-actions">
            <div class="download-buttons">
              <button 
                @click="downloadJob(selectedJob.jobId)" 
                class="download-button"
              >
                Download as ZIP
              </button>
              <button 
                @click="downloadPdf(selectedJob.jobId)" 
                class="download-button pdf-button"
              >
                Download as PDF
              </button>
            </div>
          </div>
          
          <h4>URLs Status</h4>
          <div class="url-list">
            <div v-for="(url, index) in selectedJob.urls" :key="index" class="url-item">
              <div class="url-status" :class="url.status">
                {{ url.status }}
              </div>
              <div class="url-text">{{ url.url }}</div>
              <div v-if="url.imagePath" class="url-image">
                <a :href="url.imagePath" target="_blank">View Screenshot</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
}

h1 {
  color: var(--foreground);
  margin-bottom: 2rem;
  text-align: center;
}

.actions-container {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.refresh-button {
  color: var(--accent);
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.refresh-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.back-link {
  color: var(--accent);
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-message {
  color: #f44336;
  padding: 1rem;
  background-color: var(--card);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.loading-message, .no-jobs-message {
  text-align: center;
  padding: 2rem;
  background-color: var(--card);
  border-radius: 4px;
  color: #666;
}

.jobs-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.job-card {
  background-color: var(--card);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: 1.5rem;
  transition: all 0.2s ease;
  cursor: pointer;
}

.job-card:hover {
  transform: translateY(-5px);
  background-color: var(--card-hover);
  border-color: var(--ring);
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.job-header h3 {
  margin: 0;
  color: var(--foreground);
  font-weight: 500;
  font-size: 1.2rem;
}

.job-status {
  padding: 0.25rem 0.5rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.job-status.running {
  background-color: rgba(255, 193, 7, 0.2);
  color: #FFC107;
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.job-status.completed {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.job-status.cancelled {
  background-color: rgba(244, 67, 54, 0.2);
  color: #F44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.job-details {
  margin-bottom: 1rem;
}

.job-details p {
  margin: 0.5rem 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.job-actions {
  display: flex;
  flex-direction: column;
  margin-top: 1rem;
  gap: 0.5rem;
}

.download-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.download-button, .view-details-button {
  background-color: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-details-button {
  flex-grow: 1;
}

.download-button:hover, .view-details-button:hover {
  background-color: var(--card-hover);
  border-color: var(--accent);
}

.download-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-details-button {
  background-color: var(--card);
}

.view-details-button:hover {
  background-color: var(--card-hover);
}

.cancel-button {
  background-color: #dc3545;
  color: white;
  border: 1px solid #dc3545;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  flex: 1;
}

.cancel-button:hover {
  background-color: #c82333;
  border-color: #bd2130;
}

.cancel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-actions {
  margin: 1rem 0;
  display: flex;
  justify-content: flex-start;
}

/* Modal Styles */
.job-details-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--card);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  color: var(--foreground);
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.2s ease;
}

.close-button:hover {
  color: var(--foreground);
}

.modal-body {
  padding: 1.5rem;
}

.modal-body h3, .modal-body h4 {
  color: var(--foreground);
  margin-top: 0;
  font-weight: 500;
}

.url-list {
  margin-top: 1.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background-color: var(--card-hover);
}

/* URL List Styles */
.url-list {
  margin-top: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-height: 400px;
  overflow-y: auto;
}

.url-item {
  display: flex;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  align-items: center;
}

.url-item:last-child {
  border-bottom: none;
}

.url-status {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius);
  font-size: 0.8rem;
  font-weight: 500;
  margin-right: 1rem;
  min-width: 80px;
  text-align: center;
}

.url-status.to_do {
  background-color: rgba(255, 193, 7, 0.2);
  color: #FFC107;
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.url-status.completed {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.url-status.cancelled {
  background-color: rgba(244, 67, 54, 0.2);
  color: #F44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.url-text {
  flex: 1;
  word-break: break-all;
  color: var(--muted);
}

.url-image {
  margin-left: 1rem;
}

.url-image a {
  color: var(--accent);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.url-image a:hover {
  opacity: 0.8;
}

.job-status-text {
  font-weight: 500;
}

.job-status-text.running {
  color: #FFC107;
}

.job-status-text.completed {
  color: #4CAF50;
}

.job-status-text.cancelled {
  color: #F44336;
}

.pdf-button {
  background-color: var(--card);
}
</style>