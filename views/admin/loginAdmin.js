 const form = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const infoMsg = document.getElementById('infoMsg');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    submitBtn.style.display = 'none';
    loading.style.display = 'block';
    errorMsg.classList.remove('show');
    infoMsg.classList.remove('show');

    try {
        const response = await fetch('admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        });
        const data = await response.json();
        console.log('Données JSON login admin:', data);


        if (data.success) {
            if (data.force_change) {
                window.location.href = data.redirect;
            } else {
                window.location.href = data.redirect;
            }
        } else {
            errorMsg.textContent = data.error || 'Erreur de connexion';
            errorMsg.classList.add('show');
            submitBtn.style.display = 'block';
            loading.style.display = 'none';
        }
    } catch (error) {
        errorMsg.textContent = 'Erreur réseau';
        errorMsg.classList.add('show');
        submitBtn.style.display = 'block';
        loading.style.display = 'none';
    }
});
