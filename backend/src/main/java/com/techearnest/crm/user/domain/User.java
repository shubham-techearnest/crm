package com.techearnest.crm.user.domain;

import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.role.domain.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
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
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "region_id")
    private UUID regionId;

    @Column(name = "branch_id")
    private UUID branchId;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "team_id")
    private UUID teamId;

    @Column(name = "manager_id")
    private UUID managerId;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    private String phone;

    @Column(nullable = false)
    private String status;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "access_expires_at")
    private Instant accessExpiresAt;

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
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "user_regions",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "region_id"))
    private Set<Region> assignedRegions = new HashSet<>();

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getRegionId() {
        return regionId;
    }

    public UUID getDepartmentId() {
        return departmentId;
    }

    public UUID getTeamId() {
        return teamId;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getDisplayName() {
        return (firstName + " " + lastName).trim();
    }

    public String getStatus() {
        return status;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public Set<Region> getAssignedRegions() {
        return assignedRegions;
    }

    public void markLoggedIn() {
        this.lastLoginAt = Instant.now();
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public UUID getBranchId() {
        return branchId;
    }

    public UUID getManagerId() {
        return managerId;
    }

    public String getPhone() {
        return phone;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public static User create(
            UUID organizationId,
            String email,
            String passwordHash,
            String firstName,
            String lastName,
            String phone,
            UUID regionId,
            UUID branchId,
            UUID departmentId,
            UUID teamId,
            UUID managerId,
            String status) {
        User user = new User();
        user.id = UUID.randomUUID();
        user.organizationId = organizationId;
        user.email = email.trim().toLowerCase();
        user.passwordHash = passwordHash;
        user.firstName = firstName;
        user.lastName = lastName;
        user.phone = phone;
        user.regionId = regionId;
        user.branchId = branchId;
        user.departmentId = departmentId;
        user.teamId = teamId;
        user.managerId = managerId;
        user.status = status == null || status.isBlank() ? "ACTIVE" : status;
        return user;
    }

    public void updateProfile(
            String firstName,
            String lastName,
            String phone,
            UUID regionId,
            UUID branchId,
            UUID departmentId,
            UUID teamId,
            UUID managerId,
            String status) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
        this.regionId = regionId;
        this.branchId = branchId;
        this.departmentId = departmentId;
        this.teamId = teamId;
        this.managerId = managerId;
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
    }

    public void replaceRoles(Set<Role> nextRoles) {
        this.roles.clear();
        this.roles.addAll(nextRoles);
    }

    public void replaceAssignedRegions(Set<Region> nextRegions) {
        this.assignedRegions.clear();
        this.assignedRegions.addAll(nextRegions);
    }

    public void deactivate() {
        this.status = "DEACTIVATED";
    }

    public Instant getAccessExpiresAt() {
        return accessExpiresAt;
    }

    public void setAccessExpiresAt(Instant accessExpiresAt) {
        this.accessExpiresAt = accessExpiresAt;
    }

    public boolean isAccessExpired(Instant now) {
        return accessExpiresAt != null && !accessExpiresAt.isAfter(now);
    }

    public void acceptInvite(String passwordHash) {
        this.passwordHash = passwordHash;
        this.status = "ACTIVE";
    }

    public void reinvite() {
        this.status = "INVITED";
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.status = "DEACTIVATED";
    }
}
