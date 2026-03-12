

const CLOUD_URL = "https://tourist-digital-logging-and-monitor-three.vercel.app";
let isSyncing = false;


async function runCloudSync() {
    if (isSyncing) return;


    if (!navigator.onLine) return;

    try {
        isSyncing = true;
        console.log(`[SyncEngine] Starting periodic sync with ${CLOUD_URL}...`);


        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${CLOUD_URL}/api/visitors`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Cloud connection failed (${response.status})`);

        const cloudVisitors = await response.json();


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


function initAutoSync() {

    setTimeout(runCloudSync, 1000);


    setInterval(() => {
        if (document.visibilityState === 'visible') {
            runCloudSync();
        }
    }, 10000);


    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            runCloudSync();
        }
    });


    window.syncCloudData = () => { console.log("Manual sync button removed. System syncs automatically every 10s.") };
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoSync);
} else {
    initAutoSync();
}
