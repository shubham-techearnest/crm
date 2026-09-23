package com.techearnest.crm.metadata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "sys_user_list_pref")
public class SysUserListPref {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "table_code", nullable = false, length = 64)
    private String tableCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "columns_json", nullable = false, columnDefinition = "jsonb")
    private String columnsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static SysUserListPref create(UUID orgId, UUID userId, String tableCode, String columnsJson) {
        SysUserListPref pref = new SysUserListPref();
        pref.id = UUID.randomUUID();
        pref.organizationId = orgId;
        pref.userId = userId;
        pref.tableCode = tableCode;
        pref.columnsJson = columnsJson;
        Instant now = Instant.now();
        pref.createdAt = now;
        pref.updatedAt = now;
        return pref;
    }

    public void updateColumns(String columnsJson) {
        this.columnsJson = columnsJson;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTableCode() {
        return tableCode;
    }

    public String getColumnsJson() {
        return columnsJson;
    }
}
