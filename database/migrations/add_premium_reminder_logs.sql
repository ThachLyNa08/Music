CREATE TABLE IF NOT EXISTS premium_reminder_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    subscription_id INT UNSIGNED NULL,
    subscription_end_date DATETIME NOT NULL,
    reminder_type VARCHAR(30) NOT NULL,
    notification_id INT UNSIGNED NULL,
    sent_by_admin_id INT UNSIGNED NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_premium_reminder_once UNIQUE (user_id, subscription_end_date, reminder_type),
    CONSTRAINT fk_premium_reminder_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_premium_reminder_noti FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL,
    CONSTRAINT fk_premium_reminder_admin FOREIGN KEY (sent_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
) COMMENT='Lưu log các nhắc nhở gia hạn Premium đã gửi';
