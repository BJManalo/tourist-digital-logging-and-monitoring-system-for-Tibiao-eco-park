
async function renderDashboard(timeFilter = 'Daily') {
    const response = await fetch('/api/visitors');
    let visitors = await response.json();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());


    if (timeFilter === 'Daily') {
        visitors = visitors.filter(v => new Date(v.created_at) >= today);
    } else if (timeFilter === 'Weekly') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        visitors = visitors.filter(v => new Date(v.created_at) >= lastWeek);
    } else if (timeFilter === 'Monthly') {
        visitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
        });
    } else if (timeFilter === 'Annually') {
        visitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate.getFullYear() === now.getFullYear();
        });
    }

    const activeCount = visitors.filter(v => v.status === 'Active').length;
    const checkoutCount = visitors.filter(v => v.status === 'Checked Out').length;
    let totalRevenue = 0;
    visitors.forEach(v => totalRevenue += parseFloat(v.total.replace('₱', '').replace(',', '')));

    let recentTransactionsRows = visitors.slice().reverse().slice(0, 5).map(v => `
        <tr style="cursor: pointer;" onclick="showView('payments')">
            <td style="color:var(--text-main); font-weight: 500;">${v.name}</td>
            <td><span class="badge ${v.status === 'Active' ? 'badge-active' : 'badge-out'}">${v.status}</span></td>
            <td style="color:var(--text-main); font-weight: 600;">${v.total}</td>
            <td style="color:var(--text-muted);">${new Date(v.created_at).toLocaleDateString()}</td>
            <td style="color:var(--text-muted);">${v.resort}</td>
        </tr>
    `).join('');

    return `
        <!-- Dashboard Filter UI -->
        <div style="margin: -1.25rem 0 1.5rem 0; display: flex; justify-content: flex-end;">
            <div style="display: flex; align-items: center; gap: 8px; background: white; padding: 6px 12px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <i data-lucide="filter" style="width: 14px; height: 14px; color: #64748b;"></i>
                <select onchange="refreshDashboard(this.value)" style="border: none; font-size: 0.8rem; font-weight: 700; color: #1e293b; cursor: pointer; background: transparent; outline: none;">
                    <option value="Daily" ${timeFilter === 'Daily' ? 'selected' : ''}>Today</option>
                    <option value="Weekly" ${timeFilter === 'Weekly' ? 'selected' : ''}>This Week</option>
                    <option value="Monthly" ${timeFilter === 'Monthly' ? 'selected' : ''}>This Month</option>
                    <option value="Annually" ${timeFilter === 'Annually' ? 'selected' : ''}>This Year</option>
                    <option value="All" ${timeFilter === 'All' ? 'selected' : ''}>All Time</option>
                </select>
            </div>
        </div>

        <div class="stat-grid">
            <div class="stat-card fade-in" onclick="showView('revenue')" style="cursor: pointer;">
                <span class="stat-label">TOTAL COLLECTION FEE</span>
                <span class="stat-value" style="margin-top:0.2rem">₱${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <i data-lucide="trend-up" class="stat-card-icon" style="color: var(--success); opacity: 0.2;"></i>
            </div>
            <div class="stat-card fade-in" onclick="showView('visitors')" style="cursor: pointer;">
                <span class="stat-label">TOTAL ARRIVALS</span>
                <span class="stat-value" style="margin-top:0.2rem">${visitors.length.toLocaleString()}</span>
                <i data-lucide="users" class="stat-card-icon" style="color: var(--primary); opacity: 0.2;"></i>
            </div>
            <div class="stat-card fade-in" onclick="showView('visitors-active')" style="cursor: pointer;">
                <span class="stat-label">ACTIVE VISITORS</span>
                <span class="stat-value" style="margin-top:0.2rem">${activeCount.toLocaleString()}</span>
                <i data-lucide="user-check" class="stat-card-icon" style="color: var(--primary); opacity: 0.2;"></i>
            </div>
            <div class="stat-card fade-in" onclick="showView('visitors-out')" style="cursor: pointer;">
                <span class="stat-label">CHECKED OUT</span>
                <span class="stat-value" style="margin-top:0.2rem">${checkoutCount.toLocaleString()}</span>
                <i data-lucide="log-out" class="stat-card-icon" style="color: var(--warning); opacity: 0.2;"></i>
            </div>
        </div>
        
        <div class="datadash-middle-grid fade-in">
            <div class="chart-card">
                <div class="chart-header">
                    <span><span style="white-space: nowrap;">Collection Fee &</span><br>User Growth</span>
                    <button class="btn" onclick="showView('revenue')" style="width: auto; background:var(--sidebar-bg); border:1px solid var(--border-color); color:var(--text-main); font-size: 0.75rem; padding: 0.4rem 0.8rem; cursor: pointer;">View Chart</button>
                </div>
                <!-- DataDash chart will mount here -->
                <div class="chart-container">
                    <canvas id="dashboardRevenueChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-header">
                    <span>Traffic Sources (Destinations)</span>
                </div>
                <div class="chart-container" style="display: flex; align-items: center; justify-content: center;">
                    <canvas id="dashboardPieChart"></canvas>
                </div>
            </div>
        </div>

        <div class="table-container fade-in" style="margin-top: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="font-family: 'Montserrat'; font-size: 0.95rem; font-weight: 700; text-transform: uppercase;">Recent Transactions</h3>
                <button class="btn btn-primary" onclick="showView('payments')" style="width: auto; padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 8px;">View All</button>
            </div>
            <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>CUSTOMER</th>
                            <th>STATUS</th>
                            <th>AMOUNT</th>
                            <th>DATE</th>
                            <th>DESTINATION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentTransactionsRows || '<tr><td colspan="5" style="text-align:center;">No recent transactions for this period.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


async function initDashboardCharts(timeFilter = 'Daily') {
    const response = await fetch('/api/visitors');
    let visitors = await response.json();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());


    let filteredVisitors = visitors;
    if (timeFilter === 'Daily') {
        filteredVisitors = visitors.filter(v => new Date(v.created_at) >= today);
    } else if (timeFilter === 'Weekly') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        filteredVisitors = visitors.filter(v => new Date(v.created_at) >= lastWeek);
    } else if (timeFilter === 'Monthly') {
        filteredVisitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
        });
    } else if (timeFilter === 'Annually') {
        filteredVisitors = visitors.filter(v => {
            const vDate = new Date(v.created_at);
            return vDate.getFullYear() === now.getFullYear();
        });
    }


    const revenueCtx = document.getElementById('dashboardRevenueChart');
    if (revenueCtx) {
        const labels = [];
        const data = [];
        const userGrowth = [];


        const currentDate = new Date();
        for (let i = 6; i >= 0; i--) {
            let d = new Date(currentDate);
            d.setDate(d.getDate() - i);

            let label = "";
            if (timeFilter === 'Weekly') {
                label = d.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            labels.push(label);

            const daysVisitors = visitors.filter(v => new Date(v.created_at).toDateString() === d.toDateString());
            userGrowth.push(daysVisitors.length);
            let dailyRev = 0;
            daysVisitors.forEach(v => dailyRev += parseFloat(v.total.replace('₱', '').replace(',', '')) || 0);
            data.push(dailyRev);
        }

        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Collection Fee (₱)',
                        data: data,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Users',
                        data: userGrowth,
                        borderColor: '#10b981',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' }, position: 'top' }
                },
                scales: {
                    y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }


    const pieCtx = document.getElementById('dashboardPieChart');
    if (pieCtx) {
        const resortCounts = {};

        filteredVisitors.forEach(v => {
            if (!resortCounts[v.resort]) resortCounts[v.resort] = 0;
            resortCounts[v.resort]++;
        });

        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(resortCounts),
                datasets: [{
                    data: Object.values(resortCounts),
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
                }
            }
        });
    }
}

async function refreshDashboard(filter) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `<div style="padding: 2rem; text-align: center;">Refreshing Dashboard...</div>`;


    const html = await renderDashboard(filter);
    contentArea.innerHTML = html;


    if (window.lucide) lucide.createIcons();
    setTimeout(() => initDashboardCharts(filter), 50);
}
