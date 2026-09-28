package com.techearnest.crm.procurement.application;

import com.techearnest.crm.approval.application.ApprovalService;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.finance.domain.TaxRate;
import com.techearnest.crm.finance.domain.TaxRateRepository;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.AddPurchaseOrderItemRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.CreatePurchaseOrderRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.PurchaseOrderResponse;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.QueryPurchaseOrderRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.RejectPurchaseOrderRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.UpdatePurchaseOrderRequest;
import com.techearnest.crm.procurement.domain.PurchaseOrder;
import com.techearnest.crm.procurement.domain.PurchaseOrderItem;
import com.techearnest.crm.procurement.domain.PurchaseOrderItemRepository;
import com.techearnest.crm.procurement.domain.PurchaseOrderRepository;
import com.techearnest.crm.procurement.domain.Vendor;
import com.techearnest.crm.procurement.domain.VendorRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final VendorRepository vendorRepository;
    private final ProjectRepository projectRepository;
    private final TaxRateRepository taxRateRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final ApprovalService approvalService;

    public PurchaseOrderService(
            PurchaseOrderRepository purchaseOrderRepository,
            PurchaseOrderItemRepository purchaseOrderItemRepository,
            VendorRepository vendorRepository,
            ProjectRepository projectRepository,
            TaxRateRepository taxRateRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            @Lazy ApprovalService approvalService) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.purchaseOrderItemRepository = purchaseOrderItemRepository;
        this.vendorRepository = vendorRepository;
        this.projectRepository = projectRepository;
        this.taxRateRepository = taxRateRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.approvalService = approvalService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            UUID vendorId,
            UUID projectId,
            Pageable pageable) {
        tenantAccess.requirePermission("PO_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<PurchaseOrder> page = purchaseOrderRepository.search(
                orgId, blankToNull(search), regionIds, blankToNull(status), vendorId, projectId, pageable);
        return new PageResult(page.map(PurchaseOrderResponse::summary).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryPurchaseOrderRequest request) {
        tenantAccess.requirePermission("PO_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        int page = request != null && request.page() != null ? request.page() : 0;
        int size = request != null && request.size() != null ? Math.min(request.size(), 100) : 50;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<PurchaseOrder> filterSpec = FilterSpecificationBuilder.build(
                request == null ? null : request.filter(), PurchaseOrderFilterFields.ALLOWED);
        Page<PurchaseOrder> result = purchaseOrderRepository.searchWithFilter(
                orgId,
                request == null ? null : blankToNull(request.search()),
                regionIds,
                request == null ? null : blankToNull(request.status()),
                request == null ? null : request.vendorId(),
                request == null ? null : request.projectId(),
                filterSpec,
                pageable);
        return new PageResult(result.map(PurchaseOrderResponse::summary).getContent(), PaginationMeta.from(result));
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse get(UUID id) {
        tenantAccess.requirePermission("PO_VIEW");
        PurchaseOrder po = requireVisible(id);
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse createDraft(CreatePurchaseOrderRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PO_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        tenantAccess.assertRegionVisible(request.regionId());
        Vendor vendor = vendorRepository
                .findActiveById(request.vendorId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!orgId.equals(vendor.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        UUID projectId = resolveProjectId(orgId, request.projectId());
        PurchaseOrder po = PurchaseOrder.createDraft(
                orgId,
                request.regionId(),
                vendor.getId(),
                projectId,
                request.requesterId() != null ? request.requesterId() : user.userId(),
                request.poNumber(),
                request.currencyCode(),
                request.neededBy(),
                request.notes(),
                user.userId());
        purchaseOrderRepository.save(po);
        auditService.record(orgId, user.userId(), "CREATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse update(UUID id, UpdatePurchaseOrderRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PO_UPDATE");
        PurchaseOrder po = requireDraft(id);
        UUID projectId =
                request.projectId() != null ? resolveProjectId(po.getOrganizationId(), request.projectId()) : null;
        po.update(
                projectId,
                request.poNumber(),
                request.currencyCode(),
                request.neededBy(),
                request.notes(),
                user.userId());
        auditService.record(po.getOrganizationId(), user.userId(), "UPDATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse addItem(UUID id, AddPurchaseOrderItemRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PO_UPDATE");
        PurchaseOrder po = requireDraft(id);
        TaxRate tax = resolveTax(request.taxRateId(), po.getOrganizationId());
        int nextLine = purchaseOrderItemRepository.findActiveByPurchaseOrderId(id).size() + 1;
        BigDecimal qty = request.quantity();
        BigDecimal unit = request.unitPrice();
        BigDecimal amount = qty.multiply(unit);
        BigDecimal taxAmount = taxAmount(amount, tax);
        PurchaseOrderItem item = PurchaseOrderItem.create(
                po.getOrganizationId(),
                id,
                nextLine,
                request.description().trim(),
                qty,
                unit,
                tax == null ? null : tax.getId(),
                taxAmount);
        purchaseOrderItemRepository.save(item);
        recalculate(po);
        auditService.record(po.getOrganizationId(), user.userId(), "UPDATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse removeItem(UUID poId, UUID itemId) {
        CurrentUser user = tenantAccess.requirePermission("PO_UPDATE");
        PurchaseOrder po = requireDraft(poId);
        PurchaseOrderItem item = purchaseOrderItemRepository
                .findActiveById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!poId.equals(item.getPurchaseOrderId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        item.markDeleted();
        recalculate(po);
        auditService.record(po.getOrganizationId(), user.userId(), "UPDATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("PO_DELETE");
        PurchaseOrder po = requireDraft(id);
        for (PurchaseOrderItem item : purchaseOrderItemRepository.findActiveByPurchaseOrderId(id)) {
            item.markDeleted();
        }
        po.markDeleted();
        auditService.record(po.getOrganizationId(), user.userId(), "DELETE", "PURCHASE_ORDER", po.getId());
    }

    @Transactional
    public PurchaseOrderResponse submit(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("PO_CREATE");
        PurchaseOrder po = requireVisible(id);
        if (!po.isEditable()) {
            throw new BusinessException("INVALID_STATUS", "Only draft or rejected POs can be submitted");
        }
        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findActiveByPurchaseOrderId(id);
        if (items.isEmpty()) {
            throw new BusinessException("INVALID_PO", "Add at least one line before submitting");
        }
        if (po.getTotal() == null || po.getTotal().signum() <= 0) {
            throw new BusinessException("INVALID_PO", "PO total must be greater than zero");
        }
        po.submit();
        approvalService.openPurchaseOrderRequest(po, user.userId());
        auditService.record(po.getOrganizationId(), user.userId(), "UPDATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse approve(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("PO_APPROVE");
        PurchaseOrder po = requireVisible(id);
        if (!PurchaseOrder.STATUS_PENDING_APPROVAL.equals(po.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only pending POs can be approved");
        }
        po.approve(user.userId());
        approvalService.syncApprove(
                po.getOrganizationId(),
                ApprovalService.TARGET_PURCHASE_ORDER,
                po.getId(),
                user.userId(),
                null);
        auditService.record(po.getOrganizationId(), user.userId(), "APPROVE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse reject(UUID id, RejectPurchaseOrderRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PO_APPROVE");
        PurchaseOrder po = requireVisible(id);
        if (!PurchaseOrder.STATUS_PENDING_APPROVAL.equals(po.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only pending POs can be rejected");
        }
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new BusinessException("INVALID_REASON", "Rejection reason is required");
        }
        String reason = request.reason().trim();
        po.reject(user.userId());
        approvalService.syncReject(
                po.getOrganizationId(),
                ApprovalService.TARGET_PURCHASE_ORDER,
                po.getId(),
                user.userId(),
                reason);
        auditService.record(po.getOrganizationId(), user.userId(), "REJECT", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse send(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("PO_UPDATE");
        PurchaseOrder po = requireVisible(id);
        if (!PurchaseOrder.STATUS_APPROVED.equals(po.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only approved POs can be sent");
        }
        po.send(user.userId());
        auditService.record(po.getOrganizationId(), user.userId(), "UPDATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    @Transactional
    public PurchaseOrderResponse close(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("PO_UPDATE");
        PurchaseOrder po = requireVisible(id);
        if (!PurchaseOrder.STATUS_SENT.equals(po.getStatus())
                && !PurchaseOrder.STATUS_APPROVED.equals(po.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only sent or approved POs can be closed");
        }
        po.close(user.userId());
        auditService.record(po.getOrganizationId(), user.userId(), "UPDATE", "PURCHASE_ORDER", po.getId());
        return detail(po);
    }

    private void recalculate(PurchaseOrder po) {
        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findActiveByPurchaseOrderId(po.getId());
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        for (PurchaseOrderItem item : items) {
            subtotal = subtotal.add(item.getAmount());
            taxTotal = taxTotal.add(item.getTaxAmount());
        }
        po.recalculateTotals(subtotal, taxTotal);
    }

    private PurchaseOrderResponse detail(PurchaseOrder po) {
        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findActiveByPurchaseOrderId(po.getId());
        return PurchaseOrderResponse.from(po, items);
    }

    private PurchaseOrder requireDraft(UUID id) {
        PurchaseOrder po = requireVisible(id);
        if (!po.isEditable()) {
            throw new BusinessException("INVALID_STATUS", "Only draft or rejected purchase orders can be modified");
        }
        return po;
    }

    private PurchaseOrder requireVisible(UUID id) {
        PurchaseOrder po = purchaseOrderRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(po.getOrganizationId());
        tenantAccess.assertRegionVisible(po.getRegionId());
        return po;
    }

    private UUID resolveProjectId(UUID orgId, UUID projectId) {
        if (projectId == null) {
            return null;
        }
        Project project = projectRepository
                .findActiveById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!orgId.equals(project.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return project.getId();
    }

    private TaxRate resolveTax(UUID taxRateId, UUID organizationId) {
        if (taxRateId == null) {
            return null;
        }
        TaxRate tax = taxRateRepository
                .findActiveById(taxRateId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!organizationId.equals(tax.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return tax;
    }

    private static BigDecimal taxAmount(BigDecimal amount, TaxRate tax) {
        if (tax == null || tax.getRatePercent() == null) {
            return BigDecimal.ZERO;
        }
        return amount.multiply(tax.getRatePercent())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<PurchaseOrderResponse> data, PaginationMeta pagination) {}
}
