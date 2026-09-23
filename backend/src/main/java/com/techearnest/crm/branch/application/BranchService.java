package com.techearnest.crm.branch.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.branch.api.dto.BranchDtos.BranchResponse;
import com.techearnest.crm.branch.api.dto.BranchDtos.CreateBranchRequest;
import com.techearnest.crm.branch.api.dto.BranchDtos.UpdateBranchRequest;
import com.techearnest.crm.branch.domain.Branch;
import com.techearnest.crm.branch.domain.BranchRepository;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
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
public class BranchService {

    private final BranchRepository branchRepository;
    private final RegionRepository regionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public BranchService(
            BranchRepository branchRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.branchRepository = branchRepository;
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, Pageable pageable) {
        tenantAccess.requirePermission("BRANCH_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<Branch> page = branchRepository.search(orgId, blankToNull(search), regionIds, pageable);
        return new PageResult(page.map(BranchResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public BranchResponse get(UUID id) {
        tenantAccess.requirePermission("BRANCH_VIEW");
        Branch branch = requireVisibleBranch(id);
        return BranchResponse.from(branch);
    }

    @Transactional
    public BranchResponse create(CreateBranchRequest request) {
        CurrentUser user = tenantAccess.requirePermission("BRANCH_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Region region = requireRegionInOrg(request.regionId(), orgId);
        tenantAccess.assertRegionVisible(region.getId());

        Branch branch = Branch.create(orgId, region.getId(), request.name().trim(), request.address());
        branchRepository.save(branch);
        auditService.record(orgId, user.userId(), "CREATE", "BRANCH", branch.getId());
        return BranchResponse.from(branch);
    }

    @Transactional
    public BranchResponse update(UUID id, UpdateBranchRequest request) {
        CurrentUser user = tenantAccess.requirePermission("BRANCH_MANAGE");
        Branch branch = requireVisibleBranch(id);
        UUID regionId = request.regionId() != null ? request.regionId() : branch.getRegionId();
        Region region = requireRegionInOrg(regionId, branch.getOrganizationId());
        tenantAccess.assertRegionVisible(region.getId());
        branch.update(request.name().trim(), request.address(), region.getId(), request.status());
        auditService.record(branch.getOrganizationId(), user.userId(), "UPDATE", "BRANCH", branch.getId());
        return BranchResponse.from(branch);
    }

    private Branch requireVisibleBranch(UUID id) {
        Branch branch = branchRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(branch.getOrganizationId());
        tenantAccess.assertRegionVisible(branch.getRegionId());
        return branch;
    }

    private Region requireRegionInOrg(UUID regionId, UUID organizationId) {
        Region region = regionRepository
                .findActiveById(regionId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!region.getOrganizationId().equals(organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return region;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<BranchResponse> data, PaginationMeta pagination) {}
}
