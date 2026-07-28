package com.infodigest.security;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class CredentialCryptoServiceTest {
    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);

    @Test
    void encryptsAndDecryptsCredential() {
        CredentialCryptoService service = new CredentialCryptoService(KEY);
        String encrypted = service.encrypt("secret-token");
        assertTrue(encrypted.startsWith("enc:v1:"));
        assertNotEquals("secret-token", encrypted);
        assertEquals("secret-token", service.decrypt(encrypted));
    }

    @Test
    void leavesPlainAndBlankValuesUntouched() {
        CredentialCryptoService service = new CredentialCryptoService(KEY);
        assertNull(service.encrypt(null));
        assertEquals("", service.encrypt(""));
        assertEquals("plain", service.decrypt("plain"));
    }

    @Test
    void rejectsInvalidKeyAndTamperedPayload() {
        assertThrows(IllegalArgumentException.class, () -> new CredentialCryptoService("bad-key"));
        CredentialCryptoService service = new CredentialCryptoService(KEY);
        String encrypted = service.encrypt("secret");
        String tampered = encrypted.substring(0, encrypted.length() - 2) + "xx";
        assertThrows(IllegalStateException.class, () -> service.decrypt(tampered));
    }
}
