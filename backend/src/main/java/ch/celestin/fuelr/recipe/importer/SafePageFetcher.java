package ch.celestin.fuelr.recipe.importer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Fetches a page the visitor asked for — which means fetching a URL a stranger
 * chose, from inside the network.
 *
 * That is server-side request forgery in one sentence, so the guards are not
 * optional: only http(s), no redirect off to another scheme, and every address
 * the host resolves to must be public. Without the last one, `http://backend:8080`
 * or a cloud metadata endpoint would be a page like any other, and this feature
 * would be a hole straight into the private network.
 */
@Component
public class SafePageFetcher {

    /** Long enough for a slow news site, short enough not to hold a thread. */
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    /** Recipe pages are large; 4 MB is generous and still bounded. */
    private static final int MAX_BYTES = 4 * 1024 * 1024;

    private final HttpClient client;
    private final boolean allowPrivateHosts;

    public SafePageFetcher(
            @Value("${app.import.allow-private-hosts:false}") boolean allowPrivateHosts) {
        this.allowPrivateHosts = allowPrivateHosts;
        this.client = HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                // Redirects are followed, but each hop is checked again below:
                // a public URL that redirects to 127.0.0.1 is the usual trick.
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public static class UnreadableSourceException extends RuntimeException {
        public UnreadableSourceException(String message) {
            super(message);
        }
    }

    public String fetch(String rawUrl) {
        URI uri = validated(rawUrl);
        for (int hop = 0; hop < 4; hop++) {
            HttpResponse<InputStream> response = send(uri);
            int status = response.statusCode();
            if (status >= 300 && status < 400) {
                String location = response.headers().firstValue("location")
                        .orElseThrow(() -> new UnreadableSourceException("redirect_without_location"));
                uri = validated(uri.resolve(location).toString());
                continue;
            }
            if (status != 200) {
                throw new UnreadableSourceException("http_" + status);
            }
            return body(response);
        }
        throw new UnreadableSourceException("too_many_redirects");
    }

    private HttpResponse<InputStream> send(URI uri) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                // Some sites serve a stub to unknown agents; say who we are
                // rather than pretending to be a browser.
                .header("User-Agent", "FuelrBot/1.0 (+https://fuelr.celestinrumo.ch)")
                .header("Accept", "text/html,application/xhtml+xml")
                .GET()
                .build();
        try {
            return client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            throw new UnreadableSourceException("unreachable");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UnreadableSourceException("interrupted");
        }
    }

    private String body(HttpResponse<InputStream> response) {
        try (InputStream stream = response.body()) {
            byte[] bytes = stream.readNBytes(MAX_BYTES);
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UnreadableSourceException("unreachable");
        }
    }

    private URI validated(String rawUrl) {
        URI uri;
        try {
            uri = new URI(rawUrl.trim());
        } catch (URISyntaxException e) {
            throw new UnreadableSourceException("not_a_url");
        }
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
            throw new UnreadableSourceException("unsupported_scheme");
        }
        if (uri.getHost() == null) {
            throw new UnreadableSourceException("not_a_url");
        }
        if (!allowPrivateHosts) {
            requirePublic(uri.getHost());
        }
        return uri;
    }

    /**
     * Every address the name resolves to has to be public — checking only the
     * first would let a host with one public and one loopback record through.
     */
    private void requirePublic(String host) {
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            throw new UnreadableSourceException("unknown_host");
        }
        for (InetAddress address : addresses) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                    || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                    || address.isMulticastAddress()
                    // 169.254.169.254 and friends are link-local, but be explicit
                    // about the shared-address range too (RFC 6598).
                    || isCarrierGrade(address)) {
                throw new UnreadableSourceException("private_address");
            }
        }
    }

    private boolean isCarrierGrade(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 4 && (bytes[0] & 0xFF) == 100 && (bytes[1] & 0xC0) == 0x40;
    }
}
