-- Idempotent Migration: Add system messages to Chat

DELIMITER $$
CREATE PROCEDURE extend_message_type_enum()
BEGIN
  DECLARE current_enum VARCHAR(1000);
  SELECT COLUMN_TYPE INTO current_enum
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'message_type';

  IF current_enum NOT LIKE '%''system''%' THEN
    SET @new_enum = REPLACE(current_enum, ')', ',''system'')');
    SET @sql = CONCAT('ALTER TABLE messages MODIFY COLUMN message_type ', @new_enum, ' NOT NULL DEFAULT ''text''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL extend_message_type_enum();
DROP PROCEDURE extend_message_type_enum;


-- 2. Add system_event_type
SET @has_system_event_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'system_event_type'
);
SET @sql := IF(
  @has_system_event_type = 0,
  'ALTER TABLE messages ADD COLUMN system_event_type VARCHAR(80) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add system_metadata
SET @has_system_metadata := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'system_metadata'
);
SET @sql := IF(
  @has_system_metadata = 0,
  'ALTER TABLE messages ADD COLUMN system_metadata JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add Index on system_event_type
SET @has_idx_system_event_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND INDEX_NAME = 'idx_messages_system_event_type'
);
SET @sql := IF(
  @has_idx_system_event_type = 0,
  'CREATE INDEX idx_messages_system_event_type ON messages (system_event_type)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
