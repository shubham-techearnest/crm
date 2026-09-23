package com.techearnest.crm.deal.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contact.domain.Contact;
import com.techearnest.crm.contact.domain.ContactRepository;
import com.techearnest.crm.deal.api.dto.DealDtos.CreateDealRequest;
import com.techearnest.crm.deal.api.dto.DealDtos.DealResponse;
import com.techearnest.crm.deal.api.dto.DealDtos.PipelineColumn;
import com.techearnest.crm.deal.api.dto.DealDtos.StageChangeRequest;
import com.techearnest.crm.deal.api.dto.DealDtos.UpdateDealRequest;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.deal.domain.DealStageHistory;
import com.techearnest.crm.deal.domain.DealStageHistoryRepository;
import com.techearnest.crm.metadata.application.FormPolicyEvaluator;
import com.techearnest.crm.metadata.application.MetadataExtensionService;
import com.techearnest.crm.metadata.application.TableAclEvaluator;
import com.techearnest.crm.metadata.application.TableAclEvaluator.CrudOp;
import com.techearnest.crm.common.outbox.OutboxPublisher;
import com.techearnest.crm.workflow.application.WorkflowEngine;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DealService {

    private static final List<String> PIPELINE_STAGES = List.of(
            "NEW", "QUALIFICATION", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST");

    private final DealRepository dealRepository;
    private final DealStageHistoryRepository dealStageHistoryRepository;
    private final AccountRepository accountRepository;
    private final ContactRepository contactRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final TableAclEvaluator tableAclEvaluator;
    private final MetadataExtensionService metadataExtensionService;
    private final FormPolicyEvaluator formPolicyEvaluator;
    private final OutboxPublisher outboxPublisher;

    public DealService(
            DealRepository dealRepository,
            DealStageHistoryRepository dealStageHistoryRepository,
            AccountRepository accountRepository,
            ContactRepository contactRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            TableAclEvaluator tableAclEvaluator,
            MetadataExtensionService metadataExtensionService,
            FormPolicyEvaluator formPolicyEvaluator,
            OutboxPublisher outboxPublisher) {
        this.dealRepository = dealRepository;
        this.dealStageHistoryRepository = dealStageHistoryRepository;
        this.accountRepository = accountRepository;
        this.contactRepository = contactRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.tableAclEvaluator = tableAclEvaluator;
        this.metadataExtensionService = metadataExtensionService;
        this.formPolicyEvaluator = formPolicyEvaluator;
        this.outboxPublisher = outboxPublisher;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            UUID accountId,
            String stage,
            UUID ownerId,
            java.math.BigDecimal minValue,
            java.time.LocalDate closeFrom,
            java.time.LocalDate closeTo,
            Pageable pageable) {
        tenantAccess.requirePermission("DEAL_VIEW");
        tableAclEvaluator.requireTableAccess("deal", CrudOp.READ);
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Deal> page = dealRepository.search(
                orgId,
                blankToNull(search),
                regionIds,
                ownerIds,
                accountId,
                blankToNull(stage),
                ownerId,
                minValue,
                closeFrom,
                closeTo,
                pageable);
        return new PageResult(page.map(DealResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public DealResponse get(UUID id) {
        tenantAccess.requirePermission("DEAL_VIEW");
        return DealResponse.from(requireVisibleDeal(id));
    }

    @Transactional
    public DealResponse create(CreateDealRequest request) {
        CurrentUser user = tenantAccess.requirePermission("DEAL_CREATE");
        tableAclEvaluator.requireTableAccess("deal", CrudOp.CREATE);
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Account account = accountRepository
                .findActiveById(request.accountId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!account.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        tenantAccess.assertRecordVisible(account);

        UUID contactId = request.contactId();
        if (contactId != null) {
            Contact contact = contactRepository
                    .findActiveById(contactId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            tenantAccess.assertRecordVisible(contact);
        }

        UUID ownerId = request.ownerId() != null ? request.ownerId() : user.userId();
        String stage = request.stage() != null && !request.stage().isBlank() ? request.stage() : "NEW";

        Deal deal = Deal.create(
                orgId,
                account.getRegionId(),
                account.getId(),
                contactId,
                ownerId,
                request.leadId(),
                request.name().trim(),
                stage,
                request.value(),
                request.probability(),
                request.expectedCloseDate(),
                blankToNull(request.source()),
                request.description(),
                blankToNull(request.competitor()));
        dealRepository.save(deal);
        dealStageHistoryRepository.save(
                DealStageHistory.of(orgId, deal.getId(), null, stage, user.userId()));
        auditService.record(orgId, user.userId(), "CREATE", "DEAL", deal.getId());
        return DealResponse.from(deal);
    }

    @Transactional
    public DealResponse update(UUID id, UpdateDealRequest request) {
        CurrentUser user = tenantAccess.requirePermission("DEAL_UPDATE");
        Deal deal = requireVisibleDeal(id);
        if (request.contactId() != null) {
            Contact contact = contactRepository
                    .findActiveById(request.contactId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            tenantAccess.assertRecordVisible(contact);
        }
        deal.update(
                request.contactId(),
                request.ownerId(),
                request.name().trim(),
                request.value(),
                request.probability(),
                request.expectedCloseDate(),
                blankToNull(request.source()),
                request.description(),
                blankToNull(request.competitor()));
        auditService.record(deal.getOrganizationId(), user.userId(), "UPDATE", "DEAL", deal.getId());
        return DealResponse.from(deal);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("DEAL_DELETE");
        Deal deal = requireVisibleDeal(id);
        deal.markDeleted();
        auditService.record(deal.getOrganizationId(), user.userId(), "DELETE", "DEAL", deal.getId());
    }

    @Transactional
    public DealResponse changeStage(UUID id, StageChangeRequest request) {
        CurrentUser user = tenantAccess.requirePermission("DEAL_STAGE");
        tableAclEvaluator.requireTableAccess("deal", CrudOp.UPDATE);
        Deal deal = requireVisibleDeal(id);
        String toStage = request.toStage().trim();
        if (!Deal.DEFAULT_PROBABILITY.containsKey(toStage)) {
            throw new BusinessException("INVALID_STAGE", "Invalid deal stage: " + toStage);
        }
        Map<String, Object> values = new HashMap<>();
        values.put("stage", toStage);
        values.put("lostReason", blankToNull(request.lostReason()));
        values.put(
                "expectedCloseDate",
                request.expectedCloseDate() != null
                        ? request.expectedCloseDate().toString()
                        : (deal.getExpectedCloseDate() != null ? deal.getExpectedCloseDate().toString() : null));
        formPolicyEvaluator.assertMandatory(
                metadataExtensionService.publishedPolicyNodes("deal", "EDIT"), values);
        String fromStage = deal.getStage();
        deal.changeStage(toStage, blankToNull(request.lostReason()), request.expectedCloseDate());
        dealStageHistoryRepository.save(
                DealStageHistory.of(deal.getOrganizationId(), deal.getId(), fromStage, toStage, user.userId()));
        auditService.record(deal.getOrganizationId(), user.userId(), "UPDATE", "DEAL", deal.getId());
        if ("WON".equals(toStage) && !"WON".equals(fromStage)) {
            outboxPublisher.append(
                    deal.getOrganizationId(),
                    WorkflowEngine.EVENT_DEAL_WON,
                    Map.of(
                            "dealId", deal.getId().toString(),
                            "fromStage", fromStage == null ? "" : fromStage,
                            "toStage", toStage,
                            "ownerId", deal.getOwnerId() == null ? "" : deal.getOwnerId().toString(),
                            "name", deal.getName() == null ? "" : deal.getName()),
                    "DEAL_WON:" + deal.getId(),
                    "DEAL",
                    deal.getId());
        }
        return DealResponse.from(deal);
    }

    @Transactional(readOnly = true)
    public List<PipelineColumn> pipeline(UUID organizationId) {
        tenantAccess.requirePermission("DEAL_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        List<Deal> deals = dealRepository.findForPipeline(orgId, regionIds, ownerIds);

        Map<String, List<DealResponse>> byStage = new LinkedHashMap<>();
        for (String stage : PIPELINE_STAGES) {
            byStage.put(stage, new ArrayList<>());
        }
        for (Deal deal : deals) {
            byStage.computeIfAbsent(deal.getStage(), ignored -> new ArrayList<>()).add(DealResponse.from(deal));
        }

        List<PipelineColumn> columns = new ArrayList<>();
        for (Map.Entry<String, List<DealResponse>> entry : byStage.entrySet()) {
            BigDecimal total = entry.getValue().stream()
                    .map(DealResponse::value)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            columns.add(new PipelineColumn(entry.getKey(), entry.getValue(), total));
        }
        return columns;
    }

    private Deal requireVisibleDeal(UUID id) {
        Deal deal = dealRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(deal);
        return deal;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<DealResponse> data, PaginationMeta pagination) {}
}
