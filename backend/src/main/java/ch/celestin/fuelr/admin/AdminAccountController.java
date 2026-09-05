package ch.celestin.fuelr.admin;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.plan.Household;
import ch.celestin.fuelr.plan.HouseholdMemberRepository;
import ch.celestin.fuelr.plan.HouseholdRepository;
import ch.celestin.fuelr.recipe.RecipeRepository;
import ch.celestin.fuelr.subscription.Subscription;
import ch.celestin.fuelr.subscription.SubscriptionRepository;
import ch.celestin.fuelr.subscription.SubscriptionService;
import ch.celestin.fuelr.subscription.Tier;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * The accounts, and the two things an operator can do to one.
 *
 * You arrive here with an address in your hand — somebody wrote in — so the
 * search is on email and nothing else.
 *
 * Everything behind this door is somebody's personal data: their address, what
 * they cooked, what they consumed. That is the whole reason the door answers
 * 404 to everybody else rather than 403.
 */
@RestController
@RequestMapping("/api/admin/accounts")
public class AdminAccountController {

    public record AccountRow(
            Long id,
            String email,
            String name,
            String role,
            Instant createdAt,
            boolean emailVerified,
            String tier,
            long recipes,
            /** Whose household this account is in — its own, or somebody's. */
            boolean sharesAHousehold,
            boolean ownsTheHousehold) {
    }

    public record AccountDetail(
            AccountRow account,
            SubscriptionView subscription,
            HouseholdView household,
            long aiCostMicrosThisMonth,
            long aiBudgetMicros,
            List<ActionRow> history) {
    }

    public record SubscriptionView(
            String tier,
            String status,
            Instant currentPeriodEnd,
            boolean grantedByHand) {
    }

    public record HouseholdView(boolean owner, int size, List<String> members) {
    }

    public record ActionRow(
            String actorEmail, String action, String detail, Instant at) {
    }

    /** What a deletion would carry away, before anybody confirms it. */
    public record DeletionPreview(
            String email,
            long recipes,
            long photos,
            boolean householdHandedOver,
            String newOwnerEmail) {
    }

    public record TierRequest(String tier, String reason) {
    }

    private final AdminAccess access;
    private final UserRepository users;
    private final RecipeRepository recipes;
    private final SubscriptionRepository subscriptions;
    private final SubscriptionService subscriptionService;
    private final HouseholdRepository households;
    private final HouseholdMemberRepository members;
    private final AiBudget budget;
    private final AdminActionRepository actions;
    private final AccountDeletion deletion;

    public AdminAccountController(
            AdminAccess access, UserRepository users, RecipeRepository recipes,
            SubscriptionRepository subscriptions, SubscriptionService subscriptionService,
            HouseholdRepository households, HouseholdMemberRepository members,
            AiBudget budget, AdminActionRepository actions, AccountDeletion deletion) {
        this.access = access;
        this.users = users;
        this.recipes = recipes;
        this.subscriptions = subscriptions;
        this.subscriptionService = subscriptionService;
        this.households = households;
        this.members = members;
        this.budget = budget;
        this.actions = actions;
        this.deletion = deletion;
    }

    /**
     * The accounts, newest first, or the ones whose address matches.
     *
     * Capped rather than paged: an operator looks somebody up or scans the
     * recent arrivals, and neither of those wants page seven of forty. When
     * this installation has enough accounts for that to be wrong, the search
     * is what will already be doing the work.
     */
    @GetMapping
    public List<AccountRow> list(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false) String q) {
        access.require(principal);

        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        return users.findAll().stream()
                .filter(user -> needle.isEmpty()
                        || user.getEmail().toLowerCase(Locale.ROOT).contains(needle)
                        || (user.getName() != null
                            && user.getName().toLowerCase(Locale.ROOT).contains(needle)))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .limit(200)
                .map(this::row)
                .toList();
    }

    @GetMapping("/{id}")
    public AccountDetail detail(@AuthenticationPrincipal Jwt principal,
                                @PathVariable Long id) {
        access.require(principal);
        User user = found(id);

        Optional<Subscription> subscription = subscriptions.findByUserId(id);
        Optional<Household> owned = households.findByOwnerUserId(id);

        return new AccountDetail(
                row(user),
                subscription
                        .map(one -> new SubscriptionView(
                                one.getTier().name(), one.getStatus().name(),
                                one.getCurrentPeriodEnd(), grantedByHand(id)))
                        .orElse(null),
                householdOf(user, owned),
                budget.spentMicros(id),
                budget.budgetMicros(id),
                actions.findBySubjectUserIdOrderByCreatedAtDesc(id).stream()
                        .map(one -> new ActionRow(one.getActorEmail(), one.getAction(),
                                one.getDetail(), one.getCreatedAt()))
                        .toList());
    }

    @GetMapping("/{id}/deletion-preview")
    public DeletionPreview preview(@AuthenticationPrincipal Jwt principal,
                                   @PathVariable Long id) {
        access.require(principal);
        AccountDeletion.Removed removed = deletion.preview(found(id));
        return new DeletionPreview(removed.email(), removed.recipes(), removed.photos(),
                removed.householdHandedOver(), removed.newOwnerEmail());
    }

    /**
     * Erase an account and everything in it.
     *
     * The one action in this panel that destroys data belonging to somebody
     * else, so it is written down before it is done — an operator's account
     * could itself be deleted later, and a trace that vanishes with its author
     * records nothing.
     */
    @DeleteMapping("/{id}")
    public DeletionPreview delete(@AuthenticationPrincipal Jwt principal,
                                  @PathVariable Long id) {
        access.require(principal);
        User user = found(id);

        // An operator deleting their own account would lock this installation
        // out of its own panel, from inside it.
        if (id.equals(access.actorId(principal))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "an operator cannot delete their own account here");
        }

        AccountDeletion.Removed removed = deletion.delete(user);
        actions.save(new AdminAction(
                access.actorId(principal), access.actorEmail(principal), "DELETE_ACCOUNT",
                id, removed.email(),
                "%d recipes, %d photos%s".formatted(
                        removed.recipes(), removed.photos(),
                        removed.householdHandedOver()
                                ? ", household handed to " + removed.newOwnerEmail()
                                : "")));
        return new DeletionPreview(removed.email(), removed.recipes(), removed.photos(),
                removed.householdHandedOver(), removed.newOwnerEmail());
    }

    /**
     * Give or take away a paid tier by hand — a refund, a gesture, a mistake
     * being put right.
     *
     * It goes through `SubscriptionService.confirm`, the same method a payment
     * webhook will call, so a hand-granted plan is indistinguishable from a
     * paid one everywhere else in the application. Writing a row here instead
     * would be a second way for a subscription to exist.
     */
    @PostMapping("/{id}/tier")
    public SubscriptionView setTier(@AuthenticationPrincipal Jwt principal,
                                    @PathVariable Long id,
                                    @RequestBody TierRequest request) {
        access.require(principal);
        User user = found(id);

        Tier tier;
        try {
            tier = Tier.valueOf(request.tier());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown tier");
        }

        if (tier == Tier.FREE) {
            subscriptionService.cancel(id);
        } else {
            subscriptionService.grant(id, tier);
        }

        actions.save(new AdminAction(
                access.actorId(principal), access.actorEmail(principal), "SET_TIER",
                id, user.getEmail(),
                tier.name() + (request.reason() == null || request.reason().isBlank()
                        ? "" : " — " + request.reason().trim())));

        return subscriptions.findByUserId(id)
                .map(one -> new SubscriptionView(one.getTier().name(), one.getStatus().name(),
                        one.getCurrentPeriodEnd(), true))
                .orElse(new SubscriptionView(Tier.FREE.name(), "NONE", null, true));
    }

    // --- reading ------------------------------------------------------------

    private AccountRow row(User user) {
        Optional<Household> owned = households.findByOwnerUserId(user.getId());
        boolean isMember = members.findByUserId(user.getId()).isPresent();
        int inOwned = owned
                .map(household -> members.findByHouseholdIdOrderByJoinedAtAsc(household.getId()).size())
                .orElse(0);

        return new AccountRow(
                user.getId(), user.getEmail(), user.getName(), user.getRole(),
                user.getCreatedAt(), user.isEmailVerified(),
                subscriptions.findByUserId(user.getId())
                        .map(one -> one.getTier().name()).orElse(Tier.FREE.name()),
                recipes.countByUserId(user.getId()),
                isMember || inOwned > 0,
                owned.isPresent() && inOwned > 0);
    }

    private HouseholdView householdOf(User user, Optional<Household> owned) {
        Optional<Household> theirs = owned.or(() ->
                members.findByUserId(user.getId())
                        .flatMap(member -> households.findById(member.getHouseholdId())));
        if (theirs.isEmpty()) {
            return null;
        }
        Household household = theirs.get();
        List<String> names = members.findByHouseholdIdOrderByJoinedAtAsc(household.getId()).stream()
                .map(member -> users.findById(member.getUserId())
                        .map(User::getEmail).orElse("(deleted)"))
                .toList();
        return new HouseholdView(
                owned.isPresent(), household.getSize(), names);
    }

    private boolean grantedByHand(Long userId) {
        return actions.findBySubjectUserIdOrderByCreatedAtDesc(userId).stream()
                .anyMatch(action -> "SET_TIER".equals(action.getAction()));
    }

    private User found(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
