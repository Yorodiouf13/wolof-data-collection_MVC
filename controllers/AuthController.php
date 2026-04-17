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

    // Demande de connexion utilisateur par email ou téléphone
    public function requestUserVerification() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['view' => 'user/login'];
        }

        $identifier = trim($_POST['identifier'] ?? '');
        if (empty($identifier)) {
            return ['error' => 'Veuillez indiquer votre email ou votre numéro de téléphone.'];
        }

        $isEmail = filter_var($identifier, FILTER_VALIDATE_EMAIL);
        $isPhone = preg_match('/^[0-9+\s-]{7,20}$/', $identifier);
        if (!$isEmail && !$isPhone) {
            return ['error' => 'Format invalide. Utilisez un email ou un numéro de téléphone.'];
        }

        $user = null;
        if ($isEmail) {
            $user = $this->userModel->getByEmail($identifier);
            if (!$user) {
                $name   = $this->generateDefaultName($identifier, '');
                $userId = $this->userModel->createUser($name, $identifier, $_SERVER['REMOTE_ADDR'] ?? '', null);
                $user   = $this->userModel->getById($userId);
            }
        } else {
            $user = $this->userModel->getByPhone($identifier);
            if (!$user) {
                // Créer un compte avec le numéro, mais une adresse email reste nécessaire pour l'OTP.
                $name   = $this->generateDefaultName('', $identifier);
                $userId = $this->userModel->createUser($name, '', $_SERVER['REMOTE_ADDR'] ?? '', $identifier);
                $user   = $this->userModel->getById($userId);
            }
        }

        if (!$user) {
            return ['error' => 'Impossible de charger ou créer le compte.'];
        }

        $otp      = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $userData = json_encode([
            'id'    => $user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'] ?? null,
            'ip'    => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);

        $expires = date('Y-m-d H:i:s', time() + 600);
        $created = date('Y-m-d H:i:s');
        $this->verifModel->createVerification($identifier, 'login', $otp, $userData, $expires, $created);

        if (!empty($user['email'])) {
            if (!$this->sendOTPEmail($user['email'], $otp, $user['name'] ?? $identifier)) {
                return ['error' => 'Impossible d\'envoyer le code OTP.'];
            }
            return ['success' => true, 'message' => 'Un code a été envoyé à votre adresse email.', 'redirect' => 'verify-user?identifier=' . urlencode($identifier)];
        }

        return [
            'success' => true,
            'message' => 'Compte créé. Votre code temporaire s’affiche sur la page de vérification.',
            'redirect' => 'verify-user?identifier=' . urlencode($identifier),
            'otp' => $otp
        ];
    }

    private function generateDefaultName(string $email, string $phone): string {
        if (!empty($email)) {
            return 'Utilisateur ' . strstr($email, '@', true);
        }
        return 'Utilisateur ' . preg_replace('/[^0-9]/', '', $phone);
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
            $identifier = trim($_POST['identifier'] ?? '');
            $code       = trim($_POST['code'] ?? '');

            if (empty($identifier) || empty($code)) {
                return ['error' => 'Code et identifiant obligatoires'];
            }

            $userData = $this->verifModel->verifyCode($identifier, $code);
            if (!$userData) {
                return ['error' => 'Code invalide ou expiré'];
            }

            $userId = $userData['id'] ?? null;
            if (!$userId) {
                $userId = $this->userModel->createUser(
                    $userData['name'] ?? $this->generateDefaultName($userData['email'] ?? '', $userData['phone'] ?? ''),
                    $userData['email'] ?? '',
                    $_SERVER['REMOTE_ADDR'] ?? '',
                    $userData['phone'] ?? null
                );
            }

            if (session_status() !== PHP_SESSION_ACTIVE) {
                session_start();
            }

            $_SESSION['user_id']    = $userId;
            $_SESSION['user_name']  = $userData['name'] ?? $this->userModel->getById($userId)['name'];
            $_SESSION['user_email'] = $userData['email'] ?? $_SESSION['user_email'] ?? null;
            $_SESSION['user_phone'] = $userData['phone'] ?? $_SESSION['user_phone'] ?? null;

            $user = $this->userModel->getById($userId);
            if (!empty($user['uploader_ref'])) {
                $_SESSION['uploader_ref'] = $user['uploader_ref'];
            }

            return ['success' => true, 'message' => 'Connecté avec succès !', 'redirect' => './'];
        }

        $identifier = trim($_GET['identifier'] ?? '');
        return ['view' => 'user/verify', 'identifier' => $identifier];
    }
}