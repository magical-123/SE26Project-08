import sys
import paramiko

def run_ssh_command(host, user, password, command):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password, timeout=600)
        stdin, stdout, stderr = client.exec_command(command)
        
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        status = stdout.channel.recv_exit_status()
        
        return out, err, status
    except Exception as e:
        import traceback
        return "", traceback.format_exc(), -1
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ssh_cmd.py <command>")
        sys.exit(1)
        
    cmd = " ".join(sys.argv[1:])
    out, err, status = run_ssh_command("10.119.3.25", "root", "Root1234", cmd)
    print(out)
    if err:
        print(f"STDERR: {err}")
    if status != 0:
        print(f"EXIT_STATUS: {status}")
        sys.exit(status)
