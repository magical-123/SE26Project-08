package com.infodigest.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class CredentialCryptoService {
    private static final String PREFIX = "enc:v1:";
    private static final int IV_LENGTH = 12;
    private final SecretKeySpec key;
    private final SecureRandom secureRandom = new SecureRandom();

    public CredentialCryptoService(@Value("${security.credentials.encryption-key}") String encodedKey) {
        byte[] keyBytes = Base64.getDecoder().decode(encodedKey);
        if (keyBytes.length != 32) {
            throw new IllegalArgumentException("CREDENTIAL_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");
        }
        this.key = new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String value) {
        if (value == null || value.isBlank() || value.startsWith(PREFIX)) return value;
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return PREFIX + Base64.getEncoder().encodeToString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt credential", e);
        }
    }

    public String decrypt(String value) {
        if (value == null || value.isBlank() || !value.startsWith(PREFIX)) return value;
        try {
            byte[] payload = Base64.getDecoder().decode(value.substring(PREFIX.length()));
            byte[] iv = java.util.Arrays.copyOfRange(payload, 0, IV_LENGTH);
            byte[] encrypted = java.util.Arrays.copyOfRange(payload, IV_LENGTH, payload.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt credential", e);
        }
    }
}
