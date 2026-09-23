package com.techearnest.crm.platform.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.AccessGuard;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.ProspectResponse;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.QueryProspectRequest;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.UpsertProspectRequest;
import com.techearnest.crm.platform.domain.PlatformProspectOrg;
import com.techearnest.crm.platform.domain.PlatformProspectOrgRepository;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformProspectService {

    private static final Set<String> STAGES = Set.of("NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST");

    private final AccessGuard accessGuard;
    private final PlatformProspectOrgRepository prospectRepository;
    private final OrganizationRepository organizationRepository;
    private final AuditService auditService;

    public PlatformProspectService(
            AccessGuard accessGuard,
            PlatformProspectOrgRepository prospectRepository,
            OrganizationRepository organizationRepository,
            AuditService auditService) {
        this.accessGuard = accessGuard;
        this.prospectRepository = prospectRepository;
        this.organizationRepository = organizationRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryProspectRequest request) {
        accessGuard.requirePlatform();
        QueryProspectRequest req = request == null ? new QueryProspectRequest(null, null, null, null, 0, 20) : request;
        Specification<PlatformProspectOrg> spec = Specification.where(notDeleted())
                .and(FilterSpecificationBuilder.build(req.filter(), ProspectFilterFields.ALLOWED))
                .and(searchSpec(req.search()))
                .and(eqIfPresent("stage", blankToNull(req.stage())))
                .and(eqIfPresent("source", blankToNull(req.source())));
        Page<PlatformProspectOrg> page = prospectRepository.findAll(
                spec, PageRequest.of(req.page(), req.size(), Sort.by(Sort.Direction.DESC, "createdAt")));
        return new PageResult(
                page.map(ProspectResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ProspectResponse get(UUID id) {
        accessGuard.requirePlatform();
        return ProspectResponse.from(requireActive(id));
    }

    @Transactional
    public ProspectResponse create(UpsertProspectRequest request) {
        CurrentUser actor = accessGuard.requirePlatform();
        String stage = normalizeStage(request.stage());
        PlatformProspectOrg prospect = PlatformProspectOrg.create(
                request.name().trim(),
                blankToNull(request.legalName()),
                blankToNull(request.website()),
                blankToNull(request.email()),
                blankToNull(request.phone()),
                blankToNull(request.source()),
                stage,
                request.estimatedArr(),
                request.ownerUserId() != null ? request.ownerUserId() : actor.userId(),
                blankToNull(request.notes()));
        prospectRepository.save(prospect);
        auditService.record(null, actor.userId(), "CREATE", "PLATFORM_PROSPECT", prospect.getId());
        return ProspectResponse.from(prospect);
    }

    @Transactional
    public ProspectResponse update(UUID id, UpsertProspectRequest request) {
        CurrentUser actor = accessGuard.requirePlatform();
        PlatformProspectOrg prospect = requireActive(id);
        prospect.update(
                request.name().trim(),
                blankToNull(request.legalName()),
                blankToNull(request.website()),
                blankToNull(request.email()),
                blankToNull(request.phone()),
                blankToNull(request.source()),
                normalizeStage(request.stage()),
                request.estimatedArr(),
                request.ownerUserId(),
                blankToNull(request.notes()));
        auditService.record(null, actor.userId(), "UPDATE", "PLATFORM_PROSPECT", prospect.getId());
        return ProspectResponse.from(prospect);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser actor = accessGuard.requirePlatform();
        PlatformProspectOrg prospect = requireActive(id);
        prospect.markDeleted();
        auditService.record(null, actor.userId(), "DELETE", "PLATFORM_PROSPECT", prospect.getId());
    }

    @Transactional
    public ProspectResponse linkOrganization(UUID prospectId, UUID organizationId) {
        CurrentUser actor = accessGuard.requirePlatform();
        PlatformProspectOrg prospect = requireActive(prospectId);
        organizationRepository
                .findActiveById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        prospect.linkOrganization(organizationId);
        auditService.record(organizationId, actor.userId(), "LINK", "PLATFORM_PROSPECT", prospect.getId());
        return ProspectResponse.from(prospect);
    }

    private PlatformProspectOrg requireActive(UUID id) {
        return prospectRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
    }

    private static String normalizeStage(String stage) {
        String normalized = stage == null || stage.isBlank() ? "NEW" : stage.trim().toUpperCase(Locale.ROOT);
        if (!STAGES.contains(normalized)) {
            throw new BusinessException("INVALID_STAGE", "Invalid prospect stage");
        }
        return normalized;
    }

    private static Specification<PlatformProspectOrg> notDeleted() {
        return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
    }

    private static Specification<PlatformProspectOrg> searchSpec(String search) {
        String q = blankToNull(search);
        if (q == null) {
            return null;
        }
        String like = "%" + q.toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("name")), like),
                cb.like(cb.lower(cb.coalesce(root.get("legalName"), "")), like),
                cb.like(cb.lower(cb.coalesce(root.get("email"), "")), like));
    }

    private static Specification<PlatformProspectOrg> eqIfPresent(String field, String value) {
        if (value == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get(field), value);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ProspectResponse> data, PaginationMeta pagination) {}
}
