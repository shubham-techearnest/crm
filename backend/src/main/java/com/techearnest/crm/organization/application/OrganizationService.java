package com.techearnest.crm.organization.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.organization.api.dto.OrganizationDtos.CreateOrganizationRequest;
import com.techearnest.crm.organization.api.dto.OrganizationDtos.OrganizationResponse;
import com.techearnest.crm.organization.api.dto.OrganizationDtos.UpdateOrganizationRequest;
import com.techearnest.crm.organization.domain.Organization;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public OrganizationService(
            OrganizationRepository organizationRepository, TenantAccess tenantAccess, AuditService auditService) {
        this.organizationRepository = organizationRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(String search, Pageable pageable) {
        CurrentUser user = tenantAccess.requirePermission("ORG_VIEW");
        Page<Organization> page;
        if (user.dataScope() == DataScope.PLATFORM) {
            page = organizationRepository.searchActive(blankToNull(search), null, pageable);
        } else {
            Organization org = organizationRepository
                    .findActiveById(user.organizationId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            page = new PageImpl<>(List.of(org), pageable, 1);
        }
        return new PageResult(page.map(OrganizationResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public OrganizationResponse get(UUID id) {
        tenantAccess.requirePermission("ORG_VIEW");
        Organization org = organizationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(org.getId());
        return OrganizationResponse.from(org);
    }

    @Transactional
    public OrganizationResponse create(CreateOrganizationRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ORG_CREATE");
        String slug = request.slug().trim().toLowerCase();
        if (organizationRepository.existsBySlugIgnoreCaseAndDeletedAtIsNull(slug)) {
            throw new ConflictException("Organization slug already exists");
        }
        Organization org = Organization.create(
                request.name().trim(),
                slug,
                request.legalName(),
                request.email(),
                request.phone(),
                request.website(),
                request.timezone(),
                request.locale(),
                request.currencyCode());
        organizationRepository.save(org);
        auditService.record(org.getId(), user.userId(), "CREATE", "ORGANIZATION", org.getId());
        return OrganizationResponse.from(org);
    }

    @Transactional
    public OrganizationResponse update(UUID id, UpdateOrganizationRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ORG_UPDATE");
        Organization org = organizationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(org.getId());
        org.update(
                request.name().trim(),
                request.legalName(),
                request.email(),
                request.phone(),
                request.website(),
                request.timezone(),
                request.locale(),
                request.currencyCode(),
                request.status());
        auditService.record(org.getId(), user.userId(), "UPDATE", "ORGANIZATION", org.getId());
        return OrganizationResponse.from(org);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<OrganizationResponse> data, PaginationMeta pagination) {}
}
