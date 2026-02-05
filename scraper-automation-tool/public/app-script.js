// Configuration
// Use current origin for API calls (works on localhost and Railway)
const API_BASE = `${window.location.origin}/api`;
const API_KEY = 'test-api-key-12345';

// State
let allData = [];
let filteredData = [];
let currentJobId = null;
let allJobsData = []; // Store all jobs with their data
let uniqueLocations = new Set();
let currentPage = 1;
let itemsPerPage = 30;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadCompletedJobs();
    setupEventListeners();
});

// Toggle max pages input based on selection
function toggleMaxPagesInput() {
    const select = document.getElementById('maxPagesSelect');
    const inputGroup = document.getElementById('maxPagesInputGroup');
    
    if (select.value === 'all') {
        inputGroup.style.display = 'none';
    } else {
        inputGroup.style.display = 'block';
    }
}

// Navigation
function showSection(sectionName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-primary-500', 'text-primary-600', 'font-semibold');
        btn.classList.add('border-transparent', 'text-gray-500', 'font-medium');
    });
    
    // Add active styles to clicked tab
    const activeBtn = event?.target || document.querySelector(`.tab-btn:first-child`);
    if (activeBtn && activeBtn.classList.contains('tab-btn')) {
        activeBtn.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
        activeBtn.classList.add('border-primary-500', 'text-primary-600', 'font-semibold');
    }

    // Update sections - hide all, show selected
    document.querySelectorAll('section[id$="-section"]').forEach(section => {
        section.classList.add('hidden');
    });
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('animate-fade-in');
    }

    // Load section-specific data
    if (sectionName === 'dashboard') loadDashboard();
    if (sectionName === 'database') {
        loadCompletedJobs();
        loadAllData(); // Auto-load all data
    }
    if (sectionName === 'enrich') loadEnrichmentJobs();
}

// Dashboard
async function loadDashboard() {
    try {
        // Add cache-busting timestamp to prevent stale data
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE}/jobs?limit=100&_t=${timestamp}`, {
            headers: { 
                'X-API-Key': API_KEY,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        const data = await response.json();
        const jobs = data.jobs || [];

        // Calculate stats
        const completedJobs = jobs.filter(j => j.status === 'completed');
        const runningJobs = jobs.filter(j => j.status === 'running');
        const totalItems = jobs.reduce((sum, j) => sum + (j.items_extracted || 0), 0);
        
        // Update basic stats
        document.getElementById('totalJobs').textContent = jobs.length;
        document.getElementById('completedJobs').textContent = completedJobs.length;
        document.getElementById('runningJobs').textContent = runningJobs.length;
        document.getElementById('totalItems').textContent = totalItems;

        // Calculate and display success rate
        const successRate = jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0;
        document.getElementById('successRate').textContent = `${successRate}% success rate`;
        
        // Calculate average items per job
        const avgItems = completedJobs.length > 0 ? Math.round(totalItems / completedJobs.length) : 0;
        document.getElementById('avgItemsPerJob').textContent = `~${avgItems} items per job`;
        
        // Running jobs status
        if (runningJobs.length > 0) {
            document.getElementById('runningJobsStatus').textContent = '⏳ Jobs in progress';
        } else {
            document.getElementById('runningJobsStatus').textContent = 'No active jobs';
        }

        // Show/hide empty state
        const noJobsMessage = document.getElementById('noJobsMessage');
        const recentJobsList = document.getElementById('recentJobsList');
        
        if (jobs.length === 0) {
            noJobsMessage.classList.remove('hidden');
            recentJobsList.innerHTML = '';
        } else {
            noJobsMessage.classList.add('hidden');
            
            // Get filtered jobs based on status filter
            const statusFilter = document.getElementById('dashboardStatusFilter')?.value || '';
            const filteredJobs = statusFilter ? jobs.filter(j => j.status === statusFilter) : jobs;
            
            // Show recent jobs (up to 10)
            const recentJobs = filteredJobs.slice(0, 10);
            
            if (recentJobs.length === 0) {
                recentJobsList.innerHTML = '<div class="text-center py-8 text-gray-500">No jobs match the selected filter</div>';
            } else {
                recentJobsList.innerHTML = recentJobs.map(job => renderJobCard(job)).join('');
            }
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Render enhanced job card
function renderJobCard(job) {
    const jobId = job.id || job.job_id;
    const status = job.status || 'unknown';
    const itemsExtracted = job.items_extracted || 0;
    const location = job.parameters?.location || 'Unknown';
    const category = job.parameters?.category || 'Unknown';
    const createdAt = job.created_at ? new Date(job.created_at) : null;
    const timeAgo = createdAt ? formatTimeAgo(createdAt) : 'Unknown time';
    
    // Status badge colors
    const statusColors = {
        completed: 'bg-success-100 text-success-700 border-success-200',
        running: 'bg-warning-100 text-warning-700 border-warning-200',
        failed: 'bg-danger-100 text-danger-700 border-danger-200',
        pending: 'bg-blue-100 text-blue-700 border-blue-200',
        queued: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    
    const statusColor = statusColors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    
    // Status icons
    const statusIcons = {
        completed: '✅',
        running: '⏳',
        failed: '❌',
        pending: '⏸️',
        queued: '📋'
    };
    
    const statusIcon = statusIcons[status] || '•';
    
    // Action buttons based on status with enhanced visibility and responsive sizing
    let actionButtons = '';
    
    if (status === 'completed') {
        actionButtons = `
            <button onclick="downloadJobData('${jobId}', 'json')" 
                    class="p-1.5 sm:p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 hover:text-blue-700 transition-all shadow-sm hover:shadow" 
                    title="Download JSON">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
            </button>
            <button onclick="viewJobInDatabase('${jobId}')" 
                    class="p-1.5 sm:p-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-600 hover:text-purple-700 transition-all shadow-sm hover:shadow" 
                    title="View Data">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
            </button>
            <button onclick="retryJob('${jobId}')" 
                    class="p-1.5 sm:p-2 bg-success-50 hover:bg-success-100 rounded-lg text-success-600 hover:text-success-700 transition-all shadow-sm hover:shadow" 
                    title="Rerun Job">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </button>
        `;
    } else if (status === 'running' || status === 'queued') {
        actionButtons = `
            <button onclick="stopJob('${jobId}')" 
                    class="p-1.5 sm:p-2 bg-danger-50 hover:bg-danger-100 rounded-lg text-danger-600 hover:text-danger-700 transition-all shadow-sm hover:shadow" 
                    title="Stop Job (requires server restart)">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                </svg>
            </button>
        `;
    } else if (status === 'failed') {
        actionButtons = `
            <button onclick="retryJob('${jobId}')" 
                    class="p-1.5 sm:p-2 bg-warning-50 hover:bg-warning-100 rounded-lg text-warning-600 hover:text-warning-700 transition-all shadow-sm hover:shadow" 
                    title="Retry Failed Job">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </button>
        `;
    }
    
    return `
        <div class="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200 overflow-hidden">
            <!-- Mobile Layout -->
            <div class="block sm:hidden">
                <div class="p-3">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span class="text-xs font-mono text-gray-600 truncate">${jobId.substring(0, 8)}</span>
                            <span class="px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor} whitespace-nowrap">
                                ${statusIcon} ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="flex gap-1 ml-2">
                            ${actionButtons}
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 mb-3">${timeAgo}</div>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <div class="text-gray-500 mb-0.5">Location</div>
                            <div class="font-medium text-gray-900 truncate">${formatLocation(location)}</div>
                        </div>
                        <div>
                            <div class="text-gray-500 mb-0.5">Items</div>
                            <div class="font-medium text-gray-900">${itemsExtracted} venues</div>
                        </div>
                        <div class="col-span-2">
                            <div class="text-gray-500 mb-0.5">Category</div>
                            <div class="font-medium text-gray-900 truncate">${formatCategory(category)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Desktop Layout -->
            <div class="hidden sm:block">
                <div class="p-4">
                    <div class="flex items-center justify-between gap-4 mb-3">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <span class="text-sm font-mono text-gray-600">${jobId.substring(0, 8)}</span>
                            <span class="px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor} whitespace-nowrap">
                                ${statusIcon} ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                            <span class="text-xs text-gray-500">${timeAgo}</span>
                        </div>
                        <div class="flex gap-1.5 flex-shrink-0">
                            ${actionButtons}
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 text-xs">
                        <div class="min-w-0">
                            <div class="text-gray-500 mb-1">Location</div>
                            <div class="font-medium text-gray-900 truncate">${formatLocation(location)}</div>
                        </div>
                        <div class="min-w-0">
                            <div class="text-gray-500 mb-1">Category</div>
                            <div class="font-medium text-gray-900 truncate">${formatCategory(category)}</div>
                        </div>
                        <div class="min-w-0">
                            <div class="text-gray-500 mb-1">Items</div>
                            <div class="font-medium text-gray-900">${itemsExtracted} venues</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Format time ago helper
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
}

// Format location helper
function formatLocation(location) {
    if (!location) return 'Unknown';
    return location.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ');
}

// Format category helper
function formatCategory(category) {
    if (!category) return 'Unknown';
    return category.replace('wedding-', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Filter dashboard jobs by status
function filterDashboardJobs() {
    loadDashboard();
}

// Download job data
function downloadJobData(jobId, format) {
    const link = document.createElement('a');
    link.href = `/data/${jobId}.${format}`;
    link.download = `${jobId}.${format}`;
    link.click();
}

// View job in database tab
function viewJobInDatabase(jobId) {
    showSection('database');
    // Auto-load and filter to this job's data
    setTimeout(() => {
        loadAllData();
    }, 100);
}

// Retry failed job (placeholder - would need backend support)
function retryJob(jobId) {
    alert('Retry functionality coming soon! Job ID: ' + jobId);
}

// Scraper Form
function setupEventListeners() {
    document.getElementById('scraperForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const maxPagesSelect = document.getElementById('maxPagesSelect').value;
        const maxPagesValue = maxPagesSelect === 'all' ? 999 : parseInt(document.getElementById('maxPages').value);
        
        // Get webhook URL (optional)
        const webhookUrl = document.getElementById('webhookUrl').value.trim();
        
        const data = {
            site: 'theknot',
            parameters: {
                location: document.getElementById('location').value,
                category: document.getElementById('category').value,
                maxPages: maxPagesValue
            },
            format: document.getElementById('format').value,
            headless: !document.getElementById('showBrowser').checked
        };
        
        // Add webhook_url if provided
        if (webhookUrl) {
            data.webhook_url = webhookUrl;
        }

        try {
            const response = await fetch(`${API_BASE}/scrape`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (response.ok) {
                // Show progress container
                document.getElementById('scraperProgressContainer').style.display = 'block';
                document.getElementById('scraperStatus').style.display = 'none';
                
                // Start enhanced polling
                pollScraperProgress(result.jobId, maxPagesValue);
            } else {
                showStatus('scraperStatus', 'error', `❌ Error: ${result.error}`);
            }
        } catch (error) {
            showStatus('scraperStatus', 'error', `❌ Error: ${error.message}`);
        }
    });

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', applyFilters);
}

// Poll job status
async function pollJobStatus(jobId, statusElementId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
                headers: { 'X-API-Key': API_KEY }
            });
            const job = await response.json();

            if (job.status === 'completed') {
                clearInterval(interval);
                const itemCount = job.items_extracted || job.progress?.items_extracted || job.items_enriched || 0;
                
                // Create download buttons for both formats
                let downloadBtns = '';
                if (job.result_file_path) {
                    const jobIdMatch = job.result_file_path.match(/([a-f0-9-]+)\.(json|csv)/);
                    if (jobIdMatch) {
                        const fileJobId = jobIdMatch[1];
                        downloadBtns = `
                            <a href="/data/${fileJobId}.json" download="${fileJobId}.json" class="btn btn-sm" style="margin-left: 10px;">📥 JSON</a>
                            <a href="/data/${fileJobId}.csv" download="${fileJobId}.csv" class="btn btn-sm" style="margin-left: 5px;">📥 CSV</a>
                        `;
                    }
                }
                
                showStatus(statusElementId, 'success', `✅ Complete! ${itemCount} items${downloadBtns}`);
                loadDashboard();
            } else if (job.status === 'failed') {
                clearInterval(interval);
                showStatus(statusElementId, 'error', `❌ Failed: ${job.error_message}`);
            } else {
                const itemCount = job.items_extracted || job.progress?.items_extracted || job.items_enriched || 0;
                showStatus(statusElementId, 'info', `⏳ Running... ${itemCount} items`);
            }
        } catch (error) {
            clearInterval(interval);
        }
    }, 3000);
}

// Database Functions
async function loadCompletedJobs() {
    try {
        const response = await fetch(`${API_BASE}/jobs?limit=50`, {
            headers: { 'X-API-Key': API_KEY }
        });
        const data = await response.json();
        const completedJobs = data.jobs.filter(job => job.status === 'completed');

        const selects = ['enrichJobSelect', 'cleanupJobSelect'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select a job...</option>';
                completedJobs.forEach(job => {
                    const option = document.createElement('option');
                    option.value = job.id || job.job_id;
                    option.textContent = `${job.id || job.job_id} - ${job.site} (${new Date(job.created_at).toLocaleString()})`;
                    select.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

// Load all data from all completed jobs
async function loadAllData() {
    try {
        showStatus('dataStats', 'info', '⏳ Loading all data...');
        
        const response = await fetch(`${API_BASE}/jobs?limit=100`, {
            headers: { 'X-API-Key': API_KEY }
        });
        const data = await response.json();
        const completedJobs = data.jobs.filter(job => job.status === 'completed');

        console.log(`Found ${completedJobs.length} completed jobs`);

        allJobsData = [];
        uniqueLocations.clear();

        // Load data from each completed job
        for (const job of completedJobs) {
            try {
                console.log(`Loading job ${job.id || job.job_id}:`, {
                    created_at: job.created_at,
                    finished_at: job.finished_at,
                    location: job.parameters?.location,
                    category: job.parameters?.category
                });

                const dataResponse = await fetch(`${API_BASE}/jobs/${job.id || job.job_id}/data`, {
                    headers: { 'X-API-Key': API_KEY }
                });
                const result = await dataResponse.json();
                
                console.log(`  API Response for job ${job.id || job.job_id}:`, {
                    hasData: !!result.data,
                    isArray: Array.isArray(result.data),
                    dataLength: result.data?.length,
                    itemsCount: result.items_count,
                    format: result.format
                });
                
                if (result.data && Array.isArray(result.data)) {
                    // Add metadata to each item (use finished_at if available, fallback to created_at)
                    const itemsWithMeta = result.data.map(item => ({
                        ...item,
                        _job_id: job.id || job.job_id,
                        _job_date: job.finished_at || job.created_at,
                        _job_category: job.parameters?.category || 'unknown',
                        _job_location: job.parameters?.location || 'unknown'
                    }));
                    
                    allJobsData.push(...itemsWithMeta);
                    
                    // Collect unique locations
                    if (job.parameters?.location) {
                        uniqueLocations.add(job.parameters.location);
                    }
                    
                    console.log(`  Loaded ${result.data.length} items`);
                }
            } catch (error) {
                console.error(`Error loading data for job ${job.id}:`, error);
            }
        }

        console.log(`Total items loaded: ${allJobsData.length}`);

        // Collect unique job IDs
        const uniqueJobIds = new Set();
        allJobsData.forEach(item => {
            if (item._job_id) {
                uniqueJobIds.add(item._job_id);
            }
        });

        // Populate Job ID filter
        const jobIdFilter = document.getElementById('jobIdFilter');
        jobIdFilter.innerHTML = '<option value="">All Jobs</option>';
        Array.from(uniqueJobIds).sort().forEach(jobId => {
            const option = document.createElement('option');
            option.value = jobId;
            option.textContent = jobId.substring(0, 8) + '...'; // Show first 8 chars
            jobIdFilter.appendChild(option);
        });

        // Populate location filter
        const locationFilter = document.getElementById('locationFilter');
        locationFilter.innerHTML = '<option value="">All Locations</option>';
        Array.from(uniqueLocations).sort().forEach(loc => {
            const option = document.createElement('option');
            option.value = loc;
            option.textContent = loc.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ');
            locationFilter.appendChild(option);
        });

        allData = allJobsData;
        filteredData = [...allData];
        currentPage = 1; // Reset pagination
        renderDataTable();
        updateDataStats();
        
        showStatus('dataStats', 'success', `✅ Loaded ${allData.length} items from ${completedJobs.length} jobs`);
    } catch (error) {
        console.error('Error loading all data:', error);
        showStatus('dataStats', 'error', '❌ Error loading data');
    }
}

// Apply filters
function applyFilters() {
    const dateFilter = document.getElementById('dateFilter').value;
    const jobIdFilter = document.getElementById('jobIdFilter').value;
    const locationFilter = document.getElementById('locationFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredData = allData.filter(item => {
        // Date filter
        if (dateFilter) {
            const jobDate = new Date(item._job_date);
            const now = new Date();
            
            if (dateFilter === 'today') {
                if (jobDate.toDateString() !== now.toDateString()) return false;
            } else if (dateFilter === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (jobDate < weekAgo) return false;
            } else if (dateFilter === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                if (jobDate < monthAgo) return false;
            }
        }

        // Job ID filter
        if (jobIdFilter && item._job_id !== jobIdFilter) {
            return false;
        }

        // Location filter
        if (locationFilter && item._job_location !== locationFilter) {
            return false;
        }

        // Category filter
        if (categoryFilter && item._job_category !== categoryFilter) {
            return false;
        }

        // Search filter
        if (searchTerm) {
            const searchableText = Object.values(item).join(' ').toLowerCase();
            if (!searchableText.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    currentPage = 1; // Reset to first page when filters change
    renderDataTable();
    updateDataStats();
    updatePagination();
}

function renderDataTable() {
    const container = document.getElementById('dataTableContainer');
    
    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16">
                <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <p class="text-gray-500 text-lg font-medium">No data found</p>
                <p class="text-gray-400 text-sm mt-2">Try adjusting your filters or run a new scraping job</p>
            </div>
        `;
        updatePagination();
        updateSelectionControls();
        return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const preferredOrder = ['name', 'location', 'rating', 'reviews', 'price', 'url', 'website', 'website_clean', 'phone', 'email', 'facebook', 'instagram'];
    const allKeys = [...new Set(paginatedData.flatMap(item => Object.keys(item)))];
    
    // Filter out metadata fields (starting with _)
    const dataKeys = allKeys.filter(key => !key.startsWith('_'));
    
    const keys = [
        ...preferredOrder.filter(key => dataKeys.includes(key)),
        ...dataKeys.filter(key => !preferredOrder.includes(key)).sort()
    ];

    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left">
                            <input type="checkbox" id="selectAllRows" onchange="toggleSelectAllRows()" class="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500">
                        </th>
                        ${keys.map(key => {
                            const header = key === 'website_clean' ? 'Clean Website' : 
                                           key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${paginatedData.map((item, index) => {
                        const globalIndex = startIndex + index;
                        return `
                        <tr class="hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <input type="checkbox" class="row-checkbox w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500" data-index="${globalIndex}" onchange="updateSelectionControls()">
                            </td>
                            ${keys.map(key => {
                                const value = item[key];
                                
                                // Handle URLs
                                if (value && (key === 'url' || key === 'website' || key === 'website_clean' || key === 'facebook' || key === 'instagram')) {
                                    return `<td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <a href="${value}" target="_blank" class="text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1">
                                            <span class="truncate max-w-xs">${value}</span>
                                            <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                            </svg>
                                        </a>
                                    </td>`;
                                }
                                
                                // Handle rating
                                if (key === 'rating' && value) {
                                    return `<td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <div class="flex items-center gap-1">
                                            <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                            </svg>
                                            <span class="font-medium text-gray-900">${value}</span>
                                        </div>
                                    </td>`;
                                }
                                
                                // Handle reviews count
                                if (key === 'reviews' && value) {
                                    return `<td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            ${value} reviews
                                        </span>
                                    </td>`;
                                }
                                
                                // Handle price
                                if (key === 'price' && value) {
                                    return `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${value}</td>`;
                                }
                                
                                // Handle name (bold)
                                if (key === 'name' && value) {
                                    return `<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${value}</td>`;
                                }
                                
                                // Default
                                return `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${value || '-'}</td>`;
                            }).join('')}
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHTML;
    updatePagination();
    updateSelectionControls();
}

// Selection functions
function toggleSelectAllRows() {
    const checked = document.getElementById('selectAllRows').checked;
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateSelectionControls();
}

function updateSelectionControls() {
    const selectedCount = document.querySelectorAll('.row-checkbox:checked').length;
    const downloadBtn = document.getElementById('downloadSelectedBtn');
    const downloadText = document.getElementById('downloadSelectedText');
    
    if (selectedCount > 0) {
        downloadBtn.classList.remove('hidden');
        downloadText.textContent = `Download Selected (${selectedCount})`;
    } else {
        downloadBtn.classList.add('hidden');
    }
}

function downloadSelected() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.row-checkbox:checked'));
    
    if (selectedCheckboxes.length === 0) {
        showModal({
            type: 'info',
            title: 'No Venues Selected',
            message: 'Please select at least one venue from the table to download.',
            buttons: [
                {
                    text: 'OK',
                    className: 'px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm'
                }
            ]
        });
        return;
    }
    
    const selectedIndices = selectedCheckboxes.map(cb => parseInt(cb.dataset.index));
    const selectedData = selectedIndices.map(i => filteredData[i]);
    
    // Remove metadata fields
    const cleanedData = selectedData.map(item => {
        const cleaned = {};
        Object.keys(item).forEach(key => {
            if (!key.startsWith('_')) {
                cleaned[key] = item[key];
            }
        });
        return cleaned;
    });
    
    const csv = convertToCSV(cleanedData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected-venues-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Show success message
    showModal({
        type: 'success',
        title: 'Download Complete',
        message: `Successfully downloaded ${selectedCheckboxes.length} selected venues to CSV format.`,
        buttons: [
            {
                text: 'Great!',
                className: 'px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors font-medium text-sm'
            }
        ]
    });
}

function updateDataStats() {
    const stats = document.getElementById('dataStats');
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredData.length);
    
    if (filteredData.length === 0) {
        stats.textContent = 'No items found';
    } else {
        stats.textContent = `Showing ${startIndex}-${endIndex} of ${filteredData.length} items (${allData.length} total)`;
    }
}

// Pagination functions
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const pageInfo = `Page ${currentPage} of ${totalPages}`;
    
    document.getElementById('pageInfo').textContent = pageInfo;
    document.getElementById('pageInfoBottom').textContent = pageInfo;
    
    // Update button states
    const prevBtns = document.querySelectorAll('.pagination-controls button:first-child');
    const nextBtns = document.querySelectorAll('.pagination-controls button:last-child');
    
    prevBtns.forEach(btn => btn.disabled = currentPage === 1);
    nextBtns.forEach(btn => btn.disabled = currentPage === totalPages || totalPages === 0);
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const newPage = currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderDataTable();
        updateDataStats();
        
        // Scroll to top of table
        document.getElementById('dataTableContainer').scrollIntoView({ behavior: 'smooth' });
    }
}

function changeItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('itemsPerPage').value);
    currentPage = 1; // Reset to first page
    renderDataTable();
    updateDataStats();
}

function exportData() {
    if (filteredData.length === 0) {
        showModal({
            type: 'info',
            title: 'No Data Available',
            message: 'There is no data to export. Please load data from the Data Library first.',
            buttons: [
                {
                    text: 'OK',
                    className: 'px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm'
                }
            ]
        });
        return;
    }

    const csv = convertToCSV(filteredData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${Date.now()}.csv`;
    a.click();
    
    // Show success message
    showModal({
        type: 'success',
        title: 'Export Successful',
        message: `Successfully exported ${filteredData.length} venues to CSV format.`,
        buttons: [
            {
                text: 'Great!',
                className: 'px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors font-medium text-sm'
            }
        ]
    });
}

function convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const rows = data.map(item => headers.map(h => JSON.stringify(item[h] || '')).join(','));
    return [headers.join(','), ...rows].join('\n');
}

// Enrichment Functions
function showEnrichModal() {
    console.log('showEnrichModal called, filteredData length:', filteredData.length);
    if (filteredData.length === 0) {
        showModal({
            type: 'info',
            title: 'No Data Loaded',
            message: 'Please load data from the Data Library before enriching venues.',
            buttons: [
                {
                    text: 'OK',
                    className: 'px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm'
                }
            ]
        });
        return;
    }
    
    const modal = document.getElementById('enrichModal');
    modal.classList.remove('hidden');
    
    // Populate venue list from current filtered data
    populateEnrichVenueList();
    
    // Reset progress container
    document.getElementById('enrichProgressContainer').style.display = 'none';
    document.getElementById('enrichStatus').style.display = 'none';
}

function closeEnrichModal() {
    console.log('closeEnrichModal called');
    document.getElementById('enrichModal').classList.add('hidden');
}

function populateEnrichVenueList() {
    const venueList = document.getElementById('enrichVenueList');
    
    if (filteredData.length === 0) {
        venueList.innerHTML = '<div class="p-4 text-center text-gray-500">No venues available</div>';
        return;
    }
    
    // Filter to show only unenriched venues (venues without website, phone, or social media)
    const unenrichedVenues = filteredData.filter(venue => {
        const hasWebsite = venue.website || venue.website_clean;
        const hasPhone = venue.phone;
        const hasSocial = venue.facebook || venue.instagram || venue.twitter || venue.pinterest;
        const hasEmail = venue.email;
        
        // Consider enriched if it has at least 2 of these: website, phone, social, email
        const enrichedCount = [hasWebsite, hasPhone, hasSocial, hasEmail].filter(Boolean).length;
        return enrichedCount < 2; // Show if less than 2 enriched fields
    });
    
    if (unenrichedVenues.length === 0) {
        venueList.innerHTML = `
            <div class="p-8 text-center">
                <svg class="w-16 h-16 text-success-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-gray-700 font-semibold text-lg">All venues are already enriched!</p>
                <p class="text-gray-500 text-sm mt-2">All ${filteredData.length} venues have sufficient contact information.</p>
            </div>
        `;
        return;
    }
    
    venueList.innerHTML = `
        <div class="p-3 bg-blue-50 border-b border-blue-200">
            <div class="flex items-center gap-2 text-sm text-blue-800">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span><strong>${unenrichedVenues.length}</strong> of ${filteredData.length} venues need enrichment</span>
            </div>
        </div>
    ` + unenrichedVenues.map((venue, index) => {
        // Safely encode venue data to avoid JSON parsing issues
        const venueDataEncoded = btoa(encodeURIComponent(JSON.stringify(venue)));
        
        // Check what's missing
        const missing = [];
        if (!venue.website && !venue.website_clean) missing.push('🌐 Website');
        if (!venue.phone) missing.push('📞 Phone');
        if (!venue.facebook && !venue.instagram) missing.push('📱 Social');
        if (!venue.email) missing.push('📧 Email');
        
        return `
        <div class="p-3 border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors">
            <label class="flex items-start gap-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    class="enrich-venue-checkbox w-5 h-5 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 mt-0.5 flex-shrink-0" 
                    data-index="${filteredData.indexOf(venue)}"
                    data-venue-encoded="${venueDataEncoded}"
                    onchange="updateEnrichSelectionCount()"
                >
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900">${venue.name || 'Unknown Venue'}</div>
                    <div class="text-sm text-gray-600 mt-0.5">
                        <span>📍 ${venue.location || 'Unknown'}</span>
                        ${venue.rating ? `<span class="ml-3">⭐ ${venue.rating}</span>` : ''}
                    </div>
                    ${venue.url ? `
                        <div class="text-xs text-purple-600 mt-1 truncate">
                            🔗 ${venue.url}
                        </div>
                    ` : '<div class="text-xs text-gray-400 mt-1">No URL available</div>'}
                    ${missing.length > 0 ? `
                        <div class="flex flex-wrap gap-1 mt-2">
                            ${missing.map(m => `<span class="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">${m}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </label>
        </div>
    `;
    }).join('');
    
    updateEnrichSelectionCount();
}

function toggleSelectAllEnrich() {
    const checked = document.getElementById('selectAllEnrichVenues').checked;
    document.querySelectorAll('.enrich-venue-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateEnrichSelectionCount();
}

function updateEnrichSelectionCount() {
    const selected = document.querySelectorAll('.enrich-venue-checkbox:checked').length;
    document.getElementById('enrichSelectionCount').textContent = `${selected} selected`;
}

async function startEnrichment() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.enrich-venue-checkbox:checked'));
    
    if (selectedCheckboxes.length === 0) {
        alert('Please select at least one venue to enrich');
        return;
    }

    // Decode venue data safely
    const selectedVenues = selectedCheckboxes.map(cb => {
        const encoded = cb.dataset.venueEncoded;
        return JSON.parse(decodeURIComponent(atob(encoded)));
    });
    
    const venueUrls = selectedVenues.map(v => v.url).filter(url => url); // Filter out empty URLs
    
    if (venueUrls.length === 0) {
        alert('Selected venues do not have URLs. Cannot enrich without URLs.');
        return;
    }

    const data = {
        site: 'theknot',
        venueUrls,
        originalData: selectedVenues,
        format: 'json',
        headless: !document.getElementById('showBrowserEnrich').checked
    };

    try {
        const response = await fetch(`${API_BASE}/enrich`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            // Show progress container
            document.getElementById('enrichProgressContainer').style.display = 'block';
            document.getElementById('enrichStatus').style.display = 'none';
            
            // Start enhanced polling
            pollEnrichmentProgress(result.jobId, venueUrls.length, selectedVenues);
        } else {
            showStatus('enrichStatus', 'error', `❌ Error: ${result.error}`);
            document.getElementById('enrichStatus').style.display = 'flex';
        }
    } catch (error) {
        showStatus('enrichStatus', 'error', `❌ Error: ${error.message}`);
        document.getElementById('enrichStatus').style.display = 'flex';
    }
}


// Cleanup Functions
function showCleanupModal() {
    console.log('showCleanupModal called, filteredData length:', filteredData.length);
    if (filteredData.length === 0) {
        showModal({
            type: 'info',
            title: 'No Data Loaded',
            message: 'Please load data from the Data Library before running cleanup operations.',
            buttons: [
                {
                    text: 'OK',
                    className: 'px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm'
                }
            ]
        });
        return;
    }
    const modal = document.getElementById('cleanupModal');
    console.log('Modal element:', modal);
    modal.classList.remove('hidden');
    document.getElementById('duplicatesContainer').style.display = 'none';
    document.getElementById('cleanupStatus').style.display = 'none';
    console.log('Modal should now be visible');
}

function closeCleanupModal() {
    console.log('closeCleanupModal called');
    document.getElementById('cleanupModal').classList.add('hidden');
}

function detectDuplicatesFromCurrent() {
    console.log('detectDuplicatesFromCurrent called, filteredData length:', filteredData.length);
    if (filteredData.length === 0) {
        showStatus('cleanupStatus', 'error', '❌ No data loaded');
        return;
    }

    const duplicates = findDuplicates(filteredData);
    console.log('Duplicates found:', duplicates.length, duplicates);
    displayDuplicates(duplicates);
    
    if (duplicates.length === 0) {
        showStatus('cleanupStatus', 'success', '✅ No duplicates found!');
    } else {
        showStatus('cleanupStatus', 'info', `🔍 Found ${duplicates.length} duplicate groups`);
    }
}

function findDuplicates(data) {
    const groups = {};
    
    data.forEach((item, index) => {
        // Create a key based on name and location (normalized)
        const key = `${(item.name || '').toLowerCase().trim()}-${(item.location || '').toLowerCase().trim()}`;
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push({ ...item, originalIndex: index });
    });

    // Filter groups with more than one item, then check URLs
    const duplicateGroups = [];
    
    Object.entries(groups)
        .filter(([, items]) => items.length > 1)
        .forEach(([, items]) => {
            // Group by URL within same name/location
            const urlGroups = {};
            
            items.forEach(item => {
                const url = (item.url || item.website || '').toLowerCase().trim();
                const urlKey = url || 'no-url';
                
                if (!urlGroups[urlKey]) {
                    urlGroups[urlKey] = [];
                }
                urlGroups[urlKey].push(item);
            });
            
            // Only consider as duplicates if they have the same URL (or both missing URL)
            Object.values(urlGroups).forEach(urlGroup => {
                if (urlGroup.length > 1) {
                    duplicateGroups.push({
                        items: urlGroup,
                        name: urlGroup[0].name,
                        location: urlGroup[0].location,
                        url: urlGroup[0].url || urlGroup[0].website || 'No URL'
                    });
                }
            });
        });
    
    return duplicateGroups;
}

function displayDuplicates(duplicates) {
    const container = document.getElementById('duplicatesContainer');
    const list = document.getElementById('duplicatesList');

    if (duplicates.length === 0) {
        container.style.display = 'none';
        return;
    }

    list.innerHTML = duplicates.map((group, groupIndex) => `
        <div class="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div class="flex items-start justify-between">
                <div>
                    <h4 class="font-semibold text-gray-900">🔄 ${group.name}</h4>
                    <div class="text-sm text-gray-600 mt-1">
                        <span class="font-medium">Location:</span> ${group.location}
                    </div>
                    <div class="text-sm text-gray-600">
                        <span class="font-medium">URL:</span> ${group.url}
                    </div>
                </div>
                <span class="px-2 py-1 bg-warning-100 text-warning-700 text-xs font-medium rounded-full">
                    ${group.items.length} duplicates
                </span>
            </div>
            <div class="space-y-2">
                ${group.items.map((item, itemIndex) => `
                    <div class="flex items-center justify-between p-3 bg-white rounded border border-gray-200 hover:border-primary-300 transition-colors">
                        <div class="flex-1">
                            <div class="font-medium text-gray-900">${item.name}</div>
                            <div class="text-xs text-gray-500 mt-1 space-x-3">
                                <span>📍 ${item.location}</span>
                                ${item.rating ? `<span>⭐ ${item.rating}</span>` : ''}
                                ${item.reviews ? `<span>💬 ${item.reviews} reviews</span>` : ''}
                                ${item.price ? `<span>💰 ${item.price}</span>` : ''}
                            </div>
                            ${item.url || item.website ? `
                                <div class="text-xs text-primary-600 mt-1 truncate">
                                    🔗 ${item.url || item.website}
                                </div>
                            ` : ''}
                        </div>
                        <label class="flex items-center gap-2 ml-4 cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="dup-${groupIndex}-${itemIndex}" 
                                ${itemIndex > 0 ? 'checked' : ''} 
                                data-index="${item.originalIndex}"
                                class="w-5 h-5 text-danger-600 bg-white border-gray-300 rounded focus:ring-danger-500"
                            >
                            <span class="text-sm text-gray-600">Remove</span>
                        </label>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    container.style.display = 'block';
}

async function removeDuplicates() {
    const selectedDuplicates = Array.from(document.querySelectorAll('#duplicatesList input[type="checkbox"]:checked'));
    
    if (selectedDuplicates.length === 0) {
        alert('No duplicates selected for removal');
        return;
    }

    const indicesToRemove = selectedDuplicates.map(cb => parseInt(cb.dataset.index));
    
    // Filter out duplicates from filtered data
    const cleanedFiltered = filteredData.filter((item, index) => !indicesToRemove.includes(index));
    
    // Also remove from allData
    const itemsToRemove = indicesToRemove.map(i => filteredData[i]);
    allData = allData.filter(item => !itemsToRemove.includes(item));
    
    filteredData = cleanedFiltered;
    
    showStatus('cleanupStatus', 'success', `✅ Removed ${indicesToRemove.length} duplicates!`);
    
    // Close modal after 2 seconds
    setTimeout(() => {
        closeCleanupModal();
    }, 2000);
    
    // Update database view
    currentPage = 1;
    renderDataTable();
    updateDataStats();
}

// Utility Functions
function showStatus(elementId, type, message) {
    const element = document.getElementById(elementId);
    
    // For dataStats, just update text
    if (elementId === 'dataStats') {
        element.textContent = message;
        element.style.color = type === 'success' ? 'var(--success)' : 
                              type === 'error' ? 'var(--danger)' : 
                              'var(--text-secondary)';
        return;
    }
    
    // For status messages
    element.className = `status-message ${type}`;
    element.innerHTML = message;
    element.style.display = 'flex';
}

function viewJob(jobId) {
    document.getElementById('jobFilter').value = jobId;
    showSection('database');
    loadJobData();
}


// State for enrichment job tracking
let currentEnrichmentJobId = null;
let enrichmentPollingInterval = null;

// Enhanced enrichment progress polling
async function pollEnrichmentProgress(jobId, totalVenues, originalData) {
    currentEnrichmentJobId = jobId;
    const circle = document.getElementById('enrichProgressCircle');
    const circumference = 2 * Math.PI * 60; // radius = 60
    let lastItemCount = 0;
    let startTime = Date.now();
    
    enrichmentPollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
                headers: { 'X-API-Key': API_KEY }
            });
            const job = await response.json();
            
            const itemCount = job.items_extracted || job.progress?.items_extracted || job.items_enriched || 0;
            const percentage = totalVenues > 0 ? Math.round((itemCount / totalVenues) * 100) : 0;
            
            // Update circular progress
            const offset = circumference - (percentage / 100) * circumference;
            circle.style.strokeDashoffset = offset;
            
            // Update percentage text
            document.getElementById('enrichProgressPercent').textContent = `${percentage}%`;
            
            // Update progress count
            document.getElementById('enrichProgressCount').textContent = `${itemCount} / ${totalVenues}`;
            
            // Calculate elapsed time and ETA
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const avgTimePerVenue = itemCount > 0 ? elapsed / itemCount : 0;
            const remaining = totalVenues - itemCount;
            const eta = remaining > 0 && avgTimePerVenue > 0 ? Math.ceil(remaining * avgTimePerVenue) : 0;
            
            // Update status with progress info
            if (job.status === 'completed') {
                clearInterval(enrichmentPollingInterval);
                enrichmentPollingInterval = null;
                currentEnrichmentJobId = null;
                
                document.getElementById('enrichProgressStatus').innerHTML = `
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-success-600 font-semibold">Completed Successfully!</span>
                    </div>
                `;
                document.getElementById('enrichCurrentVenue').textContent = 'All venues enriched';
                document.getElementById('enrichCurrentUrl').textContent = `Completed in ${formatTime(elapsed)}`;
                
                // Fetch enriched data and update database
                try {
                    const enrichedResponse = await fetch(`${API_BASE}/jobs/${jobId}`, {
                        headers: { 'X-API-Key': API_KEY }
                    });
                    const enrichedJob = await enrichedResponse.json();
                    
                    if (enrichedJob.data && enrichedJob.data.length > 0) {
                        // Create a map of enriched data by URL for quick lookup
                        const enrichedMap = new Map();
                        enrichedJob.data.forEach(enrichedVenue => {
                            if (enrichedVenue.url) {
                                enrichedMap.set(enrichedVenue.url, enrichedVenue);
                            }
                        });
                        
                        // Update allData with enriched information
                        allData = allData.map(venue => {
                            const enriched = enrichedMap.get(venue.url);
                            if (enriched) {
                                // Merge enriched data into existing venue
                                return {
                                    ...venue,
                                    website: enriched.website || venue.website,
                                    phone: enriched.phone || venue.phone,
                                    email: enriched.email || venue.email,
                                    facebook: enriched.facebook || venue.facebook,
                                    instagram: enriched.instagram || venue.instagram,
                                    twitter: enriched.twitter || venue.twitter,
                                    pinterest: enriched.pinterest || venue.pinterest
                                };
                            }
                            return venue;
                        });
                        
                        // Update filteredData as well
                        filteredData = filteredData.map(venue => {
                            const enriched = enrichedMap.get(venue.url);
                            if (enriched) {
                                return {
                                    ...venue,
                                    website: enriched.website || venue.website,
                                    phone: enriched.phone || venue.phone,
                                    email: enriched.email || venue.email,
                                    facebook: enriched.facebook || venue.facebook,
                                    instagram: enriched.instagram || venue.instagram,
                                    twitter: enriched.twitter || venue.twitter,
                                    pinterest: enriched.pinterest || venue.pinterest
                                };
                            }
                            return venue;
                        });
                        
                        // Refresh the database view
                        renderDataTable();
                        updateDataStats();
                        
                        console.log(`✅ Database updated with ${enrichedJob.data.length} enriched venues`);
                    }
                } catch (error) {
                    console.error('Error updating database with enriched data:', error);
                }
                
                // Show success message with download buttons
                const downloadBtns = `
                    <div class="flex gap-2 mt-3">
                        <a href="/data/${jobId}.json" download="${jobId}.json" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
                            📥 Download JSON
                        </a>
                        <a href="/data/${jobId}.csv" download="${jobId}.csv" class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                            📥 Download CSV
                        </a>
                    </div>
                `;
                document.getElementById('enrichStatus').innerHTML = `
                    <div class="p-4 bg-success-50 border border-success-200 rounded-lg">
                        <div class="flex items-start gap-3">
                            <svg class="w-6 h-6 text-success-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div class="flex-1">
                                <p class="text-success-800 font-semibold">Enrichment Complete!</p>
                                <p class="text-success-700 text-sm mt-1">Successfully enriched ${itemCount} venues and updated database.</p>
                                ${downloadBtns}
                            </div>
                        </div>
                    </div>
                `;
                document.getElementById('enrichStatus').style.display = 'block';
                
                // Update detected details with final summary
                updateDetectedDetails(['website', 'phone', 'facebook', 'instagram'], true);
                
                loadDashboard();
                
            } else if (job.status === 'failed') {
                clearInterval(enrichmentPollingInterval);
                enrichmentPollingInterval = null;
                currentEnrichmentJobId = null;
                
                document.getElementById('enrichProgressStatus').innerHTML = `
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-danger-600 font-semibold">Failed</span>
                    </div>
                `;
                document.getElementById('enrichStatus').innerHTML = `
                    <div class="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                        <div class="flex items-start gap-3">
                            <svg class="w-6 h-6 text-danger-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div>
                                <p class="text-danger-800 font-semibold">Enrichment Failed</p>
                                <p class="text-danger-700 text-sm mt-1">${job.error_message || 'An error occurred during enrichment'}</p>
                            </div>
                        </div>
                    </div>
                `;
                document.getElementById('enrichStatus').style.display = 'block';
                
            } else {
                // Running - show detailed progress
                const statusText = itemCount === 0 ? 'Starting enrichment...' : 
                                 `Enriching venue ${itemCount} of ${totalVenues}`;
                
                document.getElementById('enrichProgressStatus').innerHTML = `
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-purple-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        <div>
                            <div class="font-semibold text-gray-900">${statusText}</div>
                            <div class="text-xs text-gray-500 mt-0.5">
                                Elapsed: ${formatTime(elapsed)} ${eta > 0 ? `• ETA: ${formatTime(eta)}` : ''}
                            </div>
                        </div>
                    </div>
                `;
                
                // Show current venue being processed
                if (itemCount > lastItemCount && itemCount <= totalVenues) {
                    const currentIndex = itemCount - 1;
                    if (originalData[currentIndex]) {
                        const venue = originalData[currentIndex];
                        document.getElementById('enrichCurrentVenue').textContent = venue.name || 'Unknown Venue';
                        document.getElementById('enrichCurrentUrl').textContent = venue.url || 'No URL';
                        
                        // Randomly show detected details for demo (in real app, this comes from backend)
                        const possibleDetails = ['website', 'phone', 'facebook', 'instagram', 'email'];
                        const detectedCount = Math.floor(Math.random() * 3) + 1;
                        const detected = possibleDetails.slice(0, detectedCount);
                        updateDetectedDetails(detected, false);
                    }
                }
                
                lastItemCount = itemCount;
            }
        } catch (error) {
            clearInterval(enrichmentPollingInterval);
            enrichmentPollingInterval = null;
            currentEnrichmentJobId = null;
            console.error('Polling error:', error);
            
            document.getElementById('enrichStatus').innerHTML = `
                <div class="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                    <p class="text-danger-800 font-semibold">Connection Error</p>
                    <p class="text-danger-700 text-sm mt-1">Lost connection to server. Please refresh and check job status.</p>
                </div>
            `;
            document.getElementById('enrichStatus').style.display = 'block';
        }
    }, 2000); // Poll every 2 seconds
}

function updateDetectedDetails(details, isComplete = false) {
    const container = document.getElementById('enrichDetectedDetails');
    
    if (details.length === 0) {
        container.innerHTML = '<span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Waiting...</span>';
        return;
    }
    
    const icons = {
        website: '🌐',
        phone: '📞',
        facebook: '📘',
        instagram: '📷',
        twitter: '🐦',
        pinterest: '📌',
        email: '📧'
    };
    
    const badges = details.map(detail => {
        const color = isComplete ? 'bg-success-100 text-success-700' : 'bg-purple-100 text-purple-700';
        return `<span class="px-3 py-1 ${color} rounded-full text-xs font-medium">${icons[detail] || '✓'} ${detail}</span>`;
    }).join('');
    
    container.innerHTML = badges;
}

// Format time helper
function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
}

// Cancel enrichment job
async function cancelEnrichment() {
    if (!currentEnrichmentJobId) {
        closeEnrichModal();
        return;
    }
    
    const confirmed = confirm('Are you sure you want to cancel this enrichment job? Progress will be lost.');
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Stop polling
        if (enrichmentPollingInterval) {
            clearInterval(enrichmentPollingInterval);
            enrichmentPollingInterval = null;
        }
        
        // Attempt to cancel job on backend (if API supports it)
        // Note: This would need backend support to actually stop the job
        // For now, we just stop polling and close the modal
        
        currentEnrichmentJobId = null;
        closeEnrichModal();
        
        // Show notification
        alert('Enrichment job cancelled. The job may continue running on the server.');
        
    } catch (error) {
        console.error('Error cancelling enrichment:', error);
        alert('Error cancelling job. Please refresh the page.');
    }
}


// Enhanced scraper progress polling
async function pollScraperProgress(jobId, maxPages) {
    const circle = document.getElementById('scraperProgressCircle');
    const circumference = 2 * Math.PI * 52;
    let lastPageCount = 0;
    let lastItemCount = 0;
    
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
                headers: { 'X-API-Key': API_KEY }
            });
            const job = await response.json();
            
            const pagesScraped = job.progress?.pages_scraped || 0;
            const itemsExtracted = job.progress?.items_extracted || 0;
            
            // For "All Pages" (999), show "X / ?" until complete
            // For fixed pages, show "X / Y"
            const isAllPages = maxPages === 999;
            const targetPages = isAllPages ? null : maxPages;
            
            // Calculate percentage
            let percentage = 0;
            if (job.status === 'completed') {
                percentage = 100;
            } else if (targetPages) {
                percentage = Math.round((pagesScraped / targetPages) * 100);
            } else {
                // For "All Pages", show progress but can't calculate exact percentage
                percentage = Math.min(pagesScraped * 10, 90); // Rough estimate
            }
            
            // Update circular progress
            const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
            circle.style.strokeDashoffset = offset;
            
            // Update percentage text
            document.getElementById('scraperProgressPercent').textContent = `${Math.min(percentage, 100)}%`;
            
            // Update pages count
            const pagesText = isAllPages ? `${pagesScraped} / ?` : `${pagesScraped} / ${maxPages}`;
            document.getElementById('scraperPagesCount').textContent = pagesText;
            
            // Update current page
            const currentPageNum = job.status === 'completed' ? pagesScraped : pagesScraped + 1;
            document.getElementById('scraperCurrentPage').textContent = `Page ${currentPageNum}`;
            
            // Update total venues
            document.getElementById('scraperVenuesCount').textContent = `${itemsExtracted} venues`;
            
            // Calculate venues on current page
            if (pagesScraped > lastPageCount) {
                const venuesThisPage = itemsExtracted - lastItemCount;
                document.getElementById('scraperCurrentPageVenues').textContent = `${venuesThisPage} venues`;
                lastPageCount = pagesScraped;
                lastItemCount = itemsExtracted;
            }
            
            // Calculate average per page
            const avgPerPage = pagesScraped > 0 ? Math.round(itemsExtracted / pagesScraped) : 0;
            document.getElementById('scraperAvgVenues').textContent = `~${avgPerPage} venues`;
            
            // Update status
            if (job.status === 'completed') {
                clearInterval(interval);
                document.getElementById('scraperProgressStatus').textContent = '✅ Completed';
                
                // Show completion message with download buttons
                const downloadBtns = `
                    <a href="/data/${jobId}.json" download="${jobId}.json" class="btn btn-sm" style="margin-left: 10px;">📥 JSON</a>
                    <a href="/data/${jobId}.csv" download="${jobId}.csv" class="btn btn-sm" style="margin-left: 5px;">📥 CSV</a>
                `;
                document.getElementById('scraperStatus').style.display = 'flex';
                showStatus('scraperStatus', 'success', `✅ Complete! ${itemsExtracted} venues from ${pagesScraped} pages${downloadBtns}`);
                loadDashboard();
                
            } else if (job.status === 'failed') {
                clearInterval(interval);
                document.getElementById('scraperProgressStatus').textContent = '❌ Failed';
                document.getElementById('scraperStatus').style.display = 'flex';
                showStatus('scraperStatus', 'error', `❌ Failed: ${job.error_message}`);
                
            } else {
                // Running
                document.getElementById('scraperProgressStatus').textContent = `⏳ Scraping page ${pagesScraped + 1}...`;
            }
        } catch (error) {
            clearInterval(interval);
            console.error('Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}


// ============================================
// Location Autocomplete (US Cities Only)
// ============================================

const US_LOCATIONS = [
    // Major Metropolitan Areas (Population > 1M)
    { name: 'New York, NY', value: 'new-york-ny', state: 'New York' },
    { name: 'Los Angeles, CA', value: 'los-angeles-ca', state: 'California' },
    // Chicago Metro Area
    { name: 'Chicago, IL', value: 'chicago-il', state: 'Illinois', city: 'Chicago' },
    { name: 'Chicago Heights, IL', value: 'chicago-heights-il', state: 'Illinois', city: 'Chicago Heights', area: 'Chicago Metro' },
    { name: 'Chicago Ridge, IL', value: 'chicago-ridge-il', state: 'Illinois', city: 'Chicago Ridge', area: 'Chicago Metro' },
    { name: 'Chicago Suburbs, IL', value: 'chicago-suburbs-il', state: 'Illinois', city: 'Chicago Suburbs', area: 'Chicago Metro' },
    { name: 'Houston, TX', value: 'houston-tx', state: 'Texas' },
    { name: 'Phoenix, AZ', value: 'phoenix-az', state: 'Arizona' },
    { name: 'Philadelphia, PA', value: 'philadelphia-pa', state: 'Pennsylvania' },
    { name: 'San Antonio, TX', value: 'san-antonio-tx', state: 'Texas' },
    { name: 'San Diego, CA', value: 'san-diego-ca', state: 'California' },
    { name: 'Dallas, TX', value: 'dallas-tx', state: 'Texas' },
    { name: 'San Jose, CA', value: 'san-jose-ca', state: 'California' },
    { name: 'Austin, TX', value: 'austin-tx', state: 'Texas' },
    { name: 'Jacksonville, FL', value: 'jacksonville-fl', state: 'Florida' },
    { name: 'Fort Worth, TX', value: 'fort-worth-tx', state: 'Texas' },
    { name: 'Columbus, OH', value: 'columbus-oh', state: 'Ohio' },
    { name: 'San Francisco, CA', value: 'san-francisco-ca', state: 'California' },
    { name: 'Charlotte, NC', value: 'charlotte-nc', state: 'North Carolina' },
    { name: 'Indianapolis, IN', value: 'indianapolis-in', state: 'Indiana' },
    { name: 'Seattle, WA', value: 'seattle-wa', state: 'Washington' },
    { name: 'Denver, CO', value: 'denver-co', state: 'Colorado' },
    { name: 'Boston, MA', value: 'boston-ma', state: 'Massachusetts' },
    
    // Large Cities (Population 500K-1M)
    { name: 'Nashville, TN', value: 'nashville-tn', state: 'Tennessee' },
    { name: 'Oklahoma City, OK', value: 'oklahoma-city-ok', state: 'Oklahoma' },
    { name: 'Portland, OR', value: 'portland-or', state: 'Oregon' },
    { name: 'Las Vegas, NV', value: 'las-vegas-nv', state: 'Nevada' },
    { name: 'Detroit, MI', value: 'detroit-mi', state: 'Michigan' },
    { name: 'Memphis, TN', value: 'memphis-tn', state: 'Tennessee' },
    { name: 'Louisville, KY', value: 'louisville-ky', state: 'Kentucky' },
    { name: 'Baltimore, MD', value: 'baltimore-md', state: 'Maryland' },
    { name: 'Milwaukee, WI', value: 'milwaukee-wi', state: 'Wisconsin' },
    { name: 'Albuquerque, NM', value: 'albuquerque-nm', state: 'New Mexico' },
    { name: 'Tucson, AZ', value: 'tucson-az', state: 'Arizona' },
    { name: 'Fresno, CA', value: 'fresno-ca', state: 'California' },
    { name: 'Sacramento, CA', value: 'sacramento-ca', state: 'California' },
    { name: 'Mesa, AZ', value: 'mesa-az', state: 'Arizona' },
    { name: 'Kansas City, MO', value: 'kansas-city-mo', state: 'Missouri' },
    { name: 'Atlanta, GA', value: 'atlanta-ga', state: 'Georgia' },
    { name: 'Colorado Springs, CO', value: 'colorado-springs-co', state: 'Colorado' },
    { name: 'Raleigh, NC', value: 'raleigh-nc', state: 'North Carolina' },
    { name: 'Omaha, NE', value: 'omaha-ne', state: 'Nebraska' },
    { name: 'Miami, FL', value: 'miami-fl', state: 'Florida' },
    { name: 'Long Beach, CA', value: 'long-beach-ca', state: 'California' },
    { name: 'Virginia Beach, VA', value: 'virginia-beach-va', state: 'Virginia' },
    { name: 'Oakland, CA', value: 'oakland-ca', state: 'California' },
    { name: 'Minneapolis, MN', value: 'minneapolis-mn', state: 'Minnesota' },
    { name: 'Tulsa, OK', value: 'tulsa-ok', state: 'Oklahoma' },
    { name: 'Arlington, TX', value: 'arlington-tx', state: 'Texas' },
    { name: 'Tampa, FL', value: 'tampa-fl', state: 'Florida' },
    
    // Medium Cities (Population 250K-500K)
    { name: 'New Orleans, LA', value: 'new-orleans-la', state: 'Louisiana' },
    { name: 'Wichita, KS', value: 'wichita-ks', state: 'Kansas' },
    { name: 'Cleveland, OH', value: 'cleveland-oh', state: 'Ohio' },
    { name: 'Bakersfield, CA', value: 'bakersfield-ca', state: 'California' },
    { name: 'Aurora, CO', value: 'aurora-co', state: 'Colorado' },
    { name: 'Anaheim, CA', value: 'anaheim-ca', state: 'California' },
    { name: 'Honolulu, HI', value: 'honolulu-hi', state: 'Hawaii' },
    { name: 'Santa Ana, CA', value: 'santa-ana-ca', state: 'California' },
    { name: 'Riverside, CA', value: 'riverside-ca', state: 'California' },
    { name: 'Corpus Christi, TX', value: 'corpus-christi-tx', state: 'Texas' },
    { name: 'Lexington, KY', value: 'lexington-ky', state: 'Kentucky' },
    { name: 'Henderson, NV', value: 'henderson-nv', state: 'Nevada' },
    { name: 'Stockton, CA', value: 'stockton-ca', state: 'California' },
    { name: 'Saint Paul, MN', value: 'saint-paul-mn', state: 'Minnesota' },
    { name: 'Cincinnati, OH', value: 'cincinnati-oh', state: 'Ohio' },
    { name: 'St. Louis, MO', value: 'st-louis-mo', state: 'Missouri' },
    { name: 'Pittsburgh, PA', value: 'pittsburgh-pa', state: 'Pennsylvania' },
    { name: 'Greensboro, NC', value: 'greensboro-nc', state: 'North Carolina' },
    { name: 'Lincoln, NE', value: 'lincoln-ne', state: 'Nebraska' },
    { name: 'Anchorage, AK', value: 'anchorage-ak', state: 'Alaska' },
    { name: 'Plano, TX', value: 'plano-tx', state: 'Texas' },
    { name: 'Orlando, FL', value: 'orlando-fl', state: 'Florida' },
    { name: 'Irvine, CA', value: 'irvine-ca', state: 'California' },
    { name: 'Newark, NJ', value: 'newark-nj', state: 'New Jersey' },
    { name: 'Durham, NC', value: 'durham-nc', state: 'North Carolina' },
    { name: 'Chula Vista, CA', value: 'chula-vista-ca', state: 'California' },
    { name: 'Toledo, OH', value: 'toledo-oh', state: 'Ohio' },
    { name: 'Fort Wayne, IN', value: 'fort-wayne-in', state: 'Indiana' },
    { name: 'St. Petersburg, FL', value: 'st-petersburg-fl', state: 'Florida' },
    { name: 'Laredo, TX', value: 'laredo-tx', state: 'Texas' },
    { name: 'Jersey City, NJ', value: 'jersey-city-nj', state: 'New Jersey' },
    { name: 'Chandler, AZ', value: 'chandler-az', state: 'Arizona' },
    { name: 'Madison, WI', value: 'madison-wi', state: 'Wisconsin' },
    { name: 'Lubbock, TX', value: 'lubbock-tx', state: 'Texas' },
    { name: 'Scottsdale, AZ', value: 'scottsdale-az', state: 'Arizona' },
    { name: 'Reno, NV', value: 'reno-nv', state: 'Nevada' },
    { name: 'Buffalo, NY', value: 'buffalo-ny', state: 'New York' },
    { name: 'Gilbert, AZ', value: 'gilbert-az', state: 'Arizona' },
    { name: 'Glendale, AZ', value: 'glendale-az', state: 'Arizona' },
    { name: 'North Las Vegas, NV', value: 'north-las-vegas-nv', state: 'Nevada' },
    { name: 'Winston-Salem, NC', value: 'winston-salem-nc', state: 'North Carolina' },
    { name: 'Chesapeake, VA', value: 'chesapeake-va', state: 'Virginia' },
    { name: 'Norfolk, VA', value: 'norfolk-va', state: 'Virginia' },
    { name: 'Fremont, CA', value: 'fremont-ca', state: 'California' },
    { name: 'Garland, TX', value: 'garland-tx', state: 'Texas' },
    { name: 'Irving, TX', value: 'irving-tx', state: 'Texas' },
    { name: 'Hialeah, FL', value: 'hialeah-fl', state: 'Florida' },
    { name: 'Richmond, VA', value: 'richmond-va', state: 'Virginia' },
    { name: 'Boise, ID', value: 'boise-id', state: 'Idaho' },
    { name: 'Spokane, WA', value: 'spokane-wa', state: 'Washington' },
    
    // Smaller Cities & Popular Wedding Destinations (Population 100K-250K)
    { name: 'Des Moines, IA', value: 'des-moines-ia', state: 'Iowa' },
    { name: 'Tacoma, WA', value: 'tacoma-wa', state: 'Washington' },
    { name: 'San Bernardino, CA', value: 'san-bernardino-ca', state: 'California' },
    { name: 'Modesto, CA', value: 'modesto-ca', state: 'California' },
    { name: 'Fontana, CA', value: 'fontana-ca', state: 'California' },
    { name: 'Santa Clarita, CA', value: 'santa-clarita-ca', state: 'California' },
    { name: 'Birmingham, AL', value: 'birmingham-al', state: 'Alabama' },
    { name: 'Oxnard, CA', value: 'oxnard-ca', state: 'California' },
    { name: 'Fayetteville, NC', value: 'fayetteville-nc', state: 'North Carolina' },
    { name: 'Moreno Valley, CA', value: 'moreno-valley-ca', state: 'California' },
    { name: 'Huntington Beach, CA', value: 'huntington-beach-ca', state: 'California' },
    { name: 'Yonkers, NY', value: 'yonkers-ny', state: 'New York' },
    { name: 'Aurora, IL', value: 'aurora-il', state: 'Illinois' },
    { name: 'Montgomery, AL', value: 'montgomery-al', state: 'Alabama' },
    { name: 'Amarillo, TX', value: 'amarillo-tx', state: 'Texas' },
    { name: 'Little Rock, AR', value: 'little-rock-ar', state: 'Arkansas' },
    { name: 'Akron, OH', value: 'akron-oh', state: 'Ohio' },
    { name: 'Columbus, GA', value: 'columbus-ga', state: 'Georgia' },
    { name: 'Grand Rapids, MI', value: 'grand-rapids-mi', state: 'Michigan' },
    { name: 'Shreveport, LA', value: 'shreveport-la', state: 'Louisiana' },
    { name: 'Mobile, AL', value: 'mobile-al', state: 'Alabama' },
    { name: 'Huntsville, AL', value: 'huntsville-al', state: 'Alabama' },
    { name: 'Glendale, CA', value: 'glendale-ca', state: 'California' },
    { name: 'Grand Prairie, TX', value: 'grand-prairie-tx', state: 'Texas' },
    { name: 'Knoxville, TN', value: 'knoxville-tn', state: 'Tennessee' },
    { name: 'Worcester, MA', value: 'worcester-ma', state: 'Massachusetts' },
    { name: 'Newport News, VA', value: 'newport-news-va', state: 'Virginia' },
    { name: 'Brownsville, TX', value: 'brownsville-tx', state: 'Texas' },
    { name: 'Santa Rosa, CA', value: 'santa-rosa-ca', state: 'California' },
    { name: 'Port St. Lucie, FL', value: 'port-st-lucie-fl', state: 'Florida' },
    { name: 'Chattanooga, TN', value: 'chattanooga-tn', state: 'Tennessee' },
    { name: 'Tempe, AZ', value: 'tempe-az', state: 'Arizona' },
    { name: 'Jackson, MS', value: 'jackson-ms', state: 'Mississippi' },
    { name: 'Cape Coral, FL', value: 'cape-coral-fl', state: 'Florida' },
    { name: 'Oceanside, CA', value: 'oceanside-ca', state: 'California' },
    { name: 'Garden Grove, CA', value: 'garden-grove-ca', state: 'California' },
    { name: 'Pembroke Pines, FL', value: 'pembroke-pines-fl', state: 'Florida' },
    { name: 'Fort Lauderdale, FL', value: 'fort-lauderdale-fl', state: 'Florida' },
    { name: 'Rancho Cucamonga, CA', value: 'rancho-cucamonga-ca', state: 'California' },
    { name: 'Ontario, CA', value: 'ontario-ca', state: 'California' },
    { name: 'Elk Grove, CA', value: 'elk-grove-ca', state: 'California' },
    { name: 'Corona, CA', value: 'corona-ca', state: 'California' },
    { name: 'Eugene, OR', value: 'eugene-or', state: 'Oregon' },
    { name: 'Salem, OR', value: 'salem-or', state: 'Oregon' },
    { name: 'McKinney, TX', value: 'mckinney-tx', state: 'Texas' },
    { name: 'Frisco, TX', value: 'frisco-tx', state: 'Texas' },
    { name: 'Cary, NC', value: 'cary-nc', state: 'North Carolina' },
    { name: 'Springfield, MO', value: 'springfield-mo', state: 'Missouri' },
    { name: 'Tallahassee, FL', value: 'tallahassee-fl', state: 'Florida' },
    { name: 'Rockford, IL', value: 'rockford-il', state: 'Illinois' },
    { name: 'Sioux Falls, SD', value: 'sioux-falls-sd', state: 'South Dakota' },
    { name: 'Peoria, AZ', value: 'peoria-az', state: 'Arizona' },
    { name: 'Lancaster, CA', value: 'lancaster-ca', state: 'California' },
    { name: 'Surprise, AZ', value: 'surprise-az', state: 'Arizona' },
    { name: 'Denton, TX', value: 'denton-tx', state: 'Texas' },
    { name: 'Roseville, CA', value: 'roseville-ca', state: 'California' },
    { name: 'Joliet, IL', value: 'joliet-il', state: 'Illinois' },
    { name: 'Bridgeport, CT', value: 'bridgeport-ct', state: 'Connecticut' },
    { name: 'Sunnyvale, CA', value: 'sunnyvale-ca', state: 'California' },
    { name: 'Torrance, CA', value: 'torrance-ca', state: 'California' },
    { name: 'Hayward, CA', value: 'hayward-ca', state: 'California' },
    { name: 'Escondido, CA', value: 'escondido-ca', state: 'California' },
    { name: 'Pasadena, TX', value: 'pasadena-tx', state: 'Texas' },
    { name: 'Naperville, IL', value: 'naperville-il', state: 'Illinois' },
    { name: 'Macon, GA', value: 'macon-ga', state: 'Georgia' },
    { name: 'Dayton, OH', value: 'dayton-oh', state: 'Ohio' },
    
    // Popular Wedding & Tourist Destinations
    { name: 'Charleston, SC', value: 'charleston-sc', state: 'South Carolina' },
    { name: 'Savannah, GA', value: 'savannah-ga', state: 'Georgia' },
    { name: 'Asheville, NC', value: 'asheville-nc', state: 'North Carolina' },
    { name: 'Santa Barbara, CA', value: 'santa-barbara-ca', state: 'California' },
    { name: 'Napa, CA', value: 'napa-ca', state: 'California' },
    { name: 'Key West, FL', value: 'key-west-fl', state: 'Florida' },
    { name: 'Sedona, AZ', value: 'sedona-az', state: 'Arizona' },
    { name: 'Aspen, CO', value: 'aspen-co', state: 'Colorado' },
    { name: 'Park City, UT', value: 'park-city-ut', state: 'Utah' },
    { name: 'Carmel, CA', value: 'carmel-ca', state: 'California' },
    { name: 'Monterey, CA', value: 'monterey-ca', state: 'California' },
    { name: 'Myrtle Beach, SC', value: 'myrtle-beach-sc', state: 'South Carolina' },
    { name: 'Palm Springs, CA', value: 'palm-springs-ca', state: 'California' },
    { name: 'Lake Tahoe, CA', value: 'lake-tahoe-ca', state: 'California' },
    { name: 'Williamsburg, VA', value: 'williamsburg-va', state: 'Virginia' },
    { name: 'Annapolis, MD', value: 'annapolis-md', state: 'Maryland' },
    { name: 'Alexandria, VA', value: 'alexandria-va', state: 'Virginia' },
    { name: 'Santa Fe, NM', value: 'santa-fe-nm', state: 'New Mexico' },
    { name: 'Bend, OR', value: 'bend-or', state: 'Oregon' },
    { name: 'Burlington, VT', value: 'burlington-vt', state: 'Vermont' },
];

let selectedLocationValue = '';

function filterLocations(query) {
    const dropdown = document.getElementById('locationDropdown');
    const input = document.getElementById('location');
    
    if (!query || query.length < 1) {
        dropdown.classList.add('hidden');
        return;
    }
    
    const queryLower = query.toLowerCase();
    
    // Smart filtering: prioritize starts-with matches, then contains matches
    const startsWithMatches = US_LOCATIONS.filter(loc => 
        loc.name.toLowerCase().startsWith(queryLower) ||
        loc.city?.toLowerCase().startsWith(queryLower)
    );
    
    const containsMatches = US_LOCATIONS.filter(loc => 
        (loc.name.toLowerCase().includes(queryLower) || 
         loc.state.toLowerCase().includes(queryLower) ||
         loc.city?.toLowerCase().includes(queryLower)) &&
        !startsWithMatches.includes(loc)
    );
    
    const filtered = [...startsWithMatches, ...containsMatches].slice(0, 15); // Show up to 15 results
    
    if (filtered.length === 0) {
        dropdown.innerHTML = `
            <div class="px-4 py-3 text-sm text-gray-500 text-center">
                <div class="mb-1">No locations found for "${query}"</div>
                <div class="text-xs">Try typing a city name like "Chicago" or "Seattle"</div>
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }
    
    // Group by state if multiple results
    const groupedByState = {};
    filtered.forEach(loc => {
        if (!groupedByState[loc.state]) {
            groupedByState[loc.state] = [];
        }
        groupedByState[loc.state].push(loc);
    });
    
    let html = '';
    
    // If only one state, show simple list
    if (Object.keys(groupedByState).length === 1) {
        html = filtered.map(loc => `
            <div 
                class="px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                onclick="selectLocation('${loc.value}', '${loc.name}')"
            >
                <div class="text-sm font-medium text-gray-900">${loc.name}</div>
                ${loc.area ? `<div class="text-xs text-gray-500 mt-0.5">${loc.area}</div>` : ''}
            </div>
        `).join('');
    } else {
        // Multiple states, show with state headers
        html = Object.entries(groupedByState).map(([state, locations]) => `
            ${locations.length > 1 ? `<div class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">${state}</div>` : ''}
            ${locations.map(loc => `
                <div 
                    class="px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                    onclick="selectLocation('${loc.value}', '${loc.name}')"
                >
                    <div class="text-sm font-medium text-gray-900">${loc.name}</div>
                    ${loc.area ? `<div class="text-xs text-gray-500 mt-0.5">${loc.area}</div>` : ''}
                </div>
            `).join('')}
        `).join('');
    }
    
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
}

function selectLocation(value, name) {
    const input = document.getElementById('location');
    const dropdown = document.getElementById('locationDropdown');
    
    input.value = name;
    selectedLocationValue = value;
    dropdown.classList.add('hidden');
    
    // Add visual feedback
    input.classList.add('border-success-500');
    setTimeout(() => {
        input.classList.remove('border-success-500');
    }, 1000);
}

function showLocationDropdown() {
    const input = document.getElementById('location');
    if (input.value.length >= 2) {
        filterLocations(input.value);
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('locationDropdown');
    const input = document.getElementById('location');
    
    if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
        dropdown.classList.add('hidden');
    }
});

// Update form submission to use selected location value
const originalScraperFormHandler = document.getElementById('scraperForm')?.onsubmit;
document.getElementById('scraperForm')?.addEventListener('submit', function(e) {
    const locationInput = document.getElementById('location');
    
    // Validate that a location was selected from dropdown
    if (!selectedLocationValue) {
        e.preventDefault();
        alert('Please select a location from the dropdown suggestions');
        locationInput.focus();
        return false;
    }
    
    // Replace the display name with the value for API
    const originalValue = locationInput.value;
    locationInput.value = selectedLocationValue;
    
    // Let the original handler proceed
    if (originalScraperFormHandler) {
        originalScraperFormHandler.call(this, e);
    }
});


// Retry a failed or completed job
async function retryJob(jobId) {
    if (!confirm('Rerun this job with the same parameters?')) {
        return;
    }
    
    try {
        // Get the original job details
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE}/jobs/${jobId}?_t=${timestamp}`, {
            headers: { 
                'X-API-Key': API_KEY,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch job details');
        }
        
        const job = await response.json();
        
        // Create a new job with the same parameters
        const newJobResponse = await fetch(`${API_BASE}/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                site: job.site,
                parameters: job.parameters,
                format: job.format,
                headless: true
            })
        });
        
        if (!newJobResponse.ok) {
            throw new Error('Failed to create new job');
        }
        
        const newJob = await newJobResponse.json();
        
        // Show success message
        alert(`✅ Job restarted successfully!\n\nNew Job ID: ${newJob.jobId || newJob.job_id}\n\nThe job has been queued and will start processing shortly.`);
        
        // Refresh dashboard
        loadDashboard();
        
    } catch (error) {
        console.error('Retry job error:', error);
        alert(`❌ Failed to retry job: ${error.message}`);
    }
}

// ============================================
// MODAL SYSTEM
// ============================================

function showModal({ type = 'info', title, message, steps = [], buttons = [] }) {
    const modal = document.getElementById('universalModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');

    // Configure icon based on type
    const iconConfig = {
        info: { bg: 'bg-blue-100', icon: 'text-blue-600', svg: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        warning: { bg: 'bg-warning-100', icon: 'text-warning-600', svg: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
        error: { bg: 'bg-danger-100', icon: 'text-danger-600', svg: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
        success: { bg: 'bg-success-100', icon: 'text-success-600', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
    };

    const config = iconConfig[type] || iconConfig.info;

    // Set icon
    modalIcon.className = `w-10 h-10 ${config.bg} rounded-lg flex items-center justify-center`;
    modalIcon.innerHTML = `
        <svg class="w-6 h-6 ${config.icon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${config.svg}"></path>
        </svg>
    `;

    // Set title
    modalTitle.textContent = title;

    // Set body content
    let bodyHTML = `<div class="text-sm text-gray-600 space-y-3">`;
    
    if (message) {
        bodyHTML += `<p class="leading-relaxed">${message}</p>`;
    }

    if (steps.length > 0) {
        bodyHTML += `<div class="mt-4 space-y-2">`;
        steps.forEach((step, index) => {
            bodyHTML += `
                <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div class="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-semibold">
                        ${index + 1}
                    </div>
                    <div class="flex-1 text-sm text-gray-700">${step}</div>
                </div>
            `;
        });
        bodyHTML += `</div>`;
    }

    bodyHTML += `</div>`;
    modalBody.innerHTML = bodyHTML;

    // Set footer buttons
    modalFooter.innerHTML = '';
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = btn.className || 'px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium text-sm';
        button.textContent = btn.text;
        button.onclick = () => {
            if (btn.action) btn.action();
            closeModal();
        };
        modalFooter.appendChild(button);
    });

    // Show modal
    modal.classList.remove('hidden');
    
    // Add click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function closeModal() {
    const modal = document.getElementById('universalModal');
    modal.classList.add('hidden');
}

// ============================================
// JOB ACTIONS
// ============================================

// Stop a running job (requires server restart)
async function stopJob(jobId) {
    showModal({
        type: 'warning',
        title: 'Stop Running Job',
        message: 'Currently, stopping individual jobs requires a server restart. This will affect all running jobs on the system.',
        steps: [
            'Contact your system administrator for assistance',
            'Or restart the server manually using your deployment tools',
            'Alternative: Wait for the job to complete naturally'
        ],
        buttons: [
            {
                text: 'Got It',
                className: 'px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm'
            }
        ]
    });
}

// View job in database section
function viewJobInDatabase(jobId) {
    // Set the job filter
    document.getElementById('jobFilter').value = jobId;
    
    // Switch to database section
    showSection('database');
    
    // Load the job data
    loadJobData();
}
