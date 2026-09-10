// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxe4bUNd9iEakKnYJsgbDG-3xVXVGq72hd8a2e4WAh4WOs-n1Csh9trcb9S-RZdjNokww/exec';

let currentUser = localStorage.getItem('loggedUser');
let journals = [];
let currentTab = 'today';
let selectedIds = new Set();

// State filter tab "Semua"
let filters = { keyword: '', date: '', status: 'semua', urgent: false };

// State form multi-aktifitas
let blockCounter = 0;
let isEditMode = false;

// State fitur Team / Request / Chat / Notifikasi
let allUsers = [];
let teamViewUser = null;
let teamViewJournals = [];
let teamViewFilters = { keyword: '', date: '', status: 'semua' };
let requestBlocksContainer = null;
let requestTargetUser = null;
let notifications = [];
let notifPollTimer = null;
let chatContacts = [];
let currentChatUser = null;
let chatThreadMessages = [];
let chatThreadFilters = { date: '', keyword: '' };

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
    setTodayLabel();
    if (currentUser) {
        showDashboard();
        fetchData();
        initNotifications();
    }

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('hamburgerMenu');
        const btn = document.getElementById('hamburgerBtn');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    // Filter bar listeners
    document.getElementById('searchInput').addEventListener('input', debounce(() => {
        filters.keyword = document.getElementById('searchInput').value.trim().toLowerCase();
        renderData();
    }, 250));
    document.getElementById('filterDate').addEventListener('change', (e) => {
        filters.date = e.target.value;
        renderData();
    });
    document.getElementById('filterStatus').addEventListener('change', (e) => {
        filters.status = e.target.value;
        renderData();
    });

    // Autosave delegasi untuk semua blok aktifitas
    document.getElementById('activityBlocksContainer').addEventListener('input', () => {
        if (!isEditMode) saveDraft();
    });

    // Confirm modal default handlers
    document.getElementById('confirmNoBtn').addEventListener('click', () => resolveConfirm(false));
});

function setTodayLabel() {
    const el = document.getElementById('todayDateLabel');
    if (!el) return;
    const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    el.innerText = new Date().toLocaleDateString('id-ID', opts);
}

function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// --- SISTEM LOGIN ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = user;
            localStorage.setItem('loggedUser', user);
            showDashboard();
            fetchData();
            initNotifications();
        } else {
            document.getElementById('loginMsg').innerText = data.message;
            document.getElementById('loginMsg').classList.remove('hidden');
        }
    } catch (err) {
        showToast('Gagal terhubung ke server.', 'error');
    }
    btn.innerHTML = originalText;
});

function logout() {
    localStorage.removeItem('loggedUser');
    location.reload();
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    document.getElementById('userGreeting').innerText = currentUser;
}

// --- PENGAMBILAN & PENGELOLAAN DATA ---
async function fetchData() {
    renderLoading();
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_data', username: currentUser })
        });
        const result = await res.json();
        journals = result.data || [];
        renderStats();
        renderData();
    } catch (err) {
        document.getElementById('journalContainer').innerHTML = '<p class="text-center" style="color:var(--danger);">Gagal memuat data.</p>';
    }
}

function switchTab(tab) {
    currentTab = tab;
    ['today', 'all', 'team'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        el.classList.toggle('active', t === tab);
    });

    const filterBar = document.getElementById('filterBar');
    if (tab === 'all') filterBar.classList.remove('hidden');
    else filterBar.classList.add('hidden');

    if (tab === 'team') {
        renderLoading();
        fetchAllUsers().then(renderTeamTab);
    } else {
        renderData();
    }
}

// --- STATISTIK ---
function renderStats() {
    const bar = document.getElementById('statsBar');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayJournals = journals.filter(j => j.waktuInput && String(j.waktuInput).startsWith(todayStr));
    const todayDone = todayJournals.filter(j => j.waktuSelesai && String(j.waktuSelesai).trim() !== '').length;
    const urgentActive = journals.filter(j => j.urgensi === 'Ya' && (!j.waktuSelesai || String(j.waktuSelesai).trim() === '')).length;

    bar.innerHTML = `
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[var(--line)] text-xs font-medium text-[var(--ink-soft)] whitespace-nowrap flex-shrink-0">
            <i class="far fa-calendar-check" style="color:var(--accent);"></i> Hari ini <b class="text-[var(--ink)]">${todayJournals.length}</b>
        </div>
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[var(--line)] text-xs font-medium text-[var(--ink-soft)] whitespace-nowrap flex-shrink-0">
            <i class="fas fa-check-circle" style="color:var(--green);"></i> Selesai <b class="text-[var(--ink)]">${todayDone}/${todayJournals.length}</b>
        </div>
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[var(--line)] text-xs font-medium text-[var(--ink-soft)] whitespace-nowrap flex-shrink-0">
            <i class="fas fa-bolt" style="color:var(--amber);"></i> Urgent aktif <b class="text-[var(--ink)]">${urgentActive}</b>
        </div>
    `;
}

// --- FILTER (Tab Semua) ---
function toggleUrgentFilter() {
    filters.urgent = !filters.urgent;
    document.getElementById('filterUrgentToggle').classList.toggle('active', filters.urgent);
    renderData();
}

function resetFilters() {
    filters = { keyword: '', date: '', status: 'semua', urgent: false };
    document.getElementById('searchInput').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = 'semua';
    document.getElementById('filterUrgentToggle').classList.remove('active');
    renderData();
}

function getFilteredJournals() {
    const todayStr = new Date().toISOString().split('T')[0];

    if (currentTab === 'today') {
        return journals.filter(j => j.waktuInput && String(j.waktuInput).startsWith(todayStr));
    }

    // Tab 'all' dengan filter
    let result = journals;
    if (filters.keyword) {
        result = result.filter(j =>
            (j.nama && j.nama.toLowerCase().includes(filters.keyword)) ||
            (j.catatan && j.catatan.toLowerCase().includes(filters.keyword))
        );
    }
    if (filters.date) {
        result = result.filter(j => j.waktuInput && String(j.waktuInput).startsWith(filters.date));
    }
    if (filters.status === 'selesai') {
        result = result.filter(j => j.waktuSelesai && String(j.waktuSelesai).trim() !== '');
    } else if (filters.status === 'belum') {
        result = result.filter(j => !j.waktuSelesai || String(j.waktuSelesai).trim() === '');
    }
    if (filters.urgent) {
        result = result.filter(j => j.urgensi === 'Ya');
    }
    return result;
}

function renderData() {
    const container = document.getElementById('journalContainer');
    container.innerHTML = '';

    // Ganti layout kontainer sesuai tab
    if (currentTab === 'all') {
        container.className = 'flex-1 px-5 mt-6 w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4';
    } else {
        container.className = 'flex-1 px-5 mt-6 w-full max-w-3xl mx-auto space-y-4';
    }

    let filtered = getFilteredJournals();

    filtered = [...filtered].sort((a, b) => {
        if (a.urgensi === 'Ya' && b.urgensi !== 'Ya') return -1;
        if (a.urgensi !== 'Ya' && b.urgensi === 'Ya') return 1;
        if (!a.waktuSelesai && b.waktuSelesai) return -1;
        if (a.waktuSelesai && !b.waktuSelesai) return 1;
        return new Date(b.waktuInput) - new Date(a.waktuInput);
    });

    if (filtered.length === 0) {
        const hasActiveFilter = currentTab === 'all' && (filters.keyword || filters.date || filters.status !== 'semua' || filters.urgent);
        container.className = container.className.replace('grid grid-cols-1 sm:grid-cols-2 gap-4', '') + ' block';
        container.innerHTML = `
            <div class="text-center text-[var(--ink-faint)] mt-10 col-span-full">
                <i class="fas fa-inbox text-5xl opacity-30 mb-3"></i>
                <p>${hasActiveFilter ? 'Tidak ada aktifitas yang cocok dengan filter.' : 'Tidak ada aktifitas.'}</p>
                ${hasActiveFilter ? `<button onclick="resetFilters()" class="mt-3 text-sm font-medium" style="color:var(--accent-dark);">Reset filter</button>` : ''}
            </div>`;
        return;
    }

    filtered.forEach((j, idx) => {
        container.insertAdjacentHTML('beforeend', buildCardHTML(j, idx));
    });
}

function buildCardHTML(j, idx) {
    const isDone = j.waktuSelesai && String(j.waktuSelesai).trim() !== '';
    const isUrgent = j.urgensi === 'Ya';

    // Prioritas warna: Selesai (hijau) > Urgent & belum selesai (amber) > Belum selesai biasa (teal)
    let cardClass = 'card-progress';
    let statusIcon = '<i class="fas fa-spinner fa-spin" style="color:var(--accent);"></i>';

    if (isDone) {
        cardClass = 'card-done';
        statusIcon = '<i class="fas fa-check-circle" style="color:var(--green);"></i>';
    } else if (isUrgent) {
        cardClass = 'card-urgent';
        statusIcon = '<i class="fas fa-exclamation-circle" style="color:var(--amber);"></i>';
    }

    // Label kecil tetap muncul jika aktifitas urgent, walau sudah selesai (kartu tetap hijau)
    const urgentBadge = isUrgent
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style="background:var(--amber-soft); color:var(--amber); border:1px solid var(--amber-border);"><i class="fas fa-bolt"></i>Urgent</span>`
        : '';

    const isChecked = selectedIds.has(j.id) ? 'checked' : '';
    const noteContent = j.catatan ? j.catatan : '';

    const noteHTML = `
        <div class="note-container mt-2 w-full relative z-10">
            <div class="note-display group relative bg-white/60 p-3 rounded-lg border border-transparent hover:border-[var(--accent)] hover:shadow-inner transition-all cursor-text" onclick="inlineEditNote(this, event)">
                <p class="text-sm text-[var(--ink-soft)] whitespace-pre-wrap">${noteContent || '<span class="text-[var(--ink-faint)] italic"><i class="fas fa-pen text-xs mr-1"></i> Klik di sini untuk menambah catatan...</span>'}</p>
                <span class="absolute top-2 right-2 text-[var(--ink-faint)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-pencil-alt text-xs"></i>
                </span>
            </div>
            <div class="note-edit hidden bg-white p-2 rounded-lg border shadow-lg" style="border-color:var(--accent);">
                <textarea class="w-full px-2 py-1 text-sm bg-transparent focus:outline-none resize-none text-[var(--ink-soft)]" rows="3" placeholder="Ketik catatan di sini...">${noteContent}</textarea>
                <div class="flex justify-end space-x-2 mt-2">
                    <button onclick="cancelInlineNote(this, event)" class="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] px-3 py-1 rounded-md transition-colors font-medium">Batal</button>
                    <button onclick="saveInlineNote('${j.id}', this, event)" class="text-xs btn-accent px-4 py-1.5 rounded-md shadow-sm transition-colors font-medium"><i class="fas fa-save mr-1"></i> Simpan</button>
                </div>
            </div>
        </div>
    `;

    const quickActions = `
        <div class="flex flex-wrap gap-2 mt-4 relative z-10 border-t pt-3" style="border-color: rgba(0,0,0,0.06);">
            ${(!j.waktuSelesai || j.waktuSelesai.trim() === '') ?
                `<button onclick="quickMarkDone('${j.id}', event)" class="text-xs text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center" style="background:var(--green);"><i class="fas fa-check mr-1"></i> Selesai</button>`
            :
                `<button onclick="quickUndoDone('${j.id}', event)" class="text-xs bg-gray-400 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center"><i class="fas fa-undo mr-1"></i> Batal Selesai</button>`}

            ${j.urgensi === 'Ya' ?
                `<button onclick="quickToggleUrgent('${j.id}', 'Tidak', event)" class="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center"><i class="fas fa-minus-circle mr-1"></i> Normal</button>`
            :
                `<button onclick="quickToggleUrgent('${j.id}', 'Ya', event)" class="text-xs text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center" style="background:var(--amber);"><i class="fas fa-bolt mr-1"></i> Urgent</button>`}

            <button onclick="editJournal('${j.id}', event)" class="text-xs px-3 py-1.5 rounded-md shadow-sm transition-colors flex-none flex justify-center items-center" style="background:var(--accent-soft); color:var(--accent-dark);" title="Edit Semua Data"><i class="fas fa-edit"></i></button>
        </div>
    `;

    return `
        <div class="activity-card ${cardClass} rounded-2xl p-4 shadow-sm card-enter flex gap-3 relative overflow-hidden" style="animation-delay:${Math.min(idx * 40, 300)}ms">
            <div class="pt-1 relative z-10">
                <input type="checkbox" class="w-5 h-5 rounded border-gray-300 cursor-pointer" style="accent-color: var(--accent);" value="${j.id}" onchange="toggleSelect(this)" ${isChecked}>
            </div>
            <div class="flex-1 w-full min-w-0">
                <div class="flex justify-between items-start gap-2 mb-1">
                    <div class="flex items-center gap-2 min-w-0 flex-wrap">
                        <h4 class="font-display font-semibold text-[var(--ink)] text-lg leading-snug">${j.nama}</h4>
                        ${urgentBadge}
                    </div>
                    <span class="text-lg flex-shrink-0">${statusIcon}</span>
                </div>
                <p class="text-xs text-[var(--ink-soft)] mb-1">
                    <i class="far fa-clock mr-1"></i> Input: ${formatDate(j.waktuInput)}
                </p>
                ${j.waktuSelesai ? `<p class="text-xs font-medium mb-1" style="color:var(--green);"><i class="fas fa-check-double mr-1"></i> Selesai: ${formatDate(j.waktuSelesai)}</p>` : ''}
                ${j.deadline ? `<p class="text-xs font-semibold mt-1" style="color:${new Date(j.deadline) < new Date() && !j.waktuSelesai ? 'var(--danger)' : 'var(--ink-soft)'};"><i class="fas fa-flag-checkered mr-1"></i> Deadline: ${j.deadline}</p>` : ''}

                ${noteHTML}
                ${quickActions}
            </div>
        </div>
    `;
}

// --- MULTIPLE SELECT & DELETE ---
function toggleSelect(checkbox) {
    if (checkbox.checked) selectedIds.add(checkbox.value);
    else selectedIds.delete(checkbox.value);
    updateActionBar();
}

function updateActionBar() {
    const bar = document.getElementById('multiActionBar');
    const count = document.getElementById('selectedCount');
    if (selectedIds.size > 0) {
        count.innerText = `${selectedIds.size} terpilih`;
        bar.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        bar.classList.add('opacity-0', 'pointer-events-none');
    }
}

function clearSelection() {
    selectedIds.clear();
    renderData();
    updateActionBar();
}

async function deleteSelected() {
    const ok = await confirmDialog(`Hapus ${selectedIds.size} aktifitas yang dipilih? Tindakan ini tidak dapat dibatalkan.`, 'Hapus Aktifitas');
    if (!ok) return;

    const idsToDelete = Array.from(selectedIds);
    journals = journals.filter(j => !idsToDelete.includes(j.id));
    clearSelection();
    renderStats();

    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_data', username: currentUser, ids: idsToDelete })
        });
        showToast('Aktifitas berhasil dihapus.', 'success');
    } catch (err) {
        showToast('Gagal menghapus di server.', 'error');
    }
    fetchData();
}

// --- FORM MODAL MULTI-AKTIFITAS & AUTO-SAVE ---
const modal = document.getElementById('formModal');
const modalContent = document.getElementById('modalContent');
const blocksContainer = document.getElementById('activityBlocksContainer');

function nowLocalISO() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function createBlockElement(prefill = {}) {
    blockCounter += 1;
    const blockId = `blk_${Date.now()}_${blockCounter}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'activity-block p-4 card-enter';
    wrapper.dataset.blockId = blockId;

    wrapper.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <span class="block-label font-display text-sm font-semibold" style="color:var(--accent-dark);">Aktifitas</span>
            <button type="button" class="remove-block-btn text-xs text-[var(--ink-faint)] hover:text-[var(--danger)] transition-colors" onclick="removeActivityBlock('${blockId}')" title="Hapus blok ini">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Nama Aktifitas</label>
                <input type="text" class="field-nama w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm" required value="${escapeHtml(prefill.nama || '')}">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Waktu Input</label>
                    <input type="datetime-local" class="field-waktuInput w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm" required value="${prefill.waktuInput || nowLocalISO()}">
                </div>
                <div>
                    <label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Waktu Selesai</label>
                    <input type="datetime-local" class="field-waktuSelesai w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm text-[var(--ink-soft)]" value="${prefill.waktuSelesai || ''}">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Deadline</label>
                    <input type="date" class="field-deadline w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm" value="${prefill.deadline || ''}">
                </div>
                <div>
                    <label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Urgent?</label>
                    <select class="field-urgensi w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm">
                        <option value="Tidak" ${prefill.urgensi === 'Tidak' || !prefill.urgensi ? 'selected' : ''}>Tidak</option>
                        <option value="Ya" ${prefill.urgensi === 'Ya' ? 'selected' : ''}>Ya</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Catatan Tambahan</label>
                <textarea class="field-catatan w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm" rows="2">${escapeHtml(prefill.catatan || '')}</textarea>
            </div>
        </div>
    `;
    return wrapper;
}

function addActivityBlock(prefill = {}) {
    const el = createBlockElement(prefill);
    blocksContainer.appendChild(el);
    renumberBlocks();
    if (!isEditMode) saveDraft();
}

function removeActivityBlock(blockId) {
    const blocks = blocksContainer.querySelectorAll('.activity-block');
    if (blocks.length <= 1) {
        showToast('Minimal harus ada 1 aktifitas.', 'error');
        return;
    }
    const el = blocksContainer.querySelector(`[data-block-id="${blockId}"]`);
    if (el) el.remove();
    renumberBlocks();
    if (!isEditMode) saveDraft();
}

function renumberBlocks() {
    const blocks = blocksContainer.querySelectorAll('.activity-block');
    blocks.forEach((b, i) => {
        b.querySelector('.block-label').innerText = `Aktifitas ${i + 1}`;
        b.querySelector('.remove-block-btn').classList.toggle('invisible', blocks.length <= 1 || isEditMode);
    });
    document.getElementById('addBlockBtn').classList.toggle('hidden', isEditMode);
}

function collectBlockData(blockEl) {
    return {
        nama: blockEl.querySelector('.field-nama').value.trim(),
        waktuInput: blockEl.querySelector('.field-waktuInput').value,
        waktuSelesai: blockEl.querySelector('.field-waktuSelesai').value,
        deadline: blockEl.querySelector('.field-deadline').value,
        urgensi: blockEl.querySelector('.field-urgensi').value,
        catatan: blockEl.querySelector('.field-catatan').value.trim()
    };
}

function gatherAllBlocksData() {
    return Array.from(blocksContainer.querySelectorAll('.activity-block')).map(collectBlockData);
}

// --- AUTOSAVE DRAFT (mendukung multi-aktifitas) ---
function saveDraft() {
    const data = gatherAllBlocksData();
    const hasContent = data.some(d => d.nama || d.catatan);
    if (hasContent) {
        localStorage.setItem(`draft_${currentUser}`, JSON.stringify(data));
    } else {
        localStorage.removeItem(`draft_${currentUser}`);
    }
}

function loadDraft() {
    const raw = localStorage.getItem(`draft_${currentUser}`);
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [data]; // kompatibel dengan draft versi lama (objek tunggal)
    } catch (e) {
        return null;
    }
}

function clearDraft() {
    localStorage.removeItem(`draft_${currentUser}`);
}

function openModal(id = null) {
    document.getElementById('draftAlert').classList.add('hidden');
    document.getElementById('journalId').value = '';
    blocksContainer.innerHTML = '';

    if (id) {
        isEditMode = true;
        document.getElementById('modalTitle').innerText = 'Edit Jurnal';
        const j = journals.find(x => String(x.id) === String(id));

        if (!j) {
            showToast('Data tidak ditemukan.', 'error');
            return;
        }
        document.getElementById('journalId').value = j.id;
        addActivityBlock({
            nama: j.nama, waktuInput: j.waktuInput, waktuSelesai: j.waktuSelesai,
            deadline: j.deadline, urgensi: j.urgensi, catatan: j.catatan
        });
    } else {
        isEditMode = false;
        document.getElementById('modalTitle').innerText = 'Tambah Jurnal';

        const draft = loadDraft();
        if (draft && draft.length > 0) {
            draft.forEach(d => addActivityBlock(d));
            document.getElementById('draftAlert').classList.remove('hidden');
        } else {
            addActivityBlock();
        }
    }

    renumberBlocks();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('translate-y-full', 'sm:translate-y-6', 'opacity-0');
        modalContent.classList.add('modal-pop');
    }, 10);
}

function closeModal() {
    modal.classList.add('opacity-0');
    modalContent.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('hidden');
        modalContent.classList.remove('modal-pop');
    }, 300);
}

function editJournal(id, event) {
    if (event) event.stopPropagation();
    openModal(id);
}

document.getElementById('journalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';
    btn.disabled = true;

    const journalId = document.getElementById('journalId').value;

    try {
        if (journalId) {
            // Mode edit: satu aktifitas
            const payload = collectBlockData(blocksContainer.querySelector('.activity-block'));
            payload.id = journalId;
            await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'save_data', username: currentUser, payload })
            });
            showToast('Aktifitas berhasil diperbarui.', 'success');
        } else {
            // Mode tambah: bisa multi-aktifitas sekaligus
            const payloads = gatherAllBlocksData();
            await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'save_multiple', username: currentUser, payloads })
            });
            showToast(`${payloads.length} aktifitas berhasil ditambahkan.`, 'success');
        }

        clearDraft();
        closeModal();
        fetchData();
    } catch (err) {
        showToast('Gagal menyimpan data. Cek koneksi anda.', 'error');
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
});

// --- HELPER ---
function renderLoading() {
    const skeletonCard = `
        <div class="rounded-2xl p-4 bg-white border border-[var(--line)] flex gap-3">
            <div class="w-5 h-5 rounded skeleton flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
                <div class="h-4 w-2/3 rounded skeleton"></div>
                <div class="h-3 w-1/3 rounded skeleton"></div>
                <div class="h-10 w-full rounded skeleton mt-2"></div>
            </div>
        </div>`;
    document.getElementById('journalContainer').innerHTML = `<div class="space-y-4">${skeletonCard.repeat(3)}</div>`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// --- QUICK ACTIONS ---
async function quickMarkDone(id, event) {
    event.stopPropagation();
    const button = event.currentTarget;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    let journal = journals.find(j => String(j.id) === String(id));

    if (journal) {
        journal.waktuSelesai = nowLocalISO();
        await updateJournalServer(journal);
    } else {
        showToast('Gagal: Data tidak ditemukan.', 'error');
        fetchData();
    }
}

async function quickUndoDone(id, event) {
    event.stopPropagation();
    const button = event.currentTarget;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    let journal = journals.find(j => String(j.id) === String(id));

    if (journal) {
        journal.waktuSelesai = '';
        await updateJournalServer(journal);
    } else {
        showToast('Gagal: Data tidak ditemukan.', 'error');
        fetchData();
    }
}

async function quickToggleUrgent(id, status, event) {
    event.stopPropagation();
    const button = event.currentTarget;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    let journal = journals.find(j => String(j.id) === String(id));

    if (journal) {
        journal.urgensi = status;
        await updateJournalServer(journal);
    } else {
        showToast('Gagal: Data tidak ditemukan.', 'error');
        fetchData();
    }
}

async function updateJournalServer(payload) {
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'save_data', username: currentUser, payload: payload })
        });
        fetchData();
    } catch (err) {
        showToast('Koneksi gagal. Tidak dapat memperbarui status.', 'error');
        fetchData();
    }
}

// --- SISTEM INLINE EDIT CATATAN ---
function inlineEditNote(element, event) {
    if (event) event.stopPropagation();
    const container = element.closest('.note-container');

    container.querySelector('.note-display').classList.add('hidden');
    const editBox = container.querySelector('.note-edit');
    editBox.classList.remove('hidden');

    const textarea = editBox.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function cancelInlineNote(element, event) {
    if (event) event.stopPropagation();
    const container = element.closest('.note-container');

    container.querySelector('.note-display').classList.remove('hidden');
    container.querySelector('.note-edit').classList.add('hidden');
}

async function saveInlineNote(id, btn, event) {
    if (event) event.stopPropagation();
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const container = btn.closest('.note-container');
    const newCatatan = container.querySelector('textarea').value;

    let journal = journals.find(j => String(j.id) === String(id));

    if (journal) {
        journal.catatan = newCatatan;
        await updateJournalServer(journal);
    } else {
        showToast('Gagal menyimpan: Data referensi tidak ditemukan.', 'error');
        btn.innerHTML = 'Simpan';
        btn.disabled = false;
    }
}

// --- FITUR HARD REFRESH ---
async function forceRefresh(btn) {
    const icon = btn.querySelector('i');
    icon.classList.add('fa-spin');
    await fetchData();
    icon.classList.remove('fa-spin');
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const colors = {
        success: { bg: 'var(--accent-dark)', icon: 'fa-circle-check' },
        error: { bg: 'var(--danger)', icon: 'fa-circle-exclamation' },
        info: { bg: '#374151', icon: 'fa-circle-info' }
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.className = 'toast-in pointer-events-auto text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-xs';
    toast.style.background = c.bg;
    toast.innerHTML = `<i class="fas ${c.icon}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-in');
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 220);
    }, 2800);
}

// --- CUSTOM CONFIRM DIALOG ---
let confirmResolver = null;
function confirmDialog(message, title = 'Konfirmasi') {
    const confirmModal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    confirmModal.classList.remove('hidden');

    const yesBtn = document.getElementById('confirmYesBtn');
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    newYesBtn.addEventListener('click', () => resolveConfirm(true));

    return new Promise((resolve) => { confirmResolver = resolve; });
}

function resolveConfirm(result) {
    document.getElementById('confirmModal').classList.add('hidden');
    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
}

// ==========================================================================
// GENERIC POPUP (dipakai oleh: Team journal view, Notifikasi, Request,
// Kirim Pesan, Riwayat Chat, Chat Thread, Ganti Password)
// ==========================================================================
function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showGenericModal(headerHTML, bodyHTML, footerHTML) {
    document.getElementById('genericModalHeader').innerHTML = headerHTML;
    document.getElementById('genericModalBody').innerHTML = bodyHTML;
    const footer = document.getElementById('genericModalFooter');
    if (footerHTML) {
        footer.innerHTML = footerHTML;
        footer.classList.remove('hidden');
    } else {
        footer.innerHTML = '';
        footer.classList.add('hidden');
    }

    const m = document.getElementById('genericModal');
    const c = document.getElementById('genericModalContent');
    m.classList.remove('hidden');
    setTimeout(() => {
        m.classList.remove('opacity-0');
        c.classList.remove('translate-y-full', 'sm:translate-y-6', 'opacity-0');
    }, 10);
}

function closeGenericModal() {
    const m = document.getElementById('genericModal');
    const c = document.getElementById('genericModalContent');
    m.classList.add('opacity-0');
    c.classList.add('translate-y-full');
    setTimeout(() => { m.classList.add('hidden'); }, 300);
}

// ==========================================================================
// HAMBURGER MENU
// ==========================================================================
function toggleHamburgerMenu() {
    document.getElementById('hamburgerMenu').classList.toggle('hidden');
}
function closeHamburgerMenu() {
    document.getElementById('hamburgerMenu').classList.add('hidden');
}

// ==========================================================================
// TAB TEAM — Daftar Anggota
// ==========================================================================
async function fetchAllUsers() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_all_users', username: currentUser }) });
        const result = await res.json();
        allUsers = result.data || [];
    } catch (e) {
        allUsers = [];
    }
}

function avatarColorFor(name) {
    const palette = ['#0E6B5C', '#B45309', '#7C3AED', '#0369A1', '#B3261E', '#166534'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function renderTeamTab() {
    const container = document.getElementById('journalContainer');
    container.className = 'flex-1 px-5 mt-6 w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4';

    if (!allUsers.length) {
        container.className += ' block';
        container.innerHTML = `
            <div class="text-center text-[var(--ink-faint)] mt-10 col-span-full">
                <i class="fas fa-users text-5xl opacity-30 mb-3"></i>
                <p>Belum ada anggota tim lain.</p>
            </div>`;
        return;
    }

    container.innerHTML = allUsers.map((u, idx) => {
        const initials = u.username.slice(0, 2).toUpperCase();
        const color = avatarColorFor(u.username);
        return `
        <div class="activity-card rounded-2xl p-4 shadow-sm bg-white border border-[var(--line)] card-enter" style="animation-delay:${Math.min(idx * 40, 300)}ms">
            <div class="flex items-center gap-3 mb-3 cursor-pointer" onclick="openTeamJournal('${u.username}')">
                <div class="w-11 h-11 rounded-full flex items-center justify-center font-display font-semibold text-white flex-shrink-0" style="background:${color};">${initials}</div>
                <div class="min-w-0">
                    <h4 class="font-display font-semibold text-[var(--ink)] truncate">${escapeHtml(u.username)}</h4>
                    <p class="text-xs text-[var(--ink-soft)]">Anggota Tim &middot; <span class="underline">Lihat jurnal</span></p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="openMessageModal('${u.username}')" class="flex-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors" style="background:var(--accent-soft); color:var(--accent-dark);"><i class="fas fa-comment-dots mr-1"></i>Kirim Pesan</button>
                <button onclick="openRequestModal('${u.username}')" class="flex-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors" style="background:var(--amber-soft); color:var(--amber);"><i class="fas fa-paper-plane mr-1"></i>Request</button>
            </div>
        </div>`;
    }).join('');
}

// ==========================================================================
// LIHAT JURNAL USER LAIN (VIEW-ONLY)
// ==========================================================================
async function openTeamJournal(username) {
    teamViewUser = username;
    teamViewFilters = { keyword: '', date: '', status: 'semua' };

    const headerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-xl font-display font-semibold">Jurnal ${escapeHtml(username)}</h3>
            <button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button>
        </div>
        <div class="relative mb-2">
            <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] text-sm"></i>
            <input type="text" id="teamSearchInput" placeholder="Cari aktifitas atau catatan..." class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[var(--line)] text-sm">
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <input type="date" id="teamFilterDate" class="px-3 py-2 rounded-xl bg-white border border-[var(--line)] text-sm text-[var(--ink-soft)]">
            <select id="teamFilterStatus" class="px-3 py-2 rounded-xl bg-white border border-[var(--line)] text-sm text-[var(--ink-soft)]">
                <option value="semua">Semua Status</option>
                <option value="selesai">Selesai</option>
                <option value="belum">Belum Selesai</option>
            </select>
        </div>
    `;
    showGenericModal(headerHTML, `<div class="text-center text-[var(--ink-faint)] py-10"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`, '');

    document.getElementById('teamSearchInput').addEventListener('input', debounce((e) => { teamViewFilters.keyword = e.target.value.trim().toLowerCase(); renderTeamJournalList(); }, 250));
    document.getElementById('teamFilterDate').addEventListener('change', (e) => { teamViewFilters.date = e.target.value; renderTeamJournalList(); });
    document.getElementById('teamFilterStatus').addEventListener('change', (e) => { teamViewFilters.status = e.target.value; renderTeamJournalList(); });

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_data', username: username }) });
        const result = await res.json();
        teamViewJournals = result.data || [];
        renderTeamJournalList();
    } catch (e) {
        document.getElementById('genericModalBody').innerHTML = `<p class="text-center py-10" style="color:var(--danger);">Gagal memuat jurnal.</p>`;
    }
}

function renderTeamJournalList() {
    let filtered = teamViewJournals;
    if (teamViewFilters.keyword) {
        filtered = filtered.filter(j => (j.nama && j.nama.toLowerCase().includes(teamViewFilters.keyword)) || (j.catatan && j.catatan.toLowerCase().includes(teamViewFilters.keyword)));
    }
    if (teamViewFilters.date) filtered = filtered.filter(j => j.waktuInput && String(j.waktuInput).startsWith(teamViewFilters.date));
    if (teamViewFilters.status === 'selesai') filtered = filtered.filter(j => j.waktuSelesai && String(j.waktuSelesai).trim() !== '');
    else if (teamViewFilters.status === 'belum') filtered = filtered.filter(j => !j.waktuSelesai || String(j.waktuSelesai).trim() === '');

    filtered = [...filtered].sort((a, b) => new Date(b.waktuInput) - new Date(a.waktuInput));

    const body = document.getElementById('genericModalBody');
    if (!filtered.length) {
        body.innerHTML = `<div class="text-center text-[var(--ink-faint)] py-10"><i class="fas fa-inbox text-4xl opacity-30 mb-2"></i><p>Tidak ada aktifitas yang cocok.</p></div>`;
        return;
    }
    body.innerHTML = `<div class="space-y-3 py-3">${filtered.map(j => buildReadOnlyCardHTML(j)).join('')}</div>`;
}

function buildReadOnlyCardHTML(j) {
    const isDone = j.waktuSelesai && String(j.waktuSelesai).trim() !== '';
    const isUrgent = j.urgensi === 'Ya';
    let cardClass = 'card-progress';
    if (isDone) cardClass = 'card-done'; else if (isUrgent) cardClass = 'card-urgent';

    return `
    <div class="rounded-2xl p-4 ${cardClass}">
        <div class="flex justify-between items-start gap-2 mb-1">
            <h4 class="font-display font-semibold text-[var(--ink)]">${escapeHtml(j.nama)}</h4>
            ${isUrgent ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style="background:var(--amber-soft); color:var(--amber); border:1px solid var(--amber-border);"><i class="fas fa-bolt"></i></span>' : ''}
        </div>
        <p class="text-xs text-[var(--ink-soft)]"><i class="far fa-clock mr-1"></i>${formatDate(j.waktuInput)}</p>
        ${j.waktuSelesai ? `<p class="text-xs font-medium mt-0.5" style="color:var(--green);"><i class="fas fa-check-double mr-1"></i>Selesai: ${formatDate(j.waktuSelesai)}</p>` : ''}
        ${j.deadline ? `<p class="text-xs mt-0.5 text-[var(--ink-soft)]"><i class="fas fa-flag-checkered mr-1"></i>Deadline: ${j.deadline}</p>` : ''}
        ${j.catatan ? `<p class="text-sm text-[var(--ink-soft)] mt-2 bg-white/60 p-2 rounded-lg whitespace-pre-wrap">${escapeHtml(j.catatan)}</p>` : ''}
    </div>`;
}

// ==========================================================================
// KIRIM PESAN
// ==========================================================================
function openMessageModal(toUser) {
    const draftKey = `msgDraft_${currentUser}_${toUser}`;
    const draft = localStorage.getItem(draftKey) || '';

    const headerHTML = `<div class="flex justify-between items-center"><h3 class="text-xl font-display font-semibold">Pesan ke ${escapeHtml(toUser)}</h3><button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button></div>`;
    const bodyHTML = `<div class="py-4"><textarea id="newMessageText" rows="6" placeholder="Tulis pesan untuk ${escapeHtml(toUser)}..." class="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm">${escapeHtml(draft)}</textarea></div>`;
    const footerHTML = `<button onclick="submitMessage('${toUser}')" id="submitMessageBtn" class="w-full py-3 btn-accent font-semibold rounded-xl shadow-lg"><i class="fas fa-paper-plane mr-2"></i>Kirim Pesan</button>`;

    showGenericModal(headerHTML, bodyHTML, footerHTML);

    document.getElementById('newMessageText').addEventListener('input', (e) => {
        if (e.target.value.trim()) localStorage.setItem(draftKey, e.target.value);
        else localStorage.removeItem(draftKey);
    });
}

async function submitMessage(toUser) {
    const text = document.getElementById('newMessageText').value.trim();
    if (!text) { showToast('Pesan tidak boleh kosong.', 'error'); return; }

    const btn = document.getElementById('submitMessageBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';
    btn.disabled = true;

    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'send_message', username: currentUser, toUser: toUser, text: text }) });
        localStorage.removeItem(`msgDraft_${currentUser}_${toUser}`);
        showToast(`Pesan terkirim ke ${toUser}.`, 'success');
        closeGenericModal();
    } catch (err) {
        showToast('Gagal mengirim pesan.', 'error');
    }
    btn.innerHTML = original;
    btn.disabled = false;
}

// ==========================================================================
// REQUEST AKTIFITAS (multi-aktifitas seperti form Tambah Jurnal)
// ==========================================================================
function openRequestModal(toUser) {
    requestTargetUser = toUser;

    const headerHTML = `
        <div class="flex justify-between items-center">
            <h3 class="text-xl font-display font-semibold">Request ke ${escapeHtml(toUser)}</h3>
            <button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button>
        </div>
        <p id="requestDraftAlert" class="text-xs mt-2 hidden px-3 py-2 rounded-lg" style="background:var(--amber-soft); color:var(--amber);"><i class="fas fa-info-circle mr-1"></i>Draf request sebelumnya dipulihkan.</p>
    `;
    const bodyHTML = `
        <div id="requestBlocksContainer" class="space-y-4 py-4"></div>
        <button type="button" id="addRequestBlockBtn" onclick="addRequestBlock()" class="w-full py-2.5 rounded-xl border border-dashed border-[var(--accent)] text-[var(--accent-dark)] text-sm font-medium hover:bg-[var(--accent-soft)] transition-colors mb-4">
            <i class="fas fa-plus mr-1"></i>Aktifitas
        </button>`;
    const footerHTML = `<button onclick="submitRequest()" id="submitRequestBtn" class="w-full py-3 btn-accent font-semibold rounded-xl shadow-lg"><i class="fas fa-paper-plane mr-2"></i>Kirim Request</button>`;

    showGenericModal(headerHTML, bodyHTML, footerHTML);
    requestBlocksContainer = document.getElementById('requestBlocksContainer');
    requestBlocksContainer.addEventListener('input', () => saveRequestDraft());

    const draft = loadRequestDraft();
    if (draft && draft.length) {
        draft.forEach(d => addRequestBlock(d));
        document.getElementById('requestDraftAlert').classList.remove('hidden');
    } else {
        addRequestBlock();
    }
}

function addRequestBlock(prefill = {}) {
    const el = createBlockElement(prefill);
    el.querySelector('.remove-block-btn').setAttribute('onclick', `removeRequestBlock('${el.dataset.blockId}')`);
    requestBlocksContainer.appendChild(el);
    renumberContainerBlocks(requestBlocksContainer);
    saveRequestDraft();
}

function removeRequestBlock(blockId) {
    const blocks = requestBlocksContainer.querySelectorAll('.activity-block');
    if (blocks.length <= 1) { showToast('Minimal harus ada 1 aktifitas.', 'error'); return; }
    const el = requestBlocksContainer.querySelector(`[data-block-id="${blockId}"]`);
    if (el) el.remove();
    renumberContainerBlocks(requestBlocksContainer);
    saveRequestDraft();
}

function renumberContainerBlocks(container) {
    const blocks = container.querySelectorAll('.activity-block');
    blocks.forEach((b, i) => {
        b.querySelector('.block-label').innerText = `Aktifitas ${i + 1}`;
        b.querySelector('.remove-block-btn').classList.toggle('invisible', blocks.length <= 1);
    });
}

function gatherContainerBlocksData(container) {
    return Array.from(container.querySelectorAll('.activity-block')).map(collectBlockData);
}

function saveRequestDraft() {
    const data = gatherContainerBlocksData(requestBlocksContainer);
    const hasContent = data.some(d => d.nama || d.catatan);
    const key = `reqDraft_${currentUser}_${requestTargetUser}`;
    if (hasContent) localStorage.setItem(key, JSON.stringify(data));
    else localStorage.removeItem(key);
}

function loadRequestDraft() {
    const key = `reqDraft_${currentUser}_${requestTargetUser}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [data];
    } catch (e) {
        return null;
    }
}

async function submitRequest() {
    const payloads = gatherContainerBlocksData(requestBlocksContainer);
    if (!payloads.every(p => p.nama && p.waktuInput)) {
        showToast('Lengkapi nama & waktu input setiap aktifitas.', 'error');
        return;
    }

    const btn = document.getElementById('submitRequestBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';
    btn.disabled = true;

    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'send_request', username: currentUser, toUser: requestTargetUser, payloads: payloads }) });
        localStorage.removeItem(`reqDraft_${currentUser}_${requestTargetUser}`);
        showToast(`Request berhasil dikirim ke ${requestTargetUser}.`, 'success');
        closeGenericModal();
    } catch (err) {
        showToast('Gagal mengirim request.', 'error');
    }
    btn.innerHTML = original;
    btn.disabled = false;
}

// ==========================================================================
// NOTIFIKASI
// ==========================================================================
function initNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    pollNotifications();
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = setInterval(pollNotifications, 20000);
}

async function pollNotifications() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_notifications', username: currentUser }) });
        const result = await res.json();
        const newList = result.data || [];

        const seenKey = `notifiedKeys_${currentUser}`;
        let seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));

        newList.filter(n => !n.isRead).forEach(n => {
            const key = `${n.type}_${n.id}_${n.count || 1}_${n.status || ''}`;
            if (!seen.has(key)) {
                fireBrowserNotification(n);
                seen.add(key);
            }
        });
        localStorage.setItem(seenKey, JSON.stringify(Array.from(seen)));

        notifications = newList;
        updateNotifBadge();
    } catch (e) {
        // diam, dicoba lagi di polling berikutnya
    }
}

function fireBrowserNotification(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    let title = 'Notifikasi Baru', body = '';
    if (n.type === 'request_incoming') { title = 'Request Aktifitas Baru'; body = `${n.fromUser} mengirim ${n.count} request aktifitas.`; }
    else if (n.type === 'request_result') { title = 'Update Request'; body = n.status === 'accepted' ? `Request Anda diterima oleh ${n.toUser}.` : `Request Anda ditolak oleh ${n.toUser}.`; }
    else if (n.type === 'message') { title = `Pesan dari ${n.fromUser}`; body = n.text; }

    try {
        const notif = new Notification(title, { body: body, icon: './logojurnal2.png' });
        notif.onclick = () => { window.focus(); openNotifications(); };
    } catch (e) { /* abaikan jika browser memblokir */ }
}

function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unreadCount = notifications.filter(n => !n.isRead).length;
    if (unreadCount > 0) {
        badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function openNotifications() {
    closeHamburgerMenu();
    const unreadCount = notifications.filter(n => !n.isRead).length;
    const headerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <h3 class="text-xl font-display font-semibold">Notifikasi</h3>
                <p class="text-xs text-[var(--ink-soft)] mt-0.5">${unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}</p>
            </div>
            <button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button>
        </div>`;

    let bodyHTML;
    if (!notifications.length) {
        bodyHTML = `<div class="text-center text-[var(--ink-faint)] py-10"><i class="fas fa-bell-slash text-4xl opacity-30 mb-2"></i><p>Belum ada notifikasi.</p></div>`;
    } else {
        bodyHTML = `<div class="space-y-2 py-3">${notifications.map(n => buildNotifItemHTML(n)).join('')}</div>`;
    }
    showGenericModal(headerHTML, bodyHTML, '');
}

function buildNotifItemHTML(n) {
    let icon = 'fa-bell', color = '#0E6B5C', bgSoft = '#E3F0EC', title = '', desc = '';
    if (n.type === 'request_incoming') {
        icon = 'fa-paper-plane'; color = '#B45309'; bgSoft = '#FCEEDD';
        title = `Request dari ${n.fromUser}`;
        desc = n.status === 'pending' ? `${n.count} aktifitas menunggu persetujuan` : `${n.count} aktifitas &middot; ${n.status === 'accepted' ? 'sudah diterima' : 'sudah ditolak'}`;
    } else if (n.type === 'request_result') {
        icon = n.status === 'accepted' ? 'fa-check-circle' : 'fa-times-circle';
        color = n.status === 'accepted' ? '#15803D' : '#B3261E';
        bgSoft = n.status === 'accepted' ? '#E7F5EA' : '#FBE9E7';
        title = n.status === 'accepted' ? `Diterima oleh ${n.toUser}` : `Ditolak oleh ${n.toUser}`;
        desc = n.reason ? `Alasan: ${n.reason}` : 'Request Anda telah direspon';
    } else if (n.type === 'message') {
        icon = 'fa-comment-dots'; color = '#0E6B5C'; bgSoft = '#E3F0EC';
        title = `Pesan dari ${n.fromUser}`;
        desc = n.text && n.text.length > 60 ? n.text.slice(0, 60) + '...' : (n.text || '');
    }

    const isRead = !!n.isRead;
    const cardBg = isRead ? '#FFFFFF' : bgSoft;
    const titleClass = isRead ? 'font-medium text-[var(--ink-soft)]' : 'font-semibold text-[var(--ink)]';
    const borderStyle = isRead ? 'border-[var(--line)]' : '';

    return `
    <div class="flex items-start gap-3 p-3 rounded-xl border ${borderStyle} cursor-pointer hover:shadow-sm transition-all" style="background:${cardBg}; ${!isRead ? `border-color:${color};` : ''}" onclick="handleNotifClick('${n.type}','${n.id}')">
        <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:${isRead ? '#F1F0EA' : '#FFFFFF'};">
            <i class="fas ${icon}" style="color:${color};"></i>
        </div>
        <div class="min-w-0 flex-1">
            <p class="text-sm ${titleClass} truncate">${escapeHtml(title)}</p>
            <p class="text-xs text-[var(--ink-soft)] truncate">${escapeHtml(desc)}</p>
            <p class="text-[10px] text-[var(--ink-faint)] mt-1">${formatDate(n.time)}</p>
        </div>
        ${!isRead ? `<span class="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style="background:${color};"></span>` : ''}
    </div>`;
}

async function handleNotifClick(type, id) {
    const notif = notifications.find(n => n.type === type && String(n.id) === String(id));

    if (!notif || !notif.isRead) {
        try {
            await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'mark_notification_read', username: currentUser, notifType: type, notifId: id }) });
        } catch (e) { /* abaikan */ }
    }

    if (type === 'request_incoming') {
        openRequestDetail(id);
    } else if (type === 'request_result') {
        if (notif) showToast(notif.status === 'accepted' ? `Request Anda diterima oleh ${notif.toUser}` : `Request Anda ditolak oleh ${notif.toUser}`, notif.status === 'accepted' ? 'success' : 'error');
    } else if (type === 'message') {
        openChatThread(id.replace('msg_', ''));
    }
    pollNotifications();
}

// ==========================================================================
// DETAIL & PERSETUJUAN REQUEST
// ==========================================================================
async function openRequestDetail(requestId) {
    const headerHTML = `<div class="flex justify-between items-center"><h3 class="text-xl font-display font-semibold">Detail Request</h3><button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button></div>`;
    showGenericModal(headerHTML, `<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`, '');

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_request_detail', requestId: requestId }) });
        const result = await res.json();
        if (!result.success) { showToast(result.message, 'error'); closeGenericModal(); return; }
        const req = result.data;

        const activitiesHTML = (req.activities || []).map(a => `
            <div class="rounded-xl p-3 border border-[var(--line)] bg-white mb-2">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="font-display font-semibold text-[var(--ink)]">${escapeHtml(a.nama)}</h4>
                    ${a.urgensi === 'Ya' ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style="background:var(--amber-soft);color:var(--amber);"><i class="fas fa-bolt"></i> Urgent</span>' : ''}
                </div>
                <p class="text-xs text-[var(--ink-soft)] mt-1"><i class="far fa-clock mr-1"></i>${formatDate(a.waktuInput)}</p>
                ${a.deadline ? `<p class="text-xs text-[var(--ink-soft)]"><i class="fas fa-flag-checkered mr-1"></i>Deadline: ${a.deadline}</p>` : ''}
                ${a.catatan ? `<p class="text-sm text-[var(--ink-soft)] mt-2 bg-[var(--paper)] p-2 rounded-lg whitespace-pre-wrap">${escapeHtml(a.catatan)}</p>` : ''}
            </div>`).join('');

        document.getElementById('genericModalBody').innerHTML = `
            <p class="text-sm text-[var(--ink-soft)] mb-3 py-1">Dari <b class="text-[var(--ink)]">${escapeHtml(req.fromUser)}</b> &middot; ${formatDate(req.sentAt)}</p>
            ${activitiesHTML}
        `;

        const footer = document.getElementById('genericModalFooter');
        if (req.status === 'pending') {
            footer.classList.remove('hidden');
            footer.innerHTML = `
                <div class="space-y-2">
                    <button onclick="approveRequest('${req.id}')" class="w-full py-3 rounded-xl text-white font-semibold" style="background:var(--green);"><i class="fas fa-check mr-2"></i>Terima Request</button>
                    <button onclick="openRejectReason('${req.id}')" class="w-full py-3 rounded-xl font-semibold border" style="border-color:var(--danger); color:var(--danger);"><i class="fas fa-times mr-2"></i>Tolak Request</button>
                </div>`;
        } else {
            footer.classList.add('hidden');
            footer.innerHTML = '';
        }
    } catch (e) {
        showToast('Gagal memuat detail request.', 'error');
    }
}

async function approveRequest(requestId) {
    const ok = await confirmDialog('Apakah yakin menambahkan request ini ke jurnal?', 'Terima Request');
    if (!ok) return;

    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'respond_request', requestId: requestId, responseAction: 'accept' }) });
        showToast('Request diterima dan ditambahkan ke jurnal.', 'success');
        closeGenericModal();
        fetchData();
        pollNotifications();
    } catch (e) {
        showToast('Gagal memproses request.', 'error');
    }
}

function openRejectReason(requestId) {
    const headerHTML = `<div class="flex justify-between items-center"><h3 class="text-xl font-display font-semibold">Alasan Penolakan</h3><button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button></div>`;
    const bodyHTML = `<div class="py-4"><p class="text-xs text-[var(--ink-soft)] mb-2">Opsional — beri tahu alasan Anda menolak request ini.</p><textarea id="rejectReasonText" rows="4" class="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm" placeholder="Contoh: waktu sudah terisi aktifitas lain..."></textarea></div>`;
    const footerHTML = `<button onclick="rejectRequest('${requestId}')" class="w-full py-3 rounded-xl text-white font-semibold" style="background:var(--danger);"><i class="fas fa-times-circle mr-2"></i>Tolak Request</button>`;
    showGenericModal(headerHTML, bodyHTML, footerHTML);
}

async function rejectRequest(requestId) {
    const reason = document.getElementById('rejectReasonText').value.trim();
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'respond_request', requestId: requestId, responseAction: 'reject', reason: reason }) });
        showToast('Request ditolak.', 'info');
        closeGenericModal();
        pollNotifications();
    } catch (e) {
        showToast('Gagal menolak request.', 'error');
    }
}

// ==========================================================================
// RIWAYAT CHAT & THREAD PESAN
// ==========================================================================
async function openChatHistory() {
    closeHamburgerMenu();
    const headerHTML = `<div class="flex justify-between items-center"><h3 class="text-xl font-display font-semibold">Riwayat Chat</h3><button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button></div>`;
    showGenericModal(headerHTML, `<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`, '');

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_chat_contacts', username: currentUser }) });
        const result = await res.json();
        chatContacts = result.data || [];
        renderChatContacts();
    } catch (e) {
        document.getElementById('genericModalBody').innerHTML = `<p class="text-center py-10" style="color:var(--danger);">Gagal memuat riwayat chat.</p>`;
    }
}

function renderChatContacts() {
    const body = document.getElementById('genericModalBody');
    if (!chatContacts.length) {
        body.innerHTML = `<div class="text-center text-[var(--ink-faint)] py-10"><i class="fas fa-comments text-4xl opacity-30 mb-2"></i><p>Belum ada riwayat chat.</p></div>`;
        return;
    }
    body.innerHTML = `<div class="space-y-2 py-3">${chatContacts.map(c => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-white border border-[var(--line)] cursor-pointer hover:shadow-sm transition-all" onclick="openChatThread('${c.username}')">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-display font-semibold text-white flex-shrink-0" style="background:${avatarColorFor(c.username)};">${c.username.slice(0, 2).toUpperCase()}</div>
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-[var(--ink)] truncate">${escapeHtml(c.username)}</p>
                <p class="text-xs text-[var(--ink-soft)] truncate">${escapeHtml(c.lastText || '')}</p>
            </div>
            ${c.unread ? `<span class="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0" style="background:var(--amber);">${c.unread}</span>` : ''}
        </div>`).join('')}</div>`;
}

async function openChatThread(otherUser) {
    currentChatUser = otherUser;
    chatThreadFilters = { date: '', keyword: '' };

    const headerHTML = `
        <div class="flex justify-between items-center mb-3">
            <div class="flex items-center gap-2 min-w-0">
                <button onclick="openChatHistory()" class="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-arrow-left"></i></button>
                <h3 class="text-lg font-display font-semibold truncate">${escapeHtml(otherUser)}</h3>
            </div>
            <button onclick="closeGenericModal()" class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button>
        </div>
        <div class="flex gap-2">
            <input type="date" id="chatFilterDate" class="px-3 py-2 rounded-xl bg-white border border-[var(--line)] text-xs flex-1 min-w-0">
            <input type="text" id="chatFilterKeyword" placeholder="Cari pesan..." class="px-3 py-2 rounded-xl bg-white border border-[var(--line)] text-xs flex-1 min-w-0">
        </div>
    `;
    const footerHTML = `
        <div class="flex gap-2 items-end">
            <textarea id="chatReplyText" rows="1" placeholder="Tulis balasan..." class="flex-1 px-3 py-2.5 rounded-xl border border-[var(--line)] bg-white text-sm resize-none"></textarea>
            <button onclick="sendChatReply()" class="w-11 h-11 flex-shrink-0 btn-accent rounded-xl flex items-center justify-center"><i class="fas fa-paper-plane"></i></button>
        </div>`;

    showGenericModal(headerHTML, `<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`, footerHTML);

    document.getElementById('chatFilterDate').addEventListener('change', (e) => { chatThreadFilters.date = e.target.value; renderChatThread(); });
    document.getElementById('chatFilterKeyword').addEventListener('input', debounce((e) => { chatThreadFilters.keyword = e.target.value.trim().toLowerCase(); renderChatThread(); }, 250));

    const draftKey = `chatDraft_${currentUser}_${otherUser}`;
    const draft = localStorage.getItem(draftKey);
    const replyBox = document.getElementById('chatReplyText');
    if (draft) replyBox.value = draft;
    replyBox.addEventListener('input', (e) => {
        if (e.target.value.trim()) localStorage.setItem(draftKey, e.target.value);
        else localStorage.removeItem(draftKey);
    });

    try { await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'mark_messages_read', username: currentUser, otherUser: otherUser }) }); } catch (e) { }

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_chat_thread', username: currentUser, otherUser: otherUser }) });
        const result = await res.json();
        chatThreadMessages = result.data || [];
        renderChatThread();
    } catch (e) {
        document.getElementById('genericModalBody').innerHTML = `<p class="text-center py-10" style="color:var(--danger);">Gagal memuat pesan.</p>`;
    }

    pollNotifications();
}

function renderChatThread() {
    let filtered = chatThreadMessages;
    if (chatThreadFilters.date) filtered = filtered.filter(m => m.waktu && String(m.waktu).startsWith(chatThreadFilters.date));
    if (chatThreadFilters.keyword) filtered = filtered.filter(m => m.text && m.text.toLowerCase().includes(chatThreadFilters.keyword));

    const body = document.getElementById('genericModalBody');
    if (!filtered.length) {
        body.innerHTML = `<div class="text-center text-[var(--ink-faint)] py-10"><i class="fas fa-comment-slash text-4xl opacity-30 mb-2"></i><p>Belum ada pesan.</p></div>`;
        return;
    }
    body.innerHTML = `<div class="space-y-3 py-3">${filtered.map(m => {
        const mine = m.from === currentUser;
        return `<div class="flex ${mine ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${mine ? 'text-white rounded-br-md' : 'bg-white border border-[var(--line)] rounded-bl-md'}" style="${mine ? 'background:var(--accent);' : ''}">
                <p class="whitespace-pre-wrap">${escapeHtml(m.text)}</p>
                <p class="text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-[var(--ink-faint)]'}">${formatDate(m.waktu)}</p>
            </div>
        </div>`;
    }).join('')}</div>`;
    body.scrollTop = body.scrollHeight;
}

async function sendChatReply() {
    const box = document.getElementById('chatReplyText');
    const text = box.value.trim();
    if (!text) return;
    box.value = '';
    localStorage.removeItem(`chatDraft_${currentUser}_${currentChatUser}`);

    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'send_message', username: currentUser, toUser: currentChatUser, text: text }) });
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_chat_thread', username: currentUser, otherUser: currentChatUser }) });
        const result = await res.json();
        chatThreadMessages = result.data || [];
        renderChatThread();
    } catch (e) {
        showToast('Gagal mengirim balasan.', 'error');
    }
}

// ==========================================================================
// GANTI PASSWORD
// ==========================================================================
function openChangePassword() {
    closeHamburgerMenu();
    const headerHTML = `<div class="flex justify-between items-center"><h3 class="text-xl font-display font-semibold">Ganti Password</h3><button onclick="closeGenericModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[var(--ink-soft)]"><i class="fas fa-times"></i></button></div>`;
    const bodyHTML = `
        <div class="space-y-3 py-4">
            <div><label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Password Lama</label><input type="password" id="oldPassword" autocomplete="current-password" class="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm"></div>
            <div><label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Password Baru</label><input type="password" id="newPassword" autocomplete="new-password" class="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm"></div>
            <div><label class="block text-xs font-medium text-[var(--ink-soft)] mb-1">Konfirmasi Password Baru</label><input type="password" id="confirmPassword" autocomplete="new-password" class="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-sm"></div>
        </div>`;
    const footerHTML = `<button onclick="submitChangePassword()" id="submitPasswordBtn" class="w-full py-3 btn-accent font-semibold rounded-xl shadow-lg">Simpan Password</button>`;
    showGenericModal(headerHTML, bodyHTML, footerHTML);
}

async function submitChangePassword() {
    const oldP = document.getElementById('oldPassword').value;
    const newP = document.getElementById('newPassword').value;
    const confP = document.getElementById('confirmPassword').value;
    if (!oldP || !newP || !confP) { showToast('Lengkapi semua kolom.', 'error'); return; }
    if (newP !== confP) { showToast('Konfirmasi password baru tidak cocok.', 'error'); return; }
    if (newP.length < 4) { showToast('Password baru minimal 4 karakter.', 'error'); return; }

    const btn = document.getElementById('submitPasswordBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';
    btn.disabled = true;

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'change_password', username: currentUser, oldPassword: oldP, newPassword: newP }) });
        const result = await res.json();
        if (result.success) { showToast('Password berhasil diubah.', 'success'); closeGenericModal(); }
        else { showToast(result.message || 'Gagal mengubah password.', 'error'); }
    } catch (e) {
        showToast('Gagal terhubung ke server.', 'error');
    }
    btn.innerHTML = original;
    btn.disabled = false;
}
