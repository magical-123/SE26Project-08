import sys
from deployment_config import create_ssh_client, ssh_connect_kwargs

client = create_ssh_client()

try:
    print("Connecting to the configured deployment host...")
    client.connect(**ssh_connect_kwargs(timeout=10))
    print("Connected. Executing deployment...")
    
    command = "cd /opt/infodigest/repo && docker-compose ps"
    stdin, stdout, stderr = client.exec_command(command, get_pty=True)
    
    for line in iter(stdout.readline, ""):
        print(line, end="")
        sys.stdout.flush()
        
    status = stdout.channel.recv_exit_status()
    print(f"Deployment finished with status: {status}")
except Exception as e:
    import traceback
    print(traceback.format_exc())
finally:
    client.close()
