package com.techearnest.crm.deal.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "deal_stage_history")
public class DealStageHistory {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "deal_id", nullable = false)
    private UUID dealId;

    @Column(name = "from_stage")
    private String fromStage;

    @Column(name = "to_stage", nullable = false)
    private String toStage;

    @Column(name = "changed_by", nullable = false)
    private UUID changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    public static DealStageHistory of(
            UUID organizationId, UUID dealId, String fromStage, String toStage, UUID changedBy) {
        DealStageHistory history = new DealStageHistory();
        history.id = UUID.randomUUID();
        history.organizationId = organizationId;
        history.dealId = dealId;
        history.fromStage = fromStage;
        history.toStage = toStage;
        history.changedBy = changedBy;
        history.changedAt = Instant.now();
        return history;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getDealId() {
        return dealId;
    }

    public String getFromStage() {
        return fromStage;
    }

    public String getToStage() {
        return toStage;
    }

    public UUID getChangedBy() {
        return changedBy;
    }

    public Instant getChangedAt() {
        return changedAt;
    }
}
