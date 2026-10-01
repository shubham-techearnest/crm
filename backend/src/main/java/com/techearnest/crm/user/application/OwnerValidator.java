package com.techearnest.crm.user.application;

import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class OwnerValidator {

    private final UserRepository userRepository;

    public OwnerValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Returns the owner's organization so callers can reject records from other organizations. */
    public UUID requireActiveOwner(UUID ownerId) {
        User owner = userRepository.findById(ownerId).orElse(null);
        if (owner == null
                || owner.getDeletedAt() != null
                || !"ACTIVE".equals(owner.getStatus())
                || owner.getOrganizationId() == null) {
            throw new BusinessException("INVALID_OWNER", "Choose an active user from this organization");
        }
        return owner.getOrganizationId();
    }

    public static void requireSameOrganization(UUID ownerOrganizationId, UUID recordOrganizationId) {
        if (!ownerOrganizationId.equals(recordOrganizationId)) {
            throw new BusinessException("INVALID_OWNER", "The new owner belongs to another organization");
        }
    }
}
