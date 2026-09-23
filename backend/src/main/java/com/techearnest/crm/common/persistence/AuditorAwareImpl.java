package com.techearnest.crm.common.persistence;

import com.techearnest.crm.common.security.CurrentUserHolder;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;

@Component
public class AuditorAwareImpl implements AuditorAware<UUID> {

    @Override
    public Optional<UUID> getCurrentAuditor() {
        return CurrentUserHolder.get().map(user -> user.userId());
    }
}
