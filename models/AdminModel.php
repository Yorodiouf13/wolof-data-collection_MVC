<?php
require_once __DIR__ . '/../config/database.php';

class AdminModel {
    private $db;

    public function __construct() {
        $this->db = getDatabaseConnection();
    }

    public function getByUsername(string $username): ?array {
        $stmt = $this->db->prepare("SELECT id, name, email, username, password_hash, role, is_first_login, is_superadmin FROM admins WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function createAdmin(string $name, string $email, string $username, ?string $tempPassword = null, bool $isSuperadmin = false): string {
        $id = bin2hex(random_bytes(10));
        $passwordHash = $tempPassword ? password_hash($tempPassword, PASSWORD_BCRYPT) : null;

        $stmt = $this->db->prepare("INSERT INTO admins (id, name, email, username, password_hash, is_first_login, is_superadmin, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, NOW())");
        $stmt->bind_param("sssssi", $id, $name, $email, $username, $passwordHash, $isSuperadmin);
        $stmt->execute();
        $stmt->close();
        return $id;
    }

    public function setPasswordHash(string $adminId, string $hash): bool {
        $stmt = $this->db->prepare("UPDATE admins SET password_hash = ?, is_first_login = 0 WHERE id = ?");
        $stmt->bind_param("ss", $hash, $adminId);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function setLastLogin(string $adminId, ?string $ip = null): void {
        $stmt = $this->db->prepare("UPDATE admins SET last_login_at = NOW(), last_ip = ? WHERE id = ?");
        $stmt->bind_param("ss", $ip, $adminId);
        $stmt->execute();
        $stmt->close();
    }

    public function getById(string $id): ?array {
        $stmt = $this->db->prepare("SELECT id, name, email, username, password_hash, role, is_first_login, is_superadmin FROM admins WHERE id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function getAllAdmins(): array {
        $stmt = $this->db->prepare("SELECT id, name, email, username, role, is_superadmin, created_at, last_login_at FROM admins WHERE is_superadmin = 0 ORDER BY created_at DESC");
        $stmt->execute();
        $result = $stmt->get_result();
        $admins = [];
        while ($row = $result->fetch_assoc()) {
            $admins[] = $row;
        }
        $stmt->close();
        return $admins;
    }

    public function updateAdmin(string $id, string $name, string $email, ?string $role = null): bool {
        if ($role) {
            $stmt = $this->db->prepare("UPDATE admins SET name = ?, email = ?, role = ? WHERE id = ?");
            $stmt->bind_param("ssss", $name, $email, $role, $id);
        } else {
            $stmt = $this->db->prepare("UPDATE admins SET name = ?, email = ? WHERE id = ?");
            $stmt->bind_param("sss", $name, $email, $id);
        }
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function deleteAdmin(string $id): bool {
        $stmt = $this->db->prepare("DELETE FROM admins WHERE id = ?");
        $stmt->bind_param("s", $id);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }
}

?>
