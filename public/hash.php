<?php
$password = 'password123'; // Mets ici le mot de passe que tu veux utiliser
$hash = password_hash($password, PASSWORD_BCRYPT);
echo "Nouveau hash pour '$password' : <br><br>" . htmlspecialchars($hash);
?>