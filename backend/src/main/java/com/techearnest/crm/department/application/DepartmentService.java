package com.techearnest.crm.department.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.department.api.dto.DepartmentDtos.CreateDepartmentRequest;
import com.techearnest.crm.department.api.dto.DepartmentDtos.DepartmentResponse;
import com.techearnest.crm.department.api.dto.DepartmentDtos.UpdateDepartmentRequest;
import com.techearnest.crm.department.domain.Department;
import com.techearnest.crm.department.domain.DepartmentRepository;
import java.util.List;
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

    public DepartmentService(
            DepartmentRepository departmentRepository, TenantAccess tenantAccess, AuditService auditService) {
        this.departmentRepository = departmentRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
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
        Department department = Department.create(orgId, request.branchId(), request.name().trim());
        departmentRepository.save(department);
        auditService.record(orgId, user.userId(), "CREATE", "DEPARTMENT", department.getId());
        return DepartmentResponse.from(department);
    }

    @Transactional
    public DepartmentResponse update(UUID id, UpdateDepartmentRequest request) {
        CurrentUser user = tenantAccess.requirePermission("DEPARTMENT_MANAGE");
        Department department = requireVisibleDepartment(id);
        department.update(request.name().trim(), request.branchId(), request.status());
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

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<DepartmentResponse> data, PaginationMeta pagination) {}
}
