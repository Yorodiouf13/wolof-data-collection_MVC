let currentData = { admins: [], users: [], audios: [] };

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    const exportBtn = document.getElementById('exportDatasetBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDataset);
    }
});

function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    btn.classList.add('active');
}

async function loadData() {
    try {
        const [admins, users, audios] = await Promise.all([
            fetch('superadmin-get-admins').then(r => r.json()),
            fetch('superadmin-get-users').then(r => r.json()),
            fetch('superadmin-get-audios').then(r => r.json())
        ]);
        currentData = { admins, users, audios };
        renderAdmins();
        renderUsers();
        renderAudios();
    } catch (error) {
        console.error('Erreur chargement données:', error);
    }
}

/* =================== ADMINS =================== */

function renderAdmins(data) {
    const list = data || currentData.admins;
    const tbody = document.getElementById('adminsBody');
    const noData = document.getElementById('adminsNoData');
    tbody.innerHTML = '';

    if (list.length === 0) {
        noData.style.display = 'block';
        return;
    }
    noData.style.display = 'none';

    list.forEach(admin => {
        const pwd = admin.temp_password || '';
        const pwdCell = pwd
            ? `<div class="pwd-cell">
                <span class="pwd-code" title="${pwd}">${pwd}</span>
                <button class="copy-btn-sm" onclick="copyToClipboard('${pwd}')">Copier</button>
               </div>`
            : `<span style="color:#ccc;font-size:12px;">—</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escHtml(admin.name)}</strong></td>
            <td>${escHtml(admin.email)}</td>
            <td><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">${escHtml(admin.username)}</code></td>
            <td><span class="role-badge">${escHtml(admin.role || 'validator')}</span></td>
            <td>${pwdCell}</td>
            <td>${fmtDate(admin.created_at)}</td>
            <td>
                <button class="btn-edit" onclick="openEditAdminModal('${admin.id}')">Éditer</button>
                <button class="btn-delete" onclick="deleteAdminConfirm('${admin.id}', '${escHtml(admin.name)}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterAdmins() {
    const q = document.getElementById('searchAdmins').value.toLowerCase();
    const roleFilter = document.getElementById('filterAdminRole').value;
    const filtered = currentData.admins.filter(a => {
        const matchesText =
            (a.name || '').toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q) ||
            (a.username || '').toLowerCase().includes(q);
        const matchesRole = !roleFilter || (a.role || '').toLowerCase() === roleFilter;
        return matchesText && matchesRole;
    });
    renderAdmins(filtered);
}

function openCreateAdminModal() {
    document.getElementById('createAdminModal').classList.add('show');
    document.getElementById('createAdminForm').style.display = 'block';
    document.getElementById('tempPasswordMsg').style.display = 'none';
    document.getElementById('createAdminForm').reset();
}

function closeCreateAdminModal() {
    document.getElementById('createAdminModal').classList.remove('show');
}

async function submitCreateAdmin(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('adminName').value);
    formData.append('email', document.getElementById('adminEmail').value);
    formData.append('username', document.getElementById('adminUsername').value);
    formData.append('role', document.getElementById('adminRole').value);

    try {
        const response = await fetch('superadmin-create-admin', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            document.getElementById('tempPasswordValue').textContent = data.temp_password;
            document.getElementById('tempPasswordMsg').style.display = 'block';
            document.getElementById('createAdminForm').style.display = 'none';

            // Recharger après 5 secondes
                loadData();
                closeCreateAdminModal();

        } else {
            showMessage('adminsMessage', data.error || 'Erreur création', 'error');
        }
    } catch (error) {
        showMessage('adminsMessage', 'Erreur réseau', 'error');
    }
}

function openEditAdminModal(adminId) {
    const admin = currentData.admins.find(a => a.id === adminId);
    if (!admin) return;
    
    document.getElementById('editAdminModal').classList.add('show');
    document.getElementById('editAdminId').value = adminId;
    document.getElementById('editAdminName').value = admin.name || '';
    document.getElementById('editAdminEmail').value = admin.email || '';
    document.getElementById('editAdminRole').value = admin.role || 'validator';

    // Permissions
    const perms = (admin.permissions || '').split(',').map(p => p.trim()).filter(Boolean);
    document.querySelectorAll('#editAdminForm input[type="checkbox"]').forEach(cb => {
        cb.checked = perms.includes(cb.value);
    });

}

function closeEditAdminModal() {
    document.getElementById('editAdminModal').classList.remove('show');
}

async function submitEditAdmin(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('id', document.getElementById('editAdminId').value);
    formData.append('name', document.getElementById('editAdminName').value);
    formData.append('email', document.getElementById('editAdminEmail').value);
    formData.append('role', document.getElementById('editAdminRole').value);

    const checkedPerms = Array.from(document.querySelectorAll('#editAdminForm input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    formData.append('permissions', checkedPerms.join(','));

    try {
        const response = await fetch('superadmin-update-admin', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showMessage('adminsMessage', 'Admin mis à jour avec succès', 'success');
            loadData();
            closeEditAdminModal();
        } else {
            showMessage('adminsMessage', data.error || 'Erreur mise à jour', 'error');
        }
    } catch (error) {
        showMessage('adminsMessage', 'Erreur réseau', 'error');
    }
}

async function deleteAdminConfirm(adminId, adminName) {
    const confirmed = await confirmPopup(`Supprimer l'admin "${adminName}" ?<br><small>Cette action est irréversible.</small>`);
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('id', adminId);

    try {
        const response = await fetch('superadmin-delete-admin', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showMessage('adminsMessage', 'Admin supprimé', 'success');
            loadData();
        } else {
            showMessage('adminsMessage', data.error || 'Erreur suppression', 'error');
        }
    } catch (error) {
        showMessage('adminsMessage', 'Erreur réseau', 'error');
    }
}

/* =================== USERS =================== */

function renderUsers(data) {
    const list = data || currentData.users;
    const tbody = document.getElementById('usersBody');
    const noData = document.getElementById('usersNoData');
    tbody.innerHTML = '';

    if (list.length === 0) {
        noData.style.display = 'block';
        return;
    }
    noData.style.display = 'none';

    list.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escHtml(user.name || '—')}</strong></td>
            <td>${escHtml(user.email || '—')}</td>
            <td><code style="font-size:12px;color:#888;">${escHtml(user.uploader_ref || '—')}</code></td>
            <td>${fmtDate(user.created_at)}</td>
            <td>
                <button class="btn-delete" onclick="deleteUserConfirm('${user.id}', '${escHtml(user.name || '')}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterUsers() {
    const q = document.getElementById('searchUsers').value.toLowerCase();
    const filtered = currentData.users.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.uploader_ref || '').toLowerCase().includes(q)
    );
    renderUsers(filtered);
}

async function deleteUserConfirm(userId, userName) {
    const confirmed = await confirmPopup(`Supprimer l'utilisateur "${userName}" ?<br><small>Cette action est irréversible.</small>`);
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('id', userId);

    try {
        const response = await fetch('superadmin-delete-user', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showMessage('usersMessage', 'Utilisateur supprimé', 'success');
            loadData();
        } else {
            showMessage('usersMessage', data.error || 'Erreur suppression', 'error');
        }
    } catch (error) {
        showMessage('usersMessage', 'Erreur réseau', 'error');
    }
}

/* =================== AUDIOS =================== */

const STATUS_LABELS = { E: 'Envoyé', V: 'Validé', C: 'Contrôlé', R: 'Rejeté', A: 'Archivé', S: 'Supprimé' };

function renderAudios(data) {
    const list = data || currentData.audios;
    const tbody = document.getElementById('audiosBody');
    const noData = document.getElementById('audiosNoData');
    tbody.innerHTML = '';

    if (list.length === 0) {
        noData.style.display = 'block';
        return;
    }
    noData.style.display = 'none';

    // Find admin name by id
    const adminMap = {};
    currentData.admins.forEach(a => adminMap[a.id] = a.name);

    list.forEach(audio => {
        const s = audio.status || 'E';
        const assignedName   = audio.assigned_to ? (adminMap[audio.assigned_to] || audio.assigned_to) : '—';
        const controllerName = audio.controlled_admin_name
            ? audio.controlled_admin_name
            : (audio.controlled_by ? audio.controlled_by : '—');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(audio.audio_name || audio.filename || '')}">
                ${escHtml(audio.audio_name || audio.filename || '—')}
            </td>
            <td>${escHtml(audio.uploader_ref || '—')}</td>
            <td>${escHtml(assignedName)}</td>
            <td>${escHtml(controllerName)}</td>
            <td><span class="status-badge status-${s}">${s} — ${STATUS_LABELS[s] || s}</span></td>
            <td>${fmtDate(audio.date_creation || audio.created_at)}</td>
            <td>
                <button class="btn-edit" onclick="openEditAudioModal('${audio.id}')">Éditer</button>
                <button class="btn-delete" onclick="deleteAudioConfirm('${audio.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterAudios() {
    const q = document.getElementById('searchAudios').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const adminMap = {};
    currentData.admins.forEach(a => adminMap[a.id] = a.name);

    const filtered = currentData.audios.filter(a => {
        const assignedName = a.assigned_to ? (adminMap[a.assigned_to] || a.assigned_to) : '';
        const controllerName = a.controlled_by ? (adminMap[a.controlled_by] || a.controlled_by) : '';
        const matchesText = !q ||
            (a.audio_name || a.filename || '').toLowerCase().includes(q) ||
            (a.uploader_ref || '').toLowerCase().includes(q) ||
            assignedName.toLowerCase().includes(q) ||
            controllerName.toLowerCase().includes(q) ||
            (a.transcription || '').toLowerCase().includes(q);
        const matchesStatus = !statusFilter || a.status === statusFilter;
        return matchesText && matchesStatus;
    });
    renderAudios(filtered);
}

function openEditAudioModal(audioId) {
    const audio = currentData.audios.find(a => a.id === audioId);
    if (!audio) return;

    document.getElementById('audioId').value = audioId;
    document.getElementById('audioStatus').value = audio.status || 'E';
    document.getElementById('audioTranscription').value = audio.transcription || '';
    document.getElementById('audioTranslation').value = audio.traduction || audio.translation || '';

    // Populate assigned_to select
    const select = document.getElementById('audioAssignedTo');
    select.innerHTML = '<option value="">Non assigné</option>';
    currentData.admins.forEach(admin => {
        const opt = document.createElement('option');
        opt.value = admin.id;
        opt.textContent = admin.name + ' (' + admin.username + ')';
        if (admin.id === audio.assigned_to) opt.selected = true;
        select.appendChild(opt);
    });

    document.getElementById('editAudioModal').classList.add('show');
}

function closeEditAudioModal() {
    document.getElementById('editAudioModal').classList.remove('show');
}

async function submitEditAudio(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('id', document.getElementById('audioId').value);
    formData.append('assigned_to', document.getElementById('audioAssignedTo').value);
    formData.append('status', document.getElementById('audioStatus').value);
    formData.append('transcription', document.getElementById('audioTranscription').value);
    formData.append('translation', document.getElementById('audioTranslation').value);

    try {
        const response = await fetch('superadmin-update-audio', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showMessage('audiosMessage', 'Audio mis à jour avec succès', 'success');
            loadData();
            closeEditAudioModal();
        } else {
            showMessage('audiosMessage', data.error || 'Erreur mise à jour', 'error');
        }
    } catch (error) {
        showMessage('audiosMessage', 'Erreur réseau', 'error');
    }
}

async function deleteAudioConfirm(audioId) {
    const confirmed = await confirmPopup('Supprimer cet audio ?<br><small>Cette action est irréversible.</small>');
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('id', audioId);

    try {
        const response = await fetch('superadmin-delete-audio', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showMessage('audiosMessage', 'Audio supprimé', 'success');
            loadData();
        } else {
            showMessage('audiosMessage', data.error || 'Erreur suppression', 'error');
        }
    } catch (error) {
        showMessage('audiosMessage', 'Erreur réseau', 'error');
    }
}

async function exportDataset() {
    try {
        const response = await fetch('export-dataset');
        const result = await response.json();
        if (result.status === 'success') {
            showMessage('audiosMessage', `Export terminé (${result.total} audios).`, 'success');
            const a = document.createElement('a');
            a.href = 'dataset.json';
            a.download = 'dataset.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            loadData();
        } else {
            showMessage('audiosMessage', result.message || 'Erreur export.', 'error');
        }
    } catch (error) {
        showMessage('audiosMessage', 'Erreur réseau lors de l export.', 'error');
    }
}

/* =================== LOGOUT =================== */

async function logout() {
    const confirmed = await confirmPopup('Êtes-vous sûr de vouloir vous déconnecter ?');
    if (!confirmed) return;

    try {
        const response = await fetch('admin-logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            window.location.href = 'loginAdmin';
        }
    } catch (e) {
        window.location.href = 'loginAdmin';
    }
}

/* =================== UTILS =================== */

function showMessage(elementId, message, type) {
    const msgEl = document.getElementById(elementId);
    msgEl.textContent = message;
    msgEl.className = `message ${type} show`;
    setTimeout(() => msgEl.classList.remove('show'), 5000);
}

function confirmPopup(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:10000;';

        const box = document.createElement('div');
        box.className = 'confirm-box';
        box.style.cssText = 'background:#fff;padding:22px;max-width:420px;width:100%;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:Segoe UI, sans-serif;color:#1b1b1b;';
        box.innerHTML = `
            <div style="margin-bottom:18px;font-size:15px;line-height:1.55;">${message}</div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="confirm-cancel" type="button" style="padding:10px 18px;border:1px solid #ccc;background:#f7f7f7;color:#333;border-radius:10px;cursor:pointer;">Annuler</button>
                <button class="confirm-accept" type="button" style="padding:10px 18px;border:none;background:#1d72b8;color:#fff;border-radius:10px;cursor:pointer;">Confirmer</button>
            </div>
        `;

        const cancelBtn = box.querySelector('.confirm-cancel');
        const acceptBtn = box.querySelector('.confirm-accept');

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
        acceptBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}

function fmtDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
}

function escHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // petit feedback visuel
        const toast = document.createElement('div');
        toast.textContent = '✓ Copié !';
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:#27ae60;color:white;padding:10px 20px;border-radius:8px;font-weight:700;z-index:9999;animation:fadeIn 0.2s ease;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    });
}