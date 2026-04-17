document.addEventListener("DOMContentLoaded", async () => {
  const tableBody     = document.querySelector("#audioTable tbody");
  const searchInput   = document.getElementById("searchInput");
  const exportBtn     = document.getElementById("exportBtn");
  const archiveAllBtn = document.getElementById("archiveAllBtn");

  let allAudios           = [];
  let adminPermissions    = [];
  let adminRole           = '';
  let myAdminId           = '';
  let currentStatusFilter = '';
  let showOnlyAvailable   = false; // filtre validateur "disponibles seulement"

  // ========== Guards + Init ==========
  let info = {};
  try {
    const r = await fetch('auth-status-admin');
    info     = await r.json();
  } catch(e) { window.location.href = 'loginAdmin'; return; }

  if (!info.logged)       { window.location.href = 'loginAdmin'; return; }
  if (info.is_superadmin) { window.location.href = 'superadmin-dashboard'; return; }
  if (!['validator','controller'].includes(info.admin_role)) {
    window.location.href = 'loginAdmin'; return;
  }

  adminRole        = info.admin_role  || '';
  adminPermissions = info.permissions || [];
  myAdminId        = info.admin_id    || '';

  document.getElementById('adminGreeting').textContent = info.admin_name ? `Bonjour, ${info.admin_name}` : '';
  const roleTag    = document.getElementById('roleTag');
  const roleLabels = { validator: 'Validateur', controller: 'Contrôleur' };
  roleTag.textContent = roleLabels[adminRole] || adminRole;
  roleTag.className   = `role-tag role-${adminRole}`;

  applyRoleUI();
  loadAudios();

  // ========== UI selon le rôle ==========
  function applyRoleUI() {
    if (adminRole === 'controller') {
      const controllerActions = document.getElementById('controllerActions');
      if (controllerActions) {
        controllerActions.style.display = 'flex';
      }
      document.getElementById('thAssigned').style.display = '';
      // Contrôleur : onglets V et R + A
      document.querySelectorAll('.stab[data-status="E"]').forEach(b => b.style.display = 'none');
      // Activer V par défaut
      document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
      const stabV = document.querySelector('.stab[data-status="V"]');
      if (stabV) { stabV.classList.add('active'); currentStatusFilter = 'V'; }

    } else {
      // Validateur : onglets E, R, et un bouton "Disponibles"
      document.querySelectorAll('.stab[data-status="V"], .stab[data-status="A"]').forEach(b => b.style.display = 'none');
      // Ajouter le bouton filtre "Disponibles"
      const availBtn = document.createElement('button');
      availBtn.className   = 'stab stab-available';
      availBtn.dataset.status = '__available__';
      availBtn.textContent = 'Disponibles';
      document.getElementById('statusTabs').appendChild(availBtn);
    }
  }

  // ========== Chargement ==========
  async function loadAudios() {
    try {
      const res  = await fetch("get-audios-role");
      const data = await res.json();
      if (data.status === "success") {
        allAudios = data.data;
        renderAudios();
      } else throw new Error(data.message || 'Erreur serveur');
    } catch (err) {
      console.error("Erreur chargement:", err);
      showPopup("Erreur lors du chargement des audios : " + err.message, "error");
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#e74c3c;padding:20px;">Erreur de chargement</td></tr>`;
    }
  }

  // ========== Rendu ==========
  function renderAudios() {
    const q    = (searchInput.value || '').toLowerCase();
    let   list = allAudios;

    // Filtre statut
    if (currentStatusFilter === '__available__') {
      // Disponibles = E non encore pris par quelqu'un d'autre
      list = list.filter(a => a.status === 'E' && (!a.assigned_to || a.assigned_to === myAdminId));
    } else if (currentStatusFilter) {
      list = list.filter(a => a.status === currentStatusFilter);
    }

    // Filtre texte
    if (q) {
      list = list.filter(a =>
        (a.id            || '').toLowerCase().includes(q) ||
        (a.transcription || '').toLowerCase().includes(q) ||
        (a.traduction    || '').toLowerCase().includes(q) ||
        (a.audio_name    || '').toLowerCase().includes(q)
      );
    }

    const emptyMsg = document.getElementById('emptyMsg');
    if (list.length === 0) {
      tableBody.innerHTML    = '';
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    const showControlCol = adminRole === 'controller';

    tableBody.innerHTML = list.map(a => {
      const s = a.status || 'E';
      return `
        <tr data-id="${escapeHtml(a.id)}" data-status="${s}">
          <td class="id-cell" title="${escapeHtml(a.id)}">${escapeHtml(a.id.substring(0,8))}…</td>
          <td><audio controls preload="none" style="max-width:180px;">
            <source src="/collecte_data_wolof_mvc/${escapeHtml(a.audio_path)}" type="audio/wav">
          </audio></td>
          <td class="text-cell" title="${escapeHtml(a.transcription)}">${escapeHtml(a.transcription)}</td>
          <td class="text-cell" title="${escapeHtml(a.traduction)}">${escapeHtml(a.traduction)}</td>
          <td>${statusBadge(s)}</td>
          ${showControlCol ? `<td>${controlCell(a)}</td>` : ''}
          <td class="actions-cell">${buildActions(a, s)}</td>
        </tr>`;
    }).join('');
  }

  function statusBadge(s) {
    const labels = { E:'Envoyé', V:'Validé', R:'Rejeté', C:'Contrôlé', A:'Archivé' };
    return `<span class="sbadge sbadge-${s}">${labels[s] || s}</span>`;
  }

  function controlCell(a) {
    if (!a.controlled_by) {
      return `<button class="abtn abtn-control" onclick="takeControl('${a.id}')">Prendre en charge</button>`;
    }
    if (a.controlled_by === myAdminId) {
      return `<span class="control-mine">Vous</span>`;
    }
    return `<span class="control-other">Pris en charge</span>`;
  }

  // ========== Actions selon le rôle ==========
  function buildActions(a, s) {
    const id = a.id;
    let btns  = '';

    if (adminRole === 'validator') {
      if (s === 'E') {
        const takenByOther = a.assigned_to && a.assigned_to !== myAdminId;
        if (takenByOther) {
          btns = `<span class="claimed-badge">Pris en charge</span>`;
        } else {
          btns += `<button class="abtn abtn-edit"     onclick="openEditModal('${id}')">Modifier</button>`;
          btns += `<button class="abtn abtn-validate" onclick="changeStatus('${id}','V')">Valider</button>`;
          btns += `<button class="abtn abtn-reject"   onclick="openRejectModal('${id}')">Rejeter</button>`;
        }
      }
      if (s === 'R') {
        btns = `<span style="color:#aaa;font-size:12px;">—</span>`;
      }

    } else if (adminRole === 'controller') {
      const isMyControl = a.controlled_by === myAdminId;
      const isFree      = !a.controlled_by;

      if (s === 'V' || s === 'R') {
        if (isMyControl) {
          btns += `<button class="abtn abtn-edit" onclick="openEditModal('${id}')">Modifier</button>`;
          btns += `<button class="abtn abtn-validate" onclick="changeStatus('${id}','C')">Contrôlé</button>`;
          btns += `<button class="abtn abtn-delete" onclick="deleteSingle('${id}')">Supprimer</button>`;
        } else if (isFree) {
          btns = `<span style="color:#aaa;font-size:12px;">Prendre en charge d'abord</span>`;
        } else {
          btns = `<span style="color:#aaa;font-size:12px;">Pris par un autre</span>`;
        }
      }

      if (s === 'C') {
        if (isMyControl) {
          btns += `<button class="abtn abtn-edit" onclick="openEditModal('${id}')">Modifier</button>`;
          btns += `<button class="abtn abtn-delete" onclick="deleteSingle('${id}')">Supprimer</button>`;
        } else {
          btns = `<span style="color:#aaa;font-size:12px;">Contrôlé par un autre</span>`;
        }
      }
    }
    return btns || `<span style="color:#ccc;font-size:12px;">—</span>`;
  }

  // ========== Filtres ==========
  document.getElementById('statusTabs').addEventListener('click', e => {
    const btn = e.target.closest('.stab');
    if (!btn) return;
    document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatusFilter = btn.dataset.status;
    renderAudios();
  });

  searchInput.addEventListener('input', renderAudios);

  // ========== Prise en charge (contrôleur) ==========
  window.takeControl = async (id) => {
    const confirmed = await confirmModal('Prendre en charge cet audio ?<br><small>Vous pourrez ensuite le modifier puis le marquer comme contrôlé.</small>');
    if (!confirmed) return;
    const fd = new FormData();
    fd.append('id', id);
    try {
      const res    = await fetch('take-control', { method:'POST', body:fd });
      const result = await res.json();
      showPopup(result.message || 'Prise en charge réussie.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') loadAudios();
    } catch(e) { showPopup('Erreur réseau.', 'error'); }
  };

  // ========== Changer statut ==========
  window.changeStatus = async (id, newStatus) => {
    const labels    = { V:'valider', C:'contrôler', A:'archiver', E:'réactiver', R:'rejeter' };
    const confirmed = await confirmModal(`Voulez-vous <strong>${labels[newStatus] || 'modifier'}</strong> cet audio ?`);
    if (!confirmed) return;
    const fd = new FormData();
    fd.append('id', id);
    fd.append('status', newStatus);
    try {
      const res    = await fetch('update-audio-status', { method:'POST', body:fd });
      const result = await res.json();
      showPopup(result.message || 'Statut mis à jour.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') loadAudios();
    } catch(e) { showPopup('Erreur réseau.', 'error'); }
  };

  // ========== Supprimer ==========
  window.deleteSingle = async (id) => {
    const confirmed = await confirmModal('Supprimer cet audio ?<br><small>Action irréversible.</small>');
    if (!confirmed) return;
    const fd = new FormData();
    fd.append('id', id);
    try {
      const res    = await fetch('delete-audio', { method:'POST', body:fd });
      const result = await res.json();
      showPopup(result.message || 'Supprimé.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') loadAudios();
    } catch(e) { showPopup('Erreur réseau.', 'error'); }
  };

  // ========== Export ==========
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const res    = await fetch('export-dataset');
        const result = await res.json();
        showPopup(
          result.status === 'success' ? `${result.total} audios exportés !` : 'Erreur export.',
          result.status === 'success' ? 'success' : 'error'
        );
      } catch(e) { showPopup("Erreur lors de l'export.", 'error'); }
    });
  }

  // ========== Archiver tous mes V ==========
  if (archiveAllBtn) {
    archiveAllBtn.addEventListener('click', async () => {
      const confirmed = await confirmModal('Archiver tous <strong>vos</strong> audios validés et pris en charge ?');
      if (!confirmed) return;
      try {
        const res    = await fetch('archive-all-validated', { method:'POST' });
        const result = await res.json();
        showPopup(result.message || 'Archivage effectué.', result.status === 'success' ? 'success' : 'error');
        if (result.status === 'success') loadAudios();
      } catch(e) { showPopup('Erreur réseau.', 'error'); }
    });
  }

  // ========== Déconnexion ==========
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const confirmed = await confirmModal('Se déconnecter ?');
    if (!confirmed) return;
    try {
      const res  = await fetch('admin-logout', { method:'POST' });
      const data = await res.json();
      window.location.href = data.redirect || 'loginAdmin';
    } catch(e) { window.location.href = 'loginAdmin'; }
  });

  // ========== Modal Édition ==========
  window.openEditModal = (id) => {
    const audio = allAudios.find(a => a.id === id);
    if (!audio) return;
    document.getElementById('editId').value            = id;
    document.getElementById('editTranscription').value = audio.transcription || '';
    document.getElementById('editTraduction').value    = audio.traduction    || '';
    document.getElementById('editModal').style.display = 'flex';
  };
  window.closeEditModal = () => { document.getElementById('editModal').style.display = 'none'; };
  window.submitEdit = async () => {
    const id            = document.getElementById('editId').value;
    const transcription = document.getElementById('editTranscription').value.trim();
    const traduction    = document.getElementById('editTraduction').value.trim();
    if (!transcription || !traduction) { showPopup('Les champs ne peuvent pas être vides.', 'error'); return; }
    const fd = new FormData();
    fd.append('id', id);
    fd.append('transcription', transcription);
    fd.append('traduction', traduction);
    try {
      const res    = await fetch('update-audio-content', { method:'POST', body:fd });
      const result = await res.json();
      showPopup(result.message || 'Modifié.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') { closeEditModal(); loadAudios(); }
    } catch(e) { showPopup('Erreur réseau.', 'error'); }
  };

  // ========== Modal Rejet ==========
  window.openRejectModal = (id) => {
    document.getElementById('rejectId').value            = id;
    document.getElementById('rejectReason').value        = '';
    document.getElementById('rejectModal').style.display = 'flex';
  };
  window.closeRejectModal = () => { document.getElementById('rejectModal').style.display = 'none'; };
  window.submitReject = async () => {
    const id     = document.getElementById('rejectId').value;
    const reason = document.getElementById('rejectReason').value.trim();
    const fd     = new FormData();
    fd.append('id', id);
    fd.append('status', 'R');
    fd.append('rejection_reason', reason);
    try {
      const res    = await fetch('update-audio-status', { method:'POST', body:fd });
      const result = await res.json();
      showPopup(result.message || 'Rejeté.', result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') { closeRejectModal(); loadAudios(); }
    } catch(e) { showPopup('Erreur réseau.', 'error'); }
  };
});

// ========== Utils globaux ==========
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}
function showPopup(message, type = "info") {
  const popup = document.createElement("div");
  popup.className = `popup ${type}`;
  popup.innerHTML  = message;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("visible"), 100);
  setTimeout(() => { popup.classList.remove("visible"); setTimeout(() => popup.remove(), 500); }, 4000);
}
function confirmModal(message) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const box = document.createElement("div");
    box.className = "confirm-box";
    box.innerHTML = `<h3>${message}</h3>
      <div class="confirm-actions">
        <button class="confirm-no">Non</button>
        <button class="confirm-yes">Oui</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector(".confirm-yes").focus();
    box.querySelector(".confirm-no").onclick  = () => { overlay.remove(); resolve(false); };
    box.querySelector(".confirm-yes").onclick = () => { overlay.remove(); resolve(true); };
    overlay.addEventListener("keydown", e => { if (e.key==="Escape") { overlay.remove(); resolve(false); } });
  });
}