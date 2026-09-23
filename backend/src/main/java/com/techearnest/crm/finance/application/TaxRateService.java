package com.techearnest.crm.finance.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.finance.api.dto.TaxDtos.CreateTaxRateRequest;
import com.techearnest.crm.finance.api.dto.TaxDtos.TaxRateResponse;
import com.techearnest.crm.finance.api.dto.TaxDtos.UpdateTaxRateRequest;
import com.techearnest.crm.finance.domain.TaxRate;
import com.techearnest.crm.finance.domain.TaxRateRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaxRateService {

    private static final Set<String> TAX_TYPES = Set.of("CGST", "SGST", "IGST", "OTHER");

    private final TaxRateRepository taxRateRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public TaxRateService(
            TaxRateRepository taxRateRepository, TenantAccess tenantAccess, AuditService auditService) {
        this.taxRateRepository = taxRateRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, String taxType, boolean activeOnly, Pageable pageable) {
        tenantAccess.requirePermission("TAX_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Page<TaxRate> page = taxRateRepository.search(
                orgId, blankToNull(search), blankToNull(taxType), activeOnly, pageable);
        return new PageResult(page.map(TaxRateResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public TaxRateResponse get(UUID id) {
        tenantAccess.requirePermission("TAX_VIEW");
        return TaxRateResponse.from(requireVisible(id));
    }

    @Transactional
    public TaxRateResponse create(CreateTaxRateRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TAX_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (taxRateRepository.existsByOrganizationIdAndCodeAndDeletedAtIsNull(orgId, code)) {
            throw new ConflictException("Tax rate code already exists");
        }
        String taxType = normalizeTaxType(request.taxType());
        validateRate(request.ratePercent());
        TaxRate rate = TaxRate.create(
                orgId,
                code,
                request.name().trim(),
                request.ratePercent(),
                blankToNull(request.jurisdiction()),
                taxType,
                blankToNull(request.description()),
                user.userId());
        taxRateRepository.save(rate);
        auditService.record(orgId, user.userId(), "CREATE", "TAX_RATE", rate.getId());
        return TaxRateResponse.from(rate);
    }

    @Transactional
    public TaxRateResponse update(UUID id, UpdateTaxRateRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TAX_MANAGE");
        TaxRate rate = requireVisible(id);
        if (request.ratePercent() != null) {
            validateRate(request.ratePercent());
        }
        rate.update(
                request.name(),
                request.ratePercent(),
                request.jurisdiction(),
                request.taxType() == null ? null : normalizeTaxType(request.taxType()),
                request.active(),
                request.description(),
                user.userId());
        auditService.record(rate.getOrganizationId(), user.userId(), "UPDATE", "TAX_RATE", rate.getId());
        return TaxRateResponse.from(rate);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("TAX_MANAGE");
        TaxRate rate = requireVisible(id);
        rate.markDeleted();
        auditService.record(rate.getOrganizationId(), user.userId(), "DELETE", "TAX_RATE", rate.getId());
    }

    private TaxRate requireVisible(UUID id) {
        TaxRate rate =
                taxRateRepository.findActiveById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(rate.getOrganizationId());
        return rate;
    }

    private static String normalizeTaxType(String taxType) {
        String t = taxType == null || taxType.isBlank() ? "OTHER" : taxType.trim().toUpperCase(Locale.ROOT);
        if (!TAX_TYPES.contains(t)) {
            throw new BusinessException("INVALID_TAX_TYPE", "taxType must be CGST, SGST, IGST, or OTHER");
        }
        return t;
    }

    private static void validateRate(BigDecimal rate) {
        if (rate.compareTo(BigDecimal.ZERO) < 0 || rate.compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException("INVALID_RATE", "ratePercent must be between 0 and 100");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<TaxRateResponse> data, PaginationMeta pagination) {}
}
