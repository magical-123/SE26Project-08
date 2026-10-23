import os
from deployment_config import create_ssh_client, ssh_connect_kwargs



remote_file = "/opt/infodigest/repo/docker-compose.yml"

def revert_domain():
    client = create_ssh_client()

    try:
        client.connect(**ssh_connect_kwargs(timeout=10))
        sftp = client.open_sftp()
        with sftp.file(remote_file, 'r') as f:
            content = f.read().decode('utf-8')
            
        content = content.replace(os.environ["DEPLOY_OLD_REGISTRY"], os.environ["DEPLOY_REGISTRY"])
        
        with sftp.file(remote_file, 'w') as f:
            f.write(content.encode('utf-8'))
            
        print("Successfully reverted domain on remote server")
        sftp.close()
    except Exception as e:
        print(f"Failed to revert domain: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    revert_domain()
