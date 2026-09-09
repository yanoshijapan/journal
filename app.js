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

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
    setTodayLabel();
    if (currentUser) {
        showDashboard();
        fetchData();
    }

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
    ['today', 'all', 'urgent'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        el.classList.toggle('active', t === tab);
    });

    const filterBar = document.getElementById('filterBar');
    if (tab === 'all') filterBar.classList.remove('hidden');
    else filterBar.classList.add('hidden');

    renderData();
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
    if (currentTab === 'urgent') {
        return journals.filter(j => j.urgensi === 'Ya');
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

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
