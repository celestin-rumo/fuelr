package ch.celestin.fuelr.recipe.illustration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Two at a time. Accepting a week queues fourteen pictures, each a few
 * seconds; two threads finish them within the minute without holding
 * anything else, and a queue of a hundred is more than a launch will see.
 */
@Configuration
public class IllustrationConfig {

    @Bean("illustrationExecutor")
    public Executor illustrationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("illustration-");
        executor.initialize();
        return executor;
    }
}
