import mysql.connector
from deployment_config import database_options
conn = mysql.connector.connect(**database_options())
cur = conn.cursor()

print("=== Users ===")
cur.execute('SELECT id, username FROM users WHERE username like "test%"')
for r in cur.fetchall():
    print("  id=%s, username=%s" % r)

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
