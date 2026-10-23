from deployment_config import create_ssh_client, ssh_connect_kwargs
import os

files_to_upload = [
    "docker-compose.yml",
    ".env.example",
    "backend/Dockerfile",
    "frontend/Dockerfile",
    "frontend/nginx.conf"
]



remote_dir = "/opt/infodigest/repo"

def upload():
    client = create_ssh_client()

    try:
        client.connect(**ssh_connect_kwargs(timeout=10))
        sftp = client.open_sftp()
        for f in files_to_upload:
            local_path = os.path.join(".", f)
            remote_path = f"{remote_dir}/{f}"
            print(f"Uploading {local_path} to {remote_path}...")
            # 确保远程目录存在
            remote_parent = "/".join(remote_path.split("/")[:-1])
            try:
                sftp.stat(remote_parent)
            except IOError:
                client.exec_command(f"mkdir -p {remote_parent}")
            
            sftp.put(local_path, remote_path)
            print(f"Uploaded {f}")
        sftp.close()
    except Exception as e:
        print(f"Failed: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    upload()
