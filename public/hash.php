<?php
$password = 'password123'; 
$hash = password_hash($password, PASSWORD_BCRYPT);
echo "Nouveau hash pour '$password' : <br><br>" . htmlspecialchars($hash);
?>