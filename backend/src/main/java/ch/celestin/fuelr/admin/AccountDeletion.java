package ch.celestin.fuelr.admin;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.media.MediaStorage;
import ch.celestin.fuelr.plan.Household;
import ch.celestin.fuelr.plan.HouseholdMember;
import ch.celestin.fuelr.plan.HouseholdMemberRepository;
import ch.celestin.fuelr.plan.HouseholdRepository;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Erasing an account, and everything it contains.
 *
 * The privacy page promises this: "to have your account and its contents
 * erased, write to us — it is handled by hand today, and it is handled." This
 * is the hand.
 *
 * Almost all of it is the database's own work: every table hanging off `users`
 * cascades, which is why the schema was written that way. Two things do not,
 * and both would be silent.
 *
 * **The photographs are files.** Nothing on disk has a foreign key. Deleting
 * the rows leaves the images in the media volume forever — reachable by
 * anybody who guesses a filename, and counted in no backup total. They are
 * removed here, one by one, before the rows that name them are gone. (Deleting
 * a single *recipe* still leaks its photo; that is a separate defect and a
 * separate fix.)
 *
 * **A shared household would take other people's plan with it.** This is the
 * one that matters. `households.owner_user_id` cascades from `users`, and
 * `planned_meals.household_id` cascades from `households` — so deleting an
 * owner deletes the household, and with it every meal every *member* put on
 * that week. Somebody asks to erase their account and four other people lose
 * their planning, with nothing said anywhere.
 *
 * So the household is handed to its longest-standing member instead. Nothing
 * is deleted that belongs to somebody else, which is the same promise
 * cancelling already makes: sharing then simply stops, because
 * `HouseholdService.activeHouseholdFor` shares a household only while its
 * owner is entitled — and the new owner may not be. The week survives; who can
 * see it is decided by the rule that already existed.
 */
@Service
public class AccountDeletion {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletion.class);

    /** What a deletion carried away, for the operator and for the trace. */
    public record Removed(
            String email,
            int recipes,
            int photos,
            boolean householdHandedOver,
            String newOwnerEmail) {
    }

    private final UserRepository users;
    private final RecipeRepository recipes;
    private final HouseholdRepository households;
    private final HouseholdMemberRepository members;
    private final MediaStorage media;

    public AccountDeletion(UserRepository users, RecipeRepository recipes,
                           HouseholdRepository households,
                           HouseholdMemberRepository members, MediaStorage media) {
        this.users = users;
        this.recipes = recipes;
        this.households = households;
        this.members = members;
        this.media = media;
    }

    /**
     * What deleting this account would carry away, without deleting anything.
     *
     * The screen asks before it acts, and a confirmation that cannot say what
     * it is about to do is a confirmation nobody can give meaningfully.
     */
    @Transactional(readOnly = true)
    public Removed preview(User user) {
        List<Recipe> owned = recipes.findByUserId(user.getId());
        Optional<HouseholdMember> heir = heirOf(user.getId());
        return new Removed(
                user.getEmail(),
                owned.size(),
                (int) owned.stream().filter(recipe -> recipe.getPhotoPath() != null).count(),
                heir.isPresent(),
                heir.map(member -> users.findById(member.getUserId())
                        .map(User::getEmail).orElse(null)).orElse(null));
    }

    @Transactional
    public Removed delete(User user) {
        Removed removed = preview(user);

        // Before the rows that name them are gone.
        for (Recipe recipe : recipes.findByUserId(user.getId())) {
            if (recipe.getPhotoPath() != null) {
                media.delete(recipe.getPhotoPath());
            }
        }

        handOverHousehold(user.getId());

        users.delete(user);
        log.info("Deleted account {} — {} recipes, {} photos, household handed over: {}",
                removed.email(), removed.recipes(), removed.photos(),
                removed.householdHandedOver());
        return removed;
    }

    /**
     * The longest-standing member, who becomes the owner if there is one.
     *
     * Oldest rather than newest: they have been in this household the longest,
     * so it is the least surprising answer to "whose week is this now?".
     */
    private Optional<HouseholdMember> heirOf(Long ownerId) {
        return households.findByOwnerUserId(ownerId)
                .map(Household::getId)
                .map(members::findByHouseholdIdOrderByJoinedAtAsc)
                .filter(list -> !list.isEmpty())
                .map(List::getFirst);
    }

    private void handOverHousehold(Long ownerId) {
        Optional<Household> owned = households.findByOwnerUserId(ownerId);
        if (owned.isEmpty()) {
            return;
        }
        Household household = owned.get();
        Optional<HouseholdMember> heir = heirOf(ownerId);

        if (heir.isEmpty()) {
            // Nobody else is in it. The household and its plan belong to this
            // account alone, and go with it.
            return;
        }

        HouseholdMember successor = heir.get();
        // `household_members.user_id` is unique: the new owner is not a member
        // of their own household, so their row goes.
        members.delete(successor);
        household.setOwnerUserId(successor.getUserId());
        households.save(household);
        // Flushed before the account is deleted, or the cascade fires on a
        // household still pointing at it.
        households.flush();
    }
}
