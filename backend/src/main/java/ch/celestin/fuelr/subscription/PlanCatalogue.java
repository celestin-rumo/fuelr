package ch.celestin.fuelr.subscription;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;

/**
 * What each plan costs.
 *
 * The prices used to live in the message catalogues, once per language, as the
 * strings "6,90" and "69" — which meant three places to change a price and
 * three places for it to be wrong, and a Swiss-German reader being shown a
 * French decimal comma. They are numbers here, said once, and the screen
 * formats them for whoever is reading.
 *
 * Configuration rather than a table: a price changes about as often as a
 * deployment, and a row in the database would need an editor nobody has asked
 * for. It is per-environment, so staging can carry different figures without
 * anybody touching production's.
 */
@Component
@ConfigurationProperties(prefix = "app.subscription")
public class PlanCatalogue {

    /** ISO 4217, because a bare number is not a price. */
    private String currency = "CHF";

    private Map<Tier, Price> prices = new EnumMap<>(Tier.class);

    /** What a tier costs, per billing period. Both figures, always. */
    public static class Price {
        private BigDecimal monthly = BigDecimal.ZERO;
        private BigDecimal yearly = BigDecimal.ZERO;

        public BigDecimal getMonthly() {
            return monthly;
        }

        public void setMonthly(BigDecimal monthly) {
            this.monthly = monthly;
        }

        public BigDecimal getYearly() {
            return yearly;
        }

        public void setYearly(BigDecimal yearly) {
            this.yearly = yearly;
        }
    }

    /** The free plan costs nothing, and does not need saying in a file. */
    public Price of(Tier tier) {
        return prices.getOrDefault(tier, new Price());
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Map<Tier, Price> getPrices() {
        return prices;
    }

    public void setPrices(Map<Tier, Price> prices) {
        this.prices = prices;
    }
}
