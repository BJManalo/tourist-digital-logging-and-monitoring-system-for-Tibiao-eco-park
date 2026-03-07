/**
 * Tibiao Tourism System - Application Logic
 */

// Configuration
// Configuration
const FEES = {
    'Domestic Local': 20,
    'Domestic National': 50,
    'Foreigner': 50
};
const DISCOUNT_RATE = 0.20; // 20% discount

// Global Scanner Variable
let html5QrCode = null;

// Current Screen State
let currentScreen = 'landing-screen';

/**
 * Navigate to a different screen
 * @param {string} screenId 
 */
function navigateTo(screenId) {
    // Hide all screens
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('hidden');
    });

    // Show the target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        currentScreen = screenId;
    }

    // Special behavior for welcome screen - pure primary background
    if (screenId === 'welcome-screen') {
        document.querySelector('.app-container').style.backgroundColor = 'var(--primary)';
    } else {
        document.querySelector('.app-container').style.backgroundColor = 'var(--white)';
    }

    // Refresh icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

/**
 * Initialize and start the QR Scanner
 */
function startQRScanner() {
    navigateTo('scan-screen');

    html5QrCode = new Html5Qrcode("reader");
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        console.log(`Code matched = ${decodedText}`, decodedResult);
        stopQRScanner();
        navigateTo('registration-screen');
    };

    const config = { fps: 15, qrbox: { width: 250, height: 250 } };

    // Try starting with environment (rear camera) first, fallback to front camera
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            // Fallback to front camera if rear is not available
            html5QrCode.start({ facingMode: "user" }, config, qrCodeSuccessCallback)
                .catch(err2 => {
                    console.error(err2);
                    alert("Camera still blocked. Click the CAMERA ICON in your browser's address bar (top right) and select 'Always allow'.");
                    navigateTo('landing-screen');
                });
        });
}

/**
 * Stop the QR Scanner
 */
function stopQRScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(err => console.error("Failed to stop scanner", err));
    }
}

/**
 * Demo simulation for environment without camera
 */
function simulateScan() {
    stopQRScanner();
    navigateTo('welcome-screen');
}

/**
 * Add a new member field to the list
 */
function addMember() {
    const list = document.getElementById('members-list');
    const memberId = 'member-' + Date.now();

    // Default to the current primary visitor type
    const defaultType = document.getElementById('visitor-type').value || 'Domestic Local';

    const memberCard = document.createElement('div');
    memberCard.className = 'member-card fade-in';
    memberCard.id = memberId;

    memberCard.innerHTML = `
        <button type="button" class="remove-member" onclick="removeMember('${memberId}')">
            <i data-lucide="x-circle"></i>
        </button>
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" placeholder="Member's Name" class="member-name-input" oninput="calculatePayment()">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Age</label>
                <input type="number" placeholder="Age" class="member-age-input" oninput="calculatePayment()">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="member-status-input" onchange="calculatePayment()">
                    <option value="Regular">Regular</option>
                    <option value="Child">Child</option>
                    <option value="PWD">PWD</option>
                    <option value="Senior Citizen">Senior Citizen</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Visitor Origin / Type</label>
            <select class="member-type-input" onchange="calculatePayment()">
                <option value="Domestic Local" ${defaultType === 'Domestic Local' ? 'selected' : ''}>Within Antique</option>
                <option value="Domestic National" ${defaultType === 'Domestic National' ? 'selected' : ''}>Outside Antique</option>
                <option value="Foreigner" ${defaultType === 'Foreigner' ? 'selected' : ''}>Foreigner</option>
            </select>
        </div>
    `;

    list.appendChild(memberCard);

    if (window.lucide) {
        lucide.createIcons();
    }

    calculatePayment();
}

/**
 * Remove a member from the list
 * @param {string} memberId 
 */
function removeMember(memberId) {
    const member = document.getElementById(memberId);
    if (member) {
        member.classList.add('fade-out');
        setTimeout(() => {
            member.remove();
            calculatePayment();
        }, 100);
    }
}

/**
 * Calculate total payment based on inputs
 */
function calculatePayment() {
    const primaryAgeInput = document.getElementById('age').value;
    const primaryStatus = document.getElementById('status').value;
    const primaryType = document.getElementById('visitor-type').value;
    const paymentItemsList = document.getElementById('payment-items');
    const totalAmountSpan = document.getElementById('total-amount');
    const paymentSummaryContainer = document.getElementById('payment-summary-container');

    // Hide payment record if primary age or type is not selected yet
    if (primaryAgeInput === '' || primaryType === '') {
        if (paymentSummaryContainer) {
            paymentSummaryContainer.style.display = 'none';
        }
        return;
    }

    // Show payment record
    if (paymentSummaryContainer) {
        paymentSummaryContainer.style.display = 'block';
    }

    const primaryAge = parseInt(primaryAgeInput) || 0;
    let total = 0;
    paymentItemsList.innerHTML = '';

    // 1. Calculate for Primary Visitor
    const isPrimaryDiscounted = primaryStatus !== 'Regular' || primaryAge < 13 || primaryAge >= 60;
    const finalPrimaryStatus = isPrimaryDiscounted && primaryStatus === 'Regular'
        ? (primaryAge < 13 ? 'Child' : 'Senior Citizen')
        : primaryStatus;

    const baseFee = FEES[primaryType] || 50;
    const primaryCost = (finalPrimaryStatus !== 'Regular') ? baseFee * (1 - DISCOUNT_RATE) : baseFee;
    total += primaryCost;

    const primaryItem = document.createElement('div');
    primaryItem.className = 'payment-item';
    primaryItem.innerHTML = `
        <span>Primary Visitor (${finalPrimaryStatus} - ${primaryType})</span>
        <span>₱${primaryCost.toFixed(2)}</span>
    `;
    paymentItemsList.appendChild(primaryItem);

    // 2. Calculate for Additional Members
    const memberCards = document.querySelectorAll('.member-card');
    memberCards.forEach((card, index) => {
        const status = card.querySelector('.member-status-input').value;
        const type = card.querySelector('.member-type-input').value;
        const name = card.querySelector('.member-name-input').value || `Member ${index + 1}`;
        const age = parseInt(card.querySelector('.member-age-input').value) || 0;

        const isDiscounted = status !== 'Regular' || age < 13 || age >= 60;
        const finalStatus = isDiscounted && status === 'Regular'
            ? (age < 13 ? 'Child' : 'Senior Citizen')
            : status;

        const mBaseFee = FEES[type] || 50;
        const cost = (finalStatus !== 'Regular') ? mBaseFee * (1 - DISCOUNT_RATE) : mBaseFee;
        total += cost;

        const item = document.createElement('div');
        item.className = 'payment-item';
        item.innerHTML = `
            <span>${name} (${finalStatus} - ${type})</span>
            <span>₱${cost.toFixed(2)}</span>
        `;
        paymentItemsList.appendChild(item);
    });

    // Update Totals
    totalAmountSpan.innerText = `₱${total.toFixed(2)}`;
}


/**
 * Show/hide the manual destination input when "Others" is selected
 */
function toggleOtherResort() {
    const resortSelect = document.getElementById('resort');
    const otherGroup = document.getElementById('resort-other-group');
    const otherInput = document.getElementById('resort-other');
    if (resortSelect.value === 'Others') {
        otherGroup.style.display = 'block';
        otherInput.setAttribute('required', 'required');
    } else {
        otherGroup.style.display = 'none';
        otherInput.removeAttribute('required');
        otherInput.value = '';
    }
}

/**
 * Handle form submission
 */
document.getElementById('tourist-form').addEventListener('submit', function (e) {
    e.preventDefault();

    // Generate Unique ID
    const visitorId = `TIB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Prepare Registry Data for Database
    const memberData = [];
    document.querySelectorAll('.member-card').forEach((card, index) => {
        memberData.push({
            name: card.querySelector('.member-name-input').value || `Member ${index + 1}`,
            age: card.querySelector('.member-age-input').value || 0,
            status: card.querySelector('.member-status-input').value,
            visitorType: card.querySelector('.member-type-input').value
        });
    });

    const formData = {
        id: visitorId,
        name: document.getElementById('name').value,
        address: document.getElementById('address').value,
        age: parseInt(document.getElementById('age').value) || 0,
        gender: document.getElementById('gender').value,
        resort: (document.getElementById('resort').value === 'Others')
            ? (document.getElementById('resort-other').value.trim() || 'Others')
            : document.getElementById('resort').value,
        visitorType: document.getElementById('visitor-type').value,
        duration: document.getElementById('duration').value,
        members: memberData,
        total: document.getElementById('total-amount').innerText,
        status: 'Active'
    };

    // 1. Save to SQLite Database via API
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
        .then(async response => {
            if (!response.ok) {
                try {
                    const errorBody = await response.json();
                    throw new Error(errorBody.error || `Server Error ${response.status}`);
                } catch (e) {
                    throw new Error(`Server Error ${response.status}`);
                }
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            saveToLocalAndShowSuccess(formData, visitorId);
        })
        .catch((error) => {
            console.error('Registration Error:', error);
            console.log("Saving offline...");
            alert("⚠️ No connection to server detected. Saving registration OFFLINE on this device.");

            // Queue for later sync if needed
            let queue = JSON.parse(localStorage.getItem('offline_register_queue') || '[]');
            queue.push(formData);
            localStorage.setItem('offline_register_queue', JSON.stringify(queue));

            saveToLocalAndShowSuccess(formData, visitorId);
        });
});

function saveToLocalAndShowSuccess(formData, visitorId) {
    // Local Storage Sync (Optional fallback)
    let visitors = JSON.parse(localStorage.getItem('tibiao_visitors') || '[]');
    visitors.push(formData);
    localStorage.setItem('tibiao_visitors', JSON.stringify(visitors));

    // Update Success Summary UI
    document.getElementById('generated-id').innerText = visitorId;
    const summaryCard = document.getElementById('summary-card');
    summaryCard.innerHTML = `
        <h3 class="payment-title"><i data-lucide="file-text"></i> Registration Details</h3>
        <div class="payment-item"><span>Visitor:</span> <strong>${formData.name}</strong></div>
        <div class="payment-item"><span>Resort:</span> <strong>${formData.resort}</strong></div>
        <div class="payment-item"><span>Visitor Type:</span> <strong>${formData.visitorType}</strong></div>
        <div class="payment-item"><span>Total Members:</span> <strong>${1 + (formData.members ? formData.members.length : 0)}</strong></div>
        <div class="payment-total">
            <span>Total Paid:</span>
            <span>${formData.total}</span>
        </div>
    `;
    navigateTo('success-screen');
}

/**
 * Handle Visitor Checkout
 */
function processCheckout() {
    const idInput = document.getElementById('checkout-id').value.toUpperCase().trim();
    if (!idInput) {
        alert("Please enter a valid Registration ID.");
        return;
    }

    // 1. Update SQLite Database
    fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idInput })
    })
        .then(response => {
            if (!response.ok) throw new Error('ID not found or already checked out');
            return response.json();
        })
        .then(data => {
            handleSuccessfulCheckout(idInput);
        })
        .catch(error => {
            console.error('Network Error during checkout:', error);

            // Queue for offline sync
            let queue = JSON.parse(localStorage.getItem('offline_checkout_queue') || '[]');
            queue.push(idInput);
            localStorage.setItem('offline_checkout_queue', JSON.stringify(queue));

            alert("⚠️ No connection to server detected. Visitor check-out saved OFFLINE.");
            handleSuccessfulCheckout(idInput);
        });
}

function handleSuccessfulCheckout(idInput) {
    // 2. Sync LocalStorage for consistency
    let visitors = JSON.parse(localStorage.getItem('tibiao_visitors') || '[]');
    const visitorIndex = visitors.findIndex(v => v.id === idInput);
    if (visitorIndex !== -1) {
        visitors[visitorIndex].status = 'Checked Out';
        localStorage.setItem('tibiao_visitors', JSON.stringify(visitors));
    }

    alert(`Success! Visitor has been checked out.`);
    navigateTo('landing-screen');
    document.getElementById('checkout-id').value = '';
}

// Event Listeners
document.getElementById('add-member').addEventListener('click', addMember);
document.getElementById('age').addEventListener('change', calculatePayment);

// Handle manual change on member status dropdowns that are dynamically added
// already handled via inline onchange="calculatePayment()" 

// Initial calculation
calculatePayment();
