import paramiko
import re

host = "127.0.0.1"
user = "root"
password = "REPLACE_ME"
remote_file = "/opt/infodigest/repo/docker-compose.yml"

def update_region():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password, timeout=10)
        sftp = client.open_sftp()
        with sftp.file(remote_file, 'r') as f:
            content = f.read().decode('utf-8')
            
        content = content.replace("cn-hangzhou", "cn-shanghai")
        
        with sftp.file(remote_file, 'w') as f:
            f.write(content.encode('utf-8'))
            
        print("Successfully updated region to cn-shanghai on remote server")
        sftp.close()
    except Exception as e:
        print(f"Failed to update region: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    update_region()
