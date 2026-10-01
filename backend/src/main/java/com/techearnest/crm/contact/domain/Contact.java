package com.techearnest.crm.contact.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "contacts")
@EntityListeners(AuditingEntityListener.class)
public class Contact implements SecuredRecord {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    private String email;
    private String phone;
    private String mobile;
    private String designation;
    private String department;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Column(nullable = false)
    private String status;

    private String notes;

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

    public static Contact create(
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID ownerId,
            String firstName,
            String lastName,
            String email,
            String phone,
            String mobile,
            String designation,
            String department,
            String linkedinUrl,
            String status,
            String notes) {
        Contact contact = new Contact();
        contact.id = UUID.randomUUID();
        contact.organizationId = organizationId;
        contact.regionId = regionId;
        contact.accountId = accountId;
        contact.ownerId = ownerId;
        contact.firstName = firstName;
        contact.lastName = lastName;
        contact.email = email;
        contact.phone = phone;
        contact.mobile = mobile;
        contact.designation = designation;
        contact.department = department;
        contact.linkedinUrl = linkedinUrl;
        contact.status = status != null && !status.isBlank() ? status : "ACTIVE";
        contact.notes = notes;
        return contact;
    }

    public void update(
            UUID ownerId,
            String firstName,
            String lastName,
            String email,
            String phone,
            String mobile,
            String designation,
            String department,
            String linkedinUrl,
            String status,
            String notes) {
        if (ownerId != null) {
            this.ownerId = ownerId;
        }
        // Partial PATCH: null means leave unchanged.
        if (firstName != null) {
            this.firstName = firstName;
        }
        if (lastName != null) {
            this.lastName = lastName;
        }
        if (email != null) {
            this.email = email;
        }
        if (phone != null) {
            this.phone = phone;
        }
        if (mobile != null) {
            this.mobile = mobile;
        }
        if (designation != null) {
            this.designation = designation;
        }
        if (department != null) {
            this.department = department;
        }
        if (linkedinUrl != null) {
            this.linkedinUrl = linkedinUrl;
        }
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
        if (notes != null) {
            this.notes = notes;
        }
    }

    public void reassignOwner(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.status = "INACTIVE";
    }

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

    @Override
    public UUID getOwnerId() {
        return ownerId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getMobile() {
        return mobile;
    }

    public String getDesignation() {
        return designation;
    }

    public String getDepartment() {
        return department;
    }

    public String getLinkedinUrl() {
        return linkedinUrl;
    }

    public String getStatus() {
        return status;
    }

    public String getNotes() {
        return notes;
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
}
