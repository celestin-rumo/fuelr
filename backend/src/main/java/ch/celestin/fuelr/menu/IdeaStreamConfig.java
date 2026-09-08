package ch.celestin.fuelr.menu;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * The threads a streamed answer is written on.
 *
 * A pool of its own, like the mail's, and for the same reason: a model that
 * takes two minutes must not be able to hold anything else the application
 * runs in the background. Eight at once is more than a launch will see;
 * beyond that a request waits its turn rather than being refused.
 */
@Configuration
public class IdeaStreamConfig {

    @Bean("ideasExecutor")
    public Executor ideasExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("ideas-");
        executor.initialize();
        return executor;
    }
}
