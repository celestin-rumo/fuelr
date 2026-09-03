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

    /**
     * Stores bytes whose type is read from the bytes themselves.
     *
     * An upload arrives with a declared content type and a browser that meant
     * it. Bytes fetched from a page a stranger chose arrive with a header
     * anybody could have written and a file extension that means nothing: a
     * `.jpg` can be HTML, and `image/svg+xml` is a document that executes
     * script. So nothing announced is believed — only the first bytes are.
     */
    public String store(byte[] bytes) {
        String type = sniff(bytes);
        if (type == null) {
            throw new UnsupportedMediaException();
        }
        if (bytes.length > MAX_BYTES) {
            throw new FileTooLargeException();
        }
        String name = UUID.randomUUID() + ALLOWED.get(type);
        try {
            Files.write(root.resolve(name), bytes);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return name;
    }

    /**
     * What the bytes actually are, or null for anything not on the list.
     *
     * The three signatures are fixed by their formats: JPEG opens FF D8 FF,
     * PNG has its eight-byte header, and WebP is a RIFF container that names
     * itself at offset 8.
     */
    public static String sniff(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return null;
        }
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if ((bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
                && (bytes[4] & 0xFF) == 0x0D && (bytes[5] & 0xFF) == 0x0A
                && (bytes[6] & 0xFF) == 0x1A && (bytes[7] & 0xFF) == 0x0A) {
            return "image/png";
        }
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        return null;
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
