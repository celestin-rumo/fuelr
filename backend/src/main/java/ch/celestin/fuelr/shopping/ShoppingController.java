package ch.celestin.fuelr.shopping;

import ch.celestin.fuelr.shopping.ShoppingDtos.AddItemRequest;
import ch.celestin.fuelr.shopping.ShoppingDtos.CheckRequest;
import ch.celestin.fuelr.shopping.ShoppingDtos.ShoppingListView;
import ch.celestin.fuelr.shopping.ShoppingDtos.SyncRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/shopping")
public class ShoppingController {

    private final ShoppingService shopping;

    public ShoppingController(ShoppingService shopping) {
        this.shopping = shopping;
    }

    /**
     * The week's list. Reading brings it in step with the plan first, which is
     * why every one of these answers with the whole list: after a tick, an
     * addition or a sync, the screen has the same shape to render.
     */
    @GetMapping
    public ShoppingListView list(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return shopping.list(userId(principal), week != null ? week : LocalDate.now());
    }

    @PutMapping("/items/{id}")
    public ShoppingListView check(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @RequestBody CheckRequest body) {
        try {
            return shopping.check(userId(principal), id, body.checked(), body.at());
        } catch (NoSuchElementException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ShoppingListView add(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week,
            @Valid @RequestBody AddItemRequest body) {
        return shopping.addFreeItem(
                userId(principal), week != null ? week : LocalDate.now(), body);
    }

    @DeleteMapping("/items/{id}")
    public ShoppingListView remove(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        try {
            return shopping.removeFreeItem(userId(principal), id);
        } catch (NoSuchElementException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        } catch (ShoppingService.NotAFreeItemException e) {
            // It would be back on the next read; the honest way to stop buying
            // it is the cupboard or the plan.
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    /**
     * Everything a device ticked while it had no network, in one call. Each
     * tick carries the instant it happened, so the shop wins over the sync.
     */
    @PostMapping("/sync")
    public ShoppingListView sync(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week,
            @Valid @RequestBody SyncRequest body) {
        return shopping.sync(
                userId(principal), week != null ? week : LocalDate.now(), body.items());
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
