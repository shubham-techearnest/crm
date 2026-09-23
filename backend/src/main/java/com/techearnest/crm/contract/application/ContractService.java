package com.techearnest.crm.contract.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contract.api.dto.ContractDtos.ContractResponse;
import com.techearnest.crm.contract.api.dto.ContractDtos.CreateContractRequest;
import com.techearnest.crm.contract.api.dto.ContractDtos.QueryContractRequest;
import com.techearnest.crm.contract.api.dto.ContractDtos.UpdateContractRequest;
import com.techearnest.crm.contract.domain.Contract;
import com.techearnest.crm.contract.domain.ContractRepository;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
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
public class ContractService {

    private static final Set<String> STATUSES =
            Set.of("DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED");

    private final ContractRepository contractRepository;
    private final AccountRepository accountRepository;
    private final ProjectRepository projectRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public ContractService(
            ContractRepository contractRepository,
            AccountRepository accountRepository,
            ProjectRepository projectRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.contractRepository = contractRepository;
        this.accountRepository = accountRepository;
        this.projectRepository = projectRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            UUID accountId,
            Boolean autoRenew,
            Pageable pageable) {
        tenantAccess.requirePermission("CONTRACT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<Contract> page = contractRepository.search(
                orgId, blankToNull(search), regionIds, blankToNull(status), accountId, autoRenew, pageable);
        return new PageResult(page.map(ContractResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryContractRequest request) {
        tenantAccess.requirePermission("CONTRACT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        int page = request != null && request.page() != null ? request.page() : 0;
        int size = request != null && request.size() != null ? Math.min(request.size(), 100) : 50;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<Contract> filterSpec = FilterSpecificationBuilder.build(
                request == null ? null : request.filter(), ContractFilterFields.ALLOWED);
        Page<Contract> result = contractRepository.searchWithFilter(
                orgId,
                request == null ? null : blankToNull(request.search()),
                regionIds,
                request == null ? null : blankToNull(request.status()),
                request == null ? null : request.accountId(),
                request == null ? null : request.autoRenew(),
                filterSpec,
                pageable);
        return new PageResult(result.map(ContractResponse::from).getContent(), PaginationMeta.from(result));
    }

    @Transactional(readOnly = true)
    public ContractResponse get(UUID id) {
        tenantAccess.requirePermission("CONTRACT_VIEW");
        return ContractResponse.from(requireVisible(id));
    }

    @Transactional
    public ContractResponse create(CreateContractRequest request) {
        CurrentUser user = tenantAccess.requirePermission("CONTRACT_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        tenantAccess.assertRegionVisible(request.regionId());
        Account account = accountRepository
                .findActiveById(request.accountId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!orgId.equals(account.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        UUID projectId = null;
        if (request.projectId() != null) {
            Project project = projectRepository
                    .findActiveById(request.projectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!account.getId().equals(project.getAccountId())) {
                throw new BusinessException("ACCOUNT_MISMATCH", "Project does not belong to account");
            }
            projectId = project.getId();
        }
        String status = request.status() == null || request.status().isBlank() ? "DRAFT" : request.status().trim().toUpperCase();
        if (!STATUSES.contains(status)) {
            throw new BusinessException("INVALID_STATUS", "Invalid contract status");
        }
        Contract contract = Contract.create(
                orgId,
                request.regionId(),
                account.getId(),
                projectId,
                request.name().trim(),
                blankToNull(request.contractNumber()),
                request.valueAmount(),
                request.currencyCode(),
                request.startDate(),
                request.endDate(),
                Boolean.TRUE.equals(request.autoRenew()),
                request.renewalNoticeDays() == null ? 30 : request.renewalNoticeDays(),
                blankToNull(request.terms()),
                request.ownerId(),
                user.userId());
        if (!"DRAFT".equals(status)) {
            contract.update(null, null, null, null, null, null, null, null, null, status, null, user.userId());
        }
        contractRepository.save(contract);
        auditService.record(orgId, user.userId(), "CREATE", "CONTRACT", contract.getId());
        return ContractResponse.from(contract);
    }

    @Transactional
    public ContractResponse update(UUID id, UpdateContractRequest request) {
        CurrentUser user = tenantAccess.requirePermission("CONTRACT_MANAGE");
        Contract contract = requireVisible(id);
        if (request.status() != null && !request.status().isBlank() && !STATUSES.contains(request.status().trim().toUpperCase())) {
            throw new BusinessException("INVALID_STATUS", "Invalid contract status");
        }
        contract.update(
                request.name(),
                request.projectId(),
                request.valueAmount(),
                request.currencyCode(),
                request.startDate(),
                request.endDate(),
                request.autoRenew(),
                request.renewalNoticeDays(),
                request.terms(),
                request.status(),
                request.ownerId(),
                user.userId());
        auditService.record(contract.getOrganizationId(), user.userId(), "UPDATE", "CONTRACT", contract.getId());
        return ContractResponse.from(contract);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("CONTRACT_MANAGE");
        Contract contract = requireVisible(id);
        contract.markDeleted();
        auditService.record(contract.getOrganizationId(), user.userId(), "DELETE", "CONTRACT", contract.getId());
    }

    private Contract requireVisible(UUID id) {
        Contract contract =
                contractRepository.findActiveById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(contract.getOrganizationId());
        tenantAccess.assertRegionVisible(contract.getRegionId());
        return contract;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ContractResponse> data, PaginationMeta pagination) {}
}
