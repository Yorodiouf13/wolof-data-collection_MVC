<?php
require_once __DIR__ . '/../models/AudioModel.php';

class AudioController
{
    private AudioModel $model;
    private string $uploadDir;        
    private string $ffmpegPath;       
    public function __construct()
    {
        $this->model = new AudioModel();
       
        $this->uploadDir = __DIR__ . '/../audios/';
        $this->ffmpegPath = 'C:\\ffmpeg-2025-10-27-git-68152978b5-full_build\\bin\\ffmpeg.exe'; 
    }

    public function getAll(): void
    {
        header("Content-Type: application/json; charset=UTF-8");

        $audios = $this->model->getAllAudios();

        echo json_encode([
            "status" => "success",
            "data"   => $audios
        ]);
    }

    public function delete(): void
    {
        header("Content-Type: application/json; charset=UTF-8");

        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            $this->jsonError("Requête invalide (POST requis).");
            return;
        }

        // Suppression totale
        if (isset($_POST["action"]) && $_POST["action"] === "delete_all") {
            $success = $this->model->deleteAll();

            echo json_encode([
                "status"  => $success ? "success" : "error",
                "message" => $success ? "Tous les audios ont été supprimés avec succès." : "Erreur lors de la suppression totale."
            ]);
            return;
        }

        // Suppression unique
        $id = $_POST["id"] ?? null;
        if (!$id) {
            $this->jsonError("ID manquant.");
            return;
        }

        $success = $this->model->delete($id);

        echo json_encode([
            "status"  => $success ? "success" : "error",
            "message" => $success ? "Audio supprimé." : "Audio introuvable ou erreur."
        ]);
    }

    public function upload(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        ini_set('display_errors', 0);
        error_reporting(E_ALL);

        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            $this->jsonError("Requête invalide (POST requis).");
            return;
        }

        if (empty($_POST["transcription"]) || empty($_POST["traduction"])) {
            $this->jsonError("Tous les champs sont obligatoires.");
            return;
        }

        if (!isset($_FILES["audio"]) || $_FILES["audio"]["error"] !== UPLOAD_ERR_OK) {
            $this->jsonError("Aucun fichier audio reçu ou erreur d’upload.");
            return;
        }

        $transcription = trim($_POST["transcription"]);
        $traduction    = trim($_POST["traduction"]);
        $original_name = basename($_FILES["audio"]["name"]);
        $audio_tmp     = $_FILES["audio"]["tmp_name"];

        if (!file_exists($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }

        $ext = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
        if (!in_array($ext, ["wav", "mp3"])) {
            $this->jsonError("Format non supporté. Seuls WAV et MP3 sont acceptés.");
            return;
        }

        // Générer GUID
        $guid = $this->GUID();
        $final_name = $guid . ".wav";
        $final_path = $this->uploadDir . $final_name;

        // Conversion si MP3
        if ($ext === "mp3") {
            $tmp_mp3_path = $this->uploadDir . $guid . ".mp3";
            move_uploaded_file($audio_tmp, $tmp_mp3_path);

            if (!file_exists($this->ffmpegPath)) {
                @unlink($tmp_mp3_path);
                $this->jsonError("FFmpeg introuvable. Vérifie le chemin dans AudioController.php.");
                return;
            }

            $command = "\"" . $this->ffmpegPath . "\" -y -i " . escapeshellarg($tmp_mp3_path) . " -ar 16000 -ac 1 " . escapeshellarg($final_path);
            exec($command, $output, $return_var);
            @unlink($tmp_mp3_path);

            if ($return_var !== 0 || !file_exists($final_path)) {
                $this->jsonError("Erreur lors de la conversion du fichier audio.");
                return;
            }
        } else {
            // WAV direct
            move_uploaded_file($audio_tmp, $final_path);
        }

        // Enregistrement en base
        $audio_path_db = "audios/" . $final_name; 
        $success = $this->model->insert(
            $guid,
            $final_name,
            $original_name,
            $audio_path_db,
            $transcription,
            $traduction
        );

        if ($success) {
            $this->jsonSuccess("Formulaire enregistré avec succès sous l’ID : $guid");
        } else {
            @unlink($final_path); 
            $this->jsonError("Erreur interne lors de l’enregistrement en base.");
        }
    }

    public function export(): void
    {
        header("Content-Type: application/json; charset=UTF-8");

        $exportDir = __DIR__ . '/../dataset_creation/audios/';
        $jsonPath  = __DIR__ . '/../dataset_creation/dataset.json';

        $result = $this->model->exportDataset($exportDir, $jsonPath);

        echo json_encode([
            "status" => "success",
            "file"   => "dataset.json",
            "total"  => $result['total']
        ]);
    }

   
    private function GUID(): string
    {
        if (function_exists('com_create_guid') === true) {
            return trim(com_create_guid(), '{}');
        }

        return sprintf(
            '%04X%04X-%04X-%04X-%04X-%04X%04X%04X',
            mt_rand(0, 65535), mt_rand(0, 65535),
            mt_rand(0, 65535),
            mt_rand(16384, 20479),
            mt_rand(32768, 49151),
            mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(0, 65535)
        );
    }

    private function jsonError(string $message): void
    {
        echo json_encode(["status" => "error", "message" => $message]);
        exit;
    }

    private function jsonSuccess(string $message): void
    {
        echo json_encode(["status" => "success", "message" => $message]);
        exit;
    }
}
?>