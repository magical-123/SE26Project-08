from deployment_config import create_ssh_client, ssh_connect_kwargs
import os



local_file = os.path.join(os.path.dirname(__file__), "docker-compose.yml")
remote_file = "/opt/infodigest/repo/docker-compose.yml"

def upload_compose():
    client = create_ssh_client()

    try:
        client.connect(**ssh_connect_kwargs(timeout=10))
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
