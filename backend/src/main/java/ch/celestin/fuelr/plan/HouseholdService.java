package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.auth.EmailLinks;
import ch.celestin.fuelr.auth.OneTimeToken;
import ch.celestin.fuelr.mail.MailService;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Who shares a plan with whom.
 *
 * The rule the whole feature turns on is {@link #activeHouseholdFor}: the
 * household someone is a member of, but only while its owner is entitled to
 * share one — otherwise their own. Nothing is deleted when a plan lapses; the
 * shared household simply stops being the one people are looking at, and each
 * member is back in front of their own plan, which was there all along.
 */
@Service
public class HouseholdService {

    /**
     * Six people, as the pricing page promises: "jusqu'à 6", "six profils
     * nutritionnels distincts". The owner is one of the six.
     */
    public static final int MAX_ACCOUNTS = 6;

    /** Long enough to be answered after a weekend. */
    static final Duration INVITATION_LIFETIME = Duration.ofDays(7);

    public static class NotTheOwnerException extends RuntimeException {
        public NotTheOwnerException() {
            super("not_the_owner");
        }
    }

    public static class HouseholdFullException extends RuntimeException {
        public HouseholdFullException() {
            super("household_full");
        }
    }

    public static class InvitationNotUsableException extends RuntimeException {
        public InvitationNotUsableException() {
            super("invitation_not_usable");
        }
    }

    private final HouseholdRepository households;
    private final HouseholdMemberRepository members;
    private final HouseholdInvitationRepository invitations;
    private final UserRepository users;
    private final Entitlements entitlements;
    private final MailService mail;
    private final String siteUrl;

    public HouseholdService(
            HouseholdRepository households,
            HouseholdMemberRepository members,
            HouseholdInvitationRepository invitations,
            UserRepository users,
            Entitlements entitlements,
            MailService mail,
            @Value("${app.site-url}") String siteUrl) {
        this.households = households;
        this.members = members;
        this.invitations = invitations;
        this.users = users;
        this.entitlements = entitlements;
        this.mail = mail;
        this.siteUrl = siteUrl;
    }

    // --- which household is in front of someone -----------------------------

    /** Everyone owns one, created the first time they need it. */
    @Transactional
    public Household ownHousehold(Long userId) {
        return households.findByOwnerUserId(userId)
                .orElseGet(() -> households.save(new Household(userId)));
    }

    /**
     * The household whose plan this person is looking at.
     *
     * A membership only counts while the household's owner is entitled to
     * share. That single condition is what makes cancelling safe: the member
     * falls back to their own household, the owner keeps theirs, and the shared
     * rows are still exactly where they were if the plan comes back.
     */
    @Transactional
    public Household activeHouseholdFor(Long userId) {
        Optional<HouseholdMember> membership = members.findByUserId(userId);
        if (membership.isPresent()) {
            Optional<Household> shared = households.findById(membership.get().getHouseholdId());
            if (shared.isPresent() && sharingIsOpen(shared.get())) {
                return shared.get();
            }
        }
        return ownHousehold(userId);
    }

    /** Whether the household's owner is currently paying for sharing. */
    public boolean sharingIsOpen(Household household) {
        return entitlements.has(household.getOwnerUserId(), Feature.HOUSEHOLD_SHARING);
    }

    public boolean isOwner(Household household, Long userId) {
        return household.getOwnerUserId().equals(userId);
    }

    public List<HouseholdMember> membersOf(Long householdId) {
        return members.findByHouseholdIdOrderByJoinedAtAsc(householdId);
    }

    public List<HouseholdInvitation> pendingInvitations(Long householdId) {
        return invitations.findByHouseholdIdAndAcceptedAtIsNullOrderByIdDesc(householdId);
    }

    public Optional<User> user(Long userId) {
        return users.findById(userId);
    }

    // --- inviting -----------------------------------------------------------

    /**
     * Invites an address into the caller's own household.
     *
     * The answer is the same whether or not the address belongs to an account,
     * and the mail goes out asynchronously for the same reason — an invitation
     * endpoint that answered faster for strangers would be a way to find out
     * who has a Fuelr account.
     */
    @Transactional
    public HouseholdInvitation invite(Long ownerUserId, String email, String locale) {
        entitlements.require(ownerUserId, Feature.HOUSEHOLD_SHARING);
        Household household = ownHousehold(ownerUserId);
        if (accountsIn(household) >= MAX_ACCOUNTS) {
            throw new HouseholdFullException();
        }

        String address = email.trim().toLowerCase();
        String token = OneTimeToken.mint();
        HouseholdInvitation invitation = invitations.save(new HouseholdInvitation(
                household.getId(), address, OneTimeToken.hash(token),
                Instant.now().plus(INVITATION_LIFETIME)));

        String host = users.findById(ownerUserId)
                .map(user -> user.getName() == null ? user.getEmail() : user.getName())
                .orElse("Fuelr");
        String link = EmailLinks.householdInvitation(siteUrl, locale, token);
        mail.send(address, "Rejoins le foyer Fuelr de " + host, """
                Bonjour,

                %s t'invite à partager son planning de repas sur Fuelr :

                %s

                Le lien est valable %d jours et ne fonctionne qu'une fois. Tes
                recettes et ton profil nutritionnel restent les tiens — seul le
                planning de la semaine est partagé.

                Si tu ne sais pas de quoi il s'agit, ignore ce message.
                """.formatted(host, link, INVITATION_LIFETIME.toDays()));

        return invitation;
    }

    /**
     * Joins a household from an invitation link.
     *
     * The address on the invitation is not checked against the account
     * accepting it: whoever holds the link was sent it, and demanding a match
     * would break the common case of someone reading their mail on one address
     * and having signed up with another.
     */
    @Transactional
    public Household accept(Long userId, String token) {
        HouseholdInvitation invitation = invitations.findByTokenHash(OneTimeToken.hash(token))
                .filter(HouseholdInvitation::isUsable)
                .orElseThrow(InvitationNotUsableException::new);

        Household household = households.findById(invitation.getHouseholdId())
                .orElseThrow(InvitationNotUsableException::new);
        if (!sharingIsOpen(household)) {
            throw new InvitationNotUsableException();
        }
        if (isOwner(household, userId)) {
            throw new InvitationNotUsableException();
        }
        if (accountsIn(household) >= MAX_ACCOUNTS) {
            throw new HouseholdFullException();
        }

        // One shared household at a time. Leaving the previous one takes
        // nothing with it: its plan belongs to the household, not to the person.
        members.findByUserId(userId).ifPresent(members::delete);
        members.save(new HouseholdMember(household.getId(), userId));

        invitation.accept(userId);
        invitations.save(invitation);
        return household;
    }

    @Transactional
    public void revokeInvitation(Long ownerUserId, Long invitationId) {
        Household household = ownHousehold(ownerUserId);
        HouseholdInvitation invitation = invitations.findById(invitationId)
                .filter(candidate -> candidate.getHouseholdId().equals(household.getId()))
                .orElseThrow(InvitationNotUsableException::new);
        invitations.delete(invitation);
    }

    // --- leaving ------------------------------------------------------------

    /** Leaves whatever household the caller joined. Their own is untouched. */
    @Transactional
    public void leave(Long userId) {
        members.findByUserId(userId).ifPresent(members::delete);
    }

    /** The owner shows someone out. Only the owner can. */
    @Transactional
    public void remove(Long ownerUserId, Long memberUserId) {
        Household household = ownHousehold(ownerUserId);
        HouseholdMember member = members.findByUserId(memberUserId)
                .filter(candidate -> candidate.getHouseholdId().equals(household.getId()))
                .orElseThrow(NotTheOwnerException::new);
        members.delete(member);
    }

    private long accountsIn(Household household) {
        // The owner counts: the plan is for six people, not six guests.
        return members.countByHouseholdId(household.getId()) + 1;
    }
}
