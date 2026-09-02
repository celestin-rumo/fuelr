package ch.celestin.fuelr.subscription;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubscriptionOrderRepository extends JpaRepository<SubscriptionOrder, Long> {

    List<SubscriptionOrder> findByUserIdOrderByIdDesc(Long userId);
}
