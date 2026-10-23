from deployment_config import create_ssh_client, ssh_connect_kwargs
import sys

def run_remote(command):
    try:
        ssh = create_ssh_client()

        ssh.connect(**ssh_connect_kwargs(timeout=10))
        print(f"Executing: {command}")
        stdin, stdout, stderr = ssh.exec_command(command)
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        
        print(f"Exit status: {exit_status}")
        if out:
            print(f"STDOUT:\n{out}")
        if err:
            print(f"STDERR:\n{err}")
            
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_remote(sys.argv[1])
    else:
        # Check if docker compose v2 exists
        run_remote("docker compose version")
