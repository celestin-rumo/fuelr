package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.plan.HouseholdDtos.HouseholdView;
import ch.celestin.fuelr.plan.HouseholdDtos.InvitationView;
import ch.celestin.fuelr.plan.HouseholdDtos.InviteRequest;
import ch.celestin.fuelr.plan.HouseholdDtos.JoinRequest;
import ch.celestin.fuelr.plan.HouseholdDtos.MemberView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/household")
public class HouseholdController {

    private final HouseholdService households;

    public HouseholdController(HouseholdService households) {
        this.households = households;
    }

    @GetMapping
    public HouseholdView mine(@AuthenticationPrincipal Jwt principal) {
        return view(userId(principal));
    }

    /**
     * Invites an address. 202 and nothing else: the answer must not differ by
     * whether that address has an account, so there is nothing to return.
     */
    @PostMapping("/invitations")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void invite(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody InviteRequest body) {
        try {
            households.invite(
                    userId(principal), body.email(),
                    body.locale() == null ? "fr" : body.locale());
        } catch (HouseholdService.HouseholdFullException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @DeleteMapping("/invitations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        try {
            households.revokeInvitation(userId(principal), id);
        } catch (HouseholdService.InvitationNotUsableException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    /**
     * Accepts an invitation. 410 when the link is spent, expired, or points at
     * a household that is no longer sharing — all of which are "this link does
     * not work any more" rather than "you may not".
     */
    @PostMapping("/join")
    public HouseholdView join(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody JoinRequest body) {
        Long userId = userId(principal);
        try {
            households.accept(userId, body.token());
        } catch (HouseholdService.InvitationNotUsableException e) {
            throw new ResponseStatusException(HttpStatus.GONE, e.getMessage());
        } catch (HouseholdService.HouseholdFullException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        return view(userId);
    }

    /** Leaves the shared household. The caller's own plan is still theirs. */
    @PostMapping("/leave")
    public HouseholdView leave(@AuthenticationPrincipal Jwt principal) {
        Long userId = userId(principal);
        households.leave(userId);
        return view(userId);
    }

    @DeleteMapping("/members/{userId}")
    public HouseholdView remove(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long userId) {
        Long owner = userId(principal);
        try {
            households.remove(owner, userId);
        } catch (HouseholdService.NotTheOwnerException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
        return view(owner);
    }

    private HouseholdView view(Long userId) {
        Household household = households.activeHouseholdFor(userId);
        boolean owner = households.isOwner(household, userId);

        List<MemberView> people = new ArrayList<>();
        households.user(household.getOwnerUserId()).ifPresent(host -> people.add(
                member(host, true, host.getId().equals(userId), null)));
        for (HouseholdMember membership : households.membersOf(household.getId())) {
            households.user(membership.getUserId()).ifPresent(person -> people.add(member(
                    person, false, person.getId().equals(userId), membership.getJoinedAt())));
        }

        // Pending invitations name addresses that have not accepted anything;
        // only the person who sent them has any business seeing them.
        List<InvitationView> pending = owner
                ? households.pendingInvitations(household.getId()).stream()
                        .map(invitation -> new InvitationView(
                                invitation.getId(), invitation.getEmail(),
                                invitation.getExpiresAt()))
                        .toList()
                : List.of();

        return new HouseholdView(
                household.getId(), household.getSize(), owner,
                households.sharingIsOpen(household), HouseholdService.MAX_ACCOUNTS,
                people, pending);
    }

    private static MemberView member(User user, boolean owner, boolean you,
                                     java.time.Instant joinedAt) {
        return new MemberView(user.getId(), user.getName(), user.getEmail(), owner, you, joinedAt);
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
