<?php
require_once __DIR__ . '/../models/AdminModel.php';
require_once __DIR__ . '/../models/AudioModel.php';
require_once __DIR__ . '/../config/database.php';

class AdminController {
    private $adminModel;
    private $audioModel;

    public function __construct() {
        $this->adminModel = new AdminModel();
        $this->audioModel = new AudioModel();
    }

    // ===== LOGIN =====

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

        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['admin_id']      = $admin['id'];
        $_SESSION['admin_name']    = $admin['name'];
        $_SESSION['admin_email']   = $admin['email'];
        $_SESSION['admin_role']    = $admin['role'];
        $_SESSION['is_superadmin'] = (bool)$admin['is_superadmin'];
        $_SESSION['permissions']   = $admin['permissions'] ?? '';

        $this->adminModel->setLastLogin($admin['id'], $_SERVER['REMOTE_ADDR'] ?? null);

        if (!empty($admin['is_first_login'])) {
            return ['success' => true, 'force_change' => true, 'redirect' => 'adminChangePassword'];
        }
        if ($admin['is_superadmin']) {
            return ['success' => true, 'redirect' => 'superadmin-dashboard'];
        }
        return ['success' => true, 'redirect' => './admin.html'];
    }

    // ===== CHANGE PASSWORD =====

    public function setAdminPassword() {
        header('Content-Type: application/json; charset=UTF-8');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') return ['error' => 'Méthode invalide'];
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $adminId = $_SESSION['admin_id'] ?? null;
        if (!$adminId) return ['error' => 'Non authentifié'];

        $oldPassword = trim($_POST['old_password'] ?? '');
        $newPassword = trim($_POST['new_password'] ?? '');
        if (strlen($newPassword) < 8) return ['error' => 'Mot de passe trop court (min. 8 caractères)'];

        $admin = $this->adminModel->getById($adminId);
        if (!$admin || !password_verify($oldPassword, $admin['password_hash'] ?? '')) {
            return ['error' => 'Ancien mot de passe incorrect'];
        }

        $hash    = password_hash($newPassword, PASSWORD_BCRYPT);
        $success = $this->adminModel->setPasswordHash($adminId, $hash);
        if ($success) {
            $redirect = !empty($_SESSION['is_superadmin']) ? 'superadmin-dashboard' : './admin.html';
            return ['success' => true, 'message' => 'Mot de passe changé avec succès', 'redirect' => $redirect];
        }
        return ['error' => 'Erreur lors de la mise à jour'];
    }

    // ===== LOGOUT =====

    public function logoutAdmin() {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        session_destroy();
        return ['success' => true, 'redirect' => 'loginAdmin'];
    }

    // ===== AUTH STATUS =====

    public function authStatusAdmin() {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $logged = isset($_SESSION['admin_id']);
        $perms  = [];
        if ($logged && !empty($_SESSION['permissions'])) {
            $perms = array_values(array_filter(array_map('trim', explode(',', $_SESSION['permissions']))));
        }
        header('Content-Type: application/json');
        echo json_encode([
            'logged'        => $logged,
            'admin_id'      => $_SESSION['admin_id']    ?? null,
            'admin_name'    => $_SESSION['admin_name']  ?? null,
            'admin_email'   => $_SESSION['admin_email'] ?? null,
            'admin_role'    => $_SESSION['admin_role']  ?? null,
            'is_superadmin' => $_SESSION['is_superadmin'] ?? false,
            'permissions'   => $perms,
        ]);
        exit;
    }

    // ===== GET AUDIOS selon le rôle =====

    public function getAudiosForRole() {
        header('Content-Type: application/json');
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();

        if (empty($_SESSION['admin_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'Non authentifié']);
            exit;
        }

        $role    = $_SESSION['admin_role'] ?? '';
        $adminId = $_SESSION['admin_id'];

        if ($_SESSION['is_superadmin'] ?? false) {
            $audios = $this->audioModel->getAllAudios();
        } elseif ($role === 'controller') {
            // Contrôleur : tous les V, R et C
            $audios = $this->audioModel->getValidatedForControllers();
        } else {
            // Validateur : tous les E et R disponibles
            $audios = $this->audioModel->getAvailableForValidators();
        }

        echo json_encode(['status' => 'success', 'data' => $audios, 'role' => $role, 'admin_id' => $adminId]);
        exit;
    }

    // ===== CLAIM + MISE À JOUR STATUT (validateur) =====

    public function updateAudioStatus() {
        header('Content-Type: application/json');
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();

        if (empty($_SESSION['admin_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'Non authentifié']);
            exit;
        }

        $id              = trim($_POST['id'] ?? '');
        $status          = trim($_POST['status'] ?? '');
        $rejectionReason = trim($_POST['rejection_reason'] ?? '') ?: null;
        $adminId         = $_SESSION['admin_id'];
        $role            = $_SESSION['admin_role'] ?? '';
        $perms           = array_filter(array_map('trim', explode(',', $_SESSION['permissions'] ?? '')));

        if (empty($id) || !in_array($status, ['E', 'V', 'R', 'C', 'A'])) {
            echo json_encode(['status' => 'error', 'message' => 'Paramètres invalides']);
            exit;
        }

        $audio = $this->audioModel->getById($id);
        if (!$audio) {
            echo json_encode(['status' => 'error', 'message' => 'Audio introuvable']);
            exit;
        }

        // Vérification selon le rôle
        if (!($_SESSION['is_superadmin'] ?? false)) {
            if ($role === 'validator') {
                // Claim atomique avant d'agir
                $claimed = $this->audioModel->claimForValidator($id, $adminId);
                if (!$claimed) {
                    echo json_encode(['status' => 'error', 'message' => 'Cet audio a été pris en charge par un autre validateur.']);
                    exit;
                }
            }

            if ($role === 'controller') {
                if ($audio['controlled_by'] !== $adminId) {
                    echo json_encode(['status' => 'error', 'message' => 'Vous devez d\'abord prendre en charge cet audio.']);
                    exit;
                }
                if ($status === 'A') {
                    echo json_encode(['status' => 'error', 'message' => 'Les contrôleurs ne peuvent pas archiver les audios.']);
                    exit;
                }
            }

            // Vérifications permissions communes
            if ($status === 'V' && !in_array('validate', $perms)) {
                echo json_encode(['status' => 'error', 'message' => 'Permission insuffisante (validate)']);
                exit;
            }
            if ($status === 'R' && !in_array('reject', $perms)) {
                echo json_encode(['status' => 'error', 'message' => 'Permission insuffisante (reject)']);
                exit;
            }
        }

        $success = $this->audioModel->updateStatus($id, $status, $adminId, $rejectionReason);
        $this->logAudit($id, 'status_change',
            ['status' => $audio['status']],
            ['status' => $status, 'reason' => $rejectionReason]
        );

        $labels = ['E' => 'Envoyé', 'V' => 'Validé', 'R' => 'Rejeté', 'A' => 'Archivé'];
        echo json_encode([
            'status'  => $success ? 'success' : 'error',
            'message' => $success ? "Statut changé : {$labels[$status]}" : 'Erreur mise à jour',
        ]);
        exit;
    }

    // ===== MISE À JOUR CONTENU =====

    public function updateAudioContent() {
        header('Content-Type: application/json');
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();

        if (empty($_SESSION['admin_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'Non authentifié']);
            exit;
        }

        $id            = trim($_POST['id'] ?? '');
        $transcription = trim($_POST['transcription'] ?? '');
        $traduction    = trim($_POST['traduction'] ?? '');
        $adminId       = $_SESSION['admin_id'];
        $role          = $_SESSION['admin_role'] ?? '';
        $perms         = array_filter(array_map('trim', explode(',', $_SESSION['permissions'] ?? '')));

        if (empty($id) || empty($transcription) || empty($traduction)) {
            echo json_encode(['status' => 'error', 'message' => 'Champs requis']);
            exit;
        }
        if (!empty($perms) && !in_array('edit_transcription', $perms)) {
            echo json_encode(['status' => 'error', 'message' => 'Permission insuffisante']);
            exit;
        }

        $audio = $this->audioModel->getById($id);
        if (!$audio) {
            echo json_encode(['status' => 'error', 'message' => 'Audio introuvable']);
            exit;
        }

        if (!($_SESSION['is_superadmin'] ?? false)) {
            if ($role === 'validator') {
                // Claim atomique
                $claimed = $this->audioModel->claimForValidator($id, $adminId);
                if (!$claimed) {
                    echo json_encode(['status' => 'error', 'message' => 'Cet audio a été pris en charge par un autre validateur.']);
                    exit;
                }
            }
            if ($role === 'controller' && $audio['controlled_by'] !== $adminId) {
                echo json_encode(['status' => 'error', 'message' => 'Vous devez d\'abord prendre en charge cet audio.']);
                exit;
            }
        }

        $success = $this->audioModel->updateContent($id, $transcription, $traduction, $adminId);
        $this->logAudit($id, 'edit_content',
            ['transcription' => $audio['transcription'], 'traduction' => $audio['traduction']],
            ['transcription' => $transcription, 'traduction' => $traduction]
        );

        echo json_encode([
            'status'  => $success ? 'success' : 'error',
            'message' => $success ? 'Audio modifié avec succès' : 'Erreur modification',
        ]);
        exit;
    }

    // ===== PRISE EN CHARGE (contrôleur) =====

    public function takeControl() {
        header('Content-Type: application/json');
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();

        if (empty($_SESSION['admin_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'Non authentifié']);
            exit;
        }

        $id      = trim($_POST['id'] ?? '');
        $adminId = $_SESSION['admin_id'];
        $role    = $_SESSION['admin_role'] ?? '';

        if ($role !== 'controller') {
            echo json_encode(['status' => 'error', 'message' => 'Réservé aux contrôleurs']);
            exit;
        }

        $success = $this->audioModel->takeControl($id, $adminId);
        if ($success) {
            echo json_encode(['status' => 'success', 'message' => 'Audio pris en charge.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Cet audio est déjà pris en charge par un autre contrôleur.']);
        }
        exit;
    }

    // ===== ARCHIVER TOUS LES V contrôlés par cet admin =====

    public function archiveAllValidated() {
        header('Content-Type: application/json');
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();

        if (empty($_SESSION['admin_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'Non authentifié']);
            exit;
        }

        $perms = array_filter(array_map('trim', explode(',', $_SESSION['permissions'] ?? '')));
        if (!empty($perms) && !in_array('archive', $perms)) {
            echo json_encode(['status' => 'error', 'message' => 'Permission insuffisante (archive)']);
            exit;
        }

        $adminId = $_SESSION['admin_id'];
        $count   = $this->audioModel->archiveAllValidated($adminId);
        $this->logAudit('*', 'archive_all_validated', null, ['count' => $count]);

        echo json_encode(['status' => 'success', 'message' => "$count audio(s) archivé(s) avec succès."]);
        exit;
    }

    // ===== AUDIT =====

    private function logAudit($audioId, $action, $oldData, $newData) {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $adminId = $_SESSION['admin_id'] ?? null;
        $ip      = $_SERVER['REMOTE_ADDR'] ?? null;
        try {
            $db   = getDatabaseConnection();
            $old  = json_encode($oldData);
            $new  = json_encode($newData);
            $stmt = $db->prepare(
                "INSERT INTO audit_logs (audio_id, admin_id, action, old_data, new_data, ip_address, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())"
            );
            $stmt->bind_param("ssssss", $audioId, $adminId, $action, $old, $new, $ip);
            $stmt->execute();
            $stmt->close();
        } catch (Exception $e) {
            error_log("Audit log error: " . $e->getMessage());
        }
    }
}
?>