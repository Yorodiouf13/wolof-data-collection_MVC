<?php
// public/index.php - Point d'entrée unique

require_once __DIR__ . '/../controllers/AudioController.php';

$controller = new AudioController();

// Récupération de l'URI une seule fois
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = ltrim($uri, '/'); // ex. : "", "style.css", "get-audios", "audios/monfichier.wav"

// ==================== ROUTES API ====================
$apiRoutes = ['get-audios', 'upload', 'delete-audio', 'export-dataset'];
if (in_array($uri, $apiRoutes)) {
    switch ($uri) {
        case 'get-audios':
            $controller->getAll();
            break;
        case 'upload':
            $controller->upload();
            break;
        case 'delete-audio':
            $controller->delete();
            break;
        case 'export-dataset':
            $controller->export();
            break;
    }
    exit;
}

// ==================== SERVIR LES AUDIOS ====================
if (substr($uri, 0, 7) === 'audios/') {
    $filePath = __DIR__ . '/../' . $uri;

    if (file_exists($filePath) && strtolower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'wav') {
        header('Content-Type: audio/wav');
        header('Content-Length: ' . filesize($filePath));
        header('Accept-Ranges: bytes');
        readfile($filePath);
        exit;
    } else {
        http_response_code(404);
        exit;
    }
}

// ==================== TÉLÉCHARGEMENT DATASET.JSON ====================
if ($uri === 'dataset.json') {
    $filePath = __DIR__ . '/../dataset_creation/dataset.json';

    if (file_exists($filePath)) {
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="dataset.json"');
        readfile($filePath);
        exit;
    }
}

// ==================== FICHIERS STATIQUES (vues, CSS, JS) ====================
$viewsPath = __DIR__ . '/../views/';

$staticFiles = [
    ''                   => 'user/index.html',
    'index.html'         => 'user/index.html',
    'style.css'          => 'user/style.css',
    'script.js'          => 'user/script.js',
    'admin.html'         => 'admin/admin.html',
    'style_admin.css'    => 'admin/style_admin.css',
    'script_admin.js'    => 'admin/script_admin.js',
];

if (array_key_exists($uri, $staticFiles)) {
    $filePath = $viewsPath . $staticFiles[$uri];

    if (file_exists($filePath)) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        $mimes = [
            'html' => 'text/html',
            'css'  => 'text/css',
            'js'   => 'application/javascript',
        ];

        header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
        readfile($filePath);
        exit;
    } else {
        // Fichier manquant (utile pour debug)
        http_response_code(500);
        echo "Fichier introuvable sur le serveur : " . $staticFiles[$uri];
        exit;
    }
}

// ==================== 404 ====================
http_response_code(404);
echo json_encode(["status" => "error", "message" => "Ressource non trouvée."]);
?>