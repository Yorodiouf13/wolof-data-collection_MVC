<?php
require_once __DIR__ . '/../config/database.php';

class AudioModel
{
    private mysqli $conn;

    public function __construct()
    {
        $this->conn = getDatabaseConnection();
    }

    // ===== SUPERADMIN : tout =====

    public function getAllAudios(): array
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        $ctrlCols = $hasControlled
            ? ", u.controlled_by, u.controlled_at, c.name AS controlled_admin_name"
            : ", NULL AS controlled_by, NULL AS controlled_at, NULL AS controlled_admin_name";
        $ctrlJoin = $hasControlled ? "LEFT JOIN admins c ON c.id = u.controlled_by" : "";

        $sql = "SELECT u.id, u.audio_name, u.audio_path, u.transcription, u.traduction,
                       u.uploader_ref, u.status, u.assigned_to, u.date_creation,
                       u.rejection_reason, u.last_modified_at,
                       a.name AS assigned_admin_name
                       $ctrlCols
                FROM uploads u
                LEFT JOIN admins a ON a.id = u.assigned_to
                $ctrlJoin
                ORDER BY u.date_creation DESC";
        $result = $this->conn->query($sql);
        $rows   = [];
        if ($result) while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    // ===== VALIDATEURS : E et R non encore pris par un autre =====

    public function getAvailableForValidators(): array
    {
        $sql = "SELECT u.id, u.audio_name, u.audio_path, u.transcription, u.traduction,
                       u.uploader_ref, u.status, u.assigned_to, u.date_creation,
                       u.rejection_reason,
                       a.name AS assigned_admin_name
                FROM uploads u
                LEFT JOIN admins a ON a.id = u.assigned_to
                WHERE u.status IN ('E', 'R')
                  AND (u.controlled_by IS NULL OR u.controlled_by = '')
                ORDER BY u.date_creation ASC";
        $result = $this->conn->query($sql);
        $rows   = [];
        if ($result) while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    /**
     * Claim atomique : assigner au validateur uniquement si l'audio
     * n'est pas encore pris OU déjà pris par ce validateur.
     * Retourne true si la claim a réussi, false si pris par un autre.
     */
    public function claimForValidator(string $audioId, string $adminId): bool
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads
             SET assigned_to = ?, last_modified_at = NOW()
             WHERE id = ?
               AND status IN ('E','R')
               AND (assigned_to IS NULL OR assigned_to = ?)"
        );
        $stmt->bind_param("sss", $adminId, $audioId, $adminId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    // ===== CONTRÔLEURS : V et R (contrôle qualité + réactivation) =====

    public function getValidatedForControllers(): array
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        $ctrlCols = $hasControlled
            ? ", u.controlled_by, u.controlled_at, c.name AS controlled_admin_name"
            : ", NULL AS controlled_by, NULL AS controlled_at, NULL AS controlled_admin_name";
        $ctrlJoin = $hasControlled ? "LEFT JOIN admins c ON c.id = u.controlled_by" : "";

        $sql = "SELECT u.id, u.audio_name, u.audio_path, u.transcription, u.traduction,
                       u.uploader_ref, u.status, u.assigned_to, u.date_creation,
                       u.rejection_reason,
                       a.name AS assigned_admin_name
                       $ctrlCols
                FROM uploads u
                LEFT JOIN admins a ON a.id = u.assigned_to
                $ctrlJoin
                WHERE u.status IN ('V', 'R', 'C')
                ORDER BY FIELD(u.status, 'C', 'R', 'V'), u.date_creation DESC";
        $result = $this->conn->query($sql);
        if (!$result) {
            error_log("getValidatedForControllers SQL error: " . $this->conn->error);
            return [];
        }
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    /**
     * Prise en charge exclusive par un contrôleur.
     */
    public function takeControl(string $audioId, string $adminId): bool
    {
        if (!$this->columnExists('uploads', 'controlled_by')) {
            return true;
        }
        $stmt = $this->conn->prepare(
            "UPDATE uploads
             SET controlled_by = ?, controlled_at = NOW()
             WHERE id = ?
               AND status IN ('V','R','C')
               AND (controlled_by IS NULL OR controlled_by = ?)"
        );
        $stmt->bind_param("sss", $adminId, $audioId, $adminId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    // ===== COMMUNES =====

    public function getById(string $id): ?array
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        $ctrlCols = $hasControlled ? ", u.controlled_by, u.controlled_at" : ", NULL AS controlled_by, NULL AS controlled_at";

        $stmt = $this->conn->prepare(
            "SELECT u.* $ctrlCols
             FROM uploads u
             WHERE u.id = ?"
        );
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row    = $result->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function getByUploaderRef(string $uploaderRef, int $limit = 0): array
    {
        $sql = "SELECT id, audio_name, original_name, audio_path, transcription, traduction, uploader_ref, status, rejection_reason, date_creation, last_modified_at FROM uploads WHERE uploader_ref = ? ORDER BY date_creation DESC";
        if ($limit > 0) {
            $sql .= " LIMIT " . intval($limit);
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->bind_param("s", $uploaderRef);
        $stmt->execute();
        $result = $stmt->get_result();

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        $stmt->close();
        return $rows;
    }

    public function updateStatus(string $id, string $status, ?string $adminId = null, ?string $rejectionReason = null): bool
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads SET status=?, last_modified_by=?, last_modified_at=NOW(), rejection_reason=? WHERE id=?"
        );
        $stmt->bind_param("ssss", $status, $adminId, $rejectionReason, $id);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function updateContent(string $id, string $transcription, string $traduction, ?string $adminId = null): bool
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads SET transcription=?, traduction=?, last_modified_by=?, last_modified_at=NOW() WHERE id=?"
        );
        $stmt->bind_param("ssss", $transcription, $traduction, $adminId, $id);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function archiveAllValidated(?string $adminId = null): int
    {
        $hasControlled = $this->columnExists('uploads', 'controlled_by');
        if ($hasControlled) {
            $stmt = $this->conn->prepare(
                "UPDATE uploads SET status='A', last_modified_by=?, last_modified_at=NOW()
                 WHERE status='V' AND controlled_by=?"
            );
            $stmt->bind_param("ss", $adminId, $adminId);
        } else {
            $stmt = $this->conn->prepare(
                "UPDATE uploads SET status='A', last_modified_by=?, last_modified_at=NOW()
                 WHERE status='V'"
            );
            $stmt->bind_param("s", $adminId);
        }
        $stmt->execute();
        $count = $stmt->affected_rows;
        $stmt->close();
        return $count;
    }

    public function delete(string $id): bool
    {
        $audio    = $this->getById($id);
        if (!$audio) return false;
        $filePath = __DIR__ . '/../' . $audio['audio_path'];
        if (file_exists($filePath)) @unlink($filePath);
        $stmt = $this->conn->prepare("DELETE FROM uploads WHERE id=?");
        $stmt->bind_param("s", $id);
        $success = $stmt->execute();
        $stmt->close();
        return $success;
    }

    public function deleteAll(): bool
    {
        $result = $this->conn->query("SELECT audio_path FROM uploads");
        while ($row = $result->fetch_assoc()) {
            $fp = __DIR__ . '/../' . $row['audio_path'];
            if (file_exists($fp)) @unlink($fp);
        }
        return $this->conn->query("DELETE FROM uploads") !== false;
    }

    public function exportDataset(string $exportDir, string $jsonPath): array
    {
        if (!file_exists($exportDir)) mkdir($exportDir, 0777, true);
        $result  = $this->conn->query(
            "SELECT id, audio_path, transcription, traduction FROM uploads WHERE status='C'"
        );
        $dataset = [];
        while ($row = $result->fetch_assoc()) {
            $source  = __DIR__ . '/../' . $row['audio_path'];
            $newName = $row['id'] . ".wav";
            $dest    = $exportDir . $newName;
            if (file_exists($source)) copy($source, $dest);
            $dataset[] = [
                "audio_path"    => "dataset_creation/audios/" . $newName,
                "transcription" => $row['transcription'],
                "traduction"    => $row['traduction'],
            ];
        }
        file_put_contents($jsonPath, json_encode($dataset, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return ['total' => count($dataset)];
    }

    public function archiveExportedDataset(): int
    {
        $stmt = $this->conn->prepare(
            "UPDATE uploads SET status='A', last_modified_at=NOW() WHERE status='C'"
        );
        $stmt->execute();
        $count = $stmt->affected_rows;
        $stmt->close();
        return $count;
    }

    /**
     * Insert — sans assignedTo (plus d'assignation automatique).
     * Signature corrigée : 7 paramètres au lieu de 8.
     */
    public function insert(
        string $id,
        string $audio_name,
        string $original_name,
        string $audio_path,
        string $transcription,
        string $traduction,
        string $uploader_ref
    ): bool {
        $stmt = $this->conn->prepare(
            "INSERT INTO uploads (id, audio_name, original_name, audio_path, transcription, traduction, uploader_ref, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'E')"
        );
        $stmt->bind_param("sssssss",
            $id, $audio_name, $original_name, $audio_path,
            $transcription, $traduction, $uploader_ref
        );
        $success = $stmt->execute();
        if (!$success) error_log("AudioModel::insert error: " . $stmt->error);
        $stmt->close();
        return $success;
    }

    private function columnExists(string $table, string $column): bool
    {
        $res = $this->conn->query(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$table' AND COLUMN_NAME='$column'"
        );
        if (!$res) return false;
        $row = $res->fetch_assoc();
        return (int)($row['cnt'] ?? 0) > 0;
    }
}
?>