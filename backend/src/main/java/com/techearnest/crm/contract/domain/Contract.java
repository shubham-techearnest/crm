package com.techearnest.crm.contract.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "contracts")
public class Contract {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_EXPIRED = "EXPIRED";
    public static final String STATUS_TERMINATED = "TERMINATED";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(nullable = false)
    private String name;

    @Column(name = "contract_number", length = 64)
    private String contractNumber;

    @Column(nullable = false, length = 32)
    private String status = STATUS_DRAFT;

    @Column(name = "value_amount", precision = 18, scale = 2)
    private BigDecimal valueAmount;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode = "INR";

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "auto_renew", nullable = false)
    private boolean autoRenew = false;

    @Column(name = "renewal_notice_days", nullable = false)
    private int renewalNoticeDays = 30;

    @Column(columnDefinition = "TEXT")
    private String terms;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static Contract create(
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID projectId,
            String name,
            String contractNumber,
            BigDecimal valueAmount,
            String currencyCode,
            LocalDate startDate,
            LocalDate endDate,
            boolean autoRenew,
            int renewalNoticeDays,
            String terms,
            UUID ownerId,
            UUID createdBy) {
        Contract contract = new Contract();
        contract.id = UUID.randomUUID();
        contract.organizationId = organizationId;
        contract.regionId = regionId;
        contract.accountId = accountId;
        contract.projectId = projectId;
        contract.name = name;
        contract.contractNumber = contractNumber;
        contract.status = STATUS_DRAFT;
        contract.valueAmount = valueAmount;
        contract.currencyCode = currencyCode == null || currencyCode.isBlank() ? "INR" : currencyCode.trim().toUpperCase();
        contract.startDate = startDate;
        contract.endDate = endDate;
        contract.autoRenew = autoRenew;
        contract.renewalNoticeDays = renewalNoticeDays < 1 ? 30 : renewalNoticeDays;
        contract.terms = terms;
        contract.ownerId = ownerId != null ? ownerId : createdBy;
        contract.createdAt = Instant.now();
        contract.updatedAt = Instant.now();
        contract.createdBy = createdBy;
        contract.updatedBy = createdBy;
        return contract;
    }

    public void update(
            String name,
            UUID projectId,
            BigDecimal valueAmount,
            String currencyCode,
            LocalDate startDate,
            LocalDate endDate,
            Boolean autoRenew,
            Integer renewalNoticeDays,
            String terms,
            String status,
            UUID ownerId,
            UUID updatedBy) {
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (projectId != null) {
            this.projectId = projectId;
        }
        if (valueAmount != null) {
            this.valueAmount = valueAmount;
        }
        if (currencyCode != null && !currencyCode.isBlank()) {
            this.currencyCode = currencyCode.trim().toUpperCase();
        }
        if (startDate != null) {
            this.startDate = startDate;
        }
        if (endDate != null) {
            this.endDate = endDate;
        }
        if (autoRenew != null) {
            this.autoRenew = autoRenew;
        }
        if (renewalNoticeDays != null && renewalNoticeDays > 0) {
            this.renewalNoticeDays = renewalNoticeDays;
        }
        if (terms != null) {
            this.terms = terms.isBlank() ? null : terms.trim();
        }
        if (status != null && !status.isBlank()) {
            this.status = status.trim().toUpperCase();
        }
        if (ownerId != null) {
            this.ownerId = ownerId;
        }
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void markExpired() {
        this.status = STATUS_EXPIRED;
        this.updatedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getRegionId() {
        return regionId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getName() {
        return name;
    }

    public String getContractNumber() {
        return contractNumber;
    }

    public String getStatus() {
        return status;
    }

    public BigDecimal getValueAmount() {
        return valueAmount;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public boolean isAutoRenew() {
        return autoRenew;
    }

    public int getRenewalNoticeDays() {
        return renewalNoticeDays;
    }

    public String getTerms() {
        return terms;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
