<?php

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');          
define('DB_NAME', 'data_collection_wolof');
define('DB_CHARSET', 'utf8mb4');

function getDatabaseConnection(): mysqli
{
    static $conn = null; 

    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

        // Vérifier la connexion
        if ($conn->connect_error) {
            error_log("Erreur de connexion DB : " . $conn->connect_error);
            die("Une erreur est survenue. Veuillez réessayer plus tard.");
        }
        $conn->set_charset(DB_CHARSET);
    }

    return $conn;
}
?>