package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateSkillRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.SkillResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateSkillRequest;
import com.techearnest.crm.resource.domain.Skill;
import com.techearnest.crm.resource.domain.SkillRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillService {

    private final SkillRepository skillRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public SkillService(SkillRepository skillRepository, TenantAccess tenantAccess, AuditService auditService) {
        this.skillRepository = skillRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId, String search, String name, String category, Pageable pageable) {
        tenantAccess.requirePermission("SKILL_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Page<Skill> page = skillRepository.search(
                orgId, blankToNull(search), blankToNull(name), blankToNull(category), pageable);
        return new PageResult(page.map(SkillResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public SkillResponse get(UUID id) {
        tenantAccess.requirePermission("SKILL_VIEW");
        return SkillResponse.from(requireVisibleSkill(id));
    }

    @Transactional
    public SkillResponse create(CreateSkillRequest request) {
        CurrentUser user = tenantAccess.requirePermission("SKILL_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        String name = request.name().trim();
        if (skillRepository.existsActiveByOrganizationIdAndName(orgId, name)) {
            throw new ConflictException("Skill name already exists");
        }
        Skill skill = Skill.create(orgId, name, blankToNull(request.category()));
        skillRepository.save(skill);
        auditService.record(orgId, user.userId(), "CREATE", "SKILL", skill.getId());
        return SkillResponse.from(skill);
    }

    @Transactional
    public SkillResponse update(UUID id, UpdateSkillRequest request) {
        CurrentUser user = tenantAccess.requirePermission("SKILL_MANAGE");
        Skill skill = requireVisibleSkill(id);
        if (request.name() != null && !request.name().isBlank()) {
            String name = request.name().trim();
            if (!name.equalsIgnoreCase(skill.getName())
                    && skillRepository.existsActiveByOrganizationIdAndName(skill.getOrganizationId(), name)) {
                throw new ConflictException("Skill name already exists");
            }
        }
        skill.update(request.name() != null ? request.name().trim() : null, blankToNull(request.category()));
        auditService.record(skill.getOrganizationId(), user.userId(), "UPDATE", "SKILL", skill.getId());
        return SkillResponse.from(skill);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("SKILL_MANAGE");
        Skill skill = requireVisibleSkill(id);
        skill.markDeleted();
        auditService.record(skill.getOrganizationId(), user.userId(), "DELETE", "SKILL", skill.getId());
    }

    private Skill requireVisibleSkill(UUID id) {
        Skill skill = skillRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(skill.getOrganizationId());
        return skill;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<SkillResponse> data, PaginationMeta pagination) {}
}
