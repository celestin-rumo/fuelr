package ch.celestin.fuelr.recipe.illustration;

import ch.celestin.fuelr.media.MediaStorage;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * The picture drawn for a proposed dish, by the key the proposal carries.
 * Only the account the proposal was made to can see it, and it answers 404
 * until it has landed — which is exactly what the screen polls for.
 */
@RestController
@RequestMapping("/api/ideas/illustrations")
public class IdeaIllustrationController {

    private final IllustrationService illustrations;
    private final MediaStorage media;

    public IdeaIllustrationController(IllustrationService illustrations, MediaStorage media) {
        this.illustrations = illustrations;
        this.media = media;
    }

    @GetMapping("/{key}")
    public ResponseEntity<Resource> picture(@AuthenticationPrincipal Jwt principal,
                                            @PathVariable String key) {
        Long userId = Long.valueOf(principal.getSubject());
        return illustrations.find(userId, key)
                .map(drawn -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(MediaStorage.contentTypeOf(drawn.getPhotoPath())))
                        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePrivate())
                        .body((Resource) new FileSystemResource(media.resolve(drawn.getPhotoPath()))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
