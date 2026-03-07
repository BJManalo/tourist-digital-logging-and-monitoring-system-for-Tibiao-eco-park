/**
 * SYNC ENGINE - Automatic background data synchronization
 * Handles pulling data from the Cloud (Vercel) to the Local Database (Laptop)
 */

const CLOUD_URL = "https://tourist-digital-logging-and-monitor-three.vercel.app";
let isSyncing = false;

/**
 * Main Sync Function
 * Runs silently in the background every 10 seconds.
 */
async function runCloudSync() {
    if (isSyncing) return;

    // Check if we are online first
    if (!navigator.onLine) return;

    try {
        isSyncing = true;
        console.log(`[SyncEngine] Starting periodic sync with ${CLOUD_URL}...`);

        // 1. Fetch data from the Cloud
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${CLOUD_URL}/api/visitors`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Cloud connection failed (${response.status})`);

        const cloudVisitors = await response.json();

        // 2. Save each visitor to the local database
        let newRecords = 0;
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
                        visitorType: visitor.visitor_type || visitor.visitorType,
                        duration: visitor.duration,
                        members: typeof visitor.members === 'string' ? JSON.parse(visitor.members) : visitor.members,
                        total: visitor.total
                    })
                });

                if (localRes.ok) {
                    const data = await localRes.json();
                    if (!data.duplicate) newRecords++;
                }
            } catch (err) {
                console.warn(`[SyncEngine] Skipped item ${visitor.id}`);
            }
        }

        if (newRecords > 0) {
            console.log(`[SyncEngine] Sync Complete! Found ${newRecords} new registrations.`);
            // Automatically refresh the dashboard if visible
            if (typeof showView === 'function') {
                const activeNav = document.querySelector('.nav-item.active');
                if (activeNav) {
                    const onclickStr = activeNav.getAttribute('onclick');
                    const match = onclickStr ? onclickStr.match(/'([^']+)'/) : null;
                    if (match && (match[1] === 'dashboard' || match[1] === 'visitors')) {
                        showView(match[1]);
                    }
                }
            }
        }

    } catch (err) {
        console.error("[SyncEngine] Sync Error:", err.message);
    } finally {
        isSyncing = false;
    }
}

/**
 * INITIALIZE AUTO-SYNC
 * Runs every 10 seconds
 */
function initAutoSync() {
    // Initial sync on load
    setTimeout(runCloudSync, 1000);

    // Set interval for every 10 seconds
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            runCloudSync();
        }
    }, 10000);

    // Also sync when the user returns to the tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            runCloudSync();
        }
    });

    // Dummy function to prevent errors if any old code calls it
    window.syncCloudData = () => { console.log("Manual sync button removed. System syncs automatically every 10s.") };
}

// Start auto-sync on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoSync);
} else {
    initAutoSync();
}
