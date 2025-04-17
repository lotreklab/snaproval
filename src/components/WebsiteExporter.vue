<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';

const sitemapUrl = ref('');
const directUrls = ref('');
const inputMode = ref('sitemap'); // 'sitemap' or 'urls'
const highlightLinks = ref(true); // Default to true for highlighting external links
const isLoading = ref(false);
const error = ref('');
const showAdvanced = ref(false); // State for accordion toggle
const crawlStatus = reactive({
  isRunning: false,
  jobId: null,
  totalUrls: 0,
  processedUrls: 0,
  files: [],
  status: ''
});

const startCrawling = async () => {
  if (inputMode.value === 'sitemap' && !sitemapUrl.value) {
    error.value = 'Please enter a sitemap URL';
    return;
  }
  
  if (inputMode.value === 'urls' && !directUrls.value) {
    error.value = 'Please enter at least one URL';
    return;
  }
  
  try {
    isLoading.value = true;
    error.value = '';
    crawlStatus.isRunning = true;
    crawlStatus.files = [];
    
    let payload = {
      highlightLinks: highlightLinks.value
    };
    
    if (inputMode.value === 'sitemap') {
      payload.sitemapUrl = sitemapUrl.value;
    } else {
      // Split the text by new lines and filter out empty lines
      const urlList = directUrls.value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
      
      if (urlList.length === 0) {
        error.value = 'Please enter at least one valid URL';
        isLoading.value = false;
        crawlStatus.isRunning = false;
        return;
      }
      
      payload.urls = urlList;
    }
    
    const response = await axios.post('/api/crawl', payload);
    
    crawlStatus.jobId = response.data.jobId;
    crawlStatus.totalUrls = response.data.totalUrls;
    
    // Start polling for status
    pollStatus();
    
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to start crawling';
    crawlStatus.isRunning = false;
  } finally {
    isLoading.value = false;
  }
};

const pollStatus = async () => {
  if (!crawlStatus.jobId) return;
  
  try {
    const response = await axios.get(`/api/status/${crawlStatus.jobId}`);
    
    if (response.data.status === 'completed') {
      crawlStatus.isRunning = false;
      crawlStatus.processedUrls = response.data.filesGenerated;
      crawlStatus.files = response.data.files;
      crawlStatus.status = 'completed';
    } else {
      crawlStatus.processedUrls = response.data.filesGenerated || 0;
      crawlStatus.files = response.data.files || [];
      crawlStatus.status = response.data.status;
      // Continue polling
      setTimeout(pollStatus, 2000);
    }
  } catch (err) {
    console.error('Error polling status:', err);
    crawlStatus.isRunning = false;
    error.value = 'Error checking crawl status';
  }
};

const cancelJob = async () => {
  if (!crawlStatus.jobId || !crawlStatus.isRunning) return;
  
  try {
    isLoading.value = true;
    error.value = '';
    
    const response = await axios.post(`/api/cancel/${crawlStatus.jobId}`);
    
    if (response.data.status === 'canceled') {
      crawlStatus.isRunning = false;
      error.value = 'Job canceled successfully';
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to cancel job';
  } finally {
    isLoading.value = false;
  }
};

const downloadZip = async () => {
  try {
    isLoading.value = true;
    error.value = '';
    
    // Prevent download if job was cancelled
    if (crawlStatus.status === 'cancelled') {
      error.value = 'Download not available for cancelled jobs';
      return;
    }
    
    // Use window.open for direct download with jobId
    // We keep using window.open for direct file downloads as this is the appropriate approach
    // even when using Vue Router (router is for page navigation, not file downloads)
    if (crawlStatus.jobId) {
      window.open(`/api/download/${crawlStatus.jobId}`, '_blank');
    } else {
      error.value = 'No job ID available for download';
    }
  } catch (err) {
    error.value = 'Failed to download files';
  } finally {
    isLoading.value = false;
  }
};

const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value;
};
</script>

<template>
  <div class="website-exporter">
    
    <div class="form-container">
      <div class="input-mode-tabs">
        <button 
          @click="inputMode = 'sitemap'" 
          :class="{'active': inputMode === 'sitemap'}"
          :disabled="isLoading || crawlStatus.isRunning"
        >
          Sitemap URL
        </button>
        <button 
          @click="inputMode = 'urls'" 
          :class="{'active': inputMode === 'urls'}"
          :disabled="isLoading || crawlStatus.isRunning"
        >
          Direct URLs
        </button>
      </div>
      
      <div v-if="inputMode === 'sitemap'" class="form-group">
        <label for="sitemap-url">Sitemap URL:</label>
        <input 
          id="sitemap-url" 
          v-model="sitemapUrl" 
          type="url" 
          placeholder="https://example.com/sitemap.xml"
          :disabled="isLoading || crawlStatus.isRunning"
        />
      </div>
      
      <div v-if="inputMode === 'urls'" class="form-group">
        <label for="direct-urls">URLs to Crawl (one per line):</label>
        <textarea 
          id="direct-urls" 
          v-model="directUrls" 
          placeholder="https://example.com/page1
https://example.com/page2
https://example.com/page3"
          :disabled="isLoading || crawlStatus.isRunning"
          rows="5"
        ></textarea>
      </div>
      
      <button 
        @click="startCrawling" 
        :disabled="isLoading || crawlStatus.isRunning || (inputMode === 'sitemap' && !sitemapUrl) || (inputMode === 'urls' && !directUrls)"
        class="primary-button"
      >
        {{ isLoading ? 'Starting...' : 'Start Crawling' }}
      </button>
      
      <div class="accordion">
        <div class="accordion-header">
          <span @click="toggleAdvanced" class="accordion-header-text" >
            <span>Advanced</span>
            <span class="accordion-icon">{{ showAdvanced ? '▼' : '▶' }}</span>
          </span>
        </div>
        <div class="accordion-content" v-show="showAdvanced">
          <div class="form-group toggle-container">
            <label for="highlight-links">Highlight External Links:</label>
            <div class="toggle-switch">
              <input 
                id="highlight-links" 
                type="checkbox" 
                v-model="highlightLinks" 
                :disabled="isLoading || crawlStatus.isRunning"
              />
              <label for="highlight-links" class="toggle-slider"></label>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-if="crawlStatus.jobId" class="status-container">
      <h2>Crawling Status</h2>
      
      <div class="status-info">
        <p>
          <strong>Status:</strong> {{ crawlStatus.status.charAt(0).toUpperCase() + crawlStatus.status.slice(1) }}
        </p>
        <p>
          <strong>Progress:</strong> {{ crawlStatus.processedUrls }} / {{ crawlStatus.totalUrls }} pages
        </p>
        <div v-if="crawlStatus.isRunning" class="action-buttons">
          <button 
            @click="cancelJob" 
            :disabled="isLoading"
            class="cancel-button"
          >
            Cancel Job
          </button>
        </div>
      </div>
      
      <div v-if="crawlStatus.files.length > 0" class="files-container">
        <h3>Generated Files ({{ crawlStatus.files.length }}):</h3>
        <ul class="files-list">
          <li v-for="(file, index) in crawlStatus.files" :key="index">
            {{ file }}
          </li>
        </ul>
        
        <button 
          @click="downloadZip" 
          :disabled="isLoading || crawlStatus.status === 'cancelled'"
          :title="crawlStatus.status === 'cancelled' ? 'Download not available for cancelled jobs' : 'Download all files as ZIP'"
          class="download-button"
        >
          Download All as ZIP
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.website-exporter {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.input-mode-tabs {
  display: flex;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.input-mode-tabs button {
  flex: 1;
  padding: 0.75rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--muted);
  font-weight: 500;
  transition: all 0.2s ease;
}

.input-mode-tabs button.active {
  color: var(--foreground);
  border: 2px solid var(--muted);
}

.input-mode-tabs button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

h1 {
  font-size: 2rem;
  margin: 0;
  color: var(--foreground);
}

.results-link {
  padding: 0.5rem 1rem;
  background-color: var(--card);
  color: var(--foreground);
  text-decoration: none;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-weight: 500;
  transition: all 0.2s ease;
}

.results-link:hover {
  background-color: var(--card-hover);
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: var(--radius);
  background-color: var(--card);
  border: 1px solid var(--border);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toggle-container {
  display: flex;
  align-items: center;
  justify-content: end;
  flex-direction: row;
}

label {
  cursor: pointer;
  font-weight: 500;
  color: var(--muted);
  font-size: 0.9rem;
}

.toggle-container label {
  margin-bottom: 0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
  z-index: 1;
  cursor: pointer;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border);
  transition: .4s;
  border-radius: 24px;
  display: block;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: #ffffff; /* Fixed color for the toggle circle */
  transition: .4s;
  border-radius: 50%;
}

.toggle-slider.checked:before {
  transform: translateX(26px);
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

.accordion {
  margin-bottom: 1rem;
  overflow: hidden;
}

.accordion-header {
  display: flex;
  justify-content: end;
  align-items: center;
  padding: 0.25rem;
  color: var(--muted);
  font-size: small;
  transition: background-color 0.2s ease;
}
.accordion-header-text:hover {
  cursor: pointer;
}
.accordion-icon {
  font-size: 0.8rem;
  transition: transform 0.2s ease;
  margin-left: 0.5rem;
}

.accordion-content {
  color: var(--muted);
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}
input, textarea {
  width: auto;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.95rem;
  background-color: var(--card);
  color: var(--foreground);
  transition: border-color 0.2s ease;
  font-family: inherit;
}

textarea {
  resize: vertical;
  min-height: 100px;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

.primary-button {
  background-color: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-button:hover {
  background-color: var(--card-hover);
  border-color: var(--ring);
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  color: #f44336;
  padding: 1rem;
  background-color: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: var(--radius);
  margin-bottom: 1rem;
}

.status-container {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.status-info {
  margin-bottom: 1.5rem;
  color: var(--muted);
}

.files-container {
  background-color: var(--card-hover);
  border-radius: var(--radius);
  padding: 1rem;
  border: 1px solid var(--border);
}

.files-list {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  color: var(--muted);
}

.download-button, .cancel-button {
  padding: 0.75rem 1.5rem;
  background-color: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: block;
  width: 100%;
}

.cancel-button {
  background-color: #dc3545;
  margin-left: 1rem;
  display: inline-block;
  width: auto;
}

.download-button:hover {
  background-color: var(--card-hover);
  border-color: var(--ring);
}

.download-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>