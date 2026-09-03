package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.media.MediaStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Downloads the photo a page announced, or gives up quietly.
 *
 * Every refusal here is a recipe that arrives without a photo, never a failed
 * import: the cook asked for the recipe, and the picture was a bonus. A page
 * that publishes none, an image behind a 404, one that is too heavy, one that
 * turns out to be HTML or an SVG — all of them end the same way, with a draft
 * to edit and one fewer illustration.
 *
 * The URL is as untrusted as the page it came off, so the download goes
 * through {@link SafePageFetcher} — http(s) only, every redirect hop
 * re-checked, any host resolving to a private address refused. On top of that
 * the bytes are read for what they are rather than what they claim: a `.jpg`
 * can be a login page, and `image/svg+xml` is a document that executes script.
 */
@Component
public class RecipePhotoFetcher {

    private static final Logger log = LoggerFactory.getLogger(RecipePhotoFetcher.class);

    /**
     * One byte more than the storage accepts.
     *
     * Reading exactly the limit cannot tell a file that fits from one that was
     * cut off at it; reading one more makes the difference visible, and
     * {@code MediaStorage} then refuses it like any oversized upload.
     */
    private static final int CEILING = (int) MediaStorage.MAX_BYTES + 1;

    private final SafePageFetcher fetcher;
    private final MediaStorage media;

    public RecipePhotoFetcher(SafePageFetcher fetcher, MediaStorage media) {
        this.fetcher = fetcher;
        this.media = media;
    }

    /** The stored file name, or empty when there is nothing worth storing. */
    public Optional<String> fetch(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(media.store(fetcher.fetchBytes(imageUrl, CEILING)));
        } catch (SafePageFetcher.UnreadableSourceException
                | MediaStorage.UnsupportedMediaException
                | MediaStorage.FileTooLargeException e) {
            log.debug("No photo imported from {}: {}", imageUrl, e.toString());
            return Optional.empty();
        } catch (RuntimeException e) {
            // Writing the file failed, or something else went wrong on our
            // side. Worth an operator's attention, still not the cook's.
            log.warn("Could not store the photo from {}", imageUrl, e);
            return Optional.empty();
        }
    }
}
