// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxe4bUNd9iEakKnYJsgbDG-3xVXVGq72hd8a2e4WAh4WOs-n1Csh9trcb9S-RZdjNokww/exec'; 

let currentUser = localStorage.getItem('loggedUser');
let journals = [];
let currentTab = 'today';
let selectedIds = new Set();

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showDashboard();
        fetchData();
    }
    
    // Fitur Auto-Save Form ke LocalStorage
    const form = document.getElementById('journalForm');
    form.addEventListener('input', () => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        localStorage.setItem(`draft_${currentUser}`, JSON.stringify(data));
    });
});

// --- SISTEM LOGIN ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
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
        alert("Gagal terhubung ke server.");
    }
    btn.innerHTML = 'Login';
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
        journals = result.data;
        renderData();
    } catch (err) {
        document.getElementById('journalContainer').innerHTML = '<p class="text-center text-red-500">Gagal memuat data.</p>';
    }
}

function switchTab(tab) {
    currentTab = tab;
    // Styling Tab Actives
    ['today', 'all', 'urgent'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (t === tab) {
            el.className = 'flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow text-blue-600 transition-all';
        } else {
            el.className = 'flex-1 py-2 text-sm font-semibold rounded-lg text-gray-500 hover:text-gray-700 transition-all';
        }
    });
    renderData();
}

function renderData() {
    const container = document.getElementById('journalContainer');
    container.innerHTML = '';
    
    let filtered = journals;
    const todayStr = new Date().toISOString().split('T')[0];

    if (currentTab === 'today') filtered = journals.filter(j => j.waktuInput.startsWith(todayStr));
    else if (currentTab === 'urgent') filtered = journals.filter(j => j.urgensi === 'Ya');

    filtered.sort((a, b) => {
        if (a.urgensi === 'Ya' && b.urgensi !== 'Ya') return -1;
        if (a.urgensi !== 'Ya' && b.urgensi === 'Ya') return 1;
        if (!a.waktuSelesai && b.waktuSelesai) return -1;
        if (a.waktuSelesai && !b.waktuSelesai) return 1;
        return new Date(b.waktuInput) - new Date(a.waktuInput);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 mt-10"><i class="fas fa-inbox text-5xl opacity-30 mb-3"></i><p>Tidak ada aktifitas.</p></div>`;
        return;
    }

    filtered.forEach(j => {
        let cardClass = 'card-progress'; 
        let statusIcon = '<i class="fas fa-spinner fa-spin text-blue-500"></i>';
        
        if (j.urgensi === 'Ya') {
            cardClass = 'card-urgent'; 
            statusIcon = '<i class="fas fa-exclamation-circle text-yellow-500"></i>';
        } else if (j.waktuSelesai && j.waktuSelesai.trim() !== '') {
            cardClass = 'card-done'; 
            statusIcon = '<i class="fas fa-check-circle text-green-500"></i>';
        }

        const isChecked = selectedIds.has(j.id) ? 'checked' : '';
        const noteContent = j.catatan ? j.catatan : '';

        // --- FITUR 1: BLOK CATATAN INLINE EDIT ---
        const noteHTML = `
            <div class="note-container mt-2 w-full relative z-10"> <!-- Tambahkan 'note-container' di sini -->
                <!-- Mode Tampil -->
                <div class="note-display group relative bg-white/60 p-3 rounded-lg border border-transparent hover:border-blue-300 hover:shadow-inner transition-all cursor-text" onclick="inlineEditNote(this, event)">
                    <p class="text-sm text-gray-700 whitespace-pre-wrap">${noteContent || '<span class="text-gray-400 italic"><i class="fas fa-pen text-xs mr-1"></i> Klik di sini untuk menambah catatan...</span>'}</p>
                    <span class="absolute top-2 right-2 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i class="fas fa-pencil-alt text-xs"></i>
                    </span>
                </div>
                
                <!-- Mode Edit -->
                <div class="note-edit hidden bg-white p-2 rounded-lg border border-blue-400 shadow-lg">
                    <textarea class="w-full px-2 py-1 text-sm bg-transparent focus:outline-none resize-none text-gray-700" rows="3" placeholder="Ketik catatan di sini...">${noteContent}</textarea>
                    <div class="flex justify-end space-x-2 mt-2">
                        <button onclick="cancelInlineNote(this, event)" class="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md transition-colors font-medium">Batal</button>
                        <button onclick="saveInlineNote('${j.id}', this, event)" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md shadow-sm transition-colors font-medium"><i class="fas fa-save mr-1"></i> Simpan</button>
                    </div>
                </div>
            </div>
        `;

        // --- FITUR 2: TOMBOL QUICK ACTIONS & TOMBOL FULL EDIT ---
        const quickActions = `
            <div class="flex space-x-2 mt-4 relative z-10 border-t border-gray-200/50 pt-3">
                ${(!j.waktuSelesai || j.waktuSelesai.trim() === '') ? 
                    `<button onclick="quickMarkDone('${j.id}', event)" class="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center"><i class="fas fa-check mr-1"></i> Selesai</button>` 
                : 
                    `<button onclick="quickUndoDone('${j.id}', event)" class="text-xs bg-gray-400 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center"><i class="fas fa-undo mr-1"></i> Batal Selesai</button>`}
                
                ${j.urgensi === 'Ya' ? 
                    `<button onclick="quickToggleUrgent('${j.id}', 'Tidak', event)" class="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center"><i class="fas fa-minus-circle mr-1"></i> Normal</button>`
                : 
                    `<button onclick="quickToggleUrgent('${j.id}', 'Ya', event)" class="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-md shadow-sm transition-colors flex-1 flex justify-center items-center"><i class="fas fa-bolt mr-1"></i> Urgent</button>`}
                
                <!-- Tombol Full Edit (Membuka Form Utama) -->
                <button onclick="editJournal('${j.id}', event)" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-md shadow-sm transition-colors flex-none flex justify-center items-center tooltip" title="Edit Semua Data"><i class="fas fa-edit"></i></button>
            </div>
        `;

        const card = `
            <div class="${cardClass} rounded-xl p-4 shadow-sm card-enter flex gap-3 relative overflow-hidden transition-all hover:shadow-md">
                <div class="pt-1 relative z-10">
                    <input type="checkbox" class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" value="${j.id}" onchange="toggleSelect(this)" ${isChecked}>
                </div>
                <div class="flex-1 w-full">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-semibold text-gray-800 text-lg">${j.nama}</h4>
                        <span class="text-lg">${statusIcon}</span>
                    </div>
                    <p class="text-xs text-gray-500 mb-1">
                        <i class="far fa-clock mr-1"></i> Input: ${formatDate(j.waktuInput)} 
                    </p>
                    ${j.waktuSelesai ? `<p class="text-xs text-green-600 font-medium mb-1"><i class="fas fa-check-double mr-1"></i> Selesai: ${formatDate(j.waktuSelesai)}</p>` : ''}
                    ${j.deadline ? `<p class="text-xs font-semibold mt-1 ${new Date(j.deadline) < new Date() && !j.waktuSelesai ? 'text-red-500' : 'text-gray-500'}"><i class="fas fa-flag-checkered mr-1"></i> Deadline: ${j.deadline}</p>` : ''}
                    
                    ${noteHTML}
                    ${quickActions}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', card);
    });
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
        bar.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-4');
    } else {
        bar.classList.add('opacity-0', 'pointer-events-none', '-translate-y-4');
    }
}

function clearSelection() {
    selectedIds.clear();
    renderData();
    updateActionBar();
}

async function deleteSelected() {
    if (!confirm('Hapus aktifitas yang dipilih?')) return;
    
    const idsToDelete = Array.from(selectedIds);
    // Optimistic UI update
    journals = journals.filter(j => !idsToDelete.includes(j.id));
    clearSelection();
    
    await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_data', username: currentUser, ids: idsToDelete })
    });
    fetchData(); // Refresh to sync
}

// --- FORM MODAL & AUTO-SAVE ---
const modal = document.getElementById('formModal');
const modalContent = document.getElementById('modalContent');

function openModal(id = null) {
    document.getElementById('journalForm').reset();
    document.getElementById('draftAlert').classList.add('hidden');
    document.getElementById('journalId').value = '';

    if (id) {
        document.getElementById('modalTitle').innerText = 'Edit Jurnal';
        const j = journals.find(x => x.id === id);
        document.getElementById('journalId').value = j.id;
        document.getElementById('nama').value = j.nama;
        document.getElementById('waktuInput').value = j.waktuInput;
        document.getElementById('waktuSelesai').value = j.waktuSelesai;
        document.getElementById('urgensi').value = j.urgensi;
        document.getElementById('deadline').value = j.deadline;
        document.getElementById('catatan').value = j.catatan;
    } else {
        document.getElementById('modalTitle').innerText = 'Tambah Jurnal';
        document.getElementById('waktuInput').value = new Date().toISOString().slice(0, 16);
        
        // Cek draf Auto-Save
        const draft = localStorage.getItem(`draft_${currentUser}`);
        if (draft) {
            const data = JSON.parse(draft);
            if (Object.keys(data).length > 0 && !data.id) {
                document.getElementById('draftAlert').classList.remove('hidden');
                document.getElementById('nama').value = data.nama || '';
                document.getElementById('catatan').value = data.catatan || '';
                if(data.urgensi) document.getElementById('urgensi').value = data.urgensi;
            }
        }
    }

    modal.classList.remove('hidden');
    // Timeout sedikit untuk memicu transisi CSS
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('translate-y-full');
    }, 10);
}

function closeModal() {
    modal.classList.add('opacity-0');
    modalContent.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function editJournal(id, event) {
    if (event) event.stopPropagation(); // Mencegah bentrok dengan element lain
    openModal(id);
}

document.getElementById('journalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';
    
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'save_data', username: currentUser, payload: payload })
        });
        
        // Hapus draf jika sukses
        localStorage.removeItem(`draft_${currentUser}`);
        closeModal();
        fetchData();
    } catch (err) {
        alert("Gagal menyimpan data.");
    }
    btn.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan Aktifitas';
});

// --- HELPER ---
function renderLoading() {
    document.getElementById('journalContainer').innerHTML = '<div class="text-center text-gray-400 mt-10"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-2">Memuat data...</p></div>';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// --- QUICK ACTIONS ---

// Fitur 1: Tandai Selesai (Set tanggal selesai ke waktu saat ini)
async function quickMarkDone(id, event) {
    event.stopPropagation(); // Mencegah modal edit ikut terbuka
    const button = event.currentTarget;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Animasi loading
    
    let journal = journals.find(j => j.id === id);
    
    // Mengambil waktu lokal saat tombol diklik dan format ke YYYY-MM-DDTHH:mm
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    journal.waktuSelesai = now.toISOString().slice(0, 16);
    
    await updateJournalServer(journal);
}

// Fitur 2: Batal Selesai (Menghapus tanggal selesai)
async function quickUndoDone(id, event) {
    event.stopPropagation();
    const button = event.currentTarget;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    let journal = journals.find(j => j.id === id);
    journal.waktuSelesai = ''; // Kosongkan waktu selesai
    
    await updateJournalServer(journal);
}

// Fitur 3: Toggle Urgensi (Ubah status jadi Ya/Tidak)
async function quickToggleUrgent(id, status, event) {
    event.stopPropagation();
    const button = event.currentTarget;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    let journal = journals.find(j => j.id === id);
    journal.urgensi = status;
    
    await updateJournalServer(journal);
}

// Fungsi utama penembak API khusus Quick Action
async function updateJournalServer(payload) {
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'save_data', username: currentUser, payload: payload })
        });
        fetchData(); // Refresh UI langsung setelah spreadsheet di update
    } catch (err) {
        alert("Koneksi gagal. Tidak dapat memperbarui status.");
        fetchData(); // Kembalikan ke state semula jika error
    }
}

// --- SISTEM INLINE EDIT CATATAN ---

// Membuka mode textarea
function inlineEditNote(element, event) {
    if(event) event.stopPropagation();
    const container = element.closest('.note-container'); // Ubah di sini
    
    container.querySelector('.note-display').classList.add('hidden');
    const editBox = container.querySelector('.note-edit');
    editBox.classList.remove('hidden');
    
    const textarea = editBox.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// Menutup mode textarea tanpa save (TOMBOL BATAL)
function cancelInlineNote(element, event) {
    if(event) event.stopPropagation();
    const container = element.closest('.note-container'); // Ubah di sini
    
    container.querySelector('.note-display').classList.remove('hidden');
    container.querySelector('.note-edit').classList.add('hidden');
}

// Menyimpan catatan
async function saveInlineNote(id, btn, event) {
    if(event) event.stopPropagation();
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;
    
    const container = btn.closest('.note-container'); // Ubah di sini
    const newCatatan = container.querySelector('textarea').value;

    let journal = journals.find(j => j.id === id);
    journal.catatan = newCatatan;
    
    await updateJournalServer(journal);
}