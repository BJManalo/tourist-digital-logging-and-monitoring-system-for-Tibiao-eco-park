let currentUser = null;

// Global Alert Replacement
window.alert = function (message) {
    showAlert(message);
};

function showAlert(message) {
    const existing = document.querySelector('.custom-alert-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    overlay.innerHTML = `
        <div class="custom-alert-card">
            <div class="custom-alert-message">${message}</div>
            <button class="custom-alert-btn" onclick="closeAlert()">OK</button>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 10);
}

function closeAlert() {
    const overlay = document.querySelector('.custom-alert-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    }
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.custom-alert-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';
        overlay.innerHTML = `
            <div class="custom-alert-card">
                <div class="custom-alert-message">${message}</div>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="custom-alert-btn custom-alert-btn-secondary" id="confirm-cancel">Cancel</button>
                    <button class="custom-alert-btn" id="confirm-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
                closeAlert();
            }
        };
        document.addEventListener('keydown', handleEscape);

        document.getElementById('confirm-ok').onclick = () => {
            document.removeEventListener('keydown', handleEscape);
            resolve(true);
            closeAlert();
        };
        document.getElementById('confirm-cancel').onclick = () => {
            document.removeEventListener('keydown', handleEscape);
            resolve(false);
            closeAlert();
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    updateDate();

    // Unified Login Check
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);

        // Hide login and show dashboard immediately
        const loginScreen = document.getElementById('login-screen');
        const dashboard = document.getElementById('dashboard-layout');

        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'flex';

        applyRolePermissions();
        refreshProfile();
        showView('dashboard');
    } else {
        // Redirect if not logged in
        window.location.href = 'login.html';
    }
});

function applyRolePermissions() {
    const isStaff = currentUser.level === 'staff';

    // Hide specialized reports/settings for staff
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    navItems.forEach(item => {
        const view = item.getAttribute('onclick');
        if (isStaff && (view.includes('reports') || view.includes('settings'))) {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });
}

/**
 * Handle Sidebar Navigation
 */
async function showView(viewId) {
    const contentArea = document.getElementById('content-area');
    const viewTitle = document.getElementById('view-title');

    // Update Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick')?.includes(viewId)) {
            item.classList.add('active');
        }
    });

    // Close sidebar on mobile after clicking
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('show');
    }

    // Show/Hide Header Back Button (Only for Dashboard Sub-views)
    const backBtn = document.getElementById('back-btn-header');
    const dashboardSubViews = ['visitors', 'visitors-active', 'visitors-out', 'revenue'];

    if (dashboardSubViews.includes(viewId)) {
        backBtn.style.display = 'flex';
    } else {
        backBtn.style.display = 'none';
    }

    // Load Dynamic Content
    switch (viewId) {
        case 'dashboard':
            viewTitle.innerText = "Operation Dashboard";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Loading Data...</div>`;
            const dashboardHtml = await renderDashboard();
            contentArea.innerHTML = dashboardHtml;
            setTimeout(initDashboardCharts, 50); // Initialize DataDash charts
            break;
        case 'visitors':
            viewTitle.innerText = "Visitor Logs";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Loading Logs...</div>`;
            const visitorsHtml = await renderVisitorLogs('All');
            contentArea.innerHTML = visitorsHtml;
            break;
        case 'visitors-active':
            viewTitle.innerText = "Active Visitors";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Filtering...</div>`;
            const activeHtml = await renderVisitorLogs('Active');
            contentArea.innerHTML = activeHtml;
            break;
        case 'visitors-out':
            viewTitle.innerText = "Checked Out Visitors";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Filtering...</div>`;
            const outHtml = await renderVisitorLogs('Checked Out');
            contentArea.innerHTML = outHtml;
            break;
        case 'revenue':
            viewTitle.innerText = "Revenue Analytics";
            contentArea.innerHTML = renderRevenueGraph();
            await initRevenueChart();
            break;
        case 'payments':
            viewTitle.innerText = "Payment Logs";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Loading Transactions...</div>`;
            const paymentsHtml = await renderPaymentLogs();
            contentArea.innerHTML = paymentsHtml;
            break;
        case 'reports':
            viewTitle.innerText = "System Reports";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Generating Report...</div>`;
            const reportsHtml = await renderReports('Daily'); // Default to Daily
            contentArea.innerHTML = reportsHtml;
            break;
        case 'attendance':
            viewTitle.innerText = "Staff Attendance";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Checking Status...</div>`;
            const attendanceHtml = await renderAttendance();
            contentArea.innerHTML = attendanceHtml;
            break;
    }

    lucide.createIcons();
}



/**
 * Render Visitor Logs View (Filtered)
 */
async function renderVisitorLogs(filter = 'All') {
    const response = await fetch('/api/visitors');
    let visitors = await response.json();

    if (filter !== 'All') {
        visitors = visitors.filter(v => v.status === filter);
    }

    if (visitors.length === 0) return `
        <div class="table-container" style="text-align: center; padding: 4rem; color: #64748b;">
            <p>No ${filter.toLowerCase()} visitors found.</p>
        </div>
    `;

    let rows = '';
    visitors.forEach(v => {
        const statusClass = v.status === 'Active' ? 'badge-active' : 'badge-out';
        const membersList = JSON.parse(v.members || '[]');
        const totalPeople = 1 + membersList.length;

        // Build companions list HTML
        let companionsHtml = '';
        if (membersList.length > 0) {
            companionsHtml = `<div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; padding-left: 8px; border-left: 2px solid #e2e8f0;">
                <div style="font-weight: 700; font-size: 0.65rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px;">Companions:</div>
                ${membersList.map(m => `<div>• ${m.name} (${m.age}) — <span style="color:#6366f1; font-weight:600;">${m.visitorType || 'N/A'}</span></div>`).join('')}
            </div>`;
        }

        rows += `
            <tr>
                <td style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${v.id}</td>
                <td>
                    <div style="font-weight: 700;">${v.name}</div>
                    ${companionsHtml}
                </td>
                <td>${v.resort}</td>
                <td style="text-align: center; font-weight: 600;">${totalPeople}</td>
                <td><span style="font-weight: 600; color: #059669;">${v.total}</span></td>
                <td><span class="badge ${statusClass}">${v.status}</span></td>
                <td style="text-align: center;">
                    <button class="btn" onclick="toggleStatus('${v.id}', '${v.status}')" 
                        style="padding: 6px; background: #f1f5f9; color: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;"
                        title="Toggle Status">
                        <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    return `
        <div class="table-container fade-in">
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge ${filter === 'All' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors')" style="cursor:pointer">All</span>
                    <span class="badge ${filter === 'Active' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors-active')" style="cursor:pointer">Active</span>
                    <span class="badge ${filter === 'Checked Out' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors-out')" style="cursor:pointer">Out</span>
                </div>
                
                <div style="position: relative; flex: 1; max-width: 300px;">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; color: #94a3b8;"></i>
                    <input type="text" placeholder="Search visitors..." oninput="filterTableRows(this.value, 'visitor-table')" 
                        style="width: 100%; padding: 0.6rem 0.6rem 0.6rem 2.5rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; outline: none; transition: all 0.2s; background: #f8fafc;">
                </div>
            </div>
            <table class="data-table" id="visitor-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>VISITOR NAME</th>
                        <th>DESTINATION</th>
                        <th style="text-align: center;">MEMBERS</th>
                        <th>TOTAL PAID</th>
                        <th>STATUS</th>
                        <th style="text-align: center;">ACTIONS</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/**
 * Render Reports View with Printing and Filtering
 */
async function renderReports(filter = 'Daily') {
    const response = await fetch('/api/visitors');
    let visitors = await response.json();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter logic
    if (filter === 'Daily') {
        visitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate >= today;
        });
    } else if (filter === 'Weekly') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        visitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate >= lastWeek;
        });
    } else if (filter === 'Monthly') {
        visitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
        });
    }

    const dateHeader = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    let rows = '';
    let totalRevenue = 0;
    let totalHeadcount = 0;

    visitors.forEach(v => {
        const amount = parseFloat(v.total.replace('₱', '').replace(',', ''));
        totalRevenue += amount;

        const regDate = new Date(v.created_at).toLocaleDateString();
        const membersList = JSON.parse(v.members || '[]');
        const groupSize = 1 + membersList.length;
        totalHeadcount += groupSize;

        rows += `
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${regDate}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.id}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-weight: 700;">${v.name}</div>
                    <div style="font-size: 0.7rem; color: #64748b;">Companion: ${membersList.map(m => m.name).join(', ') || 'None'}</div>
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.resort}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${groupSize}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${v.total}</td>
            </tr>
        `;
    });

    return `
        <div class="report-controls no-print" style="margin-bottom: 2rem; display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
            <div style="position: relative; display: flex; align-items: center; gap: 8px; background: white; padding: 5px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <i data-lucide="filter" style="width: 16px; color: #64748b;"></i>
                <select onchange="refreshReport(this.value)" style="border: none; outline: none; background: transparent; font-size: 0.85rem; font-weight: 600; color: #1e293b; cursor: pointer; padding-right: 10px;">
                    <option value="Daily" ${filter === 'Daily' ? 'selected' : ''}>Today</option>
                    <option value="Weekly" ${filter === 'Weekly' ? 'selected' : ''}>This Week</option>
                    <option value="Monthly" ${filter === 'Monthly' ? 'selected' : ''}>This Month</option>
                    <option value="All" ${filter === 'All' ? 'selected' : ''}>All Time</option>
                </select>
            </div>
            
            <button class="btn btn-primary" onclick="window.print()" title="Print ${filter} Report" style="width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                <i data-lucide="printer" style="width: 20px;"></i>
            </button>
        </div>

        <div id="printable-report" class="printable-area">
            <div class="report-header" style="text-align: center; margin-bottom: 3rem;">
                <img src="../images/logo.png" style="width: 80px; margin-bottom: 1rem;">
                <h1 style="font-family: 'Montserrat'; font-size: 1.5rem; margin: 0;">Municipality of Tibiao</h1>
                <h2 style="font-family: 'Montserrat'; font-size: 1.1rem; color: #64748b; margin: 0;">Tourism Management System - ${filter} Report</h2>
                <div style="margin-top: 1rem; font-size: 0.85rem; color: #94a3b8;">Generated on: ${dateHeader}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Registrations</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${visitors.length}</div>
                </div>
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Visitors</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #3b82f6;">${totalHeadcount}</div>
                </div>
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Revenue</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #10b981;">₱${totalRevenue.toLocaleString()}</div>
                </div>
            </div>

            <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">DATE</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">REG ID</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">PRIMARY VISITOR</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">RESORT</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: center;">SIZE</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    ${visitors.length > 0 ? rows : '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #94a3b8;">No records found for this period.</td></tr>'}
                </tbody>
            </table>

            <div style="margin-top: 4rem; display: flex; justify-content: space-between;">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #000; width: 200px; margin-top: 2rem;"></div>
                    <div style="font-size: 0.8rem; font-weight: 700;">Prepared by</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #000; width: 200px; margin-top: 2rem;"></div>
                    <div style="font-size: 0.8rem; font-weight: 700;">Noted by</div>
                </div>
            </div>
        </div>
    `;
}

// Helper to refresh report without full view switch
async function refreshReport(filter) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Updating Report...</div>`;
    const reportsHtml = await renderReports(filter);
    contentArea.innerHTML = reportsHtml;
    lucide.createIcons();
}

/**
 * Render Payment Logs View
 */
async function renderPaymentLogs() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

    if (visitors.length === 0) return `<div class="table-container" style="text-align: center; padding: 4rem; color: #64748b;">No payment records found.</div>`;

    let rows = '';
    visitors.forEach(v => {
        const date = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const pStatus = v.payment_status || 'Paid';
        const badgeColor = pStatus === 'Paid' ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;';

        rows += `
            <tr>
                <td style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${v.id}</td>
                <td style="font-weight: 600;">${v.name}</td>
                <td>${v.resort}</td>
                <td><span style="color: #64748b;">${date}</span></td>
                <td><span style="font-weight: 700; color: #059669; font-size: 1.1rem;">${v.total}</span></td>
                <td><span class="badge" style="${badgeColor}">${pStatus.toUpperCase()}</span></td>
                <td style="text-align: center;">
                    <button class="btn" onclick="togglePaymentStatus('${v.id}', '${pStatus}')" 
                        style="padding: 6px; background: #f1f5f9; color: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;"
                        title="Toggle Payment Status">
                        <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    return `
        <div class="table-container fade-in">
            <h3 style="font-family: 'Montserrat'; margin-bottom: 0.5rem; font-size: 1.1rem;">Transaction History</h3>
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
                 <p style="font-size: 0.8rem; color: #64748b;">Use the <i data-lucide="edit-3" style="width:12px; vertical-align:middle;"></i> icon to toggle between <span style="color:#166534;font-weight:700;">PAID</span> and <span style="color:#92400e;font-weight:700;">PENDING</span>.</p>
                 
                 <div style="position: relative; flex: 1; max-width: 300px;">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; color: #94a3b8;"></i>
                    <input type="text" placeholder="Search transactions..." oninput="filterTableRows(this.value, 'payment-table')" 
                        style="width: 100%; padding: 0.6rem 0.6rem 0.6rem 2.5rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; outline: none; transition: all 0.2s; background: #f8fafc;">
                </div>
            </div>
            <table class="data-table" id="payment-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>PAYOR NAME</th>
                        <th>DESTINATION</th>
                        <th>DATE</th>
                        <th>AMOUNT PAID</th>
                        <th>STATUS</th>
                        <th style="text-align: center;">ACTIONS</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/**
 * Toggle Payment Status
 */
async function togglePaymentStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';

    // Using simple UI feedback since this is a quick action
    if (!(await showConfirm(`Change payment status for [${id}] to [${newStatus}]?`))) return;

    try {
        const response = await fetch('/api/visitors/payment-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, paymentStatus: newStatus })
        });

        if (response.ok) {
            showView('payments'); // Refresh the view
        } else {
            alert("Failed to update payment status.");
        }
    } catch (err) {
        alert("Network error.");
    }
}

function renderRevenueGraph() {
    return `
        <div class="table-container fade-in">
            <h3 style="font-family: 'Montserrat'; margin-bottom: 2rem;">Revenue Overview (Daily Trend)</h3>
            <div style="height: 400px;">
                <canvas id="revenueChart"></canvas>
            </div>
        </div>
    `;
}

async function initRevenueChart() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

    // Group revenue by Resort for the demo chart
    const resortData = {};
    visitors.forEach(v => {
        const amount = parseFloat(v.total.replace('₱', '').replace(',', ''));
        resortData[v.resort] = (resortData[v.resort] || 0) + amount;
    });

    const ctx = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(resortData).length > 0 ? Object.keys(resortData) : ['Calawag', 'BlueWave', 'Campolly'],
            datasets: [{
                label: 'Revenue by Destination (₱)',
                data: Object.values(resortData).length > 0 ? Object.values(resortData) : [0, 0, 0],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#6366f1'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}


function updateDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        dateEl.innerText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

async function refreshProfile() {
    const nameEl = document.getElementById('user-profile-name');
    const roleEl = document.getElementById('user-profile-role');

    if (!currentUser) return;

    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const me = users.find(u => u.id == currentUser.id);

        if (me) {
            // Sync local storage if data changed
            if (me.username !== currentUser.username || me.role !== currentUser.role) {
                currentUser.username = me.username;
                currentUser.role = me.role;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
            if (nameEl) nameEl.innerText = me.username;
            if (roleEl) roleEl.innerText = "Staff";
        } else {
            if (nameEl) nameEl.innerText = currentUser.username;
            if (roleEl) roleEl.innerText = "Staff";
        }
    } catch (err) {
        if (nameEl) nameEl.innerText = currentUser.username;
        if (roleEl) roleEl.innerText = "Staff";
    }
}

/**
 * Mobile Sidebar Toggle
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}
/**
 * Toggle Visitor Status (Active <-> Checked Out)
 */
async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Checked Out' : 'Active';
    const confirmMsg = `Change status of <strong>${id}</strong> to <strong>${newStatus}</strong>?`;

    if (!(await showConfirm(confirmMsg))) return;

    try {
        const response = await fetch('/api/visitors/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update status');

        const result = await response.json();
        console.log(result.message);

        // Refresh current view
        const currentViewId = document.querySelector('.nav-item.active').getAttribute('onclick').match(/'([^']+)'/)[1];
        showView(currentViewId);
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error: ' + error.message);
    }
}

/**
 * Attendance Logic
 */
let attendanceTimer = null;

async function renderAttendance() {
    const statusRes = await fetch(`/api/attendance/status/${currentUser.id}`);
    const currentStatus = await statusRes.json();

    const logsRes = await fetch(`/api/attendance/logs?userId=${currentUser.id}`);
    const logs = await logsRes.json();

    if (attendanceTimer) clearInterval(attendanceTimer);

    const isTimedIn = currentStatus.status === 'IN' || currentStatus.status === 'BREAK';
    const isOnBreak = currentStatus.status === 'BREAK';

    const statusColor = currentStatus.status === 'IN' ? '#10b981' : (currentStatus.status === 'BREAK' ? '#f59e0b' : '#ef4444');
    const statusGradient = currentStatus.status === 'IN'
        ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
        : currentStatus.status === 'BREAK'
            ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
            : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';

    const statusText = currentStatus.status === 'IN' ? 'Time In (On Duty)' : (currentStatus.status === 'BREAK' ? 'On Break' : 'Time Out');

    // Safety check for display time
    const displayInTime = parseSQLiteDate(currentStatus.time_in);
    const formattedInTime = displayInTime ? displayInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---';

    let logRows = '';
    logs.slice(0, 10).forEach(log => {
        const date = new Date(log.time_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeIn = new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---';

        let approvalBadge = '';
        if (log.approval_status === 'Approved') approvalBadge = '<span class="badge badge-active">Approved</span>';
        else if (log.approval_status === 'Disapproved') approvalBadge = '<span class="badge" style="background: #fee2e2; color: #991b1b;">Disapproved</span>';
        else approvalBadge = '<span class="badge" style="background: #fef3c7; color: #92400e;">Pending</span>';

        logRows += `
            <tr style="transition: all 0.2s; border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 1.25rem 1rem; font-weight: 500; color: #64748b;">${date}</td>
                <td style="padding: 1.25rem 1rem; color: #10b981; font-weight: 700;">${timeIn}</td>
                <td style="padding: 1.25rem 1rem; color: #ef4444; font-weight: 700;">${timeOut}</td>
                <td style="padding: 1.25rem 1rem;">${approvalBadge}</td>
                <td style="padding: 1.25rem 1rem; font-size: 0.85rem; color: #64748b; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.remarks || ''}">
                    ${log.remarks || '<span style="color: #cbd5e1;">No notes</span>'}
                </td>
            </tr>
        `;
    });

    const html = `
        <div class="fade-in" style="max-width: 900px; margin: 0 auto;">
            <!-- Main Action Card -->
            <div style="background: white; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 2.5rem; border: 1px solid #e2e8f0;">
                <div style="padding: 1.5rem 2.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; animation: pulse 2s infinite;"></div>
                        <span style="font-weight: 800; color: #475569; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">Current: ${statusText}</span>
                    </div>
                    <div id="live-timer" style="font-family: 'Montserrat'; font-weight: 900; font-size: 1.5rem; color: #1e293b; letter-spacing: -1px;">00:00:00</div>
                </div>

                <div style="padding: 2.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div style="display: grid; grid-template-columns: ${isTimedIn ? '1fr 1fr' : '1fr'}; gap: 1rem;">
                            ${!isTimedIn ? `
                                <button class="action-btn" onclick="timeIn()" 
                                    style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; border: none; padding: 1.5rem; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 800; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2); transition: all 0.3s;">
                                    <i data-lucide="play" style="width: 32px; height: 32px;"></i>
                                    Time In
                                </button>
                            ` : `
                                <button class="action-btn" onclick="toggleBreak()" 
                                    style="background: ${isOnBreak ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'}; color: white; border: none; padding: 1.5rem; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 800; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.2); transition: all 0.3s;">
                                    <i data-lucide="${isOnBreak ? 'play-circle' : 'pause-circle'}" style="width: 32px; height: 32px;"></i>
                                    ${isOnBreak ? 'Resuming...' : 'Take a Break'}
                                </button>
                                <button class="action-btn" onclick="timeOut()" 
                                    style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; border: none; padding: 1.5rem; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 800; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.2); transition: all 0.3s;">
                                    <i data-lucide="square" style="width: 32px; height: 32px;"></i>
                                    Time Out
                                </button>
                            `}
                        </div>

                        <div style="background: #f1f5f9; padding: 1.25rem; border-radius: 16px;">
                             <label style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.5rem; display: block;">Shift Notes</label>
                             <textarea id="attendance-remarks" placeholder="Add notes about your work today..." 
                                style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 10px; font-family: inherit; resize: none; min-height: 80px; font-size: 0.9rem; outline: none; transition: border-color 0.2s;"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- History Table -->
            <div class="table-container fade-in" style="background: white; border-radius: 24px; padding: 2rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <h3 style="font-family: 'Montserrat'; font-weight: 800; font-size: 1.15rem; color: #1e293b; margin-bottom: 1.5rem;">Recent Logs & Approvals</h3>
                <table class="data-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                    <thead>
                        <tr>
                            <th style="padding: 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Date</th>
                            <th style="padding: 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Shift Start</th>
                            <th style="padding: 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Shift End</th>
                            <th style="padding: 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Approval</th>
                            <th style="padding: 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>${logRows || '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No logs found.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <style>
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
            .action-btn:hover { transform: translateY(-3px); filter: brightness(1.1); }
            .action-btn:active { transform: translateY(0); }
            #attendance-remarks:focus { border-color: #3b82f6 !important; }
        </style>
    `;

    if (isTimedIn) {
        setTimeout(() => {
            startLiveTimer(
                currentStatus.time_in,
                currentStatus.total_break_time || 0,
                currentStatus.break_start,
                isOnBreak
            );
        }, 100);
    }

    return html;
}

/**
 * Robustly parse SQLite DATETIME strings (YYYY-MM-DD HH:MM:SS) 
 */
function parseSQLiteDate(sqliteDate) {
    if (!sqliteDate) return null;
    try {
        // SQLite CURRENT_TIMESTAMP is UTC. Convert to ISO format for better browser support
        const isoStr = sqliteDate.replace(' ', 'T') + 'Z';
        const date = new Date(isoStr);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
}

function startLiveTimer(startTime, totalBreakTime, breakStart, isOnBreak) {
    const timerEl = document.getElementById('live-timer');
    if (!timerEl) return;

    const startDate = parseSQLiteDate(startTime);
    if (!startDate) {
        timerEl.innerText = "00:00:00";
        return;
    }

    const start = startDate.getTime();
    const breakTotalMs = (parseInt(totalBreakTime) || 0) * 1000;

    attendanceTimer = setInterval(() => {
        const now = new Date().getTime();
        let elapsed;

        if (isOnBreak && breakStart) {
            const bStart = parseSQLiteDate(breakStart);
            if (bStart) {
                // Timer stays at the time work stopped (Shift Start to Break Start - accumulated breaks)
                elapsed = (bStart.getTime() - start) - breakTotalMs;
            } else {
                elapsed = (now - start) - breakTotalMs;
            }
        } else {
            elapsed = (now - start) - breakTotalMs;
        }

        if (elapsed < 0) elapsed = 0;

        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        timerEl.innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

async function timeIn() {
    const remarks = document.getElementById('attendance-remarks').value;
    try {
        const response = await fetch('/api/attendance/timein', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, username: currentUser.username, remarks })
        });
        if (response.ok) showView('attendance');
        else {
            const err = await response.json();
            alert("Error: " + (err.error || "Failed to time in"));
        }
    } catch (e) {
        console.error("Time In Error:", e);
        alert("System Error: " + e.message);
    }
}

async function timeOut() {
    const remarks = document.getElementById('attendance-remarks').value;
    if (!confirm("End shift and time out?")) return;
    try {
        const response = await fetch('/api/attendance/timeout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, remarks })
        });
        if (response.ok) showView('attendance');
        else {
            const err = await response.json();
            alert("Error: " + (err.error || "Failed to time out"));
        }
    } catch (e) {
        console.error("Time Out Error:", e);
        alert("System Error: " + e.message);
    }
}

async function toggleBreak() {
    if (!currentUser || !currentUser.id) {
        alert("Session error. Please log in again.");
        return;
    }
    try {
        const response = await fetch('/api/attendance/break', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        if (response.ok) {
            showView('attendance');
        } else {
            const err = await response.json();
            alert("Break Error: " + (err.error || "Action failed"));
        }
    } catch (e) {
        console.error("Break Toggle Error:", e);
        alert("System Error: " + e.message);
    }
}

/**
 * Universal Table Filter
 */
function filterTableRows(query, tableId) {
    const lowerQuery = query.toLowerCase().trim();
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
}
