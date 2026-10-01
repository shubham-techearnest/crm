package com.techearnest.crm.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Catalogue entry for a kind of resource (employee, contractor, ...). New kinds are added as rows. */
@Entity
@Table(name = "resource_types")
public class ResourceType {

    public static final String CATEGORY_INTERNAL = "INTERNAL";
    public static final String CATEGORY_EXTERNAL = "EXTERNAL";

    @Id
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(name = "code_prefix", nullable = false)
    private String codePrefix;

    @Column(name = "requires_user", nullable = false)
    private boolean requiresUser;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active;

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getCategory() {
        return category;
    }

    public boolean isExternal() {
        return CATEGORY_EXTERNAL.equals(category);
    }

    public String getCodePrefix() {
        return codePrefix;
    }

    public boolean isRequiresUser() {
        return requiresUser;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isActive() {
        return active;
    }
}
