package com.techearnest.crm.department.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.branch.domain.BranchRepository;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.department.api.dto.DepartmentDtos.CreateDepartmentRequest;
import com.techearnest.crm.department.api.dto.DepartmentDtos.DepartmentResponse;
import com.techearnest.crm.department.api.dto.DepartmentDtos.UpdateDepartmentRequest;
import com.techearnest.crm.department.domain.Department;
import com.techearnest.crm.department.domain.DepartmentRepository;
import com.techearnest.crm.user.application.OwnerValidator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final BranchRepository branchRepository;
    private final OwnerValidator ownerValidator;

    public DepartmentService(
            DepartmentRepository departmentRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            BranchRepository branchRepository,
            OwnerValidator ownerValidator) {
        this.departmentRepository = departmentRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.branchRepository = branchRepository;
        this.ownerValidator = ownerValidator;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, Pageable pageable) {
        tenantAccess.requirePermission("DEPARTMENT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Page<Department> page = departmentRepository.search(orgId, blankToNull(search), pageable);
        return new PageResult(page.map(DepartmentResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public DepartmentResponse get(UUID id) {
        tenantAccess.requirePermission("DEPARTMENT_VIEW");
        Department department = requireVisibleDepartment(id);
        return DepartmentResponse.from(department);
    }

    @Transactional
    public DepartmentResponse create(CreateDepartmentRequest request) {
        CurrentUser user = tenantAccess.requirePermission("DEPARTMENT_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        validateBranch(orgId, request.branchId(), null);
        Department department = Department.create(orgId, request.branchId(), request.name().trim());
        department.update(department.getName(), department.getBranchId(), normalizeStatus(request.status()));
        department.updateDetails(
                upperOrNull(request.code()),
                blankToNull(request.description()),
                validateHead(orgId, request.headId(), null),
                lowerOrNull(request.email()));
        departmentRepository.save(department);
        auditService.record(orgId, user.userId(), "CREATE", "DEPARTMENT", department.getId());
        return DepartmentResponse.from(department);
    }

    @Transactional
    public DepartmentResponse update(UUID id, UpdateDepartmentRequest request) {
        CurrentUser user = tenantAccess.requirePermission("DEPARTMENT_MANAGE");
        Department department = requireVisibleDepartment(id);
        validateBranch(department.getOrganizationId(), request.branchId(), department.getBranchId());
        department.update(request.name().trim(), request.branchId(), normalizeStatus(request.status()));
        department.updateDetails(
                upperOrNull(request.code()),
                blankToNull(request.description()),
                validateHead(department.getOrganizationId(), request.headId(), department.getHeadId()),
                lowerOrNull(request.email()));
        auditService.record(department.getOrganizationId(), user.userId(), "UPDATE", "DEPARTMENT", department.getId());
        return DepartmentResponse.from(department);
    }

    private Department requireVisibleDepartment(UUID id) {
        Department department = departmentRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(department.getOrganizationId());
        return department;
    }

    private void validateBranch(UUID orgId, UUID branchId, UUID currentBranchId) {
        if (branchId == null || branchId.equals(currentBranchId)) {
            return;
        }
        branchRepository
                .findActiveById(branchId)
                .filter(branch -> Objects.equals(branch.getOrganizationId(), orgId))
                .orElseThrow(() -> new BusinessException("INVALID_BRANCH", "Branch not found in this organization"));
    }

    private UUID validateHead(UUID orgId, UUID headId, UUID currentHeadId) {
        if (headId != null && !headId.equals(currentHeadId)) {
            OwnerValidator.requireSameOrganization(ownerValidator.requireActiveOwner(headId), orgId);
        }
        return headId;
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(normalized) && !"INACTIVE".equals(normalized)) {
            throw new BusinessException("INVALID_STATUS", "Department status must be ACTIVE or INACTIVE");
        }
        return normalized;
    }

    private static String upperOrNull(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String lowerOrNull(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<DepartmentResponse> data, PaginationMeta pagination) {}
}
