import paramiko

def upload_and_install():
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect('10.119.3.25', username='root', password='Root1234', timeout=10)
        
        print("Uploading docker-compose...")
        sftp = ssh.open_sftp()
        sftp.put('docker-compose-linux', '/usr/local/bin/docker-compose')
        sftp.close()
        
        print("Making executable...")
        stdin, stdout, stderr = ssh.exec_command('chmod +x /usr/local/bin/docker-compose && docker-compose version')
        print(stdout.read().decode())
        
        print("Starting containers...")
        stdin, stdout, stderr = ssh.exec_command('cd /opt/infodigest/repo && docker-compose pull && docker-compose up -d')
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    upload_and_install()
