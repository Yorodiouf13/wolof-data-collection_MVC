document.addEventListener('DOMContentLoaded', () => {
  const historySidebarList = document.getElementById('historySidebarList');
  const historyDetails = document.getElementById('historyDetails');
  const refreshBtn = document.getElementById('refreshHistory');
  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editUploadForm');
  const editIdInput = document.getElementById('editUploadId');
  const editTranscription = document.getElementById('editTranscription');
  const editTraduction = document.getElementById('editTraduction');
  const cancelEdit = document.getElementById('cancelEdit');
  const editFeedback = document.getElementById('editFeedback');

  let currentItems = [];
  let selectedId = null;

  refreshBtn.addEventListener('click', loadHistory);
  editForm.addEventListener('submit', submitEdit);
  cancelEdit.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (event) => {
    if (event.target === editModal) closeEditModal();
  });

  historySidebarList.addEventListener('click', (event) => {
    const itemButton = event.target.closest('[data-id]');
    if (!itemButton) return;
    const id = itemButton.dataset.id;
    if (id) selectItem(id);
  });

  historyDetails.addEventListener('click', async (event) => {
    if (event.target.matches('.delete-action')) {
      await deleteAudio(selectedId);
    }
    if (event.target.matches('.edit-action')) {
      openEditModal(selectedId);
    }
  });

  loadHistory();

  async function loadHistory() {
    try {
      const authRes = await fetch('auth-status');
      const authData = await authRes.json();
      if (!authData.logged) {
        historySidebarList.innerHTML = `
          <div class="history-empty">
            <p>Vous devez être connecté pour consulter votre historique.</p>
            <a href="login-user" class="action-btn">Se connecter</a>
          </div>`;
        historyDetails.innerHTML = '';
        return;
      }

      const res = await fetch('user-history?limit=10');
      const data = await res.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Erreur chargement historique');
      }

      currentItems = data.data || [];
      if (currentItems.length === 0) {
        historySidebarList.innerHTML = `
          <div class="history-empty">
            <p>Vous n'avez pas encore uploadé d'audio.</p>
            <a href="index.html" class="action-btn">Uploader un audio</a>
          </div>`;
        historyDetails.innerHTML = `<p class="history-empty">Vos derniers uploads apparaîtront ici.</p>`;
        selectedId = null;
        return;
      }

      selectedId = selectedId || currentItems[0].id;
      historySidebarList.innerHTML = currentItems.map(item => renderSidebarItem(item)).join('');
      selectItem(selectedId, false);
    } catch (err) {
      console.error('Erreur historique:', err);
      historySidebarList.innerHTML = `<p class="history-empty">Impossible de charger votre historique.</p>`;
      historyDetails.innerHTML = `<p class="history-empty">Impossible de charger votre historique.</p>`;
    }
  }

  function renderSidebarItem(item) {
    const statusLabels = {
      E: 'En attente',
      V: 'Validé',
      R: 'Rejeté',
      C: 'Contrôlé',
      A: 'Archivé'
    };
    const shortName = escapeHtml(item.audio_name || item.original_name || 'Audio');
    const dateLabel = new Date(item.date_creation).toLocaleDateString('fr-FR');
    const isActive = item.id === selectedId ? ' active' : '';
    return `
      <button type="button" class="history-sidebar-item${isActive}" data-id="${escapeHtml(item.id)}">
        <div class="sidebar-title">${shortName}</div>
        <div class="sidebar-meta">${dateLabel} · ${statusLabels[item.status] || item.status}</div>
      </button>`;
  }

  function renderDetails(item) {
    if (!item) {
      return `<p class="history-empty">Sélectionnez une entrée pour voir les détails.</p>`;
    }

    const statusLabels = {
      E: 'En attente',
      V: 'Validé',
      R: 'Rejeté',
      C: 'Contrôlé',
      A: 'Archivé'
    };
    const reasonHtml = item.rejection_reason ? `<div class="history-reason">Motif : ${escapeHtml(item.rejection_reason)}</div>` : '';
    const editable = ['E', 'R'].includes(item.status);

    return `
      <div class="history-detail-card-header">
        <div>
          <h2>${escapeHtml(item.audio_name || item.original_name || 'Audio')}</h2>
          <p class="history-meta">${new Date(item.date_creation).toLocaleString('fr-FR')}</p>
        </div>
        <span class="history-badge history-${item.status}">${statusLabels[item.status] || item.status}</span>
      </div>
      <div class="history-audio-player">
        <audio controls preload="none" src="${escapeHtml(item.audio_path)}"></audio>
      </div>
      <div class="history-detail-block">
        <h3>Transcription</h3>
        <p>${escapeHtml(item.transcription)}</p>
      </div>
      <div class="history-detail-block">
        <h3>Traduction</h3>
        <p>${escapeHtml(item.traduction)}</p>
      </div>
      ${reasonHtml}
      <div class="history-actions history-actions-detail">
        ${editable ? `<button class="abtn abtn-edit edit-action">Modifier</button>` : `<span class="history-note">Modification fermée pour ce statut.</span>`}
        <button class="abtn abtn-delete delete-action">Supprimer</button>
      </div>`;
  }

  function selectItem(id, scroll = true) {
    selectedId = id;
    const item = currentItems.find(entry => entry.id === id);
    historySidebarList.innerHTML = currentItems.map(renderSidebarItem).join('');
    historyDetails.innerHTML = renderDetails(item);
    if (scroll) {
      const activeButton = historySidebarList.querySelector('[data-id="' + id + '"]');
      if (activeButton) activeButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  async function deleteAudio(id) {
    if (!id || !confirm('Voulez-vous vraiment supprimer cet audio ?')) return;
    try {
      const fd = new FormData();
      fd.append('id', id);
      const res = await fetch('delete-audio', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        await loadHistory();
      } else {
        alert(data.message || 'Erreur suppression.');
      }
    } catch (err) {
      console.error('Erreur suppression audio:', err);
      alert('Erreur réseau lors de la suppression.');
    }
  }

  async function openEditModal(id) {
    const item = currentItems.find(entry => entry.id === id);
    if (!item) {
      showFeedback('Audio introuvable.', 'error');
      return;
    }
    editIdInput.value = item.id;
    editTranscription.value = item.transcription || '';
    editTraduction.value = item.traduction || '';
    editFeedback.textContent = '';
    editModal.classList.remove('hidden');
  }

  function closeEditModal() {
    editModal.classList.add('hidden');
  }

  async function submitEdit(event) {
    event.preventDefault();
    const id = editIdInput.value;
    const transcription = editTranscription.value.trim();
    const traduction = editTraduction.value.trim();
    if (!transcription || !traduction) {
      showFeedback('Les deux champs sont obligatoires.', 'error');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('id', id);
      fd.append('transcription', transcription);
      fd.append('traduction', traduction);
      const res = await fetch('update-user-upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        showFeedback(data.message || 'Mis à jour.', 'success');
        await loadHistory();
        setTimeout(() => closeEditModal(), 800);
      } else {
        showFeedback(data.message || 'Erreur mise à jour.', 'error');
      }
    } catch (err) {
      console.error('Erreur mise à jour upload:', err);
      showFeedback('Erreur réseau.', 'error');
    }
  }

  function showFeedback(message, type = 'error') {
    editFeedback.textContent = message;
    editFeedback.className = `edit-feedback ${type}`;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
