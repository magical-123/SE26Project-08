import sys
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    print("Connecting to 10.119.3.25...")
    client.connect("10.119.3.25", username="root", password="Root1234", timeout=10)
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
