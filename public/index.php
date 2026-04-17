<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
session_start();

require_once __DIR__ . '/../controllers/AudioController.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/AdminController.php';
require_once __DIR__ . '/../controllers/SuperAdminController.php';


$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = ltrim($uri, '/');

$basePath = 'collecte_data_wolof_mvc/public/';
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}

// ==================== ROUTES API ====================
$apiRoutes = ['get-audios', 'upload', 'delete-audio', 'export-dataset', 'auth-status', 'user-history', 'update-user-upload'];

if (in_array($uri, $apiRoutes)) {
    $controller = new AudioController();
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
        case 'auth-status':
            if (session_status() !== PHP_SESSION_ACTIVE) session_start();
            $logged = isset($_SESSION['user_id']);
            header('Content-Type: application/json');
            echo json_encode([
                'logged'       => $logged,
                'user_name'    => $_SESSION['user_name'] ?? null,
                'user_email'   => $_SESSION['user_email'] ?? null,
                'uploader_ref' => $_SESSION['uploader_ref'] ?? null
            ]);
            break;
        case 'user-history':
            $controller->getUserHistory();
            break;
        case 'update-user-upload':
            $controller->updateUserUpload();
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

// ==================== FICHIERS STATIQUES ====================
$viewsPath = __DIR__ . '/../views/';

$staticFiles = [
    ''                        => 'user/index.html',
    'index.php'               => 'user/index.html',
    'index.html'              => 'user/index.html',
    'style.css'               => 'user/style.css',
    'style2.css'              => 'user/style2.css',
    'script.js'               => 'user/script.js',
    'admin.html'              => 'admin/admin.html',
    'style_admin.css'         => 'admin/style_admin.css',
    'script_admin.js'         => 'admin/script_admin.js',
    'loginAdmin'              => 'admin/loginAdmin.html',
    'loginAdmin.html'         => 'admin/loginAdmin.html',
    'superadmin-dashboard'    => 'admin/superadmin-dashboard.html',
    'superadmin-dashboard.html' => 'admin/superadmin-dashboard.html',
    'adminChangePassword'         => 'admin/admin-change-password.html',
    'admin-change-password.html'  => 'admin/admin-change-password.html',
    'script_superadmin.js'    => 'admin/script_superadmin.js',
    'style_superadmin.css'    => 'admin/style_superadmin.css',
    'style_admin-cp.css'      => 'admin/style_admin-cp.css',
    'loginAdmin.js'           => 'admin/loginAdmin.js',
    'admin-change-password.js'=> 'admin/admin-change-password.js',
    'loginAdmin.css'          => 'admin/loginAdmin.css',
    'history.html'            => 'user/history.html',
    'history.js'              => 'user/history.js',
    'cadenas.png'             => 'user/cadenas.png',
    'bouton-modifier.png'     => 'assets/Icones/bouton-modifier.png',
    'coche.png'               => 'assets/Icones/coche.png',
    'effacer.png'             => 'assets/Icones/effacer.png',
    'exportation.png'         => 'assets/Icones/exportation.png',
    'les-archives.png'        => 'assets/Icones/les-archives.png',
    'rejete.png'              => 'assets/Icones/rejete.png',
    'boite-de-reception.png'  => 'assets/Icones/boite-de-reception.png',
    'rechercher.png'          => 'assets/Icones/rechercher.png',
];

if (array_key_exists($uri, $staticFiles)) {
    $filePath = $viewsPath . $staticFiles[$uri];

    if (file_exists($filePath)) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $mimes = [
            'html' => 'text/html',
            'css'  => 'text/css',
            'js'   => 'application/javascript',
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
        ];
        header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
        readfile($filePath);
        exit;
    } else {
        http_response_code(500);
        echo "Fichier introuvable sur le serveur : " . $staticFiles[$uri];
        exit;
    }
}

// ==================== ROUTES ADMIN ====================
$adminRoutes = ['admin-login', 'admin-Change-Password', 'admin-logout','get-audios-role',
                'auth-status-admin', 'update-audio-status', 'update-audio-content', 'archive-all-validated', 'take-control'];

if (in_array($uri, $adminRoutes)) {
    $adminCtrl = new AdminController();

    switch ($uri) {
        case 'admin-login':
            $result = $adminCtrl->loginAdmin();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'admin-Change-Password':
            $result = $adminCtrl->setAdminPassword();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'admin-logout':
            $result = $adminCtrl->logoutAdmin();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'get-audios-role':
            $adminCtrl->getAudiosForRole();
            exit; 
        case 'auth-status-admin':
            $adminCtrl->authStatusAdmin(); 
            exit;

        case 'update-audio-status':
            $adminCtrl->updateAudioStatus(); 
            exit;

        case 'update-audio-content':
            $adminCtrl->updateAudioContent(); 
            exit;

        case 'archive-all-validated':
            $adminCtrl->archiveAllValidated(); 
            exit;

        case 'take-control':
            $adminCtrl->takeControl();
            exit;
    }
    exit;
}

// ==================== AUTHENTIFICATION USER (OTP) ====================
if (in_array($uri, ['login-user', 'request-verification', 'verify-user'])) {
    $auth = new AuthController();

    switch ($uri) {
        case 'login-user':
            readfile($viewsPath . 'user/login.html');
            exit;

        case 'request-verification':
            $result = $auth->requestUserVerification();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'verify-user':
            $result = $auth->verifyUserCode();
            if (isset($result['view'])) {
                $email = $_GET['email'] ?? '';
                $html  = file_get_contents($viewsPath . $result['view'] . '.html');
                $html  = str_replace('{{email}}', htmlspecialchars($email), $html);
                echo $html;
            } else {
                header('Content-Type: application/json');
                echo json_encode($result);
            }
            exit;
    }
}

// ==================== SUPER ADMIN ROUTES ====================
$superAdminRoutes = [
    'superadmin-get-admins', 'superadmin-create-admin', 'superadmin-update-admin', 'superadmin-delete-admin',
    'superadmin-get-users',  'superadmin-delete-user',
    'superadmin-get-audios', 'superadmin-update-audio', 'superadmin-delete-audio'
];

if (in_array($uri, $superAdminRoutes)) {
    $superAdmin = new SuperAdminController();

    switch ($uri) {
        case 'superadmin-get-admins':
            $superAdmin->getAdminsList();
            break;

        case 'superadmin-create-admin':
            $result = $superAdmin->createAdmin();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'superadmin-update-admin':
            $result = $superAdmin->updateAdmin();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'superadmin-delete-admin':
            $result = $superAdmin->deleteAdmin();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'superadmin-get-users':
            $superAdmin->getUsersList();
            break;

        case 'superadmin-delete-user':
            $result = $superAdmin->deleteUser();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'superadmin-get-audios':
            $superAdmin->getAudiosList();
            break;

        case 'superadmin-update-audio':
            $result = $superAdmin->updateAudio();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;

        case 'superadmin-delete-audio':
            $result = $superAdmin->deleteAudio();
            header('Content-Type: application/json');
            echo json_encode($result);
            exit;
    }
    exit;
}

// ==================== 404 ====================
http_response_code(404);
echo json_encode(["status" => "error", "message" => "Ressource non trouvée."]);
?>