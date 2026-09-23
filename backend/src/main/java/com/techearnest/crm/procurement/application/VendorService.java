package com.techearnest.crm.procurement.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.procurement.api.dto.VendorDtos.CreateVendorRequest;
import com.techearnest.crm.procurement.api.dto.VendorDtos.QueryVendorRequest;
import com.techearnest.crm.procurement.api.dto.VendorDtos.UpdateVendorRequest;
import com.techearnest.crm.procurement.api.dto.VendorDtos.VendorResponse;
import com.techearnest.crm.procurement.domain.Vendor;
import com.techearnest.crm.procurement.domain.VendorRepository;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VendorService {

    private static final Set<String> STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final VendorRepository vendorRepository;
    private final AccountRepository accountRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public VendorService(
            VendorRepository vendorRepository,
            AccountRepository accountRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.vendorRepository = vendorRepository;
        this.accountRepository = accountRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, String status, Pageable pageable) {
        tenantAccess.requirePermission("VENDOR_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<Vendor> page =
                vendorRepository.search(orgId, blankToNull(search), regionIds, blankToNull(status), pageable);
        return new PageResult(page.map(VendorResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryVendorRequest request) {
        tenantAccess.requirePermission("VENDOR_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        int page = request != null && request.page() != null ? request.page() : 0;
        int size = request != null && request.size() != null ? Math.min(request.size(), 100) : 50;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "name"));
        Specification<Vendor> filterSpec = FilterSpecificationBuilder.build(
                request == null ? null : request.filter(), VendorFilterFields.ALLOWED);
        Page<Vendor> result = vendorRepository.searchWithFilter(
                orgId,
                request == null ? null : blankToNull(request.search()),
                regionIds,
                request == null ? null : blankToNull(request.status()),
                filterSpec,
                pageable);
        return new PageResult(result.map(VendorResponse::from).getContent(), PaginationMeta.from(result));
    }

    @Transactional(readOnly = true)
    public VendorResponse get(UUID id) {
        tenantAccess.requirePermission("VENDOR_VIEW");
        return VendorResponse.from(requireVisible(id));
    }

    @Transactional
    public VendorResponse create(CreateVendorRequest request) {
        CurrentUser user = tenantAccess.requirePermission("VENDOR_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        tenantAccess.assertRegionVisible(request.regionId());
        UUID accountId = resolveAccountId(orgId, request.accountId());
        String status = request.status() == null || request.status().isBlank()
                ? Vendor.STATUS_ACTIVE
                : request.status().trim().toUpperCase();
        if (!STATUSES.contains(status)) {
            throw new BusinessException("INVALID_STATUS", "Invalid vendor status");
        }
        Vendor vendor = Vendor.create(
                orgId,
                request.regionId(),
                request.name(),
                request.email(),
                request.phone(),
                request.taxNumber(),
                accountId,
                request.paymentTermsDays(),
                status,
                request.notes(),
                user.userId());
        vendorRepository.save(vendor);
        auditService.record(orgId, user.userId(), "CREATE", "VENDOR", vendor.getId());
        return VendorResponse.from(vendor);
    }

    @Transactional
    public VendorResponse update(UUID id, UpdateVendorRequest request) {
        CurrentUser user = tenantAccess.requirePermission("VENDOR_MANAGE");
        Vendor vendor = requireVisible(id);
        if (request.status() != null
                && !request.status().isBlank()
                && !STATUSES.contains(request.status().trim().toUpperCase())) {
            throw new BusinessException("INVALID_STATUS", "Invalid vendor status");
        }
        UUID accountId =
                request.accountId() != null ? resolveAccountId(vendor.getOrganizationId(), request.accountId()) : null;
        vendor.update(
                request.name(),
                request.email(),
                request.phone(),
                request.taxNumber(),
                accountId,
                request.paymentTermsDays(),
                request.status(),
                request.notes(),
                user.userId());
        auditService.record(vendor.getOrganizationId(), user.userId(), "UPDATE", "VENDOR", vendor.getId());
        return VendorResponse.from(vendor);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("VENDOR_MANAGE");
        Vendor vendor = requireVisible(id);
        vendor.markDeleted();
        auditService.record(vendor.getOrganizationId(), user.userId(), "DELETE", "VENDOR", vendor.getId());
    }

    private UUID resolveAccountId(UUID orgId, UUID accountId) {
        if (accountId == null) {
            return null;
        }
        Account account = accountRepository
                .findActiveById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!orgId.equals(account.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return account.getId();
    }

    private Vendor requireVisible(UUID id) {
        Vendor vendor =
                vendorRepository.findActiveById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(vendor.getOrganizationId());
        tenantAccess.assertRegionVisible(vendor.getRegionId());
        return vendor;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<VendorResponse> data, PaginationMeta pagination) {}
}
