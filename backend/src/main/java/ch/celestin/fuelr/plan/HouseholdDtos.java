package ch.celestin.fuelr.plan;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public final class HouseholdDtos {

    private HouseholdDtos() {
    }

    /**
     * The household the caller is currently in — their own, or the one they
     * joined while its owner is paying for sharing.
     *
     * {@code sharingOpen} is deliberately about the household rather than about
     * the caller: a member of somebody else's household is not the one who pays
     * for it, and the screen has to be able to say so.
     */
    public record HouseholdView(
            Long id,
            int size,
            boolean owner,
            boolean sharingOpen,
            int maxAccounts,
            List<MemberView> members,
            /** Only ever filled in for the owner: nobody else may see them. */
            List<InvitationView> invitations) {
    }

    public record MemberView(
            Long userId,
            String name,
            String email,
            boolean owner,
            boolean you,
            Instant joinedAt) {
    }

    public record InvitationView(Long id, String email, Instant expiresAt) {
    }

    public record InviteRequest(
            @NotBlank @Email String email,
            /** Picks the language of the invitation mail, nothing else. */
            String locale) {
    }

    public record JoinRequest(@NotBlank String token) {
    }
}
