package com.techearnest.crm.metadata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sys_table_acl")
public class SysTableAcl {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(name = "table_id", nullable = false)
    private UUID tableId;

    @Column(name = "can_create", nullable = false)
    private boolean canCreate;

    @Column(name = "can_read", nullable = false)
    private boolean canRead;

    @Column(name = "can_update", nullable = false)
    private boolean canUpdate;

    @Column(name = "can_delete", nullable = false)
    private boolean canDelete;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    private UUID updatedBy;

    public static SysTableAcl create(
            UUID orgId,
            UUID roleId,
            UUID tableId,
            boolean create,
            boolean read,
            boolean update,
            boolean delete,
            UUID userId) {
        SysTableAcl acl = new SysTableAcl();
        acl.id = UUID.randomUUID();
        acl.organizationId = orgId;
        acl.roleId = roleId;
        acl.tableId = tableId;
        acl.canCreate = create;
        acl.canRead = read;
        acl.canUpdate = update;
        acl.canDelete = delete;
        Instant now = Instant.now();
        acl.createdAt = now;
        acl.updatedAt = now;
        acl.updatedBy = userId;
        return acl;
    }

    public void update(boolean create, boolean read, boolean update, boolean delete, UUID userId) {
        this.canCreate = create;
        this.canRead = read;
        this.canUpdate = update;
        this.canDelete = delete;
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

    public UUID getTableId() {
        return tableId;
    }

    public boolean isCanCreate() {
        return canCreate;
    }

    public boolean isCanRead() {
        return canRead;
    }

    public boolean isCanUpdate() {
        return canUpdate;
    }

    public boolean isCanDelete() {
        return canDelete;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
