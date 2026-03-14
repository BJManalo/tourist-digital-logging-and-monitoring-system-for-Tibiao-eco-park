let currentUser = null;

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

    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);

        const loginScreen = document.getElementById('login-screen');
        const dashboard = document.getElementById('dashboard-layout');

        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'flex';

        applyRolePermissions();
        refreshProfile();
        showView('dashboard');
    } else {
        window.location.href = 'login.html';
    }
});

function applyRolePermissions() {
    const isStaff = currentUser.level === 'staff';
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

async function showView(viewId) {
    const contentArea = document.getElementById('content-area');
    const viewTitle = document.getElementById('view-title');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick')?.includes(viewId)) {
            item.classList.add('active');
        }
    });

    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('show');
    }

    const backBtn = document.getElementById('back-btn-header');
    const dashboardSubViews = ['visitors', 'visitors-active', 'visitors-out', 'revenue'];
    if (dashboardSubViews.includes(viewId)) {
        backBtn.style.display = 'flex';
    } else {
        backBtn.style.display = 'none';
    }

    switch (viewId) {
        case 'dashboard':
            viewTitle.innerText = "Operation Dashboard";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Loading Data...</div>`;
            const dashboardHtml = await renderDashboard();
            contentArea.innerHTML = dashboardHtml;
            setTimeout(initDashboardCharts, 50);
            break;
        case 'visitors':
            viewTitle.innerText = "Visitor Logs";
            const visitorsHtml = await renderVisitorLogs('All');
            contentArea.innerHTML = visitorsHtml;
            break;
        case 'visitors-active':
            viewTitle.innerText = "Active Visitors";
            const activeHtml = await renderVisitorLogs('Active');
            contentArea.innerHTML = activeHtml;
            break;
        case 'visitors-out':
            viewTitle.innerText = "Checked Out Visitors";
            const outHtml = await renderVisitorLogs('Checked Out');
            contentArea.innerHTML = outHtml;
            break;
        case 'revenue':
            viewTitle.innerText = "Collection Fee Analytics";
            contentArea.innerHTML = renderRevenueGraph();
            await initRevenueChart();
            break;
        case 'payments':
            viewTitle.innerText = "Payment Logs";
            const paymentsHtml = await renderPaymentLogs();
            contentArea.innerHTML = paymentsHtml;
            break;
        case 'reports':
            viewTitle.innerText = "System Reports";
            const reportsHtml = await renderReports('Daily');
            contentArea.innerHTML = reportsHtml;
            break;
        case 'attendance':
            viewTitle.innerText = "Staff Attendance";
            const attendanceHtml = await renderAttendance();
            contentArea.innerHTML = attendanceHtml;
            break;
    }
    lucide.createIcons();
}

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

        let companionsHtml = '';
        if (membersList.length > 0) {
            companionsHtml = `
                <div id="companions-${v.id}" style="display: none; font-size: 0.75rem; color: #64748b; margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--primary); animation: fadeIn 0.2s ease;">
                    <div style="font-weight: 700; font-size: 0.65rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; letter-spacing: 0.5px;">Companions:</div>
                    ${membersList.map(m => `
                        <div style="margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
                            <span style="color: var(--primary); font-size: 0.4rem;">●</span>
                            <span style="font-weight: 600; color: #475569;">${m.name}</span>
                            <span style="color: #94a3b8; font-size: 0.7rem;">(${m.age}) — <span style="color:#6366f1">${m.visitorType}</span></span>
                        </div>
                    `).join('')}
                </div>`;
        }

        rows += `
            <tr>
                <td style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${v.id}</td>
                <td>
                    <div style="font-weight: 700; color: ${membersList.length > 0 ? 'var(--primary)' : 'var(--text-main)'}; cursor: ${membersList.length > 0 ? 'pointer' : 'default'}; display: inline-block; transition: all 0.2s;" 
                         ${membersList.length > 0 ? `onclick="toggleCompanions('${v.id}')"` : ''}
                         onmouseover="this.style.textDecoration='underline'; this.style.opacity='0.8'" 
                         onmouseout="this.style.textDecoration='none'; this.style.opacity='1'">
                        ${v.name}
                    </div>
                    ${companionsHtml}
                </td>
                <td>${v.resort}</td>
                <td style="text-align: center; font-weight: 600;">${totalPeople}</td>
                <td><span style="font-weight: 600; color: #059669;">${v.total}</span></td>
                <td><span class="badge ${statusClass}">${v.status}</span></td>
                <td style="text-align: center;">
                    <button class="btn" onclick="viewVisitorDetails('${v.id}')" 
                        style="padding: 6px; background: #f1f5f9; color: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;"
                        title="View Details">
                        <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    return `
        <div class="table-container fade-in">
            <div class="table-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge ${filter === 'All' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors')" style="cursor:pointer">All</span>
                    <span class="badge ${filter === 'Active' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors-active')" style="cursor:pointer">Active</span>
                    <span class="badge ${filter === 'Checked Out' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors-out')" style="cursor:pointer">Out</span>
                </div>
                
                <div class="search-container">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; color: #94a3b8;"></i>
                    <input type="text" placeholder="Search..." oninput="filterTableRows(this.value, 'visitor-table')" 
                        style="width: 100%; padding: 0.6rem 0.6rem 0.6rem 2.5rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; outline: none; transition: all 0.2s; background: #f8fafc;">
                </div>
            </div>
            <div class="table-responsive">
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
        </div>
    `;
}

async function renderReports(filter = 'Daily') {
    const response = await fetch('/api/visitors');
    let visitors = await response.json();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'Daily') {
        visitors = visitors.filter(v => new Date(v.created_at) >= today);
    } else if (filter === 'Weekly') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        visitors = visitors.filter(v => new Date(v.created_at) >= lastWeek);
    } else if (filter === 'Monthly') {
        visitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
        });
    }

    const dateHeader = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Collection Fee</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #10b981;">₱${totalRevenue.toLocaleString()}</div>
                </div>
            </div>
            <div class="table-responsive">
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
            </div>
        </div>
    `;
}

async function refreshReport(filter) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Updating Report...</div>`;
    const reportsHtml = await renderReports(filter);
    contentArea.innerHTML = reportsHtml;
    lucide.createIcons();
}

async function renderPaymentLogs() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

    if (visitors.length === 0) return `<div class="table-container" style="text-align: center; padding: 4rem; color: #64748b;">No payment records found.</div>`;

    let rows = '';
    visitors.forEach(v => {
        const date = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        rows += `
            <tr>
                <td style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${v.id}</td>
                <td style="font-weight: 600;">${v.name}</td>
                <td>${v.resort}</td>
                <td><span style="color: #64748b;">${date}</span></td>
                <td><span style="font-weight: 700; color: #059669; font-size: 1.1rem;">${v.total}</span></td>
            </tr>
        `;
    });

    return `
        <div class="table-container fade-in">
            <div class="table-header">
                <h3 style="font-family: 'Montserrat'; font-size: 1.1rem; margin: 0;">Transaction History</h3>
                <div class="search-container">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; color: #94a3b8;"></i>
                    <input type="text" placeholder="Search..." oninput="filterTableRows(this.value, 'payment-table')" 
                        style="width: 100%; padding: 0.5rem 0.5rem 0.5rem 2.5rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; outline: none; transition: all 0.2s; background: #f8fafc;">
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="payment-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>PAYOR NAME</th>
                            <th>DESTINATION</th>
                            <th>DATE</th>
                            <th>AMOUNT PAID</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderRevenueGraph() {
    return `
        <div class="table-container fade-in">
            <h3 style="font-family: 'Montserrat'; margin-bottom: 2rem;">Collection Fee Overview (Daily Trend)</h3>
            <div style="height: 400px;">
                <canvas id="revenueChart"></canvas>
            </div>
        </div>
    `;
}

async function initRevenueChart() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

    const resortData = {};
    visitors.forEach(v => {
        const amount = parseFloat(v.total.replace('₱', '').replace(',', ''));
        resortData[v.resort] = (resortData[v.resort] || 0) + amount;
    });

    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(resortData).length > 0 ? Object.keys(resortData) : ['Calawag', 'BlueWave', 'Campolly'],
            datasets: [{
                label: 'Collection Fee by Destination (₱)',
                data: Object.values(resortData).length > 0 ? Object.values(resortData) : [0, 0, 0],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#6366f1'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
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
    window.location.href = 'login.html';
}

async function refreshProfile() {
    const nameEl = document.getElementById('user-profile-name');
    const roleEl = document.getElementById('user-profile-role');
    if (!currentUser) return;
    if (nameEl) nameEl.innerText = currentUser.username;
    if (roleEl) roleEl.innerText = "Staff";
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}

async function viewVisitorDetails(id) {
    try {
        const response = await fetch('/api/visitors');
        const visitors = await response.json();
        const v = visitors.find(v => v.id === id);
        if (!v) return;

        const membersList = JSON.parse(v.members || '[]');
        const detailsHtml = `
            <div class="custom-alert-overlay show" id="details-overlay">
                <div class="custom-alert-card" style="max-width: 500px; text-align: left; padding: 2.5rem;">
                    <h3 style="margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; font-family: 'Montserrat'; font-weight: 800; font-size: 1.25rem;">
                        Visitor Profile
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Ref: ${v.id}</span>
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                        <div>
                            <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Primary Visitor</label>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 1.1rem;">${v.name}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Destination</label>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 1.1rem;">${v.resort}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Total Paid</label>
                            <div style="font-weight: 800; color: var(--success); font-size: 1.25rem;">${v.total}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Visit Date</label>
                            <div style="font-weight: 600; color: var(--text-main);">${new Date(v.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 0.75rem; display: block;">Companions (${membersList.length})</label>
                    <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 16px; margin-bottom: 2rem; max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color);">
                        ${membersList.length > 0 ? membersList.map(m => `
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding: 8px 0; align-items: center;">
                                <span style="font-size:0.9rem; font-weight: 600; color: var(--text-main);">${m.name}</span>
                                <span style="font-size:0.75rem; color:var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px;">${m.age} • ${m.visitorType}</span>
                            </div>
                        `).join('') : '<div style="color:var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">No companions registered.</div>'}
                    </div>
                    <div style="margin-bottom: 2.5rem;">
                        <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 0.75rem; display: block;">Update Visit Status</label>
                        <div style="display: flex; gap: 12px;">
                            <button onclick="updateVisitorStatus('${v.id}', 'Active')" 
                                style="flex: 1; padding: 1rem; border-radius: 14px; border: 2px solid ${v.status === 'Active' ? 'var(--success)' : 'var(--border-color)'}; background: ${v.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}; color: ${v.status === 'Active' ? 'var(--success)' : 'var(--text-muted)'}; cursor: pointer; font-weight: 800; font-size: 0.8rem; transition: all 0.2s;">
                                ACTIVE
                            </button>
                            <button onclick="updateVisitorStatus('${v.id}', 'Checked Out')" 
                                style="flex: 1; padding: 1rem; border-radius: 14px; border: 2px solid ${v.status === 'Checked Out' ? 'var(--danger)' : 'var(--border-color)'}; background: ${v.status === 'Checked Out' ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}; color: ${v.status === 'Checked Out' ? 'var(--danger)' : 'var(--text-muted)'}; cursor: pointer; font-weight: 800; font-size: 0.8rem; transition: all 0.2s;">
                                CHECKED OUT
                            </button>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center;">
                        <button class="custom-alert-btn custom-alert-btn-secondary" style="width: 100%;" onclick="document.getElementById('details-overlay').remove()">Close Profile</button>
                    </div>
                </div>
            </div>
        `;
        const existing = document.getElementById('details-overlay');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', detailsHtml);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert('Failed to load visitor details.');
    }
}

async function updateVisitorStatus(id, newStatus) {
    try {
        const response = await fetch('/api/visitors/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
        if (!response.ok) throw new Error('Failed to update status');
        const overlay = document.getElementById('details-overlay');
        if (overlay) overlay.remove();
        const activeNav = document.querySelector('.nav-item.active');
        const currentViewId = activeNav ? activeNav.getAttribute('onclick').match(/'([^']+)'/)[1] : 'visitors';
        showView(currentViewId);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function toggleCompanions(id) {
    const el = document.getElementById(`companions-${id}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

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
    const statusText = currentStatus.status === 'IN' ? 'Time In (On Duty)' : (currentStatus.status === 'BREAK' ? 'On Break' : 'Time Out');

    let logRows = '';
    logs.slice(0, 10).forEach(log => {
        const date = new Date(log.time_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeIn = new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---';
        let approvalBadge = `<span class="badge ${log.approval_status === 'Approved' ? 'badge-active' : (log.approval_status === 'Disapproved' ? 'badge-failed' : 'badge-pending')}">${log.approval_status}</span>`;
        logRows += `
            <tr>
                <td style="padding: 1.25rem 1rem; font-weight: 500; color: #64748b;">${date}</td>
                <td style="padding: 1.25rem 1rem; color: #10b981; font-weight: 700;">${timeIn}</td>
                <td style="padding: 1.25rem 1rem; color: #ef4444; font-weight: 700;">${timeOut}</td>
                <td style="padding: 1.25rem 1rem;">${approvalBadge}</td>
                <td style="padding: 1.25rem 1rem; font-size: 0.85rem; color: #64748b;">${log.remarks || '---'}</td>
            </tr>
        `;
    });

    const html = `
        <div class="fade-in" style="max-width: 900px; margin: 0 auto;">
            <div style="background: white; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 2.5rem; border: 1px solid #e2e8f0;">
                <div style="padding: 1.5rem 2.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor};"></div>
                        <span style="font-weight: 800; color: #475569; font-size: 0.85rem; text-transform: uppercase;">Current: ${statusText}</span>
                    </div>
                    <div id="live-timer" style="font-family: 'Montserrat'; font-weight: 900; font-size: 1.5rem; color: #1e293b;">00:00:00</div>
                </div>
                <div style="padding: 2.5rem;">
                    <div style="display: grid; grid-template-columns: ${isTimedIn ? '1fr 1fr' : '1fr'}; gap: 1rem; margin-bottom: 1.5rem;">
                        ${!isTimedIn ? `
                            <button class="btn btn-primary" onclick="timeIn()" style="padding: 1.5rem; border-radius: 16px; font-weight: 800;">Time In</button>
                        ` : `
                            <button class="btn" onclick="toggleBreak()" style="padding: 1.5rem; border-radius: 16px; font-weight: 800; background: ${isOnBreak ? '#10b981' : '#f59e0b'}; color: white;">${isOnBreak ? 'Resume' : 'Break'}</button>
                            <button class="btn btn-danger" onclick="timeOut()" style="padding: 1.5rem; border-radius: 16px; font-weight: 800;">Time Out</button>
                        `}
                    </div>
                    <textarea id="attendance-remarks" placeholder="Add notes..." style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 10px; min-height: 80px;"></textarea>
                </div>
            </div>
            <div class="table-container fade-in" style="background: white; border-radius: 24px; padding: 2rem; border: 1px solid #e2e8f0;">
                <h3 style="font-family: 'Montserrat'; font-weight: 800; font-size: 1.15rem; color: #1e293b; margin-bottom: 1.5rem;">Recent Logs</h3>
                <div class="table-responsive">
                    <table class="data-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr>
                                <th>Date</th><th>Shift Start</th><th>Shift End</th><th>Approval</th><th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>${logRows || '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No logs found.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    if (isTimedIn) {
        setTimeout(() => startLiveTimer(currentStatus.time_in, currentStatus.total_break_time || 0, currentStatus.break_start, isOnBreak), 100);
    }
    return html;
}

function parseSQLiteDate(sqliteDate) {
    if (!sqliteDate) return null;
    const isoStr = sqliteDate.replace(' ', 'T') + 'Z';
    const date = new Date(isoStr);
    return isNaN(date.getTime()) ? null : date;
}

function startLiveTimer(startTime, totalBreakTime, breakStart, isOnBreak) {
    const timerEl = document.getElementById('live-timer');
    if (!timerEl) return;
    const startDate = parseSQLiteDate(startTime);
    if (!startDate) return;
    const start = startDate.getTime();
    const breakTotalMs = (parseInt(totalBreakTime) || 0) * 1000;

    attendanceTimer = setInterval(() => {
        const now = new Date().getTime();
        let elapsed = (now - start) - breakTotalMs;
        if (isOnBreak && breakStart) {
            const bStart = parseSQLiteDate(breakStart);
            if (bStart) elapsed = (bStart.getTime() - start) - breakTotalMs;
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
    const response = await fetch('/api/attendance/timein', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, username: currentUser.username, remarks })
    });
    if (response.ok) showView('attendance');
}

async function timeOut() {
    const remarks = document.getElementById('attendance-remarks').value;
    if (!confirm("Time out?")) return;
    const response = await fetch('/api/attendance/timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, remarks })
    });
    if (response.ok) showView('attendance');
}

async function toggleBreak() {
    const response = await fetch('/api/attendance/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
    });
    if (response.ok) showView('attendance');
}

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

function renderDashboard() {
    return `
        <div class="stat-grid fade-in">
            <div class="stat-card" onclick="showView('visitors')">
                <div class="stat-header">
                    <i data-lucide="users" style="color: var(--primary);"></i>
                    <span class="stat-label">Total Visitors</span>
                </div>
                <div id="stat-total-visitors" class="stat-value">---</div>
            </div>
            <div class="stat-card" onclick="showView('visitors-active')">
                <div class="stat-header">
                    <i data-lucide="user-check" style="color: var(--success);"></i>
                    <span class="stat-label">Currently Active</span>
                </div>
                <div id="stat-active-visitors" class="stat-value">---</div>
            </div>
            <div class="stat-card" onclick="showView('revenue')">
                <div class="stat-header">
                    <i data-lucide="banknote" style="color: var(--warning);"></i>
                    <span class="stat-label">Total Collection</span>
                </div>
                <div id="stat-revenue" class="stat-value">---</div>
            </div>
        </div>
        <div class="table-container fade-in" style="margin-top: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="font-family: 'Montserrat'; font-weight: 800; font-size: 1rem; margin: 0;">Recent Registrations</h3>
                <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="showView('visitors')">View All</button>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="recent-table">
                    <thead><tr><th>ID</th><th>Visitor</th><th>Resort</th><th>Date</th></tr></thead>
                    <tbody id="recent-visitor-rows"></tbody>
                </table>
            </div>
        </div>
    `;
}

async function initDashboardCharts() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();
    
    document.getElementById('stat-total-visitors').innerText = visitors.length;
    document.getElementById('stat-active-visitors').innerText = visitors.filter(v => v.status === 'Active').length;
    
    let total = 0;
    visitors.forEach(v => {
        total += parseFloat(v.total.replace('₱', '').replace(',', '')) || 0;
    });
    document.getElementById('stat-revenue').innerText = '₱' + total.toLocaleString();

    const recentRows = visitors.slice(0, 5).map(v => `
        <tr>
            <td>${v.id}</td>
            <td style="font-weight: 700;">${v.name}</td>
            <td>${v.resort}</td>
            <td>${new Date(v.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
    document.getElementById('recent-visitor-rows').innerHTML = recentRows;
    lucide.createIcons();
}
