// Shared Dashboard rendering function for DataDash style
async function renderDashboard() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

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
        <div class="stat-grid">
            <div class="stat-card fade-in" onclick="showView('revenue')" style="cursor: pointer;">
                <span class="stat-label">TOTAL REVENUE</span>
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
                    <span>Revenue & User Growth</span>
                    <button class="btn" onclick="showView('revenue')" style="background:var(--sidebar-bg); border:1px solid var(--border-color); color:var(--text-main); font-size: 0.75rem; padding: 0.4rem 0.8rem; cursor: pointer;">View Chart</button>
                </div>
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
                        ${recentTransactionsRows || '<tr><td colspan="5" style="text-align:center;">No recent transactions.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Chart Initializer
async function initDashboardCharts() {
    const response = await fetch('/api/visitors');
    const visitors = await response.json();

    // Line Chart Data
    const revenueCtx = document.getElementById('dashboardRevenueChart');
    if (revenueCtx) {
        // Group by day for the last 7 days
        const labels = [];
        const data = [];
        const userGrowth = [];

        let currentDate = new Date();
        for (let i = 6; i >= 0; i--) {
            let d = new Date(currentDate);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            labels.push(dateStr);

            // Filter visitors for this exact date
            const daysVisitors = visitors.filter(v => new Date(v.created_at).toDateString() === d.toDateString());
            userGrowth.push(daysVisitors.length);

            let dailyRevenue = 0;
            daysVisitors.forEach(v => dailyRevenue += parseFloat(v.total.replace('₱', '').replace(',', '')));
            data.push(dailyRevenue);
        }

        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue (₱)',
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

    // Pie Chart Data (Destinations)
    const pieCtx = document.getElementById('dashboardPieChart');
    if (pieCtx) {
        const resortCounts = {};
        visitors.forEach(v => {
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
