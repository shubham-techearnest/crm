package com.techearnest.crm.common.security;

import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUserHolder {

    private CurrentUserHolder() {}

    public static Optional<CurrentUser> get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof CurrentUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public static CurrentUser require() {
        return get().orElseThrow(() -> new IllegalStateException("Authenticated user is required"));
    }
}
