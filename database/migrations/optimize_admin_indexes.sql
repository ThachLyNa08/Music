DELIMITER $$

DROP PROCEDURE IF EXISTS CreateIndexIfNotExists $$
CREATE PROCEDURE CreateIndexIfNotExists (
    IN param_table_name VARCHAR(255),
    IN param_index_name VARCHAR(255),
    IN param_columns VARCHAR(255)
)
BEGIN
    DECLARE IndexIsThere INT;
    SELECT COUNT(1) INTO IndexIsThere
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema = DATABASE()
    AND table_name = param_table_name
    AND index_name = param_index_name;

    IF IndexIsThere = 0 THEN
        SET @sqlstmt = CONCAT('CREATE INDEX ', param_index_name, ' ON ', param_table_name, ' (', param_columns, ')');
        PREPARE stmt FROM @sqlstmt;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Created index ', param_index_name, ' on ', param_table_name) AS msg;
    ELSE
        SELECT CONCAT('Index ', param_index_name, ' already exists on ', param_table_name) AS msg;
    END IF;
END $$

DROP PROCEDURE IF EXISTS CreateIndexIfColumnExists $$
CREATE PROCEDURE CreateIndexIfColumnExists (
    IN param_table_name VARCHAR(255),
    IN param_index_name VARCHAR(255),
    IN param_column_name VARCHAR(255)
)
BEGIN
    DECLARE ColumnIsThere INT;

    SELECT COUNT(1) INTO ColumnIsThere
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = DATABASE()
    AND table_name = param_table_name
    AND column_name = param_column_name;

    IF ColumnIsThere > 0 THEN
        CALL CreateIndexIfNotExists(param_table_name, param_index_name, param_column_name);
    ELSE
        SELECT CONCAT('Column ', param_column_name, ' does not exist in ', param_table_name, ', skipping index creation') AS msg;
    END IF;
END $$

DROP PROCEDURE IF EXISTS CreateCompositeIndexIfExists $$
CREATE PROCEDURE CreateCompositeIndexIfExists (
    IN param_table_name VARCHAR(255),
    IN param_index_name VARCHAR(255),
    IN param_col1 VARCHAR(255),
    IN param_col2 VARCHAR(255)
)
BEGIN
    DECLARE Col1There INT;
    DECLARE Col2There INT;

    SELECT COUNT(1) INTO Col1There
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = DATABASE()
    AND table_name = param_table_name
    AND column_name = param_col1;

    SELECT COUNT(1) INTO Col2There
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = DATABASE()
    AND table_name = param_table_name
    AND column_name = param_col2;

    IF Col1There > 0 AND Col2There > 0 THEN
        CALL CreateIndexIfNotExists(param_table_name, param_index_name, CONCAT(param_col1, ', ', param_col2));
    ELSE
        SELECT CONCAT('Columns ', param_col1, ' or ', param_col2, ' do not exist in ', param_table_name, ', skipping index creation') AS msg;
    END IF;
END $$

DELIMITER ;

-- Indexes for users
CALL CreateIndexIfColumnExists('users', 'idx_users_email', 'email');
CALL CreateIndexIfColumnExists('users', 'idx_users_status', 'status');
CALL CreateIndexIfColumnExists('users', 'idx_users_role', 'role');
CALL CreateIndexIfColumnExists('users', 'idx_users_created_at', 'created_at');
CALL CreateIndexIfColumnExists('users', 'idx_users_is_experiment', 'is_experiment');

-- Indexes for songs
CALL CreateIndexIfColumnExists('songs', 'idx_songs_artist_id', 'artist_id');
CALL CreateIndexIfColumnExists('songs', 'idx_songs_album_id', 'album_id');

-- Indexes for listening_history
CALL CreateIndexIfColumnExists('listening_history', 'idx_lh_user_id', 'user_id');
CALL CreateIndexIfColumnExists('listening_history', 'idx_lh_song_id', 'song_id');
CALL CreateIndexIfColumnExists('listening_history', 'idx_lh_listened_at', 'listened_at');
CALL CreateIndexIfColumnExists('listening_history', 'idx_lh_created_at', 'created_at');
CALL CreateIndexIfColumnExists('listening_history', 'idx_lh_source', 'source');

CALL CreateCompositeIndexIfExists('listening_history', 'idx_lh_created_song', 'created_at', 'song_id');
CALL CreateCompositeIndexIfExists('listening_history', 'idx_lh_listened_song', 'listened_at', 'song_id');
CALL CreateCompositeIndexIfExists('listening_history', 'idx_lh_source_created', 'source', 'created_at');

-- Cleanup
DROP PROCEDURE IF EXISTS CreateCompositeIndexIfExists;
DROP PROCEDURE IF EXISTS CreateIndexIfColumnExists;
DROP PROCEDURE IF EXISTS CreateIndexIfNotExists;
