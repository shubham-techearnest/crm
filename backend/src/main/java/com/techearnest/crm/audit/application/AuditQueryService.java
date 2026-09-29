package com.techearnest.crm.audit.application;

import com.techearnest.crm.audit.api.dto.AuditLogResponse;
import com.techearnest.crm.audit.domain.AuditLog;
import com.techearnest.crm.audit.domain.AuditLogRepository;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.security.TenantAccess;
import java.time.Instant;
import java.util.List;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditQueryService {

    private final AuditLogRepository auditLogRepository;
    private final TenantAccess tenantAccess;

    public AuditQueryService(AuditLogRepository auditLogRepository, TenantAccess tenantAccess) {
        this.auditLogRepository = auditLogRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String action,
            String entityType,
            UUID userId,
            UUID regionId,
            UUID entityId,
            Instant fromTs,
            Instant toTs,
            Pageable pageable) {
        tenantAccess.requirePermission("AUDIT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> visibleRegions = tenantAccess.regionFilterOrNull();
        Page<AuditLog> page;
        if (visibleRegions != null) {
            if (regionId != null && !visibleRegions.contains(regionId)) {
                page = Page.empty(pageable);
            } else {
                page = auditLogRepository.searchByOrganizationAndRegions(
                        orgId,
                        visibleRegions,
                        blankToNull(action),
                        blankToNull(entityType),
                        userId,
                        regionId,
                        entityId,
                        fromTs,
                        toTs,
                        pageable);
            }
        } else {
            page = auditLogRepository.searchByOrganization(
                    orgId,
                    blankToNull(action),
                    blankToNull(entityType),
                    userId,
                    regionId,
                    entityId,
                    fromTs,
                    toTs,
                    pageable);
        }
        return new PageResult(page.map(AuditLogResponse::from).getContent(), PaginationMeta.from(page));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<AuditLogResponse> data, PaginationMeta pagination) {}
}
