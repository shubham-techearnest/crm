package com.techearnest.crm.common.security;

import com.techearnest.crm.user.domain.UserRepository;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Resolves which owner/assignee user IDs a TEAM-scoped user may see: self, same-team
 * colleagues, and direct reports (manager_id).
 */
@Service
public class TeamVisibilityService {

    private final UserRepository userRepository;

    public TeamVisibilityService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Set<UUID> visibleOwnerIds(CurrentUser user) {
        Set<UUID> ids = new HashSet<>();
        ids.add(user.userId());
        if (user.teamId() != null) {
            ids.addAll(userRepository.findActiveIdsByTeamId(user.teamId()));
        }
        ids.addAll(userRepository.findActiveIdsByManagerId(user.userId()));
        return ids;
    }
}
