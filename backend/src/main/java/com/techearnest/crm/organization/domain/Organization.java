package com.techearnest.crm.organization.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "organizations")
@EntityListeners(AuditingEntityListener.class)
public class Organization {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    @Column(name = "legal_name")
    private String legalName;

    private String email;
    private String phone;
    private String website;

    @Column(nullable = false)
    private String timezone;

    @Column(nullable = false)
    private String locale;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(nullable = false)
    private String status;

    @Column(name = "address_line")
    private String addressLine;

    private String city;
    private String state;
    private String country;

    @Column(name = "postal_code")
    private String postalCode;

    @Column(name = "tax_id")
    private String taxId;

    @Column(name = "date_format", nullable = false)
    private String dateFormat = "dd/MM/yyyy";

    @Column(name = "time_format", nullable = false)
    private String timeFormat = "12h";

    @Column(name = "week_start_day", nullable = false)
    private String weekStartDay = "MONDAY";

    @Column(name = "fiscal_year_start_month", nullable = false)
    private Integer fiscalYearStartMonth = 4;

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

    public static Organization create(
            String name,
            String slug,
            String legalName,
            String email,
            String phone,
            String website,
            String timezone,
            String locale,
            String currencyCode) {
        Organization org = new Organization();
        org.id = UUID.randomUUID();
        org.name = name;
        org.slug = slug;
        org.legalName = legalName;
        org.email = email;
        org.phone = phone;
        org.website = website;
        org.timezone = timezone == null || timezone.isBlank() ? "Asia/Kolkata" : timezone;
        org.locale = locale == null || locale.isBlank() ? "en-IN" : locale;
        org.currencyCode = currencyCode == null || currencyCode.isBlank() ? "INR" : currencyCode;
        org.status = "ACTIVE";
        return org;
    }

    public void update(
            String name,
            String legalName,
            String email,
            String phone,
            String website,
            String timezone,
            String locale,
            String currencyCode,
            String status) {
        this.name = name;
        this.legalName = legalName;
        this.email = email;
        this.phone = phone;
        this.website = website;
        if (timezone != null && !timezone.isBlank()) {
            this.timezone = timezone;
        }
        if (locale != null && !locale.isBlank()) {
            this.locale = locale;
        }
        if (currencyCode != null && !currencyCode.isBlank()) {
            this.currencyCode = currencyCode;
        }
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
    }

    public void updateAddress(
            String addressLine, String city, String state, String country, String postalCode, String taxId) {
        this.addressLine = addressLine;
        this.city = city;
        this.state = state;
        this.country = country;
        this.postalCode = postalCode;
        this.taxId = taxId;
    }

    /** Null values keep the current preference. */
    public void updatePreferences(
            String dateFormat, String timeFormat, String weekStartDay, Integer fiscalYearStartMonth) {
        if (dateFormat != null) this.dateFormat = dateFormat;
        if (timeFormat != null) this.timeFormat = timeFormat;
        if (weekStartDay != null) this.weekStartDay = weekStartDay;
        if (fiscalYearStartMonth != null) this.fiscalYearStartMonth = fiscalYearStartMonth;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public String getCity() {
        return city;
    }

    public String getState() {
        return state;
    }

    public String getCountry() {
        return country;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public String getTaxId() {
        return taxId;
    }

    public String getDateFormat() {
        return dateFormat;
    }

    public String getTimeFormat() {
        return timeFormat;
    }

    public String getWeekStartDay() {
        return weekStartDay;
    }

    public Integer getFiscalYearStartMonth() {
        return fiscalYearStartMonth;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public String getLegalName() {
        return legalName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getWebsite() {
        return website;
    }

    public String getTimezone() {
        return timezone;
    }

    public String getLocale() {
        return locale;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public String getStatus() {
        return status;
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
