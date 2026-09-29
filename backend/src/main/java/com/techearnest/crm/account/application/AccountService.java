package com.techearnest.crm.account.application;

import com.techearnest.crm.account.api.dto.AccountDtos.AccountResponse;
import com.techearnest.crm.account.api.dto.AccountDtos.CreateAccountRequest;
import com.techearnest.crm.account.api.dto.AccountDtos.UpdateAccountRequest;
import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.activity.api.dto.ActivityDtos.ActivityResponse;
import com.techearnest.crm.activity.domain.Activity;
import com.techearnest.crm.activity.domain.ActivityRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contact.api.dto.ContactDtos.ContactResponse;
import com.techearnest.crm.contact.domain.Contact;
import com.techearnest.crm.contact.domain.ContactRepository;
import com.techearnest.crm.deal.api.dto.DealDtos.DealResponse;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.project.api.dto.ProjectDtos.ProjectResponse;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final ContactRepository contactRepository;
    private final DealRepository dealRepository;
    private final ActivityRepository activityRepository;
    private final RegionRepository regionRepository;
    private final ProjectRepository projectRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public AccountService(
            AccountRepository accountRepository,
            ContactRepository contactRepository,
            DealRepository dealRepository,
            ActivityRepository activityRepository,
            RegionRepository regionRepository,
            ProjectRepository projectRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.accountRepository = accountRepository;
        this.contactRepository = contactRepository;
        this.dealRepository = dealRepository;
        this.activityRepository = activityRepository;
        this.regionRepository = regionRepository;
        this.projectRepository = projectRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            String accountType,
            String industry,
            UUID regionId,
            Pageable pageable) {
        tenantAccess.requirePermission("ACCOUNT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Account> page = accountRepository.search(
                orgId,
                blankToNull(search),
                regionIds,
                ownerIds,
                blankToNull(status),
                blankToNull(accountType),
                blankToNull(industry),
                regionId,
                pageable);
        return new PageResult(page.map(AccountResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public AccountResponse get(UUID id) {
        tenantAccess.requirePermission("ACCOUNT_VIEW");
        return AccountResponse.from(requireVisibleAccount(id));
    }

    @Transactional
    public AccountResponse create(CreateAccountRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ACCOUNT_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Region region = requireRegionInOrg(request.regionId(), orgId);
        tenantAccess.assertRegionVisible(region.getId());
        UUID ownerId = request.ownerId() != null ? request.ownerId() : user.userId();

        Account account = Account.create(
                orgId,
                region.getId(),
                ownerId,
                request.name().trim(),
                blankToNull(request.industry()),
                blankToNull(request.website()),
                blankToNull(request.email()),
                blankToNull(request.phone()),
                request.billingAddress(),
                request.shippingAddress(),
                blankToNull(request.taxNumber()),
                request.status(),
                request.accountType().trim(),
                request.description());
        accountRepository.save(account);
        auditService.record(orgId, user.userId(), "CREATE", "ACCOUNT", account.getId());
        return AccountResponse.from(account);
    }

    @Transactional
    public AccountResponse update(UUID id, UpdateAccountRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ACCOUNT_UPDATE");
        Account account = requireVisibleAccount(id);
        if (request.regionId() != null) {
            Region region = requireRegionInOrg(request.regionId(), account.getOrganizationId());
            tenantAccess.assertRegionVisible(region.getId());
        }
        account.update(
                request.regionId(),
                request.ownerId(),
                request.name().trim(),
                blankToNull(request.industry()),
                blankToNull(request.website()),
                blankToNull(request.email()),
                blankToNull(request.phone()),
                request.billingAddress(),
                request.shippingAddress(),
                blankToNull(request.taxNumber()),
                request.status(),
                blankToNull(request.accountType()),
                request.description());
        auditService.record(account.getOrganizationId(), user.userId(), "UPDATE", "ACCOUNT", account.getId());
        return AccountResponse.from(account);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("ACCOUNT_DELETE");
        Account account = requireVisibleAccount(id);
        account.markDeleted();
        auditService.record(account.getOrganizationId(), user.userId(), "DELETE", "ACCOUNT", account.getId());
    }

    @Transactional(readOnly = true)
    public ContactPageResult listContacts(UUID accountId, Pageable pageable) {
        tenantAccess.requirePermission("ACCOUNT_VIEW");
        requireVisibleAccount(accountId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Contact> page = contactRepository.findByAccount(accountId, regionIds, ownerIds, pageable);
        return new ContactPageResult(page.map(ContactResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public DealPageResult listDeals(UUID accountId, Pageable pageable) {
        tenantAccess.requirePermission("ACCOUNT_VIEW");
        requireVisibleAccount(accountId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Deal> page = dealRepository.findByAccount(accountId, regionIds, ownerIds, pageable);
        return new DealPageResult(page.map(DealResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ActivityPageResult listActivities(UUID accountId, Pageable pageable) {
        tenantAccess.requirePermission("ACCOUNT_VIEW");
        Account account = requireVisibleAccount(accountId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> assignedToIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Activity> page = activityRepository.findRelated(
                account.getOrganizationId(), "ACCOUNT", accountId, regionIds, assignedToIds, pageable);
        return new ActivityPageResult(page.map(ActivityResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ProjectPageResult listProjects(UUID accountId, Pageable pageable) {
        tenantAccess.requirePermission("ACCOUNT_VIEW");
        tenantAccess.requirePermission("PROJECT_VIEW");
        Account account = requireVisibleAccount(accountId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> managerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Project> page = projectRepository.search(
                account.getOrganizationId(),
                null,
                regionIds,
                managerIds,
                null,
                accountId,
                null,
                null,
                null,
                false,
                pageable);
        return new ProjectPageResult(
                page.getContent().stream().map(project -> ProjectResponse.from(project, null, null)).toList(),
                PaginationMeta.from(page),
                "Account projects");
    }

    private Account requireVisibleAccount(UUID id) {
        Account account = accountRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(account);
        return account;
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

    public record PageResult(List<AccountResponse> data, PaginationMeta pagination) {}

    public record ContactPageResult(List<ContactResponse> data, PaginationMeta pagination) {}

    public record DealPageResult(List<DealResponse> data, PaginationMeta pagination) {}

    public record ActivityPageResult(List<ActivityResponse> data, PaginationMeta pagination) {}

    public record ProjectPageResult(List<ProjectResponse> data, PaginationMeta pagination, String message) {}
}
