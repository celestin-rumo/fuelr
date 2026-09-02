package ch.celestin.fuelr.subscription;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Turns "you have not paid for this" into 402.
 *
 * It is not 403: nothing about the account is wrong, and the way past it is a
 * plan rather than a permission. The body names the feature and the tier that
 * opens it, so the screen can offer the right plan instead of a generic error.
 */
@RestControllerAdvice
public class NotEntitledAdvice {

    @ExceptionHandler(Entitlements.NotEntitledException.class)
    public ResponseEntity<Map<String, String>> handle(Entitlements.NotEntitledException e) {
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(Map.of(
                "error", e.getMessage(),
                "feature", e.feature().name(),
                "requiredTier", e.required().name()));
    }
}
