import mysql.connector

try:
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="261999",
        database="musicflow"
    )
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, audio_url FROM songs LIMIT 10")
    for row in cursor.fetchall():
        print(row)
    conn.close()
except Exception as e:
    print(e)
