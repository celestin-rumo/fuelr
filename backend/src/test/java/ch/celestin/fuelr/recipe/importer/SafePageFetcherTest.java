package ch.celestin.fuelr.recipe.importer;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * This endpoint fetches a URL a stranger chose, from inside the network. Every
 * test here is one way that could have been turned into a door.
 */
class SafePageFetcherTest {

    private final SafePageFetcher fetcher = new SafePageFetcher(false);

    private void refused(String url, String because) {
        assertThatThrownBy(() -> fetcher.fetch(url))
                .isInstanceOf(SafePageFetcher.UnreadableSourceException.class)
                .hasMessage(because);
    }

    @Test
    void refusesTheApplicationsOwnNetwork() {
        // The name that would reach our API from the frontend container.
        refused("http://localhost:8080/api/auth/me", "private_address");
        refused("http://127.0.0.1/", "private_address");
    }

    @Test
    void refusesPrivateRanges() {
        refused("http://10.0.0.1/", "private_address");
        refused("http://192.168.1.1/", "private_address");
        refused("http://172.16.0.1/", "private_address");
    }

    @Test
    void refusesTheCloudMetadataEndpoint() {
        // 169.254.169.254 hands out credentials on most cloud providers.
        refused("http://169.254.169.254/latest/meta-data/", "private_address");
    }

    @Test
    void refusesSchemesThatAreNotWeb() {
        refused("file:///etc/passwd", "unsupported_scheme");
        refused("ftp://example.com/x", "unsupported_scheme");
        refused("gopher://example.com/", "unsupported_scheme");
    }

    @Test
    void refusesWhatIsNotAUrl() {
        refused("pas une url", "not_a_url");
        refused("https://", "not_a_url");
    }
}
