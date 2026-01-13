<?php
require_once __DIR__ . '/../config/database.php';

class AudioModel
{
    private mysqli $conn;

    public function __construct()
    {
        $this->conn = getDatabaseConnection();
    }

    public function getAllAudios(): array
    {
        $sql = "SELECT id, audio_name, audio_path, transcription, traduction 
                FROM uploads 
                ORDER BY date_creation DESC"; 

        $result = $this->conn->query($sql);

        $audios = [];
        while ($row = $result->fetch_assoc()) {
            $audios[] = $row;
        }

        return $audios;
    }

    public function getById(string $id): ?array
    {
        $stmt = $this->conn->prepare("SELECT audio_path FROM uploads WHERE id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $stmt->close();
        return $row ?: null;
    }

    public function delete(string $id): bool
    {
        $audio = $this->getById($id);
        if (!$audio) {
            return false;
        }

        $filePath = __DIR__ . '/../' . $audio['audio_path']; 

        if (file_exists($filePath)) {
            @unlink($filePath);
        }

        $stmt = $this->conn->prepare("DELETE FROM uploads WHERE id = ?");
        $stmt->bind_param("s", $id);
        $success = $stmt->execute();
        $stmt->close();

        return $success;
    }

    
    public function deleteAll(): bool
    {
        // Supprimer tous les fichiers physiques
        $result = $this->conn->query("SELECT audio_path FROM uploads");
        while ($row = $result->fetch_assoc()) {
            $filePath = __DIR__ . '/../' . $row['audio_path'];
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        return $this->conn->query("DELETE FROM uploads") !== false;
    }

    
    public function exportDataset(string $exportDir = '../dataset_creation/audios/', string $jsonPath = '../dataset_creation/dataset.json'): array
    {
        // Créer le dossier d'export
        if (!file_exists($exportDir)) {
            mkdir($exportDir, 0777, true);
        }

        $query = "SELECT id, audio_path, transcription, traduction FROM uploads";
        $result = $this->conn->query($query);

        $dataset = [];
        while ($row = $result->fetch_assoc()) {
            $source = __DIR__ . '/../' . $row['audio_path']; 
            $newName = $row['id'] . ".wav";
            $dest = $exportDir . $newName;

            if (file_exists($source)) {
                copy($source, $dest);
            }

            $dataset[] = [
                "audio_path" => "dataset_creation/audios/" . $newName,
                "transcription" => $row['transcription'],
                "traduction" => $row['traduction']
            ];
        }

        // Sauvegarder le JSON
        $jsonContent = json_encode($dataset, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($jsonPath, $jsonContent);

        return [
            'total' => count($dataset),
            'file' => 'dataset.json'
        ];
    }

   
    public function insert(string $id, string $audio_name, string $original_name, string $audio_path, string $transcription, string $traduction): bool
    {
        $stmt = $this->conn->prepare(
            "INSERT INTO uploads (id, audio_name, original_name, audio_path, transcription, traduction) 
             VALUES (?, ?, ?, ?, ?, ?)"
        );

        $stmt->bind_param("ssssss", $id, $audio_name, $original_name, $audio_path, $transcription, $traduction);
        $success = $stmt->execute();
        $stmt->close();

        return $success;
    }
}
?>