<?php

class VerificationModel {
    private $db;

    public function __construct() {
        $this->db = getDatabaseConnection();
    }

    public function createVerification($identifier, $type, $code, $userData, $expires, $created_at) {
        $stmt = $this->db->prepare("
            INSERT INTO verifications (identifier, type, code, user_data, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $identifier, $type, $code, $userData, $expires, $created_at);
        $stmt->execute();
        $stmt->close();
    }

    public function verifyCode($identifier, $code) {
        error_log("Vérification: identifier='$identifier', code='$code'");
        
        $stmt = $this->db->prepare("
            SELECT user_data FROM verifications 
            WHERE identifier = ? AND code = ? AND expires_at > NOW()
            LIMIT 1
        ");
        $stmt->bind_param("ss", $identifier, $code);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        if ($row) {
            error_log("Code trouvé et valide");
            $this->deleteVerification($identifier, $code);
            return json_decode($row['user_data'], true);
        }

        error_log("Code non trouvé ou expiré pour identifier='$identifier', code='$code'");
        // Debug : voir tout ce qui existe
        $stmt2 = $this->db->prepare("SELECT identifier, code, expires_at FROM verifications WHERE identifier = ?");
        $stmt2->bind_param("s", $identifier);
        $stmt2->execute();
        $result2 = $stmt2->get_result();
        while ($row2 = $result2->fetch_assoc()) {
            error_log("En BD: identifier='" . $row2['identifier'] . "', code='" . $row2['code'] . "', expires_at='" . $row2['expires_at'] . "'");
        }
        $stmt2->close();

        return false;
    }

    private function deleteVerification($identifier, $code) {
        $stmt = $this->db->prepare("DELETE FROM verifications WHERE identifier = ? AND code = ?");
        $stmt->bind_param("ss", $identifier, $code);
        $stmt->execute();
    }
}