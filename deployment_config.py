"""Environment-only configuration for the optional administration scripts."""

import os


def required_env(name):
    value = os.environ.get(name, "").strip()
    if not value or value.upper().startswith(("CHANGE_ME", "REPLACE_ME")):
        raise ValueError(f"Set {name} in your local environment before running this script")
    return value


def database_options():
    return {
        "host": required_env("DB_HOST"),
        "port": int(os.environ.get("DB_PORT", "3306")),
        "user": required_env("DB_USERNAME"),
        "password": required_env("DB_PASSWORD"),
        "database": os.environ.get("DB_NAME", "info_digest"),
    }


def create_ssh_client():
    import paramiko

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    known_hosts = os.environ.get("DEPLOY_KNOWN_HOSTS")
    if known_hosts:
        client.load_host_keys(os.path.expanduser(known_hosts))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    return client


def ssh_connect_kwargs(timeout=10):
    options = {
        "hostname": required_env("DEPLOY_HOST"),
        "username": required_env("DEPLOY_USER"),
        "port": int(os.environ.get("DEPLOY_PORT", "22")),
        "timeout": timeout,
    }
    password = os.environ.get("DEPLOY_PASSWORD")
    key_file = os.environ.get("DEPLOY_KEY_FILE")
    if password:
        options["password"] = password
    if key_file:
        options["key_filename"] = os.path.expanduser(key_file)
    # With neither value set, Paramiko can use the local SSH agent and keys.
    return options
