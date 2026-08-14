DROP PROCEDURE IF EXISTS DropIndexIfExists;

DELIMITER //

CREATE PROCEDURE DropIndexIfExists(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` DROP INDEX `', p_index_name, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DELIMITER ;

CALL DropIndexIfExists('users', 'idx_email');
CALL DropIndexIfExists('users', 'idx_users_email');
CALL DropIndexIfExists('users', 'idx_users_role');
CALL DropIndexIfExists('users', 'idx_users_status');

DROP PROCEDURE DropIndexIfExists;
