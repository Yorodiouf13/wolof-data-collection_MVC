<?php
require_once __DIR__ . '/../models/AdminModel.php';
require_once __DIR__ . '/../models/UserModel.php';
require_once __DIR__ . '/../models/AudioModel.php';
require_once __DIR__ . '/../config/database.php';

class SuperAdminController {
    private $adminModel;
    private $userModel;
    private $audioModel;
    private $db;

    public function __construct() {
        $this->adminModel = new AdminModel();
        $this->userModel = new UserModel();
        $this->audioModel = new AudioModel();
        $this->db = getDatabaseConnection();
    }

    // Protéger : vérifier super admin
    private function requireSuperAdmin() {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        if (empty($_SESSION['is_superadmin'])) {
            return false;
        }
        return true;
    }

    // GET admin list
    public function getAdminsList() {
        if (!$this->requireSuperAdmin()) {
            return ['error' => 'Accès refusé'];
        }

        $admins = $this->adminModel->getAllAdmins();
        header('Content-Type: application/json');
        echo json_encode($admins);
        exit;
    }

    // CREATE admin
    public function createAdmin() {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $name = trim($_POST['name'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $tempPassword = bin2hex(random_bytes(6)); // Auto-generate temp password

        if (empty($name) || empty($email) || empty($username)) {
            return ['error' => 'Champs requis'];
        }

        try {
            $adminId = $this->adminModel->createAdmin($name, $email, $username, $tempPassword, false);
            return ['success' => true, 'admin_id' => $adminId, 'temp_password' => $tempPassword, 'message' => "Admin créé. Mot de passe temporaire: $tempPassword"];
        } catch (Exception $e) {
            return ['error' => 'Erreur création admin: ' . $e->getMessage()];
        }
    }

    // UPDATE admin
    public function updateAdmin() {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        $name = trim($_POST['name'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $role = trim($_POST['role'] ?? '');

        if (empty($id) || empty($name) || empty($email)) {
            return ['error' => 'Champs requis'];
        }

        if ($this->adminModel->updateAdmin($id, $name, $email, $role ?: null)) {
            return ['success' => true, 'message' => 'Admin mise à jour'];
        }
        return ['error' => 'Erreur mise à jour'];
    }

    // DELETE admin
    public function deleteAdmin() {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        if (empty($id)) {
            return ['error' => 'ID requis'];
        }

        if ($this->adminModel->deleteAdmin($id)) {
            return ['success' => true, 'message' => 'Admin supprimé'];
        }
        return ['error' => 'Erreur suppression'];
    }

    // GET users list
    public function getUsersList() {
        if (!$this->requireSuperAdmin()) {
            return ['error' => 'Accès refusé'];
        }

        $stmt = $this->db->prepare("SELECT id, name, email, created_at FROM users ORDER BY created_at DESC");
        $stmt->execute();
        $result = $stmt->get_result();
        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        $stmt->close();

        header('Content-Type: application/json');
        echo json_encode($users);
        exit;
    }

    // DELETE user
    public function deleteUser() {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        if (empty($id)) {
            return ['error' => 'ID requis'];
        }

        $stmt = $this->db->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("s", $id);
        if ($stmt->execute()) {
            $stmt->close();
            return ['success' => true, 'message' => 'Utilisateur supprimé'];
        }
        $stmt->close();
        return ['error' => 'Erreur suppression'];
    }

    // GET audios list
    public function getAudiosList() {
        if (!$this->requireSuperAdmin()) {
            return ['error' => 'Accès refusé'];
        }

        $audios = $this->audioModel->getAllAudios();
        header('Content-Type: application/json');
        echo json_encode($audios);
        exit;
    }

    // UPDATE audio (assign, edit metadata)
    public function updateAudio() {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        $assignedTo = trim($_POST['assigned_to'] ?? '');
        $status = trim($_POST['status'] ?? '');
        $transcription = trim($_POST['transcription'] ?? '');
        $translation = trim($_POST['translation'] ?? '');

        if (empty($id)) {
            return ['error' => 'ID requis'];
        }

        $stmt = $this->db->prepare("UPDATE audios SET assigned_to = ?, status = ?, transcription = ?, translation = ? WHERE id = ?");
        $stmt->bind_param("sssss", $assignedTo, $status, $transcription, $translation, $id);

        if ($stmt->execute()) {
            $stmt->close();
            // Log audit
            $this->logAudit($id, 'update', null, ['status' => $status, 'assigned_to' => $assignedTo]);
            return ['success' => true, 'message' => 'Audio mise à jour'];
        }
        $stmt->close();
        return ['error' => 'Erreur mise à jour'];
    }

    // DELETE audio
    public function deleteAudio() {
        if (!$this->requireSuperAdmin() || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['error' => 'Accès refusé'];
        }

        $id = trim($_POST['id'] ?? '');
        if (empty($id)) {
            return ['error' => 'ID requis'];
        }

        // Get audio details for audit
        $audio = $this->audioModel->getById($id);
        if (!$audio) {
            return ['error' => 'Audio non trouvé'];
        }

        if ($this->audioModel->delete($id)) {
            $this->logAudit($id, 'delete', $audio, null);
            return ['success' => true, 'message' => 'Audio supprimé'];
        }
        return ['error' => 'Erreur suppression'];
    }

    // Log audit action
    private function logAudit($audioId, $action, $oldData, $newData) {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $adminId = $_SESSION['admin_id'] ?? null;

        $stmt = $this->db->prepare("INSERT INTO audit_logs (audio_id, admin_id, action, old_data, new_data, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $oldJson = json_encode($oldData);
        $newJson = json_encode($newData);
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $stmt->bind_param("ssssss", $audioId, $adminId, $action, $oldJson, $newJson, $ip);
        $stmt->execute();
        $stmt->close();
    }
}

?>
