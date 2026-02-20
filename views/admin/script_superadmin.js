let currentData = { admins: [], users: [], audios: [] };

document.addEventListener('DOMContentLoaded', loadData);

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
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

function renderAdmins() {
    const tbody = document.getElementById('adminsBody');
    const noData = document.getElementById('adminsNoData');
    tbody.innerHTML = '';

    if (currentData.admins.length === 0) {
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    currentData.admins.forEach(admin => {
        const row = `
            <tr>
                <td>${admin.name}</td>
                <td>${admin.email}</td>
                <td>${admin.username}</td>
                <td>${admin.role || 'Standard'}</td>
                <td>${new Date(admin.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    <button class="btn-edit" onclick="editAdmin('${admin.id}')">Éditer</button>
                    <button class="btn-delete" onclick="deleteAdminConfirm('${admin.id}')">Supprimer</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function renderUsers() {
    const tbody = document.getElementById('usersBody');
    const noData = document.getElementById('usersNoData');
    tbody.innerHTML = '';

    if (currentData.users.length === 0) {
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    currentData.users.forEach(user => {
        const row = `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    <button class="btn-delete" onclick="deleteUserConfirm('${user.id}')">Supprimer</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function renderAudios() {
    const tbody = document.getElementById('audiosBody');
    const noData = document.getElementById('audiosNoData');
    tbody.innerHTML = '';

    if (currentData.audios.length === 0) {
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    currentData.audios.forEach(audio => {
        const row = `
            <tr>
                <td>${audio.filename}</td>
                <td>${audio.uploader_ref}</td>
                <td>${audio.assigned_to || '-'}</td>
                <td><span style="color: ${getStatusColor(audio.status)}">${audio.status}</span></td>
                <td>${new Date(audio.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    <button class="btn-edit" onclick="openEditAudioModal('${audio.id}')">Éditer</button>
                    <button class="btn-delete" onclick="deleteAudioConfirm('${audio.id}')">Supprimer</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function getStatusColor(status) {
    const colors = { pending: '#ff9800', in_progress: '#2196f3', completed: '#4caf50', rejected: '#f44336' };
    return colors[status] || '#666';
}

function openCreateAdminModal() {
    document.getElementById('createAdminModal').classList.add('show');
}

function closeCreateAdminModal() {
    document.getElementById('createAdminModal').classList.remove('show');
    document.getElementById('createAdminForm').reset();
    document.getElementById('tempPasswordMsg').style.display = 'none';
    document.getElementById('createAdminForm').style.display = 'block';
}

async function submitCreateAdmin(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('adminName').value);
    formData.append('email', document.getElementById('adminEmail').value);
    formData.append('username', document.getElementById('adminUsername').value);

    try {
        console.log('Envoi données création admin:');
        const response = await fetch('superadmin-create-admin', {
            method: 'POST',
            body: formData
        });
        console.log('Réponse brute création admin:', response);
        const data = await response.json();
        console.log('Données JSON création admin:', data);
        
        if (data.success) {
            document.getElementById('tempPasswordValue').textContent = data.temp_password;
            document.getElementById('tempPasswordMsg').style.display = 'block';
            document.getElementById('createAdminForm').style.display = 'none';
            
            setTimeout(() => {
                loadData();
                closeCreateAdminModal();
            }, 3000);
        } else {
            showMessage('adminsMessage', data.error || 'Erreur création', 'error');
        }
    } catch (error) {
        showMessage('adminsMessage', 'Erreur réseau', 'error');
    }
}

function openEditAudioModal(audioId) {
    const audio = currentData.audios.find(a => a.id === audioId);
    if (!audio) return;

    document.getElementById('audioId').value = audioId;
    document.getElementById('audioAssignedTo').value = audio.assigned_to || '';
    document.getElementById('audioStatus').value = audio.status;
    document.getElementById('audioTranscription').value = audio.transcription || '';
    document.getElementById('audioTranslation').value = audio.translation || '';
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
        const response = await fetch('superadmin-update-audio', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showMessage('audiosMessage', 'Audio mise à jour', 'success');
            loadData();
            closeEditAudioModal();
        } else {
            showMessage('audiosMessage', data.error, 'error');
        }
    } catch (error) {
        showMessage('audiosMessage', 'Erreur réseau', 'error');
    }
}

async function deleteAdminConfirm(adminId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet admin?')) {
        await deleteAdmin(adminId);
    }
}

async function deleteAdmin(adminId) {
    const formData = new FormData();
    formData.append('id', adminId);

    try {
        const response = await fetch('superadmin-delete-admin', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showMessage('adminsMessage', 'Admin supprimé', 'success');
            loadData();
        } else {
            showMessage('adminsMessage', data.error, 'error');
        }
    } catch (error) {
        showMessage('adminsMessage', 'Erreur réseau', 'error');
    }
}

async function deleteUserConfirm(userId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?')) {
        await deleteUser(userId);
    }
}

async function deleteUser(userId) {
    const formData = new FormData();
    formData.append('id', userId);

    try {
        const response = await fetch('superadmin-delete-user', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showMessage('usersMessage', 'Utilisateur supprimé', 'success');
            loadData();
        } else {
            showMessage('usersMessage', data.error, 'error');
        }
    } catch (error) {
        showMessage('usersMessage', 'Erreur réseau', 'error');
    }
}

async function deleteAudioConfirm(audioId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet audio?')) {
        await deleteAudio(audioId);
    }
}

async function deleteAudio(audioId) {
    const formData = new FormData();
    formData.append('id', audioId);

    try {
        const response = await fetch('superadmin-delete-audio', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showMessage('audiosMessage', 'Audio supprimé', 'success');
            loadData();
        } else {
            showMessage('audiosMessage', data.error, 'error');
        }
    } catch (error) {
        showMessage('audiosMessage', 'Erreur réseau', 'error');
    }
}

function editAdmin(adminId) {
    alert('Édition admin non implémentée');
}

function showMessage(elementId, message, type) {
    const msgEl = document.getElementById(elementId);
    msgEl.textContent = message;
    msgEl.className = `message ${type} show`;
    setTimeout(() => msgEl.classList.remove('show'), 5000);
}

function logout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
        window.location.href = 'admin-logout';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Copié!');
}
