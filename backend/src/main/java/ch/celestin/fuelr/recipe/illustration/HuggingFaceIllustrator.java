package ch.celestin.fuelr.recipe.illustration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

/**
 * FLUX.1-schnell through Hugging Face's inference router.
 *
 * Hugging Face fronts several providers behind one token and one URL; the
 * provider is pinned rather than left to the router, because a pinned
 * provider has one request shape and one bill. nscale speaks the OpenAI
 * images shape — `/v1/images/generations`, the picture back as base64 in
 * JSON — which is the whole of what this class knows.
 *
 * schnell because it is distilled for four steps: a second per image, a
 * fraction of a cent, and an Apache licence that a paid product may use.
 * The model is configuration, so a better one later is one line.
 */
@Component
@Order(100)
public class HuggingFaceIllustrator implements RecipeIllustrator {

    private static final Logger log = LoggerFactory.getLogger(HuggingFaceIllustrator.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Drawing takes a few seconds; a minute is a provider that is not going to answer. */
    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    private final String token;
    private final String baseUrl;
    private final String provider;
    private final String model;
    private final int size;

    public HuggingFaceIllustrator(
            @Value("${app.ai.illustration.token:}") String token,
            @Value("${app.ai.illustration.base-url:https://router.huggingface.co}") String baseUrl,
            @Value("${app.ai.illustration.provider:nscale}") String provider,
            @Value("${app.ai.illustration.model:black-forest-labs/FLUX.1-schnell}") String model,
            @Value("${app.ai.illustration.size:640}") int size) {
        this.token = token;
        this.baseUrl = baseUrl;
        this.provider = provider;
        this.model = model;
        this.size = size;
    }

    @Override
    public String name() {
        return "huggingface/" + provider;
    }

    @Override
    public boolean available() {
        return !token.isBlank();
    }

    @Override
    public Optional<byte[]> illustrate(String prompt) {
        ObjectNode body = JSON.createObjectNode();
        body.put("model", model);
        body.put("prompt", prompt);
        body.put("response_format", "b64_json");
        body.put("size", size + "x" + size);

        HttpRequest request = HttpRequest.newBuilder(
                        URI.create(baseUrl + "/" + provider + "/v1/images/generations"))
                .timeout(TIMEOUT)
                .header("content-type", "application/json")
                .header("authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("No illustration: {} {}", response.statusCode(), response.body());
                throw new IllegalStateException("provider_" + response.statusCode());
            }
            JsonNode image = JSON.readTree(response.body()).path("data").path(0).path("b64_json");
            if (image.isMissingNode() || image.asText().isBlank()) {
                return Optional.empty();
            }
            return Optional.of(Base64.getDecoder().decode(image.asText()));
        } catch (IOException e) {
            throw new IllegalStateException("unreachable", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted");
        }
    }
}
