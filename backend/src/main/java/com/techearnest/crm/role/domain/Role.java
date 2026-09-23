package com.techearnest.crm.role.domain;

import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.permission.domain.Permission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "roles")
@EntityListeners(AuditingEntityListener.class)
public class Role {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_scope", nullable = false)
    private DataScope dataScope;

    @Column(name = "is_system", nullable = false)
    private boolean system;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private UUID updatedBy;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "role_permissions",
            joinColumns = @JoinColumn(name = "role_id"),
            inverseJoinColumns = @JoinColumn(name = "permission_id"))
    private Set<Permission> permissions = new HashSet<>();

    public static Role create(UUID organizationId, String code, String name, DataScope dataScope) {
        Role role = new Role();
        role.id = UUID.randomUUID();
        role.organizationId = organizationId;
        role.code = code.toUpperCase();
        role.name = name;
        role.dataScope = dataScope;
        role.system = false;
        return role;
    }

    public static Role createSystem(UUID organizationId, String code, String name, DataScope dataScope) {
        Role role = create(organizationId, code, name, dataScope);
        role.system = true;
        return role;
    }

    public void update(String name, DataScope dataScope) {
        this.name = name;
        if (dataScope != null) {
            this.dataScope = dataScope;
        }
    }

    public void replacePermissions(Set<Permission> next) {
        this.permissions.clear();
        this.permissions.addAll(next);
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public DataScope getDataScope() {
        return dataScope;
    }

    public boolean isSystem() {
        return system;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Set<Permission> getPermissions() {
        return permissions;
    }
}
