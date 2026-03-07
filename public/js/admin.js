let currentAdmin = null;
let editingUserId = null;

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

    // Unified Login Check
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentAdmin = JSON.parse(storedUser);

        // Final verify for admin role
        if (currentAdmin.level !== 'admin') {
            alert("Unauthorized access. Admin portal only.");
            window.location.href = 'login.html';
            return;
        }

        // Hide login and show dashboard
        const loginScreen = document.getElementById('login-screen');
        const dashboard = document.getElementById('dashboard-layout');

        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'flex';

        refreshProfile();
        showView('dashboard');
    } else {
        window.location.href = 'login.html';
    }
});

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

    // Cloud Sync Button (Only show on Dashboard)
    const syncBtn = document.getElementById('cloud-sync-btn');
    if (syncBtn) {
        syncBtn.style.display = viewId === 'dashboard' ? 'flex' : 'none';
    }

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 1024) {
        sidebar.classList.remove('show');
    }

    // Show/Hide Header Back Button
    const backBtn = document.getElementById('back-btn-header');
    if (backBtn) {
        const subViews = ['visitors-active', 'visitors-out'];
        backBtn.style.display = subViews.includes(viewId) ? 'flex' : 'none';
    }

    // View Routing
    switch (viewId) {
        case 'dashboard':
            viewTitle.innerText = "System Overview";
            contentArea.innerHTML = await renderDashboard();
            setTimeout(initDashboardCharts, 50); // Initialize DataDash charts
            break;
        case 'visitors':
            viewTitle.innerText = "Global Visitor Logs";
            contentArea.innerHTML = await renderVisitorLogs('All');
            break;
        case 'visitors-active':
            viewTitle.innerText = "Currently Active";
            contentArea.innerHTML = await renderVisitorLogs('Active');
            break;
        case 'visitors-out':
            viewTitle.innerText = "Checkout Records";
            contentArea.innerHTML = await renderVisitorLogs('Checked Out');
            break;
        case 'payments':
            viewTitle.innerText = "Finance & Transactions";
            contentArea.innerHTML = await renderPaymentLogs();
            break;
        case 'reports':
            viewTitle.innerText = "Analytics & Reports";
            contentArea.innerHTML = await renderReports('Daily');
            break;
        case 'revenue':
            viewTitle.innerText = "Financial Analytics";
            contentArea.innerHTML = renderRevenueGraph();
            setTimeout(initRevenueChart, 100);
            break;
        case 'accounts':
            viewTitle.innerText = "Account Management";
            contentArea.innerHTML = await renderAccountsView();
            break;
        case 'attendance':
            viewTitle.innerText = "Staff Duty Logs";
            contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Retrieving Employee Logs...</div>`;
            contentArea.innerHTML = await renderAttendanceLogs();
            break;
    }

    lucide.createIcons();
}



/** VISITOR LOGS **/
async function renderVisitorLogs(filter = 'All') {
    const response = await fetch('/api/visitors');
    let visitors = await response.json();

    if (filter !== 'All') {
        visitors = visitors.filter(v => v.status === filter);
    }

    let rows = visitors.slice().reverse().map(v => {
        const membersList = JSON.parse(v.members || '[]');
        return `
            <tr>
                <td style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${v.id}</td>
                <td>
                    <div style="font-weight: 700;">${v.name}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">Headcount: ${1 + membersList.length}</div>
                </td>
                <td>${v.resort}</td>
                <td><span style="font-weight: 600; color: #059669;">${v.total}</span></td>
                <td><span class="badge ${v.status === 'Active' ? 'badge-active' : 'badge-out'}">${v.status}</span></td>
                <td>${new Date(v.created_at).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-container fade-in">
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 10px;">
                <span class="badge ${filter === 'All' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors')" style="cursor:pointer">All</span>
                <span class="badge ${filter === 'Active' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors-active')" style="cursor:pointer">Active</span>
                <span class="badge ${filter === 'Checked Out' ? 'badge-active' : 'badge-out'}" onclick="showView('visitors-out')" style="cursor:pointer">Out</span>
            </div>
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>VISITOR</th><th>RESORT</th><th>PAID</th><th>STATUS</th><th>DATE</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">No records found.</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

/** FULL REPORTING MODULE **/
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

    let rows = '';
    let totalRevenue = 0;
    let totalHeadcount = 0;

    // Fetch latest account data to ensure "Authenticated By" is current
    const usersResponse = await fetch('/api/users');
    const allUsers = await usersResponse.json();
    const activeAdmin = allUsers.find(u => u.id === currentAdmin.id) || currentAdmin;

    visitors.forEach(v => {
        const amount = parseFloat(v.total.replace('₱', '').replace(',', '')) || 0;
        totalRevenue += amount;
        const members = JSON.parse(v.members || '[]');
        const size = 1 + members.length;
        totalHeadcount += size;

        // Generate names of companions if any
        let companionInfo = '';
        if (members.length > 0) {
            companionInfo = `
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px; font-weight: 500;">
                    Companions: ${members.map(m => `${m.name} (<span style="color:#6366f1;font-weight:700;">${m.visitorType || 'N/A'}</span>)`).join(', ')}
                </div>
            `;
        }

        rows += `
            <tr style="border-bottom: 1px solid #e2e8f0; vertical-align: top;">
                <td style="padding: 12px 15px; text-align: left; color: #64748b; font-weight: 700; font-size: 0.8rem;">${v.id}</td>
                <td style="padding: 12px 15px; text-align: left; color: #1e293b; font-weight: 700;">
                    <div>${v.name}</div>
                    ${companionInfo}
                </td>
                <td style="padding: 12px 15px; text-align: left; color: #475569;">${v.resort}</td>
                <td style="padding: 12px 15px; text-align: center; color: #1e293b; font-weight: 600;">${size}</td>
                <td style="padding: 12px 15px; text-align: right; color: #10b981; font-weight: 800;">${v.total}</td>
            </tr>
        `;
    });

    return `
        <div class="report-wrapper fade-in" style="max-width: 1100px; margin: 0 auto;">
            <!-- Controls (HIDDEN ON PRINT) -->
            <div class="report-controls no-print" style="margin-bottom: 2.5rem; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h3 style="font-family:'Montserrat'; font-weight: 800; font-size: 1.5rem; color: #1e293b; margin: 0;">Analytics & Reports</h3>
                    <p style="font-size: 0.9rem; color: #64748b; margin-top: 4px;">Comprehensive oversight of tourism operations</p>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; background: white; padding: 10px 16px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <i data-lucide="filter" style="width: 18px; color: #64748b;"></i>
                        <select onchange="refreshReport(this.value)" style="border: none; font-size: 0.9rem; font-weight: 700; color: #1e293b; cursor: pointer; background: transparent; outline: none;">
                            <option value="Daily" ${filter === 'Daily' ? 'selected' : ''}>Today</option>
                            <option value="Weekly" ${filter === 'Weekly' ? 'selected' : ''}>This Week</option>
                            <option value="Monthly" ${filter === 'Monthly' ? 'selected' : ''}>This Month</option>
                            <option value="All" ${filter === 'All' ? 'selected' : ''}>All Time</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="window.print()" title="Print/Export Document" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; padding: 0;">
                        <i data-lucide="printer" style="width: 18px;"></i>
                    </button>
                </div>
            </div>

            <!-- Printable Document Area -->
            <div class="printable-area" style="background: white; padding: 3rem; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <!-- Report Header -->
                <div style="text-align: center; margin-bottom: 3.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 2rem;">
                    <img src="../images/logo.png" style="width: 80px; margin-bottom: 1rem;">
                    <h1 style="font-family:'Montserrat'; font-weight: 900; font-size: 1.75rem; color: #1e293b; margin: 0; letter-spacing: -0.5px;">TIBIAO TOURISM OFFICE</h1>
                    <p style="color: #64748b; font-weight: 600; font-size: 0.95rem; margin-top: 8px;">
                        <span style="text-transform: uppercase; color: #10b981;">${filter}</span> Operations Report • Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>

                <!-- Executive Summary Cards -->
                <div class="executive-summary" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 3.5rem;">
                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
                        <div style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Total Arrivals</div>
                        <div style="font-size: 2rem; font-weight: 900; color: #1e293b;">${visitors.length}</div>
                    </div>
                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
                        <div style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Total Headcount</div>
                        <div style="font-size: 2rem; font-weight: 900; color: #3b82f6;">${totalHeadcount}</div>
                    </div>
                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
                        <div style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Gross Revenue</div>
                        <div style="font-size: 2rem; font-weight: 900; color: #10b981;">₱${totalRevenue.toLocaleString()}</div>
                    </div>
                </div>

                <!-- Detailed Data Table -->
                <div style="margin-bottom: 3rem;">
                    <h4 style="font-family:'Montserrat'; font-weight: 800; font-size: 1.1rem; color: #1e293b; margin-bottom: 1.25rem;">Detailed Entry Logs</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 15px; text-align: left; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">Reg ID</th>
                                <th style="padding: 15px; text-align: left; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">Primary Visitor</th>
                                <th style="padding: 15px; text-align: left; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">Destination</th>
                                <th style="padding: 15px; text-align: center; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">Quantity</th>
                                <th style="padding: 15px; text-align: right; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="5" style="text-align:center; padding: 3rem; color: #94a3b8; font-weight: 600;">No operational data recorded for this selection.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <!-- Report Footer (VISIBLE ON PRINT) -->
                <div class="print-footer" style="display: none; justify-content: space-between; align-items: flex-end; padding-top: 2rem; margin-top: 5rem;">
                    <div style="text-align: left;">
                        <div style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Authenticated By:</div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #1e293b; margin-top: 0;">
                            ${activeAdmin.username}
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 500;">${activeAdmin.role} • Tibiao Tourism Office</div>
                    </div>
                    <div style="text-align: right; font-size: 0.75rem; color: #94a3b8; max-width: 350px; line-height: 1.5;">
                        This document is a system-generated official record 
                        issued by the Tibiao Municipal Tourism Office.
                    </div>
                </div>
            </div>
        </div>

        <style>
            @media (max-width: 768px) {
                .report-controls { flex-direction: column; align-items: flex-start !important; gap: 1.5rem; }
                .report-controls > div:last-child { align-self: flex-end; width: auto; }
                .btn-text-hide-mobile { display: none; }
                .executive-summary { grid-template-columns: 1fr !important; gap: 12px !important; }
                .printable-area { padding: 1.5rem !important; }
                .report-wrapper { padding: 0 10px; }
            }

            @media print {
                /* FORCE PARENTS TO ALLOW MULTI-PAGE */
                html, body, .dashboard-container, .main-content, #content-area, .report-wrapper {
                    height: auto !important;
                    overflow: visible !important;
                    display: block !important;
                }

                .print-footer { display: flex !important; position: relative !important; page-break-before: auto; }
                .printable-area { border: none !important; box-shadow: none !important; padding: 0 !important; display: block !important; }
                
                /* Table styling for print */
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; }
                .executive-summary { page-break-inside: avoid; margin-top: 20px; display: grid !important; grid-template-columns: repeat(3, 1fr) !important; }
                
                table { border-collapse: collapse; width: 100%; table-layout: auto; }
                .printable-area table th, 
                .printable-area table td { 
                    border-bottom: 1px solid #e2e8f0 !important; 
                }
            }
        </style>
    `;
}

async function refreshReport(filter) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Refreshing...</div>`;
    contentArea.innerHTML = await renderReports(filter);
    lucide.createIcons();
}

/** PAYMENT LOGS **/
async function renderPaymentLogs() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

    let rows = visitors.map(v => `
        <tr>
            <td style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${v.id}</td>
            <td style="font-weight: 600;">${v.name}</td>
            <td>${v.resort}</td>
            <td style="font-weight: 700; color: #059669;">${v.total}</td>
            <td><span class="badge badge-active">PAID</span></td>
        </tr>
    `).join('');

    return `
        <div class="table-container fade-in">
            <h3 style="font-family:'Montserrat'; margin-bottom: 1.5rem;">Audit Trail</h3>
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>PAYOR</th><th>DESTINATION</th><th>AMOUNT</th><th>STATUS</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/** ACCOUNT MANAGEMENT **/
async function renderAccountsView() {
    const response = await fetch('/api/users');
    const users = await response.json();

    let userRows = users.map(u => `
        <tr>
            <td style="font-weight: 700;">${u.username}</td>
            <td>${u.role}</td>
            <td><span class="badge ${u.level === 'admin' ? 'badge-active' : 'badge-out'}">${u.level.toUpperCase()}</span></td>
            <td style="color:#64748b;">${new Date(u.created_at).toLocaleDateString()}</td>
            <td class="no-print">
                <div style="display: flex; gap: 8px;">
                    <button class="btn" style="padding: 6px; background: #3b82f6; color: white; border-radius: 6px;" onclick='editUser(${JSON.stringify(u).replace(/'/g, "&apos;")})'>
                        <i data-lucide="edit-3" style="width: 14px;"></i>
                    </button>
                    <button class="btn" style="padding: 6px; background: #ef4444; color: white; border-radius: 6px;" onclick="deleteUser(${u.id})">
                        <i data-lucide="trash-2" style="width: 14px;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;" class="no-print">
            <h3 style="font-family:'Montserrat';">Personnel Records</h3>
            <button class="btn btn-primary" onclick="toggleAccountForm()" title="Add New Account" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; padding: 0;">
                <i data-lucide="plus-circle" style="width: 20px;"></i>
            </button>
        </div>

        <div id="account-creation-card" class="user-form-card no-print fade-in" style="display: none; margin-bottom: 2rem;">
            <h3 style="font-family:'Montserrat'; margin-bottom: 2rem;">Create Staff Account</h3>
            <form id="add-user-form" class="admin-form-grid" autocomplete="off">
                <div class="form-group">
                    <label>Personnel Username</label>
                    <input type="text" id="new-username" placeholder="Full name or Employee Tag" required autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label>Security Password</label>
                    <input type="password" id="new-password" placeholder="••••••••" required autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label>Duty Assignment / Role</label>
                    <input type="text" id="new-role" placeholder="e.g. BlueWave Duty Officer" required>
                </div>
                <div class="form-group">
                    <label>Authorized Portal</label>
                    <select id="new-level" required>
                        <option value="staff">Staff Portal (Restricted)</option>
                        <option value="admin">Admin Portal (Full Access)</option>
                    </select>
                </div>
                <button type="button" class="btn btn-primary account-submit-btn" style="grid-column: 1 / -1; padding: 1rem;" onclick="createUserAccount()">
                    Create Account
                </button>
            </form>
        </div>

        <div class="table-container fade-in">
            <table class="data-table">
                <thead>
                    <tr><th>USERNAME</th><th>ASSIGNMENT</th><th>ACCESS LEVEL</th><th>MEMBER SINCE</th><th class="no-print">ACTIONS</th></tr>
                </thead>
                <tbody>${userRows}</tbody>
            </table>
        </div>
    `;
}

function toggleAccountForm() {
    const card = document.getElementById('account-creation-card');
    const title = card.querySelector('h3');
    const btn = card.querySelector('.account-submit-btn');

    if (card.style.display === 'none') {
        card.style.display = 'block';
        if (editingUserId) {
            title.innerText = "Update Account Details";
            btn.innerText = "Update User Account";
        } else {
            title.innerText = "Create Staff Account";
            btn.innerText = "Create Account";
        }
    } else {
        card.style.display = 'none';
        document.getElementById('add-user-form').reset();
        editingUserId = null;
    }
}

async function createUserAccount() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const level = document.getElementById('new-level').value;

    if (!username || !role || (!editingUserId && !password)) {
        alert("Please fill in all required fields.");
        return;
    }

    try {
        const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';
        const method = editingUserId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, level })
        });

        if (response.ok) {
            alert(editingUserId ? "Account updated successfully!" : "Account provisioned successfully!");

            // If editing own account, update session data
            if (editingUserId && editingUserId == currentAdmin.id) {
                currentAdmin.username = username;
                currentAdmin.role = role;
                currentAdmin.level = level;
                localStorage.setItem('currentUser', JSON.stringify(currentAdmin));
                refreshProfile();
            }

            editingUserId = null;
            showView('accounts');
        } else {
            const err = await response.json();
            alert("Action failed: " + err.error);
        }
    } catch (err) {
        alert("Network failure.");
    }
}

function editUser(user) {
    editingUserId = user.id;
    const card = document.getElementById('account-creation-card');
    card.style.display = 'block';

    document.getElementById('new-username').value = user.username;
    document.getElementById('new-role').value = user.role;
    document.getElementById('new-level').value = user.level;
    document.getElementById('new-password').placeholder = "Leave blank to keep current";
    document.getElementById('new-password').required = false;

    // Update form visuals for edit mode
    card.querySelector('h3').innerText = "Update Account Details";
    card.querySelector('.account-submit-btn').innerText = "Update User Account";

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteUser(id) {
    if (!(await showConfirm("Are you sure you want to delete this account? This action cannot be undone."))) return;

    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("Account deleted successfully.");
            showView('accounts');
        } else {
            const err = await response.json();
            alert("Deletion failed: " + err.error);
        }
    } catch (err) {
        alert("Network failure.");
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

async function refreshProfile() {
    const nameEl = document.getElementById('admin-profile-name');
    const roleEl = document.getElementById('admin-profile-role');

    if (!currentAdmin) return;

    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const me = users.find(u => u.id == currentAdmin.id);

        if (me) {
            // Sync local storage if data changed
            if (me.username !== currentAdmin.username || me.role !== currentAdmin.role) {
                currentAdmin.username = me.username;
                currentAdmin.role = me.role;
                localStorage.setItem('currentUser', JSON.stringify(currentAdmin));
            }
            if (nameEl) nameEl.innerText = me.username;
            if (roleEl) roleEl.innerText = me.role;
        } else {
            if (nameEl) nameEl.innerText = currentAdmin.username;
            if (roleEl) roleEl.innerText = currentAdmin.role;
        }
    } catch (err) {
        if (nameEl) nameEl.innerText = currentAdmin.username;
        if (roleEl) roleEl.innerText = currentAdmin.role;
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

/** ATTENDANCE LOGS **/
async function renderAttendanceLogs() {
    const response = await fetch('/api/attendance/logs');
    const logs = await response.json();

    let rows = logs.map(log => {
        const date = new Date(log.time_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeIn = new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '<span style="color:#ef4444; font-weight:800; animation: blink 1.5s infinite;">ON DUTY</span>';

        let dutyStatus = '';
        if (log.status === 'IN') {
            dutyStatus = '<span class="badge" style="background: #dcfce7; color: #166534;">Active</span>';
        } else if (log.status === 'BREAK') {
            dutyStatus = '<span class="badge" style="background: #fef3c7; color: #92400e;">On Break</span>';
        } else {
            dutyStatus = '<span class="badge" style="background: #f1f5f9; color: #475569;">Timed Out</span>';
        }

        let statusBadge = '';
        if (log.approval_status === 'Approved') {
            statusBadge = '<span class="badge badge-active">Approved</span>';
        } else if (log.approval_status === 'Disapproved') {
            statusBadge = '<span class="badge" style="background: #fee2e2; color: #991b1b;">Disapproved</span>';
        } else {
            statusBadge = `
                <div class="no-print" style="display: flex; gap: 5px;">
                    <button onclick="approveAttendance(${log.id}, 'Approved')" class="btn" style="padding: 4px 8px; font-size: 0.7rem; background: #10b981; color: white; border: none; border-radius: 6px;">Approve</button>
                    <button onclick="approveAttendance(${log.id}, 'Disapproved')" class="btn" style="padding: 4px 8px; font-size: 0.7rem; background: #ef4444; color: white; border: none; border-radius: 6px;">Deny</button>
                </div>
                <span class="print-only" style="display:none; color: #94a3b8; font-style: italic;">Pending Review</span>
            `;
        }

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 1.25rem 1rem;">
                    <div style="font-weight:700; color: #1e293b;">${log.username}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${date}</div>
                </td>
                <td style="padding: 1.25rem 1rem; color:#10b981; font-weight:700;">${timeIn}</td>
                <td style="padding: 1.25rem 1rem; color:#1e293b; font-weight:600;">${timeOut}</td>
                <td style="padding: 1.25rem 1rem;">${dutyStatus}</td>
                <td style="padding: 1.25rem 1rem;">${statusBadge}</td>
                <td style="padding: 1.25rem 1rem; font-size: 0.85rem; color: #64748b; max-width: 250px;">${log.remarks || '<em style="color:#cbd5e1">No remarks</em>'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="fade-in" style="max-width: 1100px; margin: 0 auto;">
            <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-bottom: 2rem;">
                <div>
                    <h3 style="font-family:'Montserrat'; font-weight: 800; font-size: 1.5rem; color: #1e293b; margin: 0;">Personnel Attendance</h3>
                    <p class="no-print" style="font-size: 0.9rem; color: #64748b; margin-top: 4px;">Approve, monitor, and oversee staff duty cycles</p>
                </div>
                <button class="btn btn-primary no-print" onclick="window.print()" title="Export Attendance Log" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; padding: 0; font-weight: 700;">
                    <i data-lucide="printer" style="width: 18px;"></i>
                </button>
            </div>

            <div class="table-container" style="background: white; border-radius: 24px; padding: 1.25rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <table class="data-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                    <thead>
                        <tr>
                            <th style="padding: 1.25rem 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Personnel</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">In</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Out</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Duty Status</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Approval Status</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9;">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align:center; padding: 4rem; color: #94a3b8;">No attendance records found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        <style>
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            @media print {
                .print-only { display: inline-block !important; }
            }
        </style>
    `;
}

async function approveAttendance(id, status) {
    if (!(await showConfirm(`Are you sure you want to ${status.toLowerCase()} this attendance log?`))) return;
    const response = await fetch('/api/attendance/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
    });
    if (response.ok) showView('attendance');
}

/** CLOUD SYNCHRONIZATION **/
async function syncCloudData() {
    const syncBtn = document.getElementById('cloud-sync-btn');
    const syncIcon = syncBtn.querySelector('i');
    const syncText = syncBtn.querySelector('span');

    try {
        // Start Animation
        syncBtn.disabled = true;
        syncIcon.style.animation = "spin 1s linear infinite";
        syncText.innerText = "Syncing...";

        // 1. Fetch data from the Cloud (Vercel)
        // We assume the local dashboard is running on localhost:5000 
        // and we need to reach out to the Vercel URL
        const CLOUD_URL = "https://tourist-digital-logging-and-monitoring-system.vercel.app";

        console.log("Reaching out to cloud...");
        const response = await fetch(`${CLOUD_URL}/api/visitors`);
        if (!response.ok) throw new Error("Could not connect to Cloud Database");

        const cloudVisitors = await response.json();
        console.log(`Found ${cloudVisitors.length} visitors in Cloud.`);

        // 2. Send each visitor to the local database
        // The local API /api/register will handle deduplication if the ID already exists (SQLite error)
        let syncCount = 0;
        for (const visitor of cloudVisitors) {
            try {
                const localRes = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: visitor.id,
                        name: visitor.name,
                        address: visitor.address,
                        age: visitor.age,
                        gender: visitor.gender,
                        resort: visitor.resort,
                        visitorType: visitor.visitor_type, // Map db field to API field
                        duration: visitor.duration,
                        members: JSON.parse(visitor.members || '[]'),
                        total: visitor.total
                    })
                });

                if (localRes.ok) syncCount++;
            } catch (err) {
                // Likely a duplicate, skip it
                console.log(`Skipped duplicate: ${visitor.id}`);
            }
        }

        alert(`✅ Sync Complete! Retrieved ${syncCount} new registrations from the QR codes.`);
        showView('dashboard'); // Refresh stats

    } catch (err) {
        console.error("Sync Error:", err);
        alert("❌ Sync Failed: Make sure your laptop has an internet connection to reach the Cloud.");
    } finally {
        syncBtn.disabled = false;
        syncIcon.style.animation = "";
        syncText.innerText = "Sync Cloud";
    }
}
