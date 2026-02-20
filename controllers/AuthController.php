<?php
require_once __DIR__ . '/../models/UserModel.php';
require_once __DIR__ . '/../models/VerificationModel.php';
require_once __DIR__ . '/../config/mail.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class AuthController {
    private $userModel;
    private $verifModel;

    public function __construct() {
        $this->userModel = new UserModel();
        $this->verifModel = new VerificationModel();
    }

    // Demande OTP pour inscription/connexion user
    public function requestUserVerification() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['view' => 'user/login'];
        }

        $name = trim($_POST['name'] ?? '');
        $email = trim($_POST['email'] ?? '');


        if (empty($name) || empty($email)) {
            return ['error' => 'Nom complet et email obligatoires'];
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['error' => 'Email invalide'];
        }

        if ($this->userModel->emailExists($email)) {
            // Si existe déjà → on traite comme reconnexion (envoi OTP sans créer nouveau user)
            $existing = $this->userModel->getByEmail($email);
            $userData = [
                'id' => $existing['id'],
                'name' => $existing['name'],
                'email' => $email,
                'ip' => $_SERVER['REMOTE_ADDR']
            ];
        } else {
            // Nouveau user → on stocke temporairement
            $userData = [
                'name' => $name,
                'email' => $email,
                'ip' => $_SERVER['REMOTE_ADDR']
            ];
        }

        // OTP
        $otp = sprintf("%06d", mt_rand(0, 999999));
        $expires = date('Y-m-d H:i:s', strtotime('+10 minutes'));
        $created_at = date('Y-m-d H:i:s');

        $this->verifModel->createVerification($email, 'email', $otp, json_encode($userData), $expires, $created_at);

        // Envoi email
        if (!$this->sendOTPEmail($email, $otp, $name)) {
            return ['error' => 'Erreur envoi email. Réessayez.'];
        }

        return ['success' => true, 'redirect' => 'verify-user?email=' . urlencode($email)];
    }

    private function sendOTPEmail($to, $otp, $name) {
        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host       = SMTP_HOST;
            $mail->SMTPAuth   = true;
            $mail->Username   = SMTP_USERNAME;
            $mail->Password   = SMTP_PASSWORD;
            $mail->SMTPSecure = SMTP_SECURE;
            $mail->Port       = SMTP_PORT;

            $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
            $mail->addAddress($to);

            $mail->isHTML(true);
            $mail->Subject = 'Votre code de connexion - Collecte Linguistique Wolof';
            $mail->Body    = "
                <h2>Bonjour $name,</h2>
                <p>Votre code de vérification est : <strong>$otp</strong></p>
                <p>Il est valable 10 minutes.</p>
                <p>Si vous n'avez pas demandé ce code, ignorez ce message.</p>
                <br>
                <p>Équipe SOLID Afrique</p>
            ";

            $mail->send();
            return true;
        } catch (Exception $e) {
            error_log("Erreur PHPMailer : {$mail->ErrorInfo}");
            return false;
        }
    }

    // Vérification du code OTP
    public function verifyUserCode() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $email = trim($_POST['email'] ?? '');
            $code  = trim($_POST['code'] ?? '');

            if (empty($email) || empty($code)) {
                return ['error' => 'Code obligatoire'];
            }

            $userData = $this->verifModel->verifyCode($email, $code);
            if (!$userData) {
                return ['error' => 'Code invalide ou expiré'];
            }

            // Si nouveau user → créer
            if (!isset($userData['id'])) {
                $userId = $this->userModel->createUser(
                    $userData['name'],
                    $userData['email'],
                    $userData['ip']
                );
            } else {
                $userId = $userData['id'];
            }

            // Connexion
            if (session_status() !== PHP_SESSION_ACTIVE) {
                session_start();
            }

            $_SESSION['user_id']   = $userId;
            $_SESSION['user_name'] = $userData['name'] ?? $this->userModel->getById($userId)['name'];

            // Récupérer et stocker uploader_ref pour association d'uploads
            $user = $this->userModel->getById($userId);
            if (!empty($user['uploader_ref'])) {
                $_SESSION['uploader_ref'] = $user['uploader_ref'];
            }

            // redirection relative vers la racine de l'app (dossier public)
            return ['success' => true, 'message' => 'Connecté avec succès !', 'redirect' => './'];
        }

        // GET : afficher page code
        $email = trim($_GET['email'] ?? '');
        return ['view' => 'user/verify', 'email' => $email];
    }
}