import mysql.connector
conn = mysql.connector.connect(host="10.119.3.25", port=3306, user="infodigest", password="infodigest2025", database="info_digest")
cur = conn.cursor()

print("=== Users ===")
cur.execute('SELECT id, username, password FROM users WHERE username like "test%"')
for r in cur.fetchall():
    print("  id=%s, username=%s, password=%s" % r)

print()
print("=== Concepts for test users ===")
cur.execute("""
    SELECT c.id, c.user_id, c.name, c.label 
    FROM concepts c 
    JOIN users u ON c.user_id = u.id 
    WHERE u.username like "test%"
""")
for r in cur.fetchall():
    print("  id=%s, userId=%s, name=%s, label=%s" % r)

cur.close()
conn.close()
