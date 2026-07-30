import paramiko
import os

host = "10.119.3.25"
user = "root"
password = "Root1234"
local_file = "c:\\Users\\15600\\Desktop\\软工原\\InfoDigest-\\docker-compose.yml"
remote_file = "/opt/infodigest/repo/docker-compose.yml"

def upload_compose():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password, timeout=10)
        sftp = client.open_sftp()
        sftp.put(local_file, remote_file)
        print("Successfully uploaded the new GHCR docker-compose.yml to remote server")
        sftp.close()
    except Exception as e:
        print(f"Failed to upload: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    upload_compose()
