package com.techearnest.crm.deal.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "deals")
@EntityListeners(AuditingEntityListener.class)
public class Deal implements SecuredRecord, Persistable<UUID> {

    public static final Map<String, BigDecimal> DEFAULT_PROBABILITY = Map.of(
            "NEW", new BigDecimal("10"),
            "QUALIFICATION", new BigDecimal("20"),
            "REQUIREMENT", new BigDecimal("40"),
            "PROPOSAL", new BigDecimal("60"),
            "NEGOTIATION", new BigDecimal("80"),
            "WON", new BigDecimal("100"),
            "LOST", BigDecimal.ZERO);

    @Id
    private UUID id;

    @Transient
    private boolean newEntity = true;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "contact_id")
    private UUID contactId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "lead_id")
    private UUID leadId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String stage;

    @Column(nullable = false)
    private BigDecimal value;

    @Column(nullable = false)
    private BigDecimal probability;

    @Column(name = "expected_close_date")
    private LocalDate expectedCloseDate;

    private String source;
    private String description;
    private String competitor;

    @Column(name = "won_at")
    private Instant wonAt;

    @Column(name = "lost_at")
    private Instant lostAt;

    @Column(name = "lost_reason")
    private String lostReason;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
    @Column(nullable = false)
    private Long version;

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

    public static Deal create(
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID contactId,
            UUID ownerId,
            UUID leadId,
            String name,
            String stage,
            BigDecimal value,
            BigDecimal probability,
            LocalDate expectedCloseDate,
            String source,
            String description,
            String competitor) {
        Deal deal = new Deal();
        deal.id = UUID.randomUUID();
        deal.organizationId = organizationId;
        deal.regionId = regionId;
        deal.accountId = accountId;
        deal.contactId = contactId;
        deal.ownerId = ownerId;
        deal.leadId = leadId;
        deal.name = name;
        deal.stage = stage != null && !stage.isBlank() ? stage : "NEW";
        deal.value = value != null ? value : BigDecimal.ZERO;
        deal.probability = probability != null ? probability : defaultProbability(deal.stage);
        deal.expectedCloseDate = expectedCloseDate;
        deal.source = source;
        deal.description = description;
        deal.competitor = competitor;
        return deal;
    }

    public static BigDecimal defaultProbability(String stage) {
        return DEFAULT_PROBABILITY.getOrDefault(stage, BigDecimal.ZERO);
    }

    public void update(
            UUID contactId,
            UUID ownerId,
            String name,
            BigDecimal value,
            BigDecimal probability,
            LocalDate expectedCloseDate,
            String source,
            String description,
            String competitor) {
        this.contactId = contactId;
        if (ownerId != null) {
            this.ownerId = ownerId;
        }
        this.name = name;
        if (value != null) {
            this.value = value;
        }
        if (probability != null) {
            this.probability = probability;
        }
        this.expectedCloseDate = expectedCloseDate;
        this.source = source;
        this.description = description;
        this.competitor = competitor;
    }

    public void changeStage(String toStage, String lostReason, LocalDate expectedCloseDate) {
        this.stage = toStage;
        this.probability = defaultProbability(toStage);
        if ("WON".equals(toStage)) {
            this.wonAt = Instant.now();
            this.lostAt = null;
            this.lostReason = null;
            if (expectedCloseDate != null) {
                this.expectedCloseDate = expectedCloseDate;
            }
        } else if ("LOST".equals(toStage)) {
            this.lostAt = Instant.now();
            this.wonAt = null;
            this.lostReason = lostReason;
        } else {
            this.wonAt = null;
            this.lostAt = null;
            this.lostReason = null;
        }
    }

    /** @deprecated use changeStage(toStage, lostReason, expectedCloseDate) */
    public void changeStage(String toStage, String lostReason) {
        changeStage(toStage, lostReason, null);
    }

    public void reassignOwner(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.newEntity = false;
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public UUID getOrganizationId() {
        return organizationId;
    }

    @Override
    public UUID getRegionId() {
        return regionId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public UUID getContactId() {
        return contactId;
    }

    @Override
    public UUID getOwnerId() {
        return ownerId;
    }

    public UUID getLeadId() {
        return leadId;
    }

    public String getName() {
        return name;
    }

    public String getStage() {
        return stage;
    }

    public BigDecimal getValue() {
        return value;
    }

    public BigDecimal getProbability() {
        return probability;
    }

    public LocalDate getExpectedCloseDate() {
        return expectedCloseDate;
    }

    public String getSource() {
        return source;
    }

    public String getDescription() {
        return description;
    }

    public String getCompetitor() {
        return competitor;
    }

    public Instant getWonAt() {
        return wonAt;
    }

    public Instant getLostAt() {
        return lostAt;
    }

    public String getLostReason() {
        return lostReason;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
