package com.techearnest.crm.resource.application;

import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.resource.domain.ResourceType;
import com.techearnest.crm.resource.domain.ResourceTypeRepository;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Reads the resource_types catalogue; the table is small, so each call reads it fresh. */
@Component
public class ResourceTypeCatalog {

    private final ResourceTypeRepository repository;

    public ResourceTypeCatalog(ResourceTypeRepository repository) {
        this.repository = repository;
    }

    public List<ResourceType> all() {
        return repository.findAllOrdered();
    }

    public Optional<ResourceType> find(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        return repository.findById(code.trim().toUpperCase(Locale.ROOT));
    }

    /** Normalises and validates a type code for a new or changed resource; only active types are accepted. */
    public ResourceType requireActive(String code) {
        return find(code)
                .filter(ResourceType::isActive)
                .orElseThrow(() -> new BusinessException(
                        "INVALID_RESOURCE_TYPE",
                        "Resource type must be one of "
                                + all().stream()
                                        .filter(ResourceType::isActive)
                                        .map(ResourceType::getCode)
                                        .collect(Collectors.joining(", "))));
    }
}
