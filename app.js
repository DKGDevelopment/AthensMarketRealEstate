/* Piraeus Real Estate Market Tracker
 * Pure client-side app. Data is loaded from data.js (window.PIRAEUS_LISTINGS),
 * which works both over http(s) and when opening index.html directly (file://).
 */

// Map Greek property-type roots to friendly English labels for the UI.
const TYPE_LABELS = {
    'Διαμέρισμα': 'Apartment',
    'Μεζονέτα': 'Maisonette',
    'Μονοκατοικία': 'Detached house',
    'Κτίριο': 'Building',
    'Studio / Γκαρσονιέρα': 'Studio',
    'Συγκρότημα διαμερισμάτων': 'Apartment complex',
    'Λοιπές κατηγορίες': 'Other',
};

let allListings = [];
let filteredListings = [];
const charts = {};

/* ---------- helpers ---------- */
const fmt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('en-US');
const euro = n => (n == null || isNaN(n)) ? '—' : '€' + fmt(n);

function baseType(propType) {
    return (propType || '').split(',')[0].trim();
}
function typeLabel(propType) {
    const b = baseType(propType);
    return TYPE_LABELS[b] || b || 'Property';
}
function median(arr) {
    const a = arr.filter(v => v != null && !isNaN(v)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function mean(arr) {
    const a = arr.filter(v => v != null && !isNaN(v));
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

/* ---------- init ---------- */
function init() {
    const raw = window.PIRAEUS_LISTINGS || [];
    allListings = raw.map(l => ({
        ...l,
        ppsm: (l.SQM && l.Price_EUR) ? l.Price_EUR / l.SQM : null,
        typeRoot: baseType(l.Property_Type),
        typeLabel: typeLabel(l.Property_Type),
    }));
    filteredListings = [...allListings];

    populateTypeFilter();
    setupTabs();
    setupListingControls();

    renderDashboard('');
    renderListings(filteredListings);

    document.getElementById('footerCount').textContent = fmt(allListings.length);
}

/* ---------- tabs ---------- */
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            // Charts need a resize nudge when revealed from display:none.
            if (btn.dataset.tab === 'dashboard') {
                Object.values(charts).forEach(c => c && c.resize());
            }
        });
    });
}

/* ================= DASHBOARD ================= */
function populateTypeFilter() {
    const counts = {};
    allListings.forEach(l => { counts[l.typeRoot] = (counts[l.typeRoot] || 0) + 1; });
    const sel = document.getElementById('dashType');
    Object.keys(counts).sort((a, b) => counts[b] - counts[a]).forEach(root => {
        const o = document.createElement('option');
        o.value = root;
        o.textContent = `${typeLabel(root)} (${counts[root]})`;
        sel.appendChild(o);
    });
    sel.addEventListener('change', e => renderDashboard(e.target.value));
}

function renderDashboard(typeRoot) {
    const data = typeRoot ? allListings.filter(l => l.typeRoot === typeRoot) : allListings;
    document.getElementById('dashScope').textContent =
        `${fmt(data.length)} listing${data.length === 1 ? '' : 's'} in scope`;

    renderKPIs(data);
    renderTypeTable(typeRoot ? data : allListings, typeRoot);
    // Charts depend on Chart.js; never let a charting failure break the page.
    try {
        if (typeof Chart !== 'undefined') renderCharts(data, typeRoot);
    } catch (e) {
        console.error('Chart rendering failed:', e);
    }
}

function renderKPIs(data) {
    const prices = data.map(l => l.Price_EUR);
    const ppsm = data.map(l => l.ppsm).filter(Boolean);
    const areas = data.map(l => l.SQM).filter(Boolean);
    const parking = data.filter(l => l.Parking === 'Yes').length;

    document.getElementById('kpiTotal').textContent = fmt(data.length);
    document.getElementById('kpiMedianPrice').textContent = euro(median(prices));
    document.getElementById('kpiMedianPpsm').textContent = euro(median(ppsm));
    document.getElementById('kpiMedianArea').textContent = data.length ? fmt(median(areas)) + ' m²' : '—';
    document.getElementById('kpiPriceRange').textContent =
        data.length ? `${euro(Math.min(...prices))} – ${euro(Math.max(...prices))}` : '—';
    const pct = data.length ? Math.round(parking / data.length * 100) : 0;
    document.getElementById('kpiParking').textContent = `${fmt(parking)} (${pct}%)`;
}

function renderTypeTable(data, activeRoot) {
    const groups = {};
    data.forEach(l => { (groups[l.typeRoot] = groups[l.typeRoot] || []).push(l); });
    const rows = Object.keys(groups).map(root => {
        const g = groups[root];
        const prices = g.map(l => l.Price_EUR);
        return {
            root,
            label: typeLabel(root),
            count: g.length,
            medPrice: median(prices),
            medPpsm: median(g.map(l => l.ppsm).filter(Boolean)),
            medArea: median(g.map(l => l.SQM).filter(Boolean)),
            min: Math.min(...prices),
            max: Math.max(...prices),
        };
    }).sort((a, b) => b.count - a.count);

    const tbody = document.querySelector('#typeTable tbody');
    tbody.innerHTML = rows.map(r => `
        <tr${r.root === activeRoot ? ' style="background:#eff6ff"' : ''}>
            <td>${r.label}</td>
            <td>${fmt(r.count)}</td>
            <td>${euro(r.medPrice)}</td>
            <td>${euro(r.medPpsm)}</td>
            <td>${fmt(r.medArea)} m²</td>
            <td>${euro(r.min)}</td>
            <td>${euro(r.max)}</td>
        </tr>`).join('');
}

const COLORS = ['#2563eb', '#764ba2', '#16a34a', '#f59e0b', '#dc2626', '#0891b2', '#db2777', '#65a30d'];

function makeChart(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
}

function renderCharts(data, typeRoot) {
    // 1. Price distribution histogram (cap at 2M, last bucket = 2M+)
    const buckets = [0, 100000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000, Infinity];
    const labels = ['<100k', '100–200k', '200–300k', '300–400k', '400–500k', '500–750k', '750k–1M', '1–1.5M', '1.5–2M', '2M+'];
    const distCounts = new Array(labels.length).fill(0);
    data.forEach(l => {
        for (let i = 0; i < buckets.length - 1; i++) {
            if (l.Price_EUR >= buckets[i] && l.Price_EUR < buckets[i + 1]) { distCounts[i]++; break; }
        }
    });
    makeChart('chartPriceDist', {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Listings', data: distCounts, backgroundColor: '#2563eb', borderRadius: 4 }] },
        options: baseOpts({ y: 'Listings' }),
    });

    // 2. Listings by property type (doughnut) — always full market for context
    const typeCounts = {};
    allListings.forEach(l => { typeCounts[l.typeRoot] = (typeCounts[l.typeRoot] || 0) + 1; });
    const tEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    makeChart('chartType', {
        type: 'doughnut',
        data: {
            labels: tEntries.map(e => typeLabel(e[0])),
            datasets: [{ data: tEntries.map(e => e[1]), backgroundColor: COLORS }],
        },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { boxWidth: 14 } } } },
    });

    // 3. Median €/m² by type (bar)
    const ppsmByType = tEntries.map(([root]) => ({
        label: typeLabel(root),
        v: median(allListings.filter(l => l.typeRoot === root).map(l => l.ppsm).filter(Boolean)),
    })).filter(x => x.v).sort((a, b) => b.v - a.v);
    makeChart('chartPpsmType', {
        type: 'bar',
        data: { labels: ppsmByType.map(x => x.label), datasets: [{ label: '€/m²', data: ppsmByType.map(x => Math.round(x.v)), backgroundColor: '#764ba2', borderRadius: 4 }] },
        options: baseOpts({ y: '€/m²', currency: true, indexAxis: 'y' }),
    });

    // 4. Price vs area scatter (filter extreme outliers for readability)
    const pts = data.filter(l => l.SQM && l.Price_EUR && l.SQM <= 600 && l.Price_EUR <= 2500000)
        .map(l => ({ x: l.SQM, y: l.Price_EUR }));
    makeChart('chartScatter', {
        type: 'scatter',
        data: { datasets: [{ label: 'Listing', data: pts, backgroundColor: 'rgba(37,99,235,0.45)', pointRadius: 3 }] },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.x} m² · €${fmt(c.parsed.y)}` } } },
            scales: {
                x: { title: { display: true, text: 'Area (m²)' } },
                y: { title: { display: true, text: 'Price (€)' }, ticks: { callback: v => '€' + (v / 1000) + 'k' } },
            },
        },
    });

    // 5. Size bands
    const sizeBuckets = [0, 40, 60, 80, 100, 150, 200, Infinity];
    const sizeLabels = ['<40', '40–60', '60–80', '80–100', '100–150', '150–200', '200+'];
    const sizeCounts = new Array(sizeLabels.length).fill(0);
    data.forEach(l => {
        if (!l.SQM) return;
        for (let i = 0; i < sizeBuckets.length - 1; i++) {
            if (l.SQM >= sizeBuckets[i] && l.SQM < sizeBuckets[i + 1]) { sizeCounts[i]++; break; }
        }
    });
    makeChart('chartSizeBand', {
        type: 'bar',
        data: { labels: sizeLabels, datasets: [{ label: 'Listings', data: sizeCounts, backgroundColor: '#16a34a', borderRadius: 4 }] },
        options: baseOpts({ y: 'Listings' }),
    });

    // 6. Bedroom mix
    const bedCounts = { '1': 0, '2': 0, '3': 0, '4+': 0, 'N/A': 0 };
    data.forEach(l => {
        const b = l.Bedrooms;
        if (b == null) bedCounts['N/A']++;
        else if (b >= 4) bedCounts['4+']++;
        else if (b >= 1) bedCounts[String(Math.round(b))] = (bedCounts[String(Math.round(b))] || 0) + 1;
        else bedCounts['N/A']++;
    });
    makeChart('chartBeds', {
        type: 'bar',
        data: { labels: Object.keys(bedCounts), datasets: [{ label: 'Listings', data: Object.values(bedCounts), backgroundColor: '#f59e0b', borderRadius: 4 }] },
        options: baseOpts({ y: 'Listings' }),
    });
}

function baseOpts({ y, currency, indexAxis } = {}) {
    const opts = {
        responsive: true,
        indexAxis: indexAxis || 'x',
        plugins: { legend: { display: false } },
        scales: {
            x: {},
            y: { beginAtZero: true, title: { display: !!y, text: y } },
        },
    };
    if (currency) {
        const valAxis = indexAxis === 'y' ? opts.scales.x : opts.scales.y;
        valAxis.ticks = { callback: v => '€' + fmt(v) };
    }
    return opts;
}

/* ================= LISTINGS ================= */
function setupListingControls() {
    document.getElementById('btnSearch').addEventListener('click', applyFilters);
    document.getElementById('btnReset').addEventListener('click', resetFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    ['searchInput', 'minPrice', 'maxPrice', 'minSqm', 'maxSqm'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });
    });
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
    const minSqm = parseFloat(document.getElementById('minSqm').value) || 0;
    const maxSqm = parseFloat(document.getElementById('maxSqm').value) || Infinity;
    const bedrooms = document.getElementById('bedrooms').value;
    const bathrooms = document.getElementById('bathrooms').value;
    const parking = document.getElementById('parking').value;
    const sortBy = document.getElementById('sortBy').value;

    filteredListings = allListings.filter(l => {
        const hay = ((l.Property_Type || '') + ' ' + l.typeLabel).toLowerCase();
        const matchSearch = !search || hay.includes(search);
        const matchPrice = l.Price_EUR >= minPrice && l.Price_EUR <= maxPrice;
        const matchSqm = (l.SQM || 0) >= minSqm && (l.SQM || 0) <= maxSqm;
        const matchBed = !bedrooms || (bedrooms === '4' ? l.Bedrooms >= 4 : l.Bedrooms == bedrooms);
        const matchBath = !bathrooms || (bathrooms === '3' ? l.Bathrooms >= 3 : l.Bathrooms == bathrooms);
        const matchPark = !parking || l.Parking === parking;
        return matchSearch && matchPrice && matchSqm && matchBed && matchBath && matchPark;
    });

    sortListings(filteredListings, sortBy);
    renderListings(filteredListings);
}

function sortListings(list, sortBy) {
    const cmp = {
        'price-asc': (a, b) => a.Price_EUR - b.Price_EUR,
        'price-desc': (a, b) => b.Price_EUR - a.Price_EUR,
        'sqm-asc': (a, b) => (a.SQM || 0) - (b.SQM || 0),
        'sqm-desc': (a, b) => (b.SQM || 0) - (a.SQM || 0),
        'ppsm-asc': (a, b) => (a.ppsm || Infinity) - (b.ppsm || Infinity),
        'ppsm-desc': (a, b) => (b.ppsm || 0) - (a.ppsm || 0),
    }[sortBy];
    if (cmp) list.sort(cmp);
}

function resetFilters() {
    ['searchInput', 'minPrice', 'maxPrice', 'minSqm', 'maxSqm'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('bedrooms').value = '';
    document.getElementById('bathrooms').value = '';
    document.getElementById('parking').value = '';
    document.getElementById('sortBy').value = 'price-asc';
    filteredListings = [...allListings];
    sortListings(filteredListings, 'price-asc');
    renderListings(filteredListings);
}

function renderListings(list) {
    const container = document.getElementById('listingsContainer');
    if (!list.length) {
        container.innerHTML = '<div class="no-results"><p>No properties match your criteria.</p></div>';
    } else {
        container.innerHTML = list.map(l => `
            <div class="listing-card">
                <div class="listing-header">
                    <div class="property-type">${l.typeLabel}${l.SQM ? ' · ' + l.SQM + ' m²' : ''}</div>
                    <div class="property-price">${euro(l.Price_EUR)}</div>
                    ${l.ppsm ? `<span class="ppsm-badge">${euro(l.ppsm)} / m²</span>` : ''}
                </div>
                <div class="listing-body">
                    <div class="listing-details">
                        <div class="detail-item"><div class="detail-icon">📐</div><div class="detail-text"><div class="detail-label">Area</div><div class="detail-value">${l.SQM ? l.SQM + ' m²' : 'N/A'}</div></div></div>
                        <div class="detail-item"><div class="detail-icon">🛏️</div><div class="detail-text"><div class="detail-label">Bedrooms</div><div class="detail-value">${l.Bedrooms != null ? Math.round(l.Bedrooms) : 'N/A'}</div></div></div>
                        <div class="detail-item"><div class="detail-icon">🚿</div><div class="detail-text"><div class="detail-label">Bathrooms</div><div class="detail-value">${l.Bathrooms != null ? Math.round(l.Bathrooms) : 'N/A'}</div></div></div>
                        <div class="detail-item"><div class="detail-icon">🚗</div><div class="detail-text"><div class="detail-label">Parking</div><div class="detail-value ${l.Parking === 'Yes' ? 'parking-yes' : 'parking-no'}">${l.Parking || 'N/A'}</div></div></div>
                    </div>
                    <a href="${l.Link}" target="_blank" rel="noopener" class="listing-link">View Full Listing →</a>
                </div>
            </div>`).join('');
    }

    document.getElementById('showingCount').textContent = fmt(list.length);
    document.getElementById('avgPrice').textContent = euro(mean(list.map(l => l.Price_EUR)));
    document.getElementById('medPpsm').textContent = euro(median(list.map(l => l.ppsm).filter(Boolean)));
    document.getElementById('avgArea').textContent = list.length ? fmt(mean(list.map(l => l.SQM).filter(Boolean))) + ' m²' : '0 m²';
}

window.addEventListener('DOMContentLoaded', init);
