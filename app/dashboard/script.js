// KRA Automation Dashboard Script.js
// Modular, error-free, and ready for integration

// --- DOM References ---
const automationTableBody = document.getElementById('automation-table-body');
const sideSheetOverlay = document.getElementById('side-sheet-overlay');
const sideSheetTitle = document.getElementById('side-sheet-title');
const closeSideSheetButton = document.getElementById('close-side-sheet');
const filterType = document.getElementById('filter-type');
const filterStatus = document.getElementById('filter-status');
const refreshButton = document.getElementById('refresh-btn');
const detailName = document.getElementById('detail-name');
const detailType = document.getElementById('detail-type');
const detailFrequency = document.getElementById('detail-frequency');
const detailLastRun = document.getElementById('detail-last-run');
const companyList = document.getElementById('company-list');
const selectAllButton = document.getElementById('select-all-companies');
const deselectAllButton = document.getElementById('deselect-all-companies');
const runSelectedButton = document.getElementById('run-selected-btn');
const runAllButton = document.getElementById('run-all-btn');
const selectedCount = document.getElementById('selected-count');
const executionStatus = document.getElementById('execution-status');
const recentLogs = document.getElementById('recent-logs');
const downloadLogsButton = document.getElementById('download-logs-btn');

// --- Sample Data (replace with backend integration as needed) ---
const automations = [
    {
        id: '1',
        name: 'KRA Portal Login',
        description: 'Automates login using credentials stored in Supabase',
        type: 'authentication',
        cron_schedule: 'Daily at 8:00 AM',
        last_run_at: '2023-05-15T10:30:00',
        next_run_at: '2023-05-15T11:00:00',
        status: 'success',
        companies: [
            { id: 'c1', name: 'Company A', status: 'success', last_run: '2023-05-15T10:30:00' },
            { id: 'c2', name: 'Company B', status: 'success', last_run: '2023-05-15T10:30:00' },
            { id: 'c3', name: 'Company C', status: 'failed', last_run: '2023-05-15T10:30:00' }
        ],
        logs: [
            { type: 'info', message: 'Starting login process for Company A', timestamp: '2023-05-15T10:30:05' },
            { type: 'success', message: 'Successfully logged in to Company A', timestamp: '2023-05-15T10:30:15' },
            { type: 'info', message: 'Starting login process for Company B', timestamp: '2023-05-15T10:30:20' },
            { type: 'success', message: 'Successfully logged in to Company B', timestamp: '2023-05-15T10:30:30' },
            { type: 'info', message: 'Starting login process for Company C', timestamp: '2023-05-15T10:30:35' },
            { type: 'error', message: 'Failed to login to Company C: Invalid credentials', timestamp: '2023-05-15T10:30:45' }
        ]
    },
    {
        id: '2',
        name: 'Tax Compliance Check',
        description: 'Verifies tax compliance status for all registered companies',
        type: 'compliance',
        cron_schedule: 'Daily at 9:00 AM',
        last_run_at: '2023-05-15T09:00:00',
        next_run_at: '2023-05-16T09:00:00',
        status: 'in-progress',
        companies: [
            { id: 'c4', name: 'Company D', status: 'success', last_run: '2023-05-15T09:00:00' },
            { id: 'c5', name: 'Company E', status: 'in-progress', last_run: '2023-05-15T09:00:00' }
        ],
        logs: [
            { type: 'info', message: 'Starting tax compliance check', timestamp: '2023-05-15T09:00:00' },
            { type: 'success', message: 'Company D compliance verified', timestamp: '2023-05-15T09:05:00' },
            { type: 'info', message: 'Processing Company E compliance check', timestamp: '2023-05-15T09:10:00' }
        ]
    },
    {
        id: '3',
        name: 'VAT Data Extraction',
        description: 'Extracts VAT return data from KRA portal',
        type: 'extraction',
        cron_schedule: 'Weekly on Monday',
        last_run_at: '2023-05-08T08:00:00',
        next_run_at: '2023-05-15T08:00:00',
        status: 'failed',
        companies: [
            { id: 'c6', name: 'Company F', status: 'failed', last_run: '2023-05-08T08:00:00' },
            { id: 'c7', name: 'Company G', status: 'failed', last_run: '2023-05-08T08:00:00' }
        ],
        logs: [
            { type: 'error', message: 'Rate limit exceeded for VAT data extraction', timestamp: '2023-05-08T08:15:00' },
            { type: 'warning', message: 'Retry attempt failed', timestamp: '2023-05-08T08:30:00' }
        ]
    },
    {
        id: '4',
        name: 'Document Verification',
        description: 'Verifies submitted tax documents and certificates',
        type: 'verification',
        cron_schedule: 'Every 6 hours',
        last_run_at: '2023-05-15T06:00:00',
        next_run_at: '2023-05-15T12:00:00',
        status: 'pending',
        companies: [
            { id: 'c8', name: 'Company H', status: 'pending', last_run: '2023-05-15T06:00:00' },
            { id: 'c9', name: 'Company I', status: 'pending', last_run: '2023-05-15T06:00:00' }
        ],
        logs: [
            { type: 'info', message: 'Document verification queue updated', timestamp: '2023-05-15T06:00:00' }
        ]
    },
    {
        id: '5',
        name: 'Payment Notification',
        description: 'Sends payment reminders and receipt confirmations',
        type: 'communication',
        cron_schedule: 'Daily at 3:00 PM',
        last_run_at: '2023-05-14T15:00:00',
        next_run_at: '2023-05-15T15:00:00',
        status: 'success',
        companies: [
            { id: 'c10', name: 'Company J', status: 'success', last_run: '2023-05-14T15:00:00' },
            { id: 'c11', name: 'Company K', status: 'success', last_run: '2023-05-14T15:00:00' }
        ],
        logs: [
            { type: 'success', message: 'Payment notifications sent to all companies', timestamp: '2023-05-14T15:05:00' },
            { type: 'info', message: 'Email delivery confirmation received', timestamp: '2023-05-14T15:10:00' }
        ]
    }
];

// --- State Management ---
let currentAutomation = null;
let selectedCompanies = new Set();
let filteredAutomations = [...automations];

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    renderTable();
    bindEventListeners();
});

// --- Event Listeners ---
function bindEventListeners() {
    if (closeSideSheetButton) closeSideSheetButton.addEventListener('click', closeSideSheet);
    if (sideSheetOverlay) sideSheetOverlay.addEventListener('click', (e) => {
        if (e.target === sideSheetOverlay || e.target.id === 'side-sheet-backdrop') closeSideSheet();
    });
    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (refreshButton) refreshButton.addEventListener('click', refreshData);
    if (selectAllButton) selectAllButton.addEventListener('click', selectAllCompanies);
    if (deselectAllButton) deselectAllButton.addEventListener('click', deselectAllCompanies);
    if (runSelectedButton) runSelectedButton.addEventListener('click', runSelected);
    if (runAllButton) runAllButton.addEventListener('click', runAll);
    if (downloadLogsButton) downloadLogsButton.addEventListener('click', downloadLogs);
}

// --- Table Rendering ---
function renderTable() {
    if (!automationTableBody) return;
    automationTableBody.innerHTML = '';
    filteredAutomations.forEach(automation => {
        const row = createTableRow(automation);
        automationTableBody.appendChild(row);
    });
}

function createTableRow(automation) {
    const row = document.createElement('tr');
    row.className = 'table-row automation-type type-' + automation.type;
    row.dataset.id = automation.id;
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full ${getTypeBgColor(automation.type)} ${getTypeTextColor(automation.type)}">
                    <i class="${getTypeIcon(automation.type)}"></i>
                </div>
                <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">${automation.name}</div>
                    <div class="text-sm text-gray-500">${formatType(automation.type)}</div>
                </div>
            </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${formatDateRelative(automation.last_run_at)}</div>
            <div class="text-sm text-gray-500">by System</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${automation.cron_schedule}</div>
            <div class="text-sm text-gray-500">Next: ${formatDateNext(automation.next_run_at)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-${automation.status}">${formatStatus(automation.status)}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button class="text-indigo-600 hover:text-indigo-900 mr-3 run-btn" data-id="${automation.id}" ${automation.status === 'in-progress' ? 'disabled' : ''}>
                <i class="fas fa-play"></i> ${automation.status === 'in-progress' ? 'Running' : 'Run'}
            </button>
        </td>
    `;
    // Row click (except button)
    row.addEventListener('click', (e) => {
        if (!e.target.closest('button')) openSideSheet(automation.id);
    });
    // Run button click
    const runBtn = row.querySelector('.run-btn');
    if (runBtn) {
        runBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            runAutomation(automation.id, runBtn);
        });
    }
    return row;
}

// --- Helper Functions ---
function getTypeBgColor(type) {
    switch (type) {
        case 'authentication': return 'bg-indigo-100';
        case 'extraction': return 'bg-green-100';
        case 'compliance': return 'bg-yellow-100';
        case 'verification': return 'bg-blue-100';
        case 'communication': return 'bg-pink-100';
        default: return 'bg-gray-100';
    }
}
function getTypeTextColor(type) {
    switch (type) {
        case 'authentication': return 'text-indigo-600';
        case 'extraction': return 'text-green-600';
        case 'compliance': return 'text-yellow-600';
        case 'verification': return 'text-blue-600';
        case 'communication': return 'text-pink-600';
        default: return 'text-gray-600';
    }
}
function getTypeIcon(type) {
    switch (type) {
        case 'authentication': return 'fas fa-key';
        case 'extraction': return 'fas fa-file-download';
        case 'compliance': return 'fas fa-file-alt';
        case 'verification': return 'fas fa-check-circle';
        case 'communication': return 'fas fa-comment-alt';
        default: return 'fas fa-cog';
    }
}
function formatType(type) {
    const types = {
        authentication: 'Authentication',
        extraction: 'Data Extraction',
        compliance: 'Compliance',
        verification: 'Verification',
        communication: 'Communication'
    };
    return types[type] || type;
}
function formatStatus(status) {
    const statuses = {
        success: 'Success',
        failed: 'Failed',
        'in-progress': 'In Progress',
        pending: 'Pending'
    };
    return statuses[status] || status;
}
function formatDateRelative(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
}
function formatDateNext(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    if (diff < 0) return 'Elapsed';
    if (diff < 86400000) return 'Tomorrow';
    return `${Math.ceil(diff / 86400000)} days`;
}
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// --- Automation Actions ---
function runAutomation(automationId, button) {
    const automation = automations.find(a => a.id === automationId);
    if (!automation) return;
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running';
        button.disabled = true;
    }
    setTimeout(() => {
        automation.status = Math.random() > 0.2 ? 'success' : 'failed';
        automation.last_run_at = new Date().toISOString();
        renderTable();
        showNotification(`Automation "${automation.name}" completed with status: ${automation.status}`);
    }, 2000);
}

function showNotification(message) {
    // Simple notification (replace with toast if using a UI lib)
    alert(message);
}

// --- Side Sheet Management ---
function openSideSheet(automationId) {
    currentAutomation = automations.find(a => a.id === automationId);
    if (!currentAutomation) return;
    if (sideSheetTitle) sideSheetTitle.textContent = currentAutomation.name;
    if (detailName) detailName.textContent = currentAutomation.name;
    if (detailType) detailType.textContent = formatType(currentAutomation.type);
    if (detailFrequency) detailFrequency.textContent = currentAutomation.cron_schedule;
    if (detailLastRun) detailLastRun.textContent = formatDate(currentAutomation.last_run_at);
    renderCompanyList();
    renderLogs();
    if (executionStatus) executionStatus.innerHTML = '<p class="text-sm text-gray-500">No companies selected for execution</p>';
    updateSelectedCount();
    if (sideSheetOverlay) {
        sideSheetOverlay.classList.remove('hidden');
        const sheet = sideSheetOverlay.querySelector('.w-screen');
        if (sheet) {
            sheet.classList.remove('slide-out');
            sheet.classList.add('slide-in');
        }
    }
}
function closeSideSheet() {
    if (sideSheetOverlay) {
        const sheet = sideSheetOverlay.querySelector('.w-screen');
        if (sheet) {
            sheet.classList.remove('slide-in');
            sheet.classList.add('slide-out');
        }
        setTimeout(() => {
            sideSheetOverlay.classList.add('hidden');
            currentAutomation = null;
            selectedCompanies.clear();
        }, 300);
    }
}

// --- Companies List ---
function renderCompanyList() {
    if (!currentAutomation || !companyList) return;
    companyList.innerHTML = '';
    currentAutomation.companies.forEach(company => {
        const companyItem = document.createElement('div');
        companyItem.className = 'flex items-center py-2';
        companyItem.innerHTML = `
            <input type="checkbox" id="company-${company.id}" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" ${selectedCompanies.has(company.id) ? 'checked' : ''}>
            <label for="company-${company.id}" class="ml-3 block text-sm">
                <span class="font-medium text-gray-700">${company.name}</span>
                <span class="text-gray-500 ml-2">${formatDateRelative(company.last_run)}</span>
                <span class="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-${company.status}">${formatStatus(company.status)}</span>
            </label>
        `;
        const checkbox = companyItem.querySelector('input');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) selectedCompanies.add(company.id);
                else selectedCompanies.delete(company.id);
                updateSelectedCount();
            });
        }
        companyList.appendChild(companyItem);
    });
}
function updateSelectedCount() {
    if (selectedCount) selectedCount.textContent = `${selectedCompanies.size} companies selected`;
}
function selectAllCompanies() {
    if (!currentAutomation) return;
    selectedCompanies.clear();
    currentAutomation.companies.forEach(company => selectedCompanies.add(company.id));
    renderCompanyList();
    updateSelectedCount();
}
function deselectAllCompanies() {
    selectedCompanies.clear();
    renderCompanyList();
    updateSelectedCount();
}

// --- Run Selected/All ---
function runSelected() {
    if (!currentAutomation || selectedCompanies.size === 0) return;
    const selectedCompanyList = Array.from(selectedCompanies).map(id => {
        const company = currentAutomation.companies.find(c => c.id === id);
        return company ? company.name : '';
    }).filter(Boolean);
    if (executionStatus) {
        executionStatus.innerHTML = `<p class="text-sm text-blue-600">Running for: ${selectedCompanyList.join(', ')}</p>`;
    }
    setTimeout(() => {
        if (executionStatus) executionStatus.innerHTML = `<p class="text-sm text-green-600">Completed for: ${selectedCompanyList.join(', ')}</p>`;
    }, 2000);
}
function runAll() {
    if (!currentAutomation) return;
    selectedCompanies = new Set(currentAutomation.companies.map(c => c.id));
    renderCompanyList();
    updateSelectedCount();
    runSelected();
}

// --- Logs ---
function renderLogs() {
    if (!currentAutomation || !recentLogs) return;
    if (!currentAutomation.logs || currentAutomation.logs.length === 0) {
        recentLogs.innerHTML = '<p class="text-sm text-gray-500">No recent logs available</p>';
        return;
    }
    recentLogs.innerHTML = '';
    currentAutomation.logs.slice(-10).forEach(log => {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry log-${log.type}`;
        logDiv.innerHTML = `<span class="text-xs text-gray-500 mr-2">${formatDate(log.timestamp)}</span> <span>${log.message}</span>`;
        recentLogs.appendChild(logDiv);
    });
}
function downloadLogs() {
    if (!currentAutomation || !currentAutomation.logs) return;
    const logText = currentAutomation.logs.map(log => `[${formatDate(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentAutomation.name.replace(/\s+/g, '_')}_logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Filtering ---
function applyFilters() {
    filteredAutomations = automations.filter(a => {
        let typeMatch = !filterType || !filterType.value || a.type === filterType.value;
        let statusMatch = !filterStatus || !filterStatus.value || a.status === filterStatus.value;
        return typeMatch && statusMatch;
    });
    renderTable();
}
function refreshData() {
    // For real apps, reload data from backend
    filteredAutomations = [...automations];
    renderTable();
}