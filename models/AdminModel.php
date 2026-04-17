<?php
require_once __DIR__ . '/../config/database.php';

class AdminModel {
    private $db;

    // Permissions fixes par rôle
    const ROLE_PERMISSIONS = [
        'validator'  => 'edit_transcription,validate,reject,delete',
        'controller' => 'edit_transcription,validate,reject,delete',
    ];

    public function __construct() {
        $this->db = getDatabaseConnection();
    }

    public function getByUsername(string $username): ?array {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, username, password_hash, role,
                    is_first_login, is_superadmin,
                    COALESCE(permissions, '') AS permissions
             FROM admins WHERE username = ?"
        );
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $row    = $result->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function createAdmin(
        string $name,
        string $email,
        string $username,
        ?string $tempPassword = null,
        bool $isSuperadmin    = false,
        string $role          = 'validator'
    ): string {
        $id           = bin2hex(random_bytes(10));
        $passwordHash = $tempPassword ? password_hash($tempPassword, PASSWORD_BCRYPT) : null;
        $isSuperInt   = $isSuperadmin ? 1 : 0;
        $permissions  = self::ROLE_PERMISSIONS[$role] ?? self::ROLE_PERMISSIONS['validator'];

        $hasTempPwd = $this->columnExists('admins', 'temp_password');

        if ($hasTempPwd) {
            $stmt = $this->db->prepare(
                "INSERT INTO admins
                    (id, name, email, username, password_hash, role, permissions, is_first_login, is_superadmin, temp_password, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW())"
            );
            $stmt->bind_param("sssssssss",
                $id, $name, $email, $username, $passwordHash,
                $role, $permissions, $isSuperInt, $tempPassword
            );
        } else {
            $stmt = $this->db->prepare(
                "INSERT INTO admins
                    (id, name, email, username, password_hash, role, permissions, is_first_login, is_superadmin, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())"
            );
            $stmt->bind_param("ssssssss",
                $id, $name, $email, $username, $passwordHash,
                $role, $permissions, $isSuperInt
            );
        }

        if (!$stmt->execute()) {
            throw new Exception("Erreur insertion admin : " . $stmt->error);
        }
        $stmt->close();
        return $id;
    }

    public function setPasswordHash(string $adminId, string $hash): bool {
        if ($this->columnExists('admins', 'temp_password')) {
            $stmt = $this->db->prepare(
                "UPDATE admins SET password_hash = ?, is_first_login = 0, temp_password = NULL WHERE id = ?"
            );
        } else {
            $stmt = $this->db->prepare(
                "UPDATE admins SET password_hash = ?, is_first_login = 0 WHERE id = ?"
            );
        }
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
        $stmt = $this->db->prepare(
            "SELECT id, name, email, username, password_hash, role,
                    is_first_login, is_superadmin,
                    COALESCE(permissions, '') AS permissions
             FROM admins WHERE id = ?"
        );
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row    = $result->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function getAllAdmins(): array {
        $hasTempPwd = $this->columnExists('admins', 'temp_password');
        $hasPerms   = $this->columnExists('admins', 'permissions');
        $tempCol    = $hasTempPwd ? 'temp_password'                            : 'NULL AS temp_password';
        $permsCol   = $hasPerms   ? "COALESCE(permissions,'') AS permissions"  : "'' AS permissions";

        $sql    = "SELECT id, name, email, username, role, is_superadmin,
                          created_at, last_login_at, $permsCol, $tempCol
                   FROM admins WHERE is_superadmin = 0 ORDER BY created_at DESC";
        $result = $this->db->query($sql);
        if (!$result) {
            error_log("getAllAdmins error: " . $this->db->error);
            return [];
        }
        $admins = [];
        while ($row = $result->fetch_assoc()) {
            $admins[] = $row;
        }
        return $admins;
    }

    /**
     * Mise à jour : le rôle recalcule automatiquement les permissions par défaut,
     * sauf si des permissions custom sont explicitement passées.
     */
    public function updateAdmin(string $id, string $name, string $email, string $role, ?string $customPerms = null): bool {
        $permissions = $customPerms ?? (self::ROLE_PERMISSIONS[$role] ?? self::ROLE_PERMISSIONS['validator']);
        if ($role === 'controller') {
            $perms = array_filter(array_map('trim', explode(',', $permissions)));
            $perms = array_filter($perms, fn($p) => !in_array($p, ['export', 'archive'], true));
            $permissions = implode(',', $perms);
        }
        $hasPerms    = $this->columnExists('admins', 'permissions');

        if ($hasPerms) {
            $stmt = $this->db->prepare(
                "UPDATE admins SET name=?, email=?, role=?, permissions=? WHERE id=? AND is_superadmin=0"
            );
            $stmt->bind_param("sssss", $name, $email, $role, $permissions, $id);
        } else {
            $stmt = $this->db->prepare(
                "UPDATE admins SET name=?, email=?, role=? WHERE id=? AND is_superadmin=0"
            );
            $stmt->bind_param("ssss", $name, $email, $role, $id);
        }
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function deleteAdmin(string $id): bool {
        $stmt = $this->db->prepare("DELETE FROM admins WHERE id=? AND is_superadmin=0");
        $stmt->bind_param("s", $id);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    /**
     * Load-balancing : uniquement vers les VALIDATEURS (role = 'validator').
     * Les contrôleurs ne reçoivent jamais d'audios auto-assignés.
     */
    public function getValidatorWithLeastAudios(): ?array {
        $sql = "SELECT a.id, a.name, a.username, COUNT(u.id) AS audio_count
                FROM admins a
                LEFT JOIN uploads u ON u.assigned_to = a.id AND u.status NOT IN ('A','S')
                WHERE a.is_superadmin = 0 AND a.role = 'validator'
                GROUP BY a.id
                ORDER BY audio_count ASC
                LIMIT 1";
        $result = $this->db->query($sql);
        if (!$result) return null;
        return $result->fetch_assoc() ?: null;
    }

    private function columnExists(string $table, string $column): bool {
        $res = $this->db->query(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$table' AND COLUMN_NAME='$column'"
        );
        if (!$res) return false;
        $row = $res->fetch_assoc();
        return (int)($row['cnt'] ?? 0) > 0;
    }
}
?>