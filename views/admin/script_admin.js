document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector("#audioTable tbody");
  const exportBtn = document.getElementById("exportBtn");
  const deleteAllBtn = document.getElementById("deleteAllBtn");

  // Fonction pour charger la liste des audios
  function loadAudios() {
    fetch("/get-audios")
      .then(async res => {
        if (!res.ok) throw new Error("Erreur HTTP " + res.status);
        const data = await res.json();

        if (data.status === "success" && data.data.length > 0) {
          tableBody.innerHTML = data.data.map(a => `
            <tr>
              <td>${a.id}</td>
              <td><audio controls><source src="/${a.audio_path}" type="audio/wav"></audio></td>
              <td class="transcription">${escapeHtml(a.transcription)}</td>
              <td class="traduction">${escapeHtml(a.traduction)}</td>
              <td><button class="delete-btn danger" data-id="${a.id}">Supprimer</button></td>
            </tr>
          `).join("");
        } else if (data.status === "success" && data.data.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Aucun audio enregistré</td></tr>`;
        } else {
          throw new Error(data.message || "Erreur inconnue");
        }
      })
      .catch(err => {
        console.error("Erreur chargement audios :", err);
        showPopup("Erreur lors du chargement des données.", "error");
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Erreur de chargement</td></tr>`;
      });
  }

  // Chargement initial
  loadAudios();

  // Export du dataset
  exportBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/export-dataset");
      const result = await res.json();

      if (result.status === "success") {
        showPopup(`${result.total} audios exportés avec succès !`, "success");
      } else {
        showPopup("Erreur lors de l'export : " + (result.message || ""), "error");
      }
    } catch (err) {
      console.error("Erreur export :", err);
      showPopup("Erreur lors de l’export. Réessayez.", "error");
    }
  });

  // Suppression totale 
  deleteAllBtn.addEventListener("click", async () => {
    const confirmDelete = await confirmModal("Voulez-vous vraiment supprimer <strong>TOUS</strong> les audios ?<br>Cette action est irréversible !");
    if (!confirmDelete) return;

    try {
      const fd = new FormData();
      fd.append("action", "delete_all");

      const res = await fetch("/delete-audio", {
        method: "POST",
        body: fd
      });

      const result = await res.json();

      if (result.status === "success") {
        showPopup(result.message || "Tous les audios ont été supprimés.", "success");
        setTimeout(() => location.reload(), 1000);
      } else {
        showPopup(result.message || "Erreur lors de la suppression massive", "error");
      }
    } catch (err) {
      console.error("Erreur suppression massive :", err);
      showPopup("Erreur serveur lors de la suppression", "error");
    }
  });

  // Suppression d'un audio
  tableBody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const id = e.target.dataset.id;
      const confirmDelete = await confirmModal(`Supprimer l'audio ?<br>Cette action est irréversible.`);
      if (!confirmDelete) return;

      const fd = new FormData();
      fd.append("id", id);

      try {
        const res = await fetch("/delete-audio", {
          method: "POST",
          body: fd
        });

        const result = await res.json();

        if (result.status === "success") {
          showPopup("Audio supprimé avec succès.", "success");
          loadAudios(); // Recharge sans refresh complet
        } else {
          showPopup(result.message || "Erreur lors de la suppression", "error");
        }
      } catch (err) {
        console.error("Erreur suppression :", err);
        showPopup("Erreur lors de la suppression.", "error");
      }
    }
  });
});

// Protection contre XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Popup de notification
function showPopup(message, type = "info") {
  const popup = document.createElement("div");
  popup.className = `popup ${type}`;
  popup.innerHTML = message; // innerHTML car on peut avoir <strong>
  document.body.appendChild(popup);

  setTimeout(() => popup.classList.add("visible"), 100);

  setTimeout(() => {
    popup.classList.remove("visible");
    setTimeout(() => popup.remove(), 500);
  }, 4000);
}

// Modal de confirmation personnalisée
async function confirmModal(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";

    const box = document.createElement("div");
    box.className = "confirm-box";

    box.innerHTML = `
      <h3>${message}</h3>
      <div class="confirm-actions">
        <button class="confirm-no">Non</button>
        <button class="confirm-yes">Oui</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus sur le bouton Oui pour accessibilité
    overlay.querySelector(".confirm-yes").focus();

    overlay.querySelector(".confirm-no").onclick = () => {
      overlay.remove();
      resolve(false);
    };

    overlay.querySelector(".confirm-yes").onclick = () => {
      overlay.remove();
      resolve(true);
    };

    // Fermer avec Échap
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        resolve(false);
      }
    });
  });
}