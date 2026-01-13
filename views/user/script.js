document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dataForm");
  const audioInput = document.getElementById("audioInput");
  const recorderCircle = document.getElementById("recorderCircle");
  const recorderText = document.getElementById("recorderText");
  const fallbackBtn = document.getElementById("fallbackUploadBtn");

  let mediaRecorder = null;
  let audioChunks = [];

  const fileNameDisplay = document.createElement("p");
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

          // Réinitialiser l'interface
          recorderCircle.classList.remove("recording");
          recorderText.textContent = "Enregistrement terminé !";
          showPopup("Enregistrement terminé. Remplissez transcription et traduction.", "success");

          // Arrêter les pistes audio (libère le micro)
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        recorderCircle.classList.add("recording");
        recorderText.textContent = "Enregistrement en cours... Cliquez pour arrêter";
      } catch (err) {
        console.error("Erreur accès microphone :", err);
        showPopup("Impossible d'accéder au microphone. Vérifiez les permissions.", "error");
      }
    } else {
      mediaRecorder.stop();
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

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
      const response = await fetch("/upload", {
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

// Fonction popup (inchangée)
function showPopup(message, type = "info") {
  const popup = document.createElement("div");
  popup.className = `popup ${type}`;
  popup.textContent = message;
  document.body.appendChild(popup);

  setTimeout(() => popup.classList.add("visible"), 50);

  setTimeout(() => {
    popup.classList.remove("visible");
    setTimeout(() => popup.remove(), 400);
  }, 3000);
}