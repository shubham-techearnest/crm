package com.techearnest.crm.resource.application;

import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Human-readable resource names. A resource's own full name wins (people without a login have no user record),
 * then the linked user's name, then the employee code / designation.
 */
@Component
public class ResourceDisplayNames {

    private final ResourceRepository resourceRepository;
    private final UserRepository userRepository;

    public ResourceDisplayNames(ResourceRepository resourceRepository, UserRepository userRepository) {
        this.resourceRepository = resourceRepository;
        this.userRepository = userRepository;
    }

    public String of(Resource resource) {
        return namesFor(List.of(resource)).get(resource.getId());
    }

    public Map<UUID, String> byResourceIds(Collection<UUID> resourceIds) {
        if (resourceIds.isEmpty()) {
            return Map.of();
        }
        return namesFor(resourceRepository.findAllById(new HashSet<>(resourceIds)));
    }

    public Map<UUID, String> namesFor(Iterable<Resource> resources) {
        Set<UUID> userIds = new HashSet<>();
        for (Resource resource : resources) {
            if (resource.getUserId() != null) {
                userIds.add(resource.getUserId());
            }
        }
        Map<UUID, String> userNames = new HashMap<>();
        if (!userIds.isEmpty()) {
            for (User user : userRepository.findAllById(userIds)) {
                userNames.put(user.getId(), user.getDisplayName());
            }
        }
        Map<UUID, String> names = new HashMap<>();
        for (Resource resource : resources) {
            names.put(resource.getId(), label(resource, userNames.get(resource.getUserId())));
        }
        return names;
    }

    public static String label(Resource resource, String userDisplayName) {
        if (resource.getFullName() != null && !resource.getFullName().isBlank()) {
            return resource.getFullName();
        }
        if (userDisplayName != null && !userDisplayName.isBlank()) {
            return userDisplayName;
        }
        if (resource.getEmployeeCode() != null) {
            return resource.getEmployeeCode();
        }
        return resource.getDesignation() != null ? resource.getDesignation() : "Resource";
    }
}
