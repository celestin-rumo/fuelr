package ch.celestin.fuelr.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/**
 * Stores uploaded images on a mounted volume.
 *
 * The database keeps the path only. Bytes in Postgres would bloat every dump
 * and slow every restore, and the volume is the same mechanism `postgres_data`
 * already uses.
 */
@Service
public class MediaStorage {

    /** What the client may send. Anything else is refused before it is written. */
    public static final Map<String, String> ALLOWED = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    /** Generous, because the client resizes before sending. */
    public static final long MAX_BYTES = 2L * 1024 * 1024;

    private final Path root;

    public MediaStorage(@Value("${app.media.dir}") String dir) {
        this.root = Path.of(dir);
    }

    @PostConstruct
    void ensureDirectory() {
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException(
                    "Cannot create the media directory at " + root
                            + ". Is the volume mounted and writable?", e);
        }
    }

    public String store(MultipartFile file) {
        String extension = ALLOWED.get(file.getContentType());
        if (extension == null) {
            throw new UnsupportedMediaException();
        }
        if (file.getSize() > MAX_BYTES) {
            throw new FileTooLargeException();
        }
        String name = UUID.randomUUID() + extension;
        try {
            Files.copy(file.getInputStream(), root.resolve(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return name;
    }

    public Path resolve(String name) {
        // Reject anything that could climb out of the media directory.
        Path resolved = root.resolve(name).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("Chemin hors du répertoire média : " + name);
        }
        return resolved;
    }

    public void delete(String name) {
        if (name == null) return;
        try {
            Files.deleteIfExists(resolve(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static String contentTypeOf(String name) {
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    public static class UnsupportedMediaException extends RuntimeException {
    }

    public static class FileTooLargeException extends RuntimeException {
    }
}
