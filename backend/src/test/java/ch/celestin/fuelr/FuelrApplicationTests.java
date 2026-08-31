package ch.celestin.fuelr;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The context can only start against a real PostgreSQL: Flyway runs the
 * migrations on boot and JPA validates the schema against them. Testcontainers
 * supplies one, so the suite needs no database on the host or on CI —
 * {@code @ServiceConnection} points the datasource at the container.
 */
@SpringBootTest
@Testcontainers
class FuelrApplicationTests {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:17");

    @Test
    void contextLoads() {
    }
}
