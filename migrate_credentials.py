import base64
import os
import mysql.connector
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# 配置
PREFIX = "enc:v1:"
ENCODED_KEY = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="
KEY = base64.b64decode(ENCODED_KEY)

DB_HOST = "10.119.3.25"
DB_PORT = 3306
DB_USER = "root"
DB_PASS = "root123"
DB_NAME = "info_digest"

def encrypt_credential(value: str) -> str:
    if not value or value.startswith(PREFIX):
        return value
    
    aesgcm = AESGCM(KEY)
    iv = os.urandom(12)  # 12 bytes IV
    # encrypt returns ciphertext + 16-byte auth tag, which perfectly matches Java's doFinal
    encrypted = aesgcm.encrypt(iv, value.encode('utf-8'), None)
    
    payload = iv + encrypted
    return PREFIX + base64.b64encode(payload).decode('utf-8')

def main():
    print("连接数据库...")
    conn = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME
    )
    cur = conn.cursor()

    print("获取明文 Cookie 列表...")
    cur.execute("SELECT id, credential FROM user_platforms")
    records = cur.fetchall()
    
    migrated_count = 0
    skipped_count = 0
    
    for row_id, credential in records:
        if credential and not credential.startswith(PREFIX):
            encrypted_val = encrypt_credential(credential)
            # 更新数据库
            update_cur = conn.cursor()
            update_cur.execute(
                "UPDATE user_platforms SET credential = %s WHERE id = %s",
                (encrypted_val, row_id)
            )
            update_cur.close()
            migrated_count += 1
        else:
            skipped_count += 1
            
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"数据迁移完成！共迁移了 {migrated_count} 条明文数据，跳过了 {skipped_count} 条。")

if __name__ == "__main__":
    main()
