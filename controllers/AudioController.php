<?php
require_once __DIR__ . '/../models/AudioModel.php';
require_once __DIR__ . '/../models/AdminModel.php';

class AudioController
{
    private AudioModel $model;
    private string     $uploadDir;
    private string     $ffmpegPath;

    public function __construct()
    {
        $this->model      = new AudioModel();
        $this->uploadDir  = __DIR__ . '/../audios/';
        $this->ffmpegPath = 'C:\\ffmpeg-2025-10-27-git-68152978b5-full_build\\bin\\ffmpeg.exe';
    }

    public function getAll(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "success", "data" => $this->model->getAllAudios()]);
    }

    public function delete(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if ($_SERVER["REQUEST_METHOD"] !== "POST") { $this->jsonError("Requête invalide."); return; }

        if (isset($_POST["action"]) && $_POST["action"] === "delete_all") {
            $success = $this->model->deleteAll();
            echo json_encode([
                "status"  => $success ? "success" : "error",
                "message" => $success ? "Tous les audios supprimés." : "Erreur suppression totale.",
            ]);
            return;
        }

        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            $this->jsonError("Utilisateur non connecté."); return;
        }

        $id = trim($_POST["id"] ?? '');
        if (!$id) { $this->jsonError("ID manquant."); return; }

        $audio = $this->model->getById($id);
        if (!$audio || ($audio['uploader_ref'] ?? '') !== $uploader_ref) {
            $this->jsonError("Audio introuvable ou accès refusé."); return;
        }

        $success = $this->model->delete($id);
        echo json_encode([
            "status"  => $success ? "success" : "error",
            "message" => $success ? "Audio supprimé." : "Audio introuvable.",
        ]);
    }

    public function upload(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        ini_set('display_errors', 0);

        if ($_SERVER["REQUEST_METHOD"] !== "POST") { $this->jsonError("POST requis."); return; }

        if (empty($_POST["transcription"]) || empty($_POST["traduction"])) {
            $this->jsonError("Transcription et traduction obligatoires."); return;
        }
        if (!isset($_FILES["audio"]) || $_FILES["audio"]["error"] !== UPLOAD_ERR_OK) {
            $this->jsonError("Aucun fichier audio reçu (erreur: " . ($_FILES["audio"]["error"] ?? "?") . ")."); return;
        }

        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            $this->jsonError("Vous devez être connecté pour uploader un audio."); return;
        }

        $transcription = trim($_POST["transcription"]);
        $traduction    = trim($_POST["traduction"]);
        $original_name = basename($_FILES["audio"]["name"]);
        $audio_tmp     = $_FILES["audio"]["tmp_name"];

        if (!file_exists($this->uploadDir)) mkdir($this->uploadDir, 0777, true);

        $ext = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
        if (!in_array($ext, ["wav", "mp3"])) {
            $this->jsonError("Seuls WAV et MP3 sont acceptés."); return;
        }

        $guid       = $this->GUID();
        $final_name = $guid . ".wav";
        $final_path = $this->uploadDir . $final_name;

        if ($ext === "mp3") {
            $tmp_mp3 = $this->uploadDir . $guid . ".mp3";
            move_uploaded_file($audio_tmp, $tmp_mp3);

            if (!file_exists($this->ffmpegPath)) {
                @unlink($tmp_mp3);
                $this->jsonError("FFmpeg introuvable."); return;
            }

            // Convertir ET limiter à 15 secondes
            $cmd = "\"" . $this->ffmpegPath . "\" -y -i " . escapeshellarg($tmp_mp3)
                 . " -ar 16000 -ac 1 -t 15 " . escapeshellarg($final_path);
            exec($cmd, $out, $ret);
            @unlink($tmp_mp3);

            if ($ret !== 0 || !file_exists($final_path)) {
                $this->jsonError("Erreur conversion audio."); return;
            }
        } else {
            // WAV : on coupe aussi à 15s via ffmpeg si disponible, sinon on accepte tel quel
            if (file_exists($this->ffmpegPath)) {
                $tmp_wav = $this->uploadDir . $guid . "_tmp.wav";
                move_uploaded_file($audio_tmp, $tmp_wav);
                $cmd = "\"" . $this->ffmpegPath . "\" -y -i " . escapeshellarg($tmp_wav)
                     . " -ar 16000 -ac 1 -t 15 " . escapeshellarg($final_path);
                exec($cmd, $out, $ret);
                @unlink($tmp_wav);
                if ($ret !== 0 || !file_exists($final_path)) {
                    $this->jsonError("Erreur traitement audio WAV."); return;
                }
            } else {
                move_uploaded_file($audio_tmp, $final_path);
            }
        }

        // Insert sans assignedTo — les validateurs voient tous les E
        $audio_path_db = "audios/" . $final_name;
        $success = $this->model->insert(
            $guid, $final_name, $original_name,
            $audio_path_db, $transcription, $traduction,
            $uploader_ref
        );

        if ($success) {
            $this->jsonSuccess("Enregistrement réussi !");
        } else {
            @unlink($final_path);
            $this->jsonError("Erreur enregistrement en base.");
        }
    }

    public function getUserHistory(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            echo json_encode(["status" => "error", "message" => "Utilisateur non connecté."]); return;
        }

        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 0;
        echo json_encode(["status" => "success", "data" => $this->model->getByUploaderRef($uploader_ref, $limit)]);
    }

    public function updateUserUpload(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if ($_SERVER["REQUEST_METHOD"] !== "POST") {
            $this->jsonError("POST requis."); return;
        }
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $uploader_ref = $_SESSION['uploader_ref'] ?? null;
        if (!$uploader_ref) {
            $this->jsonError("Utilisateur non connecté."); return;
        }

        $id            = trim($_POST['id'] ?? '');
        $transcription = trim($_POST['transcription'] ?? '');
        $traduction    = trim($_POST['traduction'] ?? '');

        if (!$id || !$transcription || !$traduction) {
            $this->jsonError("Champs requis."); return;
        }

        $audio = $this->model->getById($id);
        if (!$audio || ($audio['uploader_ref'] ?? '') !== $uploader_ref) {
            $this->jsonError("Audio introuvable ou accès refusé."); return;
        }

        if (!in_array($audio['status'], ['E','R'], true)) {
            $this->jsonError("Seuls les audios non validés peuvent être modifiés."); return;
        }

        $success = $this->model->updateContent($id, $transcription, $traduction, $uploader_ref);
        echo json_encode([
            "status"  => $success ? "success" : "error",
            "message" => $success ? "Audio mis à jour avec succès." : "Erreur de mise à jour.",
        ]);
    }

    public function export(): void
    {
        header("Content-Type: application/json; charset=UTF-8");
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        if (empty($_SESSION['is_superadmin'])) {
            echo json_encode(["status" => "error", "message" => "Accès refusé. Export réservé aux superadmins."]);
            return;
        }

        $exportDir = __DIR__ . '/../dataset_creation/audios/';
        $jsonPath  = __DIR__ . '/../dataset_creation/dataset.json';
        $result    = $this->model->exportDataset($exportDir, $jsonPath);
        $archived  = $this->model->archiveExportedDataset();

        echo json_encode([
            "status"  => "success",
            "file"    => "dataset.json",
            "total"   => $result['total'],
            "archived" => $archived,
        ]);
    }

    private function GUID(): string
    {
        if (function_exists('com_create_guid')) return trim(com_create_guid(), '{}');
        return sprintf('%04X%04X-%04X-%04X-%04X-%04X%04X%04X',
            mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535),
            mt_rand(16384,20479), mt_rand(32768,49151),
            mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535)
        );
    }

    private function jsonError(string $msg): void  { echo json_encode(["status"=>"error",   "message"=>$msg]); exit; }
    private function jsonSuccess(string $msg): void { echo json_encode(["status"=>"success", "message"=>$msg]); exit; }
}
?>