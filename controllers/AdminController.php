<?php
require_once __DIR__ . '/../models/AdminModel.php';

class AdminController {
    private $adminModel;

    public function __construct() {
        $this->adminModel = new AdminModel();
    }

    // Login admin avec username/password (POST)
    public function loginAdmin() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['view' => 'admin/loginAdmin'];
        }

        $username = trim($_POST['username'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if (empty($username) || empty($password)) {
            return ['error' => 'Identifiant et mot de passe requis'];
        }
        
        
        $admin = $this->adminModel->getByUsername($username);
        if (!$admin || !password_verify($password, $admin['password_hash'] ?? '')) {
            return ['error' => 'Identifiant ou mot de passe incorrect'];
        }
            

            // Connexion admin
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_name'] = $admin['name'];
        $_SESSION['admin_email'] = $admin['email'];
        $_SESSION['is_superadmin'] = (bool)$admin['is_superadmin'];

        // Update last login
        $this->adminModel->setLastLogin($admin['id'], $_SERVER['REMOTE_ADDR'] ?? null);

        // Forcer changement de mot de passe si premier login
        if (!empty($admin['is_first_login'])) {
            return ['success' => true, 'force_change' => true, 'redirect' => 'admin-change-password'];
        }

        // Redirect selon type d'admin
        if ($admin['is_superadmin']) {
            return ['success' => true, 'redirect' => 'superadmin-dashboard'];
        }

        return ['success' => true, 'redirect' => './admin.html'];
    }

    // Changer mot de passe admin (POST)
   public function setAdminPassword() {
    try {
        error_log('setAdminPassword appelé');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Méthode invalide'];
        }

        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $adminId = $_SESSION['admin_id'] ?? null;
        error_log('Admin ID dans setAdminPassword : ' . ($adminId ?? 'null'));
        if (!$adminId) {
            return ['error' => 'Non authentifié'];
        }

        $oldPassword = trim($_POST['old_password'] ?? '');
        $newPassword = trim($_POST['new_password'] ?? '');

        if (strlen($newPassword) < 8) {
            return ['error' => 'Mot de passe trop court (>=8 caractères)'];
        }

        $admin = $this->adminModel->getById($adminId);
        error_log('Admin récupéré dans setAdminPassword : ' . print_r($admin, true));
        if (!$admin) {
            return ['error' => 'Admin introuvable'];
        }

        if (!password_verify($oldPassword, $admin['password_hash'] ?? '')) {
            return ['error' => 'Ancien mot de passe incorrect'];
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $success = $this->adminModel->setPasswordHash($adminId, $hash);

        if ($success) {
            return [
                'success' => true,
                'message' => 'Mot de passe changé avec succès',
                'redirect' => isset($_SESSION['is_superadmin']) && $_SESSION['is_superadmin'] ? 'superadmin-dashboard' : './admin.html'
            ];
        } else {
            return ['error' => 'Erreur lors de la mise à jour du mot de passe'];
        }
    } catch (Exception $e) {
        error_log("Erreur setAdminPassword : " . $e->getMessage());
        return ['error' => 'Erreur serveur interne'];
    }
}

    // Logout admin
    public function logoutAdmin() {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        session_destroy();
        return ['success' => true, 'redirect' => 'admin-login'];
    }
}


?>
