package com.techearnest.crm.lead.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditFieldChanges;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contact.domain.Contact;
import com.techearnest.crm.contact.domain.ContactRepository;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.deal.domain.DealStageHistory;
import com.techearnest.crm.deal.domain.DealStageHistoryRepository;
import com.techearnest.crm.lead.api.dto.LeadDtos.AssignLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.BulkAssignLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.BulkLeadItemFailure;
import com.techearnest.crm.lead.api.dto.LeadDtos.BulkLeadResult;
import com.techearnest.crm.lead.api.dto.LeadDtos.BulkStatusLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.ConvertLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.ConvertLeadResponse;
import com.techearnest.crm.lead.api.dto.LeadDtos.CreateLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.DuplicateCheckRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.DuplicateCheckResponse;
import com.techearnest.crm.lead.api.dto.LeadDtos.DuplicateMatch;
import com.techearnest.crm.lead.api.dto.LeadDtos.LeadResponse;
import com.techearnest.crm.lead.api.dto.LeadDtos.UpdateLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.QueryLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.SortSpec;
import com.techearnest.crm.lead.domain.Lead;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.filter.FilterNode;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.metadata.application.TableAclEvaluator;
import com.techearnest.crm.metadata.application.TableAclEvaluator.CrudOp;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
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
public class LeadService {

    private final LeadRepository leadRepository;
    private final AccountRepository accountRepository;
    private final ContactRepository contactRepository;
    private final DealRepository dealRepository;
    private final DealStageHistoryRepository dealStageHistoryRepository;
    private final RegionRepository regionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final TableAclEvaluator tableAclEvaluator;

    public LeadService(
            LeadRepository leadRepository,
            AccountRepository accountRepository,
            ContactRepository contactRepository,
            DealRepository dealRepository,
            DealStageHistoryRepository dealStageHistoryRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            TableAclEvaluator tableAclEvaluator) {
        this.leadRepository = leadRepository;
        this.accountRepository = accountRepository;
        this.contactRepository = contactRepository;
        this.dealRepository = dealRepository;
        this.dealStageHistoryRepository = dealStageHistoryRepository;
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.tableAclEvaluator = tableAclEvaluator;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            String source,
            String priority,
            UUID regionId,
            UUID ownerId,
            Pageable pageable) {
        tenantAccess.requirePermission("LEAD_VIEW");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.READ);
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();

        Specification<Lead> spec = baseScope(orgId, regionIds, ownerIds)
                .and(textSearch(blankToNull(search)))
                .and(eqIfPresent("status", blankToNull(status)))
                .and(eqIfPresent("source", blankToNull(source)))
                .and(eqIfPresent("priority", blankToNull(priority)))
                .and(eqIfPresent("regionId", regionId))
                .and(eqIfPresent("ownerId", ownerId));

        Page<Lead> page = leadRepository.findAll(spec, pageable);
        return new PageResult(page.map(LeadResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryLeadRequest request) {
        tenantAccess.requirePermission("LEAD_VIEW");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.READ);
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();

        FilterNode filter = request == null ? null : request.filter();
        Specification<Lead> filterSpec = FilterSpecificationBuilder.build(filter, LeadFilterFields.ALLOWED);

        Specification<Lead> spec = baseScope(orgId, regionIds, ownerIds)
                .and(textSearch(request == null ? null : blankToNull(request.search())))
                .and(filterSpec);

        int page = request != null && request.page() != null ? Math.max(0, request.page()) : 0;
        int size = request != null && request.size() != null ? Math.min(Math.max(1, request.size()), 100) : 20;
        Pageable pageable = PageRequest.of(page, size, toSort(request == null ? null : request.sort()));
        Page<Lead> result = leadRepository.findAll(spec, pageable);
        return new PageResult(result.map(LeadResponse::from).getContent(), PaginationMeta.from(result));
    }

    private static Specification<Lead> baseScope(
            UUID orgId, Collection<UUID> regionIds, Collection<UUID> ownerIds) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("organizationId"), orgId));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (regionIds != null) {
                predicates.add(root.get("regionId").in(regionIds));
            }
            if (ownerIds != null) {
                predicates.add(root.get("ownerId").in(ownerIds));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private static Specification<Lead> textSearch(String search) {
        if (search == null) {
            return (root, query, cb) -> cb.conjunction();
        }
        String pattern = "%" + search.toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("firstName")), pattern),
                cb.like(cb.lower(root.get("lastName")), pattern),
                cb.like(cb.lower(root.get("companyName")), pattern),
                cb.like(cb.lower(root.get("email")), pattern));
    }

    private static Specification<Lead> eqIfPresent(String attribute, Object value) {
        if (value == null) {
            return (root, query, cb) -> cb.conjunction();
        }
        return (root, query, cb) -> cb.equal(root.get(attribute), value);
    }

    private static Sort toSort(List<SortSpec> specs) {
        if (specs == null || specs.isEmpty()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        Set<String> allowed = LeadFilterFields.ALLOWED.keySet();
        List<Sort.Order> orders = new ArrayList<>();
        for (SortSpec spec : specs) {
            if (spec == null || spec.field() == null || !allowed.contains(spec.field())) {
                continue;
            }
            Sort.Direction dir = "ASC".equalsIgnoreCase(spec.direction()) ? Sort.Direction.ASC : Sort.Direction.DESC;
            orders.add(new Sort.Order(dir, spec.field()));
        }
        return orders.isEmpty() ? Sort.by(Sort.Direction.DESC, "createdAt") : Sort.by(orders);
    }

    @Transactional(readOnly = true)
    public LeadResponse get(UUID id) {
        tenantAccess.requirePermission("LEAD_VIEW");
        return LeadResponse.from(requireVisibleLead(id));
    }

    @Transactional
    public LeadResponse create(CreateLeadRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_CREATE");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.CREATE);
        return createLead(user, request);
    }

    @Transactional
    public LeadResponse update(UUID id, UpdateLeadRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_UPDATE");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.UPDATE);
        Lead lead = requireVisibleLead(id);
        if ("CONVERTED".equals(lead.getStatus())) {
            throw new BusinessException("LEAD_CONVERTED", "Converted leads cannot be edited.");
        }
        if (request.regionId() != null) {
            Region region = requireRegionInOrg(request.regionId(), lead.getOrganizationId());
            tenantAccess.assertRegionVisible(region.getId());
        }
        UUID oldOwnerId = lead.getOwnerId();
        String oldStatus = lead.getStatus();
        String oldPriority = lead.getPriority();
        java.math.BigDecimal oldEstimatedValue = lead.getEstimatedValue();
        String oldCompany = lead.getCompanyName();
        String oldFirstName = lead.getFirstName();
        String oldLastName = lead.getLastName();
        String oldSource = lead.getSource();
        java.time.LocalDate oldCloseDate = lead.getExpectedCloseDate();

        lead.update(
                request.regionId(),
                request.ownerId(),
                trimToNull(request.salutation()),
                trimToNull(request.firstName()),
                trimToNull(request.lastName()),
                trimToNull(request.companyName()),
                trimToNull(request.email()),
                trimToNull(request.phone()),
                trimToNull(request.mobile()),
                trimToNull(request.fax()),
                trimToNull(request.website()),
                trimToNull(request.source()),
                request.emailOptOut(),
                request.noOfEmployees(),
                trimToNull(request.rating()),
                trimToNull(request.skypeId()),
                trimToNull(request.secondaryEmail()),
                trimToNull(request.twitter()),
                trimToNull(request.addressCountry()),
                trimToNull(request.addressFlat()),
                trimToNull(request.addressStreet()),
                trimToNull(request.addressCity()),
                trimToNull(request.addressState()),
                trimToNull(request.addressZip()),
                request.addressLatitude(),
                request.addressLongitude(),
                request.photoDocumentId(),
                request.status(),
                trimToNull(request.priority()),
                trimToNull(request.industry()),
                trimToNull(request.designation()),
                request.estimatedValue(),
                request.expectedCloseDate(),
                request.description());
        AuditFieldChanges.Builder changes = AuditFieldChanges.builder()
                .addIfChanged("status", "Status", oldStatus, lead.getStatus())
                .addIfChanged("priority", "Priority", oldPriority, lead.getPriority())
                .addIfChanged("estimatedValue", "Estimated Value", oldEstimatedValue, lead.getEstimatedValue())
                .addIfChanged("companyName", "Company", oldCompany, lead.getCompanyName())
                .addIfChanged("firstName", "First Name", oldFirstName, lead.getFirstName())
                .addIfChanged("lastName", "Last Name", oldLastName, lead.getLastName())
                .addIfChanged("source", "Lead Source", oldSource, lead.getSource())
                .addIfChanged("expectedCloseDate", "Expected Close Date", oldCloseDate, lead.getExpectedCloseDate())
                .addIfChanged("ownerId", "Lead Owner", oldOwnerId, lead.getOwnerId());
        if (changes.hasChanges()) {
            auditService.recordWithSummary(
                    lead.getOrganizationId(), user.userId(), "UPDATE", "LEAD", lead.getId(), changes.toJson());
        } else {
            auditService.record(lead.getOrganizationId(), user.userId(), "UPDATE", "LEAD", lead.getId());
        }
        return LeadResponse.from(lead);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_DELETE");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.DELETE);
        Lead lead = requireVisibleLead(id);
        lead.markDeleted();
        auditService.record(lead.getOrganizationId(), user.userId(), "DELETE", "LEAD", lead.getId());
    }

    @Transactional
    public LeadResponse assign(UUID id, AssignLeadRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_ASSIGN");
        Lead lead = requireVisibleLead(id);
        lead.assign(request.ownerId());
        auditService.record(lead.getOrganizationId(), user.userId(), "ASSIGN", "LEAD", lead.getId());
        return LeadResponse.from(lead);
    }

    @Transactional
    public BulkLeadResult bulkAssign(BulkAssignLeadRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_ASSIGN");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.UPDATE);
        List<UUID> ids = cappedIds(request.leadIds());
        List<BulkLeadItemFailure> failures = new ArrayList<>();
        int succeeded = 0;
        for (UUID id : ids) {
            try {
                Lead lead = requireVisibleLead(id);
                lead.assign(request.ownerId());
                auditService.recordWithSummary(                        lead.getOrganizationId(),
                        user.userId(),
                        "ASSIGN",
                        "LEAD",
                        lead.getId(),
                        "{\"bulk\":true,\"ownerId\":\"" + request.ownerId() + "\"}");
                succeeded++;
            } catch (Exception ex) {
                failures.add(new BulkLeadItemFailure(id, ex.getMessage() == null ? "FAILED" : ex.getMessage()));
            }
        }
        return new BulkLeadResult(succeeded, failures.size(), failures);
    }

    @Transactional
    public BulkLeadResult bulkStatus(BulkStatusLeadRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_UPDATE");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.UPDATE);
        String status = request.status().trim();
        List<UUID> ids = cappedIds(request.leadIds());
        List<BulkLeadItemFailure> failures = new ArrayList<>();
        int succeeded = 0;
        for (UUID id : ids) {
            try {
                Lead lead = requireVisibleLead(id);
                lead.changeStatus(status);
                auditService.recordWithSummary(                        lead.getOrganizationId(),
                        user.userId(),
                        "UPDATE",
                        "LEAD",
                        lead.getId(),
                        "{\"bulk\":true,\"status\":\"" + status + "\"}");
                succeeded++;
            } catch (Exception ex) {
                failures.add(new BulkLeadItemFailure(id, ex.getMessage() == null ? "FAILED" : ex.getMessage()));
            }
        }
        return new BulkLeadResult(succeeded, failures.size(), failures);
    }

    @Transactional(readOnly = true)
    public DuplicateCheckResponse checkDuplicates(DuplicateCheckRequest request) {
        tenantAccess.requirePermission("LEAD_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        String email = trimToNull(request.email());
        String company = trimToNull(request.companyName());
        if (email == null && company == null) {
            return new DuplicateCheckResponse(false, List.of());
        }
        List<Lead> matches = leadRepository.findPotentialDuplicates(
                orgId, email, company, PageRequest.of(0, 10));
        List<DuplicateMatch> rows = matches.stream()
                .map(l -> new DuplicateMatch(
                        l.getId(),
                        l.getFirstName(),
                        l.getLastName(),
                        l.getCompanyName(),
                        l.getEmail(),
                        l.getStatus()))
                .toList();
        return new DuplicateCheckResponse(!rows.isEmpty(), rows);
    }

    private static List<UUID> cappedIds(List<UUID> leadIds) {
        if (leadIds == null || leadIds.isEmpty()) {
            throw new BusinessException("BULK_EMPTY", "Select at least one lead");
        }
        if (leadIds.size() > 100) {
            throw new BusinessException("BULK_LIMIT", "Bulk actions are capped at 100 leads");
        }
        return leadIds.stream().distinct().toList();
    }

    @Transactional
    public ConvertLeadResponse convert(UUID id, ConvertLeadRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_CONVERT");
        Lead lead = requireVisibleLead(id);
        if ("CONVERTED".equals(lead.getStatus())) {
            throw new ConflictException("Lead is already converted");
        }

        boolean createAccount = Boolean.TRUE.equals(request.createAccount());
        boolean createContact = Boolean.TRUE.equals(request.createContact());
        boolean createDeal = Boolean.TRUE.equals(request.createDeal());

        UUID accountId = request.accountId();
        Account account = null;
        if (createAccount && accountId == null) {
            if (lead.getCompanyName() == null || lead.getCompanyName().isBlank()) {
                throw new BusinessException("COMPANY_REQUIRED", "companyName is required to create an account");
            }
            // Reuse existing account by exact company name or email to avoid duplicates.
            account = accountRepository
                    .findActiveByOrganizationIdAndNameIgnoreCase(
                            lead.getOrganizationId(), lead.getCompanyName().trim())
                    .stream()
                    .findFirst()
                    .orElse(null);
            if (account == null && lead.getEmail() != null && !lead.getEmail().isBlank()) {
                account = accountRepository
                        .findActiveByOrganizationIdAndEmailIgnoreCase(
                                lead.getOrganizationId(), lead.getEmail().trim())
                        .stream()
                        .findFirst()
                        .orElse(null);
            }
            if (account == null) {
                account = Account.create(
                        lead.getOrganizationId(),
                        lead.getRegionId(),
                        lead.getOwnerId(),
                        lead.getCompanyName().trim(),
                        lead.getIndustry(),
                        lead.getWebsite(),
                        lead.getEmail(),
                        lead.getPhone(),
                        null,
                        null,
                        null,
                        "ACTIVE",
                        "PROSPECT",
                        lead.getDescription());
                accountRepository.save(account);
                auditService.record(lead.getOrganizationId(), user.userId(), "CREATE", "ACCOUNT", account.getId());
            }
            accountId = account.getId();
        } else if (accountId != null) {
            account = accountRepository
                    .findActiveById(accountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            tenantAccess.assertRecordVisible(account);
            accountId = account.getId();
        } else if (createContact || createDeal) {
            throw new BusinessException("ACCOUNT_REQUIRED", "accountId or createAccount is required");
        }

        UUID contactId = null;
        if (createContact) {
            String firstName = blankToDefault(lead.getFirstName(), "Unknown");
            String lastName = blankToDefault(lead.getLastName(), "Contact");
            Contact contact = null;
            if (lead.getEmail() != null && !lead.getEmail().isBlank()) {
                contact = contactRepository
                        .findActiveByAccountAndEmailIgnoreCase(
                                lead.getOrganizationId(), accountId, lead.getEmail().trim())
                        .orElse(null);
            }
            if (contact == null) {
                contact = Contact.create(
                        lead.getOrganizationId(),
                        lead.getRegionId(),
                        accountId,
                        lead.getOwnerId(),
                        firstName,
                        lastName,
                        lead.getEmail(),
                        lead.getPhone(),
                        null,
                        lead.getDesignation(),
                        null,
                        null,
                        "ACTIVE",
                        null);
                contactRepository.save(contact);
                auditService.record(lead.getOrganizationId(), user.userId(), "CREATE", "CONTACT", contact.getId());
            }
            contactId = contact.getId();
        }

        UUID dealId = null;
        if (createDeal) {
            String stage = request.dealStage() != null && !request.dealStage().isBlank()
                    ? request.dealStage()
                    : "NEW";
            String dealName = request.dealName() != null && !request.dealName().isBlank()
                    ? request.dealName().trim()
                    : blankToDefault(lead.getCompanyName(), "Deal from lead");
            BigDecimal value = request.dealValue() != null
                    ? request.dealValue()
                    : (lead.getEstimatedValue() != null ? lead.getEstimatedValue() : BigDecimal.ZERO);
            Deal deal = Deal.create(
                    lead.getOrganizationId(),
                    lead.getRegionId(),
                    accountId,
                    contactId,
                    lead.getOwnerId(),
                    lead.getId(),
                    dealName,
                    stage,
                    value,
                    null,
                    lead.getExpectedCloseDate(),
                    lead.getSource(),
                    lead.getDescription(),
                    null);
            dealRepository.save(deal);
            dealStageHistoryRepository.save(
                    DealStageHistory.of(lead.getOrganizationId(), deal.getId(), null, stage, user.userId()));
            auditService.record(lead.getOrganizationId(), user.userId(), "CREATE", "DEAL", deal.getId());
            dealId = deal.getId();
        }

        lead.markConverted(accountId, contactId, dealId);
        auditService.record(lead.getOrganizationId(), user.userId(), "CONVERT", "LEAD", lead.getId());
        return new ConvertLeadResponse(accountId, contactId, dealId);
    }

    @Transactional(readOnly = true)
    public String exportCsv(UUID organizationId, List<String> columns) {
        tenantAccess.requirePermission("LEAD_EXPORT");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.READ);
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        List<Lead> leads = leadRepository.findAllForExport(orgId, regionIds, ownerIds);
        Set<String> allowed = Set.of(
                "id",
                "firstName",
                "lastName",
                "companyName",
                "email",
                "phone",
                "status",
                "source",
                "priority",
                "estimatedValue",
                "regionId",
                "ownerId",
                "createdAt");
        List<String> fields = new ArrayList<>();
        if (columns != null) {
            for (String raw : columns) {
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                String field = raw.trim();
                if (allowed.contains(field) && !fields.contains(field)) {
                    fields.add(field);
                }
            }
        }
        if (fields.isEmpty()) {
            fields.addAll(List.of(
                    "id", "firstName", "lastName", "companyName", "email", "phone", "status", "regionId", "ownerId"));
        }
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", fields)).append('\n');
        for (Lead lead : leads) {
            List<String> cells = new ArrayList<>();
            for (String field : fields) {
                cells.add(csvEscape(leadExportValue(lead, field)));
            }
            csv.append(String.join(",", cells)).append('\n');
        }
        return csv.toString();
    }

    private static String leadExportValue(Lead lead, String field) {
        return switch (field) {
            case "id" -> lead.getId().toString();
            case "firstName" -> lead.getFirstName();
            case "lastName" -> lead.getLastName();
            case "companyName" -> lead.getCompanyName();
            case "email" -> lead.getEmail();
            case "phone" -> lead.getPhone();
            case "status" -> lead.getStatus();
            case "source" -> lead.getSource();
            case "priority" -> lead.getPriority();
            case "estimatedValue" ->
                    lead.getEstimatedValue() == null ? "" : lead.getEstimatedValue().toPlainString();
            case "regionId" -> lead.getRegionId() == null ? "" : lead.getRegionId().toString();
            case "ownerId" -> lead.getOwnerId() == null ? "" : lead.getOwnerId().toString();
            case "createdAt" -> lead.getCreatedAt() == null ? "" : lead.getCreatedAt().toString();
            default -> "";
        };
    }

    @Transactional
    public int importLeads(List<CreateLeadRequest> requests) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_IMPORT");
        if (requests == null || requests.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (CreateLeadRequest request : requests) {
            createLead(user, request);
            count++;
        }
        return count;
    }

    private LeadResponse createLead(CurrentUser user, CreateLeadRequest request) {
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Region region = requireRegionInOrg(request.regionId(), orgId);
        tenantAccess.assertRegionVisible(region.getId());
        UUID ownerId = request.ownerId() != null ? request.ownerId() : user.userId();

        Lead lead = Lead.create(
                orgId,
                region.getId(),
                ownerId,
                trimToNull(request.salutation()),
                trimToNull(request.firstName()),
                trimToNull(request.lastName()),
                trimToNull(request.companyName()),
                trimToNull(request.email()),
                trimToNull(request.phone()),
                trimToNull(request.mobile()),
                trimToNull(request.fax()),
                trimToNull(request.website()),
                trimToNull(request.source()),
                request.emailOptOut() != null && request.emailOptOut(),
                request.noOfEmployees(),
                trimToNull(request.rating()),
                trimToNull(request.skypeId()),
                trimToNull(request.secondaryEmail()),
                trimToNull(request.twitter()),
                trimToNull(request.addressCountry()),
                trimToNull(request.addressFlat()),
                trimToNull(request.addressStreet()),
                trimToNull(request.addressCity()),
                trimToNull(request.addressState()),
                trimToNull(request.addressZip()),
                request.addressLatitude(),
                request.addressLongitude(),
                null,
                request.status(),
                trimToNull(request.priority()),
                trimToNull(request.industry()),
                trimToNull(request.designation()),
                request.estimatedValue(),
                request.expectedCloseDate(),
                request.description());
        leadRepository.save(lead);
        auditService.record(orgId, user.userId(), "CREATE", "LEAD", lead.getId());
        return LeadResponse.from(lead);
    }

    private Lead requireVisibleLead(UUID id) {
        Lead lead = leadRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(lead);
        return lead;
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

    private static String trimToNull(String value) {
        return blankToNull(value);
    }

    private static String blankToDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private static String csvEscape(String value) {
        return com.techearnest.crm.common.csv.CsvCells.escape(value);
    }

    public record PageResult(List<LeadResponse> data, PaginationMeta pagination) {}
}
