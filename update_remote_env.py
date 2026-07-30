import paramiko
import re

host = "127.0.0.1"
user = "root"
password = "REPLACE_ME"
remote_env_path = "/opt/infodigest/repo/.env"

def update_env():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password, timeout=10)
        sftp = client.open_sftp()
        
        # 读取远程的 .env 文件
        with sftp.file(remote_env_path, 'r') as f:
            content = f.read().decode('utf-8')
            
        # 查找是否已经有 ALIYUN_NAMESPACE
        if "ALIYUN_NAMESPACE=" in content:
            content = re.sub(r"ALIYUN_NAMESPACE=.*", "ALIYUN_NAMESPACE=infodigest", content)
        else:
            if not content.endswith("\n"):
                content += "\n"
            content += "ALIYUN_NAMESPACE=infodigest\n"
            
        # 写回远程
        with sftp.file(remote_env_path, 'w') as f:
            f.write(content.encode('utf-8'))
            
        print("Successfully updated remote .env file with ALIYUN_NAMESPACE=infodigest")
        sftp.close()
    except Exception as e:
        print(f"Failed to update env: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    update_env()
