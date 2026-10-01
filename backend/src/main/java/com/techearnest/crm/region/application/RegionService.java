package com.techearnest.crm.region.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.region.api.dto.RegionDtos.CreateRegionRequest;
import com.techearnest.crm.region.api.dto.RegionDtos.RegionResponse;
import com.techearnest.crm.region.api.dto.RegionDtos.UpdateRegionRequest;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.user.application.OwnerValidator;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RegionService {

    private final RegionRepository regionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final OwnerValidator ownerValidator;

    public RegionService(
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            OwnerValidator ownerValidator) {
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.ownerValidator = ownerValidator;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, Pageable pageable) {
        tenantAccess.requirePermission("REGION_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<Region> page = regionRepository.search(orgId, blankToNull(search), regionIds, pageable);
        return new PageResult(page.map(RegionResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public RegionResponse get(UUID id) {
        tenantAccess.requirePermission("REGION_VIEW");
        Region region = requireVisibleRegion(id);
        return RegionResponse.from(region);
    }

    @Transactional
    public RegionResponse create(CreateRegionRequest request) {
        CurrentUser user = tenantAccess.requirePermission("REGION_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        if (request.parentId() != null) {
            Region parent = regionRepository
                    .findActiveById(request.parentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!parent.getOrganizationId().equals(orgId)) {
                throw new ResourceNotFoundException("Resource not found");
            }
            tenantAccess.assertRegionVisible(parent.getId());
        } else if (user.dataScope() == DataScope.REGION) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }

        String code = request.code().trim().toUpperCase();
        if (regionRepository.existsByOrganizationIdAndCodeIgnoreCaseAndDeletedAtIsNull(orgId, code)) {
            throw new ConflictException("Region code already exists");
        }

        Region region = Region.create(orgId, request.parentId(), request.name().trim(), code);
        region.update(region.getName(), region.getParentId(), normalizeStatus(request.status()));
        region.updateDetails(
                blankToNull(request.description()),
                validateManager(orgId, request.managerId(), null),
                blankToNull(request.timezone()),
                upperOrNull(request.currencyCode()));
        regionRepository.save(region);
        auditService.record(orgId, user.userId(), "CREATE", "REGION", region.getId());
        return RegionResponse.from(region);
    }

    @Transactional
    public RegionResponse update(UUID id, UpdateRegionRequest request) {
        CurrentUser user = tenantAccess.requirePermission("REGION_MANAGE");
        Region region = requireVisibleRegion(id);
        if (request.parentId() != null) {
            Region parent = regionRepository
                    .findActiveById(request.parentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!parent.getOrganizationId().equals(region.getOrganizationId())) {
                throw new ResourceNotFoundException("Resource not found");
            }
            tenantAccess.assertRegionVisible(parent.getId());
            assertNoCycle(region, parent);
        }
        region.update(request.name().trim(), request.parentId(), normalizeStatus(request.status()));
        region.updateDetails(
                blankToNull(request.description()),
                validateManager(region.getOrganizationId(), request.managerId(), region.getManagerId()),
                blankToNull(request.timezone()),
                upperOrNull(request.currencyCode()));
        auditService.record(region.getOrganizationId(), user.userId(), "UPDATE", "REGION", region.getId());
        return RegionResponse.from(region);
    }

    private Region requireVisibleRegion(UUID id) {
        Region region = regionRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(region.getOrganizationId());
        tenantAccess.assertRegionVisible(region.getId());
        return region;
    }

    private void assertNoCycle(Region region, Region parent) {
        Region cursor = parent;
        for (int depth = 0; cursor != null && depth < 64; depth++) {
            if (cursor.getId().equals(region.getId())) {
                throw new BusinessException("INVALID_PARENT", "A region cannot be placed under itself or its sub-regions");
            }
            UUID next = cursor.getParentId();
            cursor = next == null ? null : regionRepository.findActiveById(next).orElse(null);
        }
    }

    private UUID validateManager(UUID orgId, UUID managerId, UUID currentManagerId) {
        if (managerId != null && !managerId.equals(currentManagerId)) {
            OwnerValidator.requireSameOrganization(ownerValidator.requireActiveOwner(managerId), orgId);
        }
        return managerId;
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(normalized) && !"INACTIVE".equals(normalized)) {
            throw new BusinessException("INVALID_STATUS", "Region status must be ACTIVE or INACTIVE");
        }
        return normalized;
    }

    private static String upperOrNull(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<RegionResponse> data, PaginationMeta pagination) {}
}
