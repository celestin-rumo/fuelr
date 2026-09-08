package ch.celestin.fuelr.menu;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.function.Function;

/**
 * An answer told as it is written, over server-sent events.
 *
 * Three screens ask a model for dishes and wait; this is the one shape their
 * waiting takes. `progress` events carry the dish that was just started —
 * its number, how many were asked for, its title; `dish` events carry each
 * dish written to the end, shaped by the caller, so the screen shows the row
 * the moment it exists; and one `result` event carries the whole answer,
 * exactly what the one-piece endpoint would have returned. A screen that
 * reads only the result loses nothing.
 *
 * The work runs on a pool of its own rather than the request thread, since
 * a stream is a request held open for the two minutes a model takes and a
 * connector thread held for two minutes is one nobody else gets. And a
 * screen that went away is not a reason to stop: the answer is billed
 * whether or not anybody is still looking, so it is finished and recorded,
 * and only the telling is dropped.
 */
@Component
public class IdeaStreams {

    private static final Logger log = LoggerFactory.getLogger(IdeaStreams.class);

    /** Longer than the longest answer, so the emitter never gives up before the model does. */
    private static final Duration TIMEOUT = Duration.ofMinutes(5);

    private final Executor executor;

    public IdeaStreams(@Qualifier("ideasExecutor") Executor executor) {
        this.executor = executor;
    }

    public <T> SseEmitter run(Function<MenuIntelligence.Progress, T> work) {
        SseEmitter emitter = new SseEmitter(TIMEOUT.toMillis());
        executor.execute(() -> {
            try {
                T result = work.apply(new MenuIntelligence.Progress() {
                    @Override
                    public void dish(int index, int of, String title) {
                        // In this order on the wire, always: a screen reads it,
                        // and so does a test.
                        Map<String, Object> progress = new LinkedHashMap<>();
                        progress.put("done", index);
                        progress.put("of", of);
                        progress.put("title", title);
                        tell(emitter, "progress", progress);
                    }

                    @Override
                    public void completed(int index, int of, Object dish) {
                        // A whole dish, the moment it exists: the screen shows
                        // the row and starts fetching its picture.
                        Map<String, Object> event = new LinkedHashMap<>();
                        event.put("index", index);
                        event.put("of", of);
                        event.put("dish", dish);
                        tell(emitter, "dish", event);
                    }
                });
                emitter.send(SseEmitter.event().name("result").data(result, MediaType.APPLICATION_JSON));
                emitter.complete();
            } catch (Exception e) {
                log.warn("An ideas stream ended early: {}", e.toString());
                try {
                    emitter.send(SseEmitter.event().name("failed")
                            .data(Map.of("error", "failed"), MediaType.APPLICATION_JSON));
                    emitter.complete();
                } catch (Exception gone) {
                    emitter.completeWithError(e);
                }
            }
        });
        return emitter;
    }

    private static void tell(SseEmitter emitter, String name, Map<String, Object> payload) {
        try {
            emitter.send(SseEmitter.event().name(name).data(payload, MediaType.APPLICATION_JSON));
        } catch (Exception gone) {
            // Nobody listening any more. The answer is still finished and
            // billed; only the counting stops.
        }
    }
}
