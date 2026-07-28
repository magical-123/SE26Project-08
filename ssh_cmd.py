import sys
import paramiko

def run_ssh_command(host, user, password, command):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password, timeout=10)
        stdin, stdout, stderr = client.exec_command(command)
        
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        status = stdout.channel.recv_exit_status()
        
        return out, err, status
    except Exception as e:
        return "", str(e), -1
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ssh_cmd.py <command>")
        sys.exit(1)
        
    cmd = " ".join(sys.argv[1:])
    out, err, status = run_ssh_command("127.0.0.1", "root", "REPLACE_ME", cmd)
    print(out)
    if err:
        print(f"STDERR: {err}")
    if status != 0:
        print(f"EXIT_STATUS: {status}")
        sys.exit(status)
