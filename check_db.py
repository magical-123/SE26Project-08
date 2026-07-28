import mysql.connector
conn = mysql.connector.connect(host="127.0.0.1", port=3306, user="infodigest", password="REPLACE_ME", database="info_digest")
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
