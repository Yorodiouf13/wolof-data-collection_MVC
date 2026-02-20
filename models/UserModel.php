<?php
require_once __DIR__ . '/../config/database.php';

class UserModel {
    private $db;

    public function __construct() {
        $this->db = getDatabaseConnection(); 
    }

    /**
     * Vérifie si un email existe déjà
     * @param string $email
     * @return bool
     */
    public function emailExists(string $email): bool {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $stmt->close();

        return $count > 0;
    }

    /**
     * Crée un nouvel utilisateur et retourne son ID
     * @param string $name (nom complet)
     * @param string $email
     * @param string $ip (adresse IP pour traçabilité)
     * @return string ID généré
     */
    public function createUser(string $name, string $email, string $ip): string {
        $id = bin2hex(random_bytes(10));
        $uploader_ref = bin2hex(random_bytes(6)); 

        $stmt = $this->db->prepare("
            INSERT INTO users (id, name, email, uploader_ref, last_ip)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sssss", $id, $name, $email, $uploader_ref, $ip);

        if (!$stmt->execute()) {
            error_log("Erreur création user : " . $stmt->error);
            throw new Exception("Erreur lors de la création de l'utilisateur");
        }

        $stmt->close();
        return $id;
    }

    /**
     * Récupère un utilisateur par son ID
     * @param string $id
     * @return array|null
     */
    public function getById(string $id): ?array {
        $stmt = $this->db->prepare("SELECT id, name, email, uploader_ref, created_at FROM users WHERE id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        return $user ?: null;
    }

    /**
     * Récupère un utilisateur par email (pour reconnexion)
     * @param string $email
     * @return array|null
     */
    public function getByEmail(string $email): ?array {
        $stmt = $this->db->prepare("SELECT id, name, email, uploader_ref FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        return $user ?: null;
    }
}