package com.techearnest.crm.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "invoice_number_sequences")
public class InvoiceNumberSequence {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(nullable = false, length = 16)
    private String prefix = "INV";

    @Column(name = "next_value", nullable = false)
    private long nextValue = 1;

    @Column(name = "pad_width", nullable = false)
    private int padWidth = 5;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static InvoiceNumberSequence create(UUID organizationId, String prefix) {
        InvoiceNumberSequence seq = new InvoiceNumberSequence();
        seq.id = UUID.randomUUID();
        seq.organizationId = organizationId;
        seq.prefix = prefix == null || prefix.isBlank() ? "INV" : prefix.trim().toUpperCase();
        seq.nextValue = 1;
        seq.padWidth = 5;
        seq.createdAt = Instant.now();
        seq.updatedAt = Instant.now();
        return seq;
    }

    public String allocateNext() {
        String number = prefix + "-" + String.format("%0" + padWidth + "d", nextValue);
        nextValue += 1;
        updatedAt = Instant.now();
        return number;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getPrefix() {
        return prefix;
    }
}
