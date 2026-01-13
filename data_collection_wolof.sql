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
-- Structure de la table `uploads`
--

DROP TABLE IF EXISTS `uploads`;
CREATE TABLE IF NOT EXISTS `uploads` (
  `id` varchar(20) NOT NULL,
  `audio_name` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `audio_path` varchar(255) NOT NULL,
  `transcription` text NOT NULL,
  `traduction` text NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `uploads`
--

INSERT INTO `uploads` (`id`, `audio_name`, `original_name`, `audio_path`, `transcription`, `traduction`, `date_creation`) VALUES
('C75ECCC3-5680-445A-B', 'C75ECCC3-5680-445A-B136-32F697BABD63.wav', 'Joker-Aya-version-chipmunk.mp3', 'audios/C75ECCC3-5680-445A-B136-32F697BABD63.wav', 'vdnm', 'vdcbn', '2026-01-12 16:09:57'),
('8DF68D8F-2436-49E3-A', '8DF68D8F-2436-49E3-A648-C33CDA4DBFE2.wav', 'swoosh-riser-reverb-390309.mp3', 'audios/8DF68D8F-2436-49E3-A648-C33CDA4DBFE2.wav', 'et voilà', 'et voilà encore', '2026-01-02 11:33:15'),
('8CA19FE2-FF92-448A-B', '8CA19FE2-FF92-448A-B7B8-0603DF7DAD51.wav', 'the-acid-trance-queen-194846.mp3', 'audios/8CA19FE2-FF92-448A-B7B8-0603DF7DAD51.wav', 'revoilà', 'revoilà encore', '2026-01-02 11:33:45'),
('C05E514D-7FDD-4D4C-A', 'C05E514D-7FDD-4D4C-A791-2BA48E1EDCA2.wav', 'Đồng hồ đếm ngược dành cho ai làm video 10s.mp3', 'audios/C05E514D-7FDD-4D4C-A791-2BA48E1EDCA2.wav', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi ex tempora nam consequuntur nostrum? Aliquam accusantium quis voluptas earum quo error saepe impedit officia ducimus accusamus vel repellat, dicta vero.', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi ex tempora nam consequuntur nostrum? Aliquam accusantium quis voluptas earum quo error saepe impedit officia ducimus accusamus vel repellat, dicta vero.', '2026-01-02 11:35:08');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
