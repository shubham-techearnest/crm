package com.techearnest.crm.region.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
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
import java.util.Collection;
import java.util.List;
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

    public RegionService(RegionRepository regionRepository, TenantAccess tenantAccess, AuditService auditService) {
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
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
        }
        region.update(request.name().trim(), request.parentId(), request.status());
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

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<RegionResponse> data, PaginationMeta pagination) {}
}
