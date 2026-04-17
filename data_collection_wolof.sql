-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mar. 13 jan. 2026 à 13:03
-- Version du serveur : 8.2.0
-- Version de PHP : 8.2.13

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `data_collection_wolof`
--

-- --------------------------------------------------------

--
-- Structure de la table users
--

DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
  id varchar(20) NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  last_ip varchar(45),
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table verifications
--

DROP TABLE IF EXISTS verifications;
CREATE TABLE IF NOT EXISTS verifications (
  id int NOT NULL AUTO_INCREMENT,
  identifier varchar(255) NOT NULL,
  type varchar(50) NOT NULL,
  code varchar(10) NOT NULL,
  user_data longtext NOT NULL,
  expires_at datetime NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table uploads
--

DROP TABLE IF EXISTS uploads;
CREATE TABLE IF NOT EXISTS uploads (
  id varchar(20) NOT NULL,
  audio_name varchar(255) NOT NULL,
  original_name varchar(255) DEFAULT NULL,
  audio_path varchar(255) NOT NULL,
  transcription text NOT NULL,
  traduction text NOT NULL,
  date_creation timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--

-- Ajouter colonne uploader_ref pour lier les uploads aux utilisateurs (si manquante)
ALTER TABLE users
  ADD COLUMN uploader_ref VARCHAR(32) DEFAULT NULL AFTER email;

-- Ajouter colonnes de gestion/assignation/statut à uploads
ALTER TABLE uploads
  ADD COLUMN uploader_ref VARCHAR(32) DEFAULT NULL AFTER traduction,
  ADD COLUMN assigned_to VARCHAR(32) DEFAULT NULL,
  ADD COLUMN controlled_by VARCHAR(32) DEFAULT NULL,
  ADD COLUMN controlled_at DATETIME DEFAULT NULL,
  ADD COLUMN status CHAR(1) DEFAULT 'E',
  ADD COLUMN last_modified_by VARCHAR(32) DEFAULT NULL,
  ADD COLUMN last_modified_at DATETIME DEFAULT NULL,
  ADD COLUMN rejection_reason VARCHAR(255) DEFAULT NULL;

-- Index utiles
ALTER TABLE uploads
  ADD INDEX idx_assigned_to (assigned_to),
  ADD INDEX idx_controlled_by (controlled_by),
  ADD INDEX idx_status (status);

-- Création de la table admins ( validateurs / Controleurs)
DROP TABLE IF EXISTS admins;
CREATE TABLE IF NOT EXISTS admins (
  id varchar(32) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(100) DEFAULT NULL,
  phone varchar(20) DEFAULT NULL,
  uploader_ref varchar(32) DEFAULT NULL,
  password_hash varchar(255) DEFAULT NULL,
  role varchar(50) DEFAULT 'validator',
  is_first_login tinyint(1) DEFAULT 1,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  last_login_at datetime DEFAULT NULL,
  last_ip varchar(45) DEFAULT NULL,
  username VARCHAR(50) UNIQUE NOT NULL AFTER email,
  is_superadmin BOOLEAN DEFAULT FALSE AFTER role
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email),
  UNIQUE KEY uq_admins_phone (phone)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE admins 
  ADD COLUMN temp_password VARCHAR(50) DEFAULT NULL,
  ADD COLUMN permissions VARCHAR(255) DEFAULT NULL;

-- Mettre à jour les permissions par défaut selon le rôle
UPDATE admins 
  SET permissions = 'edit_transcription,validate,reject,delete' WHERE role = 'validator',
  SET permissions = 'edit_transcription,validate,reject,delete,export,archive' WHERE role = 'controller';

-- Renommer les anciens rôles pour correspondre à la nouvelle structure
UPDATE admins SET role = 'validator' WHERE role IN ('linguist');

-- Création de la table d'audit
CREATE TABLE IF NOT EXISTS audit_logs (
  id int NOT NULL AUTO_INCREMENT,
  audio_id varchar(32) NOT NULL,
  admin_id varchar(32) DEFAULT NULL,
  action varchar(50) NOT NULL,
  old_data longtext,
  new_data longtext,
  reason varchar(255) DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO admins (id, name, email, username, password_hash, is_superadmin, is_first_login) 
VALUES (
    'super_admin_001',
    'Super Administrateur',
    'super@wolof.local',
    'superadmin',
    '2y$10$3mQqxgjXS0GALa2JjwclKuWqg9ssMcrv./NQT5x8oO6cgEh1uNnra',
    TRUE,
    1
);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
