package com.techearnest.crm.metadata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sys_field_acl")
public class SysFieldAcl {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(name = "field_id", nullable = false)
    private UUID fieldId;

    @Column(name = "access_level", nullable = false, length = 16)
    private String accessLevel;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    private UUID updatedBy;

    public static SysFieldAcl create(
            UUID orgId, UUID roleId, UUID fieldId, String accessLevel, UUID userId) {
        SysFieldAcl acl = new SysFieldAcl();
        acl.id = UUID.randomUUID();
        acl.organizationId = orgId;
        acl.roleId = roleId;
        acl.fieldId = fieldId;
        acl.accessLevel = accessLevel;
        Instant now = Instant.now();
        acl.createdAt = now;
        acl.updatedAt = now;
        acl.updatedBy = userId;
        return acl;
    }

    public void update(String accessLevel, UUID userId) {
        this.accessLevel = accessLevel;
        this.updatedBy = userId;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getRoleId() {
        return roleId;
    }

    public UUID getFieldId() {
        return fieldId;
    }

    public String getAccessLevel() {
        return accessLevel;
    }
}
