package com.techearnest.crm.contract.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "contract_expiry_reminders")
public class ContractExpiryReminder {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "contract_id", nullable = false)
    private UUID contractId;

    @Column(name = "remind_on", nullable = false)
    private LocalDate remindOn;

    @Column(name = "notified_user_id")
    private UUID notifiedUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static ContractExpiryReminder create(
            UUID organizationId, UUID contractId, LocalDate remindOn, UUID notifiedUserId) {
        ContractExpiryReminder row = new ContractExpiryReminder();
        row.id = UUID.randomUUID();
        row.organizationId = organizationId;
        row.contractId = contractId;
        row.remindOn = remindOn;
        row.notifiedUserId = notifiedUserId;
        row.createdAt = Instant.now();
        return row;
    }

    public UUID getId() {
        return id;
    }
}
