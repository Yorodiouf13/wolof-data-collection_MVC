const MAX_DURATION = 10; 

document.addEventListener("DOMContentLoaded", () => {
  const form            = document.getElementById("dataForm");
  const audioInput      = document.getElementById("audioInput");
  const recorderCircle  = document.getElementById("recorderCircle");
  const recorderText    = document.getElementById("recorderText");
  const fallbackBtn     = document.getElementById("fallbackUploadBtn");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const audioPreview    = document.getElementById("audioPreview");
  const previewPlayer   = document.getElementById("previewPlayer");
  const reRecordBtn     = document.getElementById("reRecordBtn");
  const submitBtn       = document.getElementById("submitBtn");

  // Éléments du modal d'enregistrement
  const recordingModal = document.getElementById("recordingModal");
  const timerFill      = document.getElementById("timerFill");
  const recElapsed     = document.getElementById("recElapsed");
  const waveCanvas     = document.getElementById("waveformCanvas");
  const recPauseBtn    = document.getElementById("recPauseBtn");
  const recSaveBtn     = document.getElementById("recSaveBtn");
  const recDeleteBtn   = document.getElementById("recDeleteBtn");
  const waveCtx        = waveCanvas.getContext("2d");

  let mediaRecorder  = null;
  let audioChunks    = [];
  let activeStream   = null;
  let timerInterval  = null;
  let elapsedSeconds = 0;
  let isPaused       = false;
  let analyser       = null;
  let animFrameId    = null;
  const STORAGE_KEY = 'pendingUserUpload';

  fileNameDisplay.className  = "file-name-display";
  fileNameDisplay.textContent = "Aucun fichier sélectionné";

  const recentHistoryContainer = document.getElementById('recentHistory');
  restorePendingUpload();
  loadRecentHistory();

  function savePendingUploadAndRedirect() {
    const transcription = (document.getElementById("transcription").value || "").trim();
    const traduction    = (document.getElementById("traduction").value || "").trim();
    const file          = audioInput.files[0];
    const state = {
      transcription,
      traduction,
      audioName: file ? file.name : '',
      audioType: file ? file.type : 'audio/wav',
      audioDataUrl: ''
    };

    if (!file) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.location.href = 'login-user';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      state.audioDataUrl = reader.result;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.location.href = 'login-user';
    };
    reader.onerror = () => {
      console.error('Erreur lecture fichier pour restauration');
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.location.href = 'login-user';
    };
    reader.readAsDataURL(file);
  }

  function restorePendingUpload() {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    let state;
    try {
      state = JSON.parse(saved);
    } catch (err) {
      console.error('Impossible de lire l état stocké', err);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (!state) return;

    if (state.transcription) {
      document.getElementById("transcription").value = state.transcription;
    }
    if (state.traduction) {
      document.getElementById("traduction").value = state.traduction;
    }
    if (state.audioDataUrl) {
      previewPlayer.src = state.audioDataUrl;
      audioPreview.classList.remove("hidden");
      fileNameDisplay.textContent = state.audioName || "Fichier sélectionné";
      if (state.audioName) {
        fetch(state.audioDataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], state.audioName, { type: state.audioType || 'audio/wav' });
            const dt = new DataTransfer();
            dt.items.add(file);
            audioInput.files = dt.files;
          })
          .catch(err => console.error('Erreur restauration audio:', err));
      }
    }
  }

  // ===== Upload fichier =====
  audioInput.addEventListener("change", () => {
    const file = audioInput.files[0];
    if (file) {
      const allowedTypes = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"];
      if (!allowedTypes.includes(file.type)) {
        showPopup("Seuls les fichiers WAV ou MP3 sont acceptés.", "error");
        audioInput.value = "";
        fileNameDisplay.textContent = "Aucun fichier sélectionné";
        return;
      }

      // Vérifier durée côté client
      const tempUrl   = URL.createObjectURL(file);
      const tempAudio = new Audio(tempUrl);
      tempAudio.addEventListener("loadedmetadata", () => {
        if (tempAudio.duration > MAX_DURATION) {
          showPopup(`Fichier trop long (${Math.round(tempAudio.duration)}s). Maximum : ${MAX_DURATION}s.`, "error");
          audioInput.value = "";
          fileNameDisplay.textContent = "Aucun fichier sélectionné";
          URL.revokeObjectURL(tempUrl);
          return;
        }
        fileNameDisplay.textContent = `Fichier choisi : ${file.name}`;
        const audioUrl = URL.createObjectURL(file);
        previewPlayer.src = audioUrl;
        audioPreview.classList.remove("hidden");
      });
      tempAudio.addEventListener("error", () => {
        // Impossible de lire les métadonnées, on accepte
        fileNameDisplay.textContent = `Fichier choisi : ${file.name}`;
        const audioUrl = URL.createObjectURL(file);
        previewPlayer.src = audioUrl;
        audioPreview.classList.remove("hidden");
      });
    } else {
      fileNameDisplay.textContent = "Aucun fichier sélectionné";
    }
  });

  fallbackBtn.addEventListener("click", () => audioInput.click());

  // ===== Clic sur le cercle mic → ouvre modal =====
  recorderCircle.addEventListener("click", startRecording);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStream   = stream;
      audioChunks    = [];
      elapsedSeconds = 0;
      isPaused       = false;

      // Analyser pour visualisation waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaStreamSource(stream);
      analyser       = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = onRecordingStop;
      mediaRecorder.start(100);

      recorderCircle.classList.add("recording");
      recorderText.textContent = "En cours...";
      openRecordingModal();
      startTimer();
      drawWaveform();

    } catch (err) {
      console.error("Erreur accès microphone:", err);
      showPopup("Impossible d'accéder au microphone. Vérifiez les permissions.", "error");
    }
  }

  function openRecordingModal() {
    timerFill.style.width   = "0%";
    recElapsed.textContent  = "0s";
    recPauseBtn.textContent = "⏸ Pause";
    recordingModal.style.display = "flex";
  }

  function closeRecordingModal() {
    recordingModal.style.display = "none";
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrameId);
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      if (isPaused) return;
      elapsedSeconds++;
      const pct = Math.min((elapsedSeconds / MAX_DURATION) * 100, 100);
      timerFill.style.width  = pct + "%";
      recElapsed.textContent = elapsedSeconds + "s";
      if (elapsedSeconds >= MAX_DURATION) {
        clearInterval(timerInterval);
        stopAndSave();
      }
    }, 1000);
  }

  function drawWaveform() {
    if (!analyser) return;
    const bufLen    = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);
    const W = waveCanvas.width, H = waveCanvas.height;
    function draw() {
      animFrameId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      waveCtx.clearRect(0, 0, W, H);
      waveCtx.lineWidth   = 2.5;
      waveCtx.strokeStyle = isPaused ? "rgba(255,255,255,0.3)" : "#ffa600";
      waveCtx.beginPath();
      const slice = W / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const y = (dataArray[i] / 128.0) * H / 2;
        i === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
        x += slice;
      }
      waveCtx.lineTo(W, H / 2);
      waveCtx.stroke();
    }
    draw();
  }

  // ===== Contrôles modal =====
  recPauseBtn.addEventListener("click", () => {
    if (!mediaRecorder) return;
    if (!isPaused) {
      mediaRecorder.pause(); isPaused = true; recPauseBtn.textContent = "▶ Reprendre";
    } else {
      mediaRecorder.resume(); isPaused = false; recPauseBtn.textContent = "⏸ Pause";
    }
  });

  recSaveBtn.addEventListener("click", () => {
    if (elapsedSeconds < 2) {
      showPopup("Enregistrement trop court (minimum 2 secondes).", "error");
      return;
    }
    stopAndSave();
  });

  recDeleteBtn.addEventListener("click", stopAndDiscard);

  function stopAndSave() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }

  function stopAndDiscard() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    analyser    = null;
    audioChunks = [];
    closeRecordingModal();
    recorderCircle.classList.remove("recording");
    recorderText.textContent = "Cliquez pour enregistrer";
  }

  function onRecordingStop() {
    // Copié de la version qui marchait + ajout de la durée dans le nom
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    analyser = null;
    closeRecordingModal();

    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    const file      = new File([audioBlob], "enregistrement.wav", { type: "audio/wav" });

    // Assigner au champ input sans déclencher la vérification de durée
    const dt = new DataTransfer();
    dt.items.add(file);
    audioInput.files = dt.files;
    // Ne pas dispatchEvent("change") pour éviter la vérification de durée

    // Afficher le player directement
    const audioUrl = URL.createObjectURL(audioBlob);
    previewPlayer.src = audioUrl;
    audioPreview.classList.remove("hidden");

    recorderCircle.classList.remove("recording");
    recorderText.textContent = "Enregistrement terminé !";
    fileNameDisplay.textContent = `enregistrement.wav (${elapsedSeconds}s)`;

    showPopup("Enregistrement terminé. Remplissez transcription et traduction.", "success");
  }

  // ===== Recommencer =====
  reRecordBtn.addEventListener("click", () => {
    audioPreview.classList.add("hidden");
    previewPlayer.src = "";
    audioInput.value  = "";
    fileNameDisplay.textContent = "Aucun fichier sélectionné";
    recorderText.textContent    = "Cliquez pour enregistrer";
    recorderCircle.classList.remove("recording");
    document.getElementById("transcription").value = "";
    document.getElementById("traduction").value    = "";
    setTimeout(() => window.location.reload(), 10);
  });

  // ===== Soumission formulaire (même logique que la version qui marchait) =====
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. Vérifier connexion (identique à la version qui marchait)
    try {
      const statusRes = await fetch('auth-status');
      const statusTxt = await statusRes.text();
      const status    = JSON.parse(statusTxt);

      if (!status.logged) {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';

        const box = document.createElement('div');
        box.className = 'popup-box';
        box.style.backgroundColor = '#f39c12';
        box.innerHTML = `
          <div style="display:flex;align-items:center;gap:15px;margin-bottom:20px;">
            <div style="font-size:28px;">🔒</div>
            <div style="text-align:left;flex:1;color:white;font-weight:600;">
              Vous devez être connecté pour envoyer un audio
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
            <button id="toLoginBtn"
              style="background:#27ae60;color:white;border:none;padding:10px 25px;border-radius:10px;font-weight:600;cursor:pointer;">
              Se connecter
            </button>
            <button id="cancelLoginBtn"
              style="background:#e0e0e0;color:#333;border:none;padding:10px 25px;border-radius:10px;font-weight:600;cursor:pointer;">
              Annuler
            </button>
          </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('visible'), 50);

        document.getElementById('toLoginBtn').addEventListener('click', () => {
          savePendingUploadAndRedirect();
        });
        document.getElementById('cancelLoginBtn').addEventListener('click', () => {
          overlay.classList.remove('visible');
          setTimeout(() => overlay.remove(), 300);
        });
        return;
      }
    } catch (err) {
      console.error('Erreur vérification auth:', err);
      showPopup('Impossible de vérifier la connexion. Réessayez.', 'error');
      return;
    }

    // 2. Valider les champs
    const formData      = new FormData(form);
    const audioFile     = formData.get("audio");
    const transcription = (formData.get("transcription") || "").trim();
    const traduction    = (formData.get("traduction")    || "").trim();

    if (!audioFile || audioFile.size === 0) {
      showPopup("Veuillez enregistrer ou uploader un fichier audio.", "error");
      return;
    }
    if (!transcription || !traduction) {
      showPopup("Tous les champs sont obligatoires.", "error");
      return;
    }

    // 3. Envoyer
    submitBtn.disabled    = true;
    submitBtn.textContent = " Envoi en cours...";
    showPopup("Envoi en cours...", "info");

    try {
      const response = await fetch("upload", {
        method: "POST",
        body:   formData,
        cache:  "no-store"
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.error("Réponse serveur invalide:", text);
        showPopup("Le serveur a renvoyé une réponse invalide. Veuillez réessayer.", "error");
        submitBtn.disabled    = false;
        submitBtn.textContent = "Envoyer";
        return;
      }

      if (result && result.status === "success") {
        sessionStorage.removeItem(STORAGE_KEY);
        showPopup(result.message || "Formulaire enregistré avec succès !", "success");
        // Reset propre sans rechargement brutal
        setTimeout(() => {
          form.reset();
          audioPreview.classList.add("hidden");
          previewPlayer.src           = "";
          fileNameDisplay.textContent = "Aucun fichier sélectionné";
          recorderText.textContent    = "Cliquez pour enregistrer";
          submitBtn.disabled          = false;
          submitBtn.textContent       = "Envoyer";
        }, 2000);
      } else {
        const userMsg = result && result.message
          ? result.message
          : "Une erreur est survenue. Veuillez réessayer.";
        showPopup(userMsg, "error");
        submitBtn.disabled    = false;
        submitBtn.textContent = "Envoyer";
      }
    } catch (networkErr) {
      console.error("Erreur réseau:", networkErr);
      showPopup("Erreur de connexion au serveur. Vérifiez votre connexion internet.", "error");
      submitBtn.disabled    = false;
      submitBtn.textContent = "Envoyer";
    }
  });
});

async function loadRecentHistory() {
  const recentHistoryContainer = document.getElementById('recentHistory');
  if (!recentHistoryContainer) return;

  try {
    const authRes = await fetch('auth-status');
    const authData = await authRes.json();
    if (!authData.logged) {
      recentHistoryContainer.innerHTML = `<p class="history-empty">Connectez-vous pour consulter votre historique d'uploads.</p>`;
      return;
    }

    const res = await fetch('user-history?limit=3');
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'Erreur chargement historique');
    }

    if (!data.data || data.data.length === 0) {
      recentHistoryContainer.innerHTML = `<p class="history-empty">Vous n'avez pas encore uploadé d'audio.</p>`;
      return;
    }

    recentHistoryContainer.innerHTML = data.data.map(item => {
      const status = item.status || 'E';
      const label = {
        E: 'En attente',
        V: 'Validé',
        R: 'Rejeté',
        C: 'Contrôlé',
        A: 'Archivé'
      }[status] || status;
      const reason = item.rejection_reason ? `<div class="history-reason">Motif : ${escapeHtml(item.rejection_reason)}</div>` : '';
      return `
        <article class="history-item">
          <div class="history-item-top">
            <strong>${escapeHtml(item.audio_name || item.original_name || 'Audio')}</strong>
            <span class="history-badge history-${status}">${label}</span>
          </div>
          <div class="history-item-meta">${new Date(item.date_creation).toLocaleDateString('fr-FR')} · ${escapeHtml(item.transcription || '').substring(0, 50)}...</div>
          ${reason}
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error('Erreur historique utilisateur:', err);
    recentHistoryContainer.innerHTML = `<p class="history-empty">Impossible de charger l'historique.</p>`;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ===== showPopup — identique à la version qui marchait =====
function showPopup(message, type = "info", autoClose = 3500) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  let bgColor   = "#007bff";
  if (type === "error")   { bgColor = "#e74c3c";  }
  if (type === "success") { bgColor = "#27ae60";  }
  if (type === "warning") { bgColor = "#f39c12";  }

  const box = document.createElement("div");
  box.className = "popup-box";
  box.style.backgroundColor = bgColor;
  box.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="flex:1;text-align:left;">${message}</div>
      <button class="popup-close"
        style="background:none;border:none;color:white;cursor:pointer;font-size:20px;padding:0;margin-left:10px;">
        ✕
      </button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("visible"), 50);

  box.querySelector(".popup-close").addEventListener("click", () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 300);
  });

  if (autoClose > 0) {
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.classList.remove("visible");
        setTimeout(() => overlay.remove(), 300);
      }
    }, autoClose);
  }
}