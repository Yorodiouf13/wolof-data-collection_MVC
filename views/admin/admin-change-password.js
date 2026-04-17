const form = document.getElementById('changePasswordForm');
const newPassword = document.getElementById('newPassword');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

// Vérification de la force du mot de passe
newPassword.addEventListener('input', checkPasswordStrength);
document.getElementById('confirmPassword').addEventListener('input', validateMatch);

function checkPasswordStrength() {
    const pwd = newPassword.value;
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    // Vérifications
    const hasLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);

    // Mettre à jour les indicateurs
    updateRequirement('req-length', hasLength);
    updateRequirement('req-upper', hasUpper);
    updateRequirement('req-lower', hasLower);
    updateRequirement('req-number', hasNumber);

    // Calculer la force
    let strength = 0;
    if (hasLength) strength += 25;
    if (hasUpper) strength += 25;
    if (hasLower) strength += 25;
    if (hasNumber) strength += 25;

    strengthBar.style.width = strength + '%';

    if (strength < 50) {
        strengthBar.style.background = '#f44336';
        strengthText.className = 'strength-text';
        strengthText.textContent = 'Très faible';
    } else if (strength < 75) {
        strengthBar.style.background = '#ff9800';
        strengthText.className = 'strength-text fair';
        strengthText.textContent = 'Faible';
    } else if (strength < 100) {
        strengthBar.style.background = '#4caf50';
        strengthText.className = 'strength-text good';
        strengthText.textContent = 'Bon';
    } else {
        strengthBar.style.background = '#2196f3';
        strengthText.className = 'strength-text strong';
        strengthText.textContent = 'Très fort';
    }
}

function updateRequirement(id, met) {
    const element = document.getElementById(id);
    if (met) {
        element.classList.add('met');
    } else {
        element.classList.remove('met');
    }
}

function validateMatch() {
    const newPwd = newPassword.value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    
    if (confirmPwd && newPwd !== confirmPwd) {
        errorMsg.textContent = 'Les mots de passe ne correspondent pas';
        errorMsg.classList.add('show');
        submitBtn.disabled = true;
    } else if (confirmPwd) {
        errorMsg.classList.remove('show');
        submitBtn.disabled = false;
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldPassword = document.getElementById('oldPassword').value;
    const newPwd = newPassword.value;
    const confirmPwd = document.getElementById('confirmPassword').value;

    if (newPwd !== confirmPwd) {
        errorMsg.textContent = 'Les mots de passe ne correspondent pas';
        errorMsg.classList.add('show');
        return;
    }

    if (newPwd.length < 8) {
        errorMsg.textContent = 'Le mot de passe doit contenir au moins 8 caractères';
        errorMsg.classList.add('show');
        return;
    }

    submitBtn.style.display = 'none';
    loading.style.display = 'block';
    errorMsg.classList.remove('show');
    successMsg.classList.remove('show');

    try {
        const response = await fetch('admin-Change-Password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `old_password=${encodeURIComponent(oldPassword)}&new_password=${encodeURIComponent(newPwd)}`
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('Réponse JSON invalide:', text);
            throw new Error('Le serveur a renvoyé une réponse inattendue.');
        }

        if (!response.ok) {
            const message = data.error || data.message || 'Erreur serveur lors du changement de mot de passe';
            throw new Error(message);
        }

        if (data.success) {
            successMsg.textContent = data.message || 'Mot de passe changé avec succès';
            successMsg.classList.add('show');
            window.location.href = data.redirect;
        } else {
            throw new Error(data.error || 'Erreur lors du changement');
        }
    } catch (error) {
        errorMsg.textContent = error.message || 'Erreur réseau';
        errorMsg.classList.add('show');
        submitBtn.style.display = 'block';
        loading.style.display = 'none';
    }
});
