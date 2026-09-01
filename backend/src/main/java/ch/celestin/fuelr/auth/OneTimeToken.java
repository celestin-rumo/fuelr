package ch.celestin.fuelr.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Links sent by email: reset and verification both need one.
 *
 * The value handed out lives only in the message; what is stored is its
 * SHA-256. A plain digest is right here and would be wrong for a password —
 * these tokens are 256 bits of randomness, so there is nothing to guess and
 * nothing for a slow hash to protect.
 */
final class OneTimeToken {

    private static final SecureRandom RANDOM = new SecureRandom();

    private OneTimeToken() {
    }

    /** A fresh token, URL-safe so it survives being pasted out of an email. */
    static String mint() {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of()
                    .formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every JVM", e);
        }
    }
}
