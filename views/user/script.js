
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dataForm");
  const audioInput = document.getElementById("audioInput");
  const recorderCircle = document.getElementById("recorderCircle");
  const recorderText = document.getElementById("recorderText");
  const fallbackBtn = document.getElementById("fallbackUploadBtn");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const audioPreview = document.getElementById("audioPreview");
  const previewPlayer = document.getElementById("previewPlayer");
  const reRecordBtn = document.getElementById("reRecordBtn");

  let mediaRecorder = null;
  let audioChunks = [];

  fileNameDisplay.className = "file-name-display";
  fileNameDisplay.textContent = "Aucun fichier sélectionné";
  audioInput.parentNode.insertBefore(fileNameDisplay, audioInput.nextSibling);

  audioInput.addEventListener("change", () => {
  const file = audioInput.files[0];
  if (file) {
    const allowedTypes = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"];
      if (!allowedTypes.includes(file.type)) {
        showPopup("Seuls les fichiers WAV ou MP3 sont acceptés.", "error");
        audioInput.value = "";
        fileNameDisplay.textContent = "Aucun fichier sélectionné";
      }
      fileNameDisplay.textContent = `Fichier choisi : ${file.name}`;
      // Afficher le player
      const audioUrl = URL.createObjectURL(file);
      previewPlayer.src = audioUrl;
      audioPreview.classList.remove("hidden");
    } else {
      fileNameDisplay.textContent = "Aucun fichier sélectionné";
    }
  });

  
  recorderCircle.addEventListener("click", toggleRecording);

  fallbackBtn.addEventListener("click", () => {
    audioInput.click();
  });

 
  async function toggleRecording() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      // Démarrer l'enregistrement
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

        mediaRecorder.onstop = () => {
          // Créer le fichier audio enregistré
          const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
          const file = new File([audioBlob], "enregistrement.wav", { type: "audio/wav" });

          // Assigner automatiquement au champ input file
          const dt = new DataTransfer();
          dt.items.add(file);
          audioInput.files = dt.files;
          audioInput.dispatchEvent(new Event("change"));

          // Afficher le player
          const audioUrl = URL.createObjectURL(audioBlob);
          previewPlayer.src = audioUrl;
          audioPreview.classList.remove("hidden");
          
          // Réinitialiser l'interface
          recorderCircle.classList.remove("recording");
          recorderText.textContent = "Enregistrement terminé !";
          showPopup("Enregistrement terminé. Remplissez transcription et traduction.", "success");

          // Arrêter les pistes audio (libère le micro)
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        recorderCircle.classList.add("recording");
        recorderText.textContent = "En cours... Cliquez pour arrêter";
      } catch (err) {
        console.error("Erreur accès microphone :", err);
        showPopup("Impossible d'accéder au microphone. Vérifiez les permissions.", "error");
      }
    } else {
      mediaRecorder.stop();
    }
  }

  reRecordBtn.addEventListener("click", () => {
  audioPreview.classList.add("hidden");
  previewPlayer.src = ""; 
  audioInput.value = ""; 
  fileNameDisplay.textContent = "Aucun fichier sélectionné";
  recorderText.textContent = "Cliquez pour enregistrer";
  recorderCircle.classList.remove("recording");
  document.getElementById("transcription").value = "";
  document.getElementById("traduction").value = "";
  setTimeout(() => window.location.reload(), 10);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Vérifier statut connexion avant tout
    try {
      const statusRes = await fetch('auth-status');
      const statusTxt = await statusRes.text();
      const status = JSON.parse(statusTxt);
      if (!status.logged) {
        // Afficher modale avec bouton de connexion
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        
        const box = document.createElement('div');
        box.className = 'popup-box';
        box.style.backgroundColor = '#f39c12';
        box.innerHTML = `
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
            <img src="cadenas.png" width="32" height="32"> 
            <div style="text-align: left; flex: 1;">Vous devez être connecté pour envoyer un audio</div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
            <button id="toLoginBtn" style="background: #ffa600; color: white; border: none; padding: 10px 25px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s;">
              Se connecter
            </button>
            <button id="cancelLoginBtn" style="background: #e0e0e0; color: #333; border: none; padding: 10px 25px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s;">
              Annuler
            </button>
          </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        setTimeout(() => overlay.classList.add('visible'), 50);
        
        document.getElementById('toLoginBtn').addEventListener('click', () => {
          window.location.href = 'login-user';
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

    const formData = new FormData(form);
    const audioFile = formData.get("audio");
    const transcription = (formData.get("transcription") || "").trim();
    const traduction = (formData.get("traduction") || "").trim();

    if (!audioFile || !transcription || !traduction) {
      showPopup("Tous les champs sont obligatoires.", "error");
      return;
    }

    showPopup("Envoi en cours...", "info");

    try {
      const response = await fetch("upload", {
        method: "POST",
        body: formData,
        cache: "no-store"
      });

      const text = await response.text();

      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.error("Réponse serveur invalide (brute) :", text);
        showPopup("Le serveur a renvoyé une réponse invalide. Veuillez réessayer.", "error");
        return;
      }

      if (result && result.status === "success") {
        showPopup(result.message || "Formulaire enregistré avec succès !", "success");
        form.reset();
        // Recharger la page après succès
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const userMsg = result && result.message ? result.message : "Une erreur est survenue. Veuillez réessayer.";
        showPopup( + userMsg, "error");
      }
    } catch (networkErr) {
      console.error("Erreur réseau / fetch :", networkErr);
      showPopup("Erreur de connexion au serveur. Vérifiez votre connexion internet.", "error");
    }
  });


});


// Fonction modale élégante pour afficher les messages
function showPopup(message, type = "info", autoClose = 3000) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  // Déterminer la couleur selon le type
  let bgColor = "#007bff"; // info
  let iconEmoji = "ℹ️";
  if (type === "error") {
    bgColor = "#e74c3c";
    iconEmoji = "❌";
  } else if (type === "success") {
    bgColor = "#27ae60";
    iconEmoji = "✓";
  } else if (type === "warning") {
    bgColor = "#f39c12";
    iconEmoji = "⚠️";
  }

  const box = document.createElement("div");
  box.className = "popup-box";
  box.style.backgroundColor = bgColor;

  box.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 24px; flex-shrink: 0;">${iconEmoji}</span>
      <div style="flex: 1; text-align: left;">
        ${message}
      </div>
      <button class="popup-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0; margin-left: 10px;">✕</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Animer l'apparition
  setTimeout(() => overlay.classList.add("visible"), 50);

  // Fermer au clic sur X
  box.querySelector(".popup-close").addEventListener("click", () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 300);
  });

  // Auto-fermeture
  if (autoClose > 0) {
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.classList.remove("visible");
        setTimeout(() => overlay.remove(), 300);
      }
    }, autoClose);
  }
}