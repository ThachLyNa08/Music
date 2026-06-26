-- Safe ADD COLUMN migration
DELIMITER //

CREATE PROCEDURE AddRefreshDates()
BEGIN
    DECLARE col_exists INT;
    
    SELECT COUNT(*) INTO col_exists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name = 'playlists'
      AND column_name = 'last_refreshed_at';
      
    IF col_exists = 0 THEN
        ALTER TABLE playlists
        ADD COLUMN last_refreshed_at DATETIME NULL AFTER updated_at,
        ADD COLUMN next_refresh_at DATETIME NULL AFTER last_refreshed_at;
    END IF;
END //

DELIMITER ;

CALL AddRefreshDates();
DROP PROCEDURE AddRefreshDates;

-- Stagger backfill for Daily Mixes
UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 6 DAY)
WHERE name = 'Daily Mix 01' AND last_refreshed_at IS NULL;

UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 5 DAY)
WHERE name = 'Daily Mix 02' AND last_refreshed_at IS NULL;

UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 4 DAY)
WHERE name = 'Daily Mix 03' AND last_refreshed_at IS NULL;

UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 3 DAY)
WHERE name = 'Daily Mix 04' AND last_refreshed_at IS NULL;

UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 2 DAY)
WHERE name = 'Daily Mix 05' AND last_refreshed_at IS NULL;

UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE name = 'Daily Mix 06' AND last_refreshed_at IS NULL;

-- Backfill Weekly Mix and other system playlists that are null
UPDATE playlists
SET last_refreshed_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE name LIKE '%Weekly Mix%' AND last_refreshed_at IS NULL;
