package com.techearnest.crm.common.attachment;

import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.activity.domain.ActivityRepository;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.SecuredRecord;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contact.domain.ContactRepository;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.project.domain.ProjectRepository;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Resolves polymorphic parent records for documents/notes and enforces org/region/owner visibility.
 */
@Component
public class AttachmentParentGuard {

    private static final Set<String> SUPPORTED =
            Set.of("LEAD", "ACCOUNT", "CONTACT", "DEAL", "PROJECT", "ACTIVITY");

    private final TenantAccess tenantAccess;
    private final LeadRepository leadRepository;
    private final AccountRepository accountRepository;
    private final ContactRepository contactRepository;
    private final DealRepository dealRepository;
    private final ProjectRepository projectRepository;
    private final ActivityRepository activityRepository;

    public AttachmentParentGuard(
            TenantAccess tenantAccess,
            LeadRepository leadRepository,
            AccountRepository accountRepository,
            ContactRepository contactRepository,
            DealRepository dealRepository,
            ProjectRepository projectRepository,
            ActivityRepository activityRepository) {
        this.tenantAccess = tenantAccess;
        this.leadRepository = leadRepository;
        this.accountRepository = accountRepository;
        this.contactRepository = contactRepository;
        this.dealRepository = dealRepository;
        this.projectRepository = projectRepository;
        this.activityRepository = activityRepository;
    }

    public ParentRef requireVisibleParent(String entityType, UUID entityId) {
        String type = normalize(entityType);
        SecuredRecord record = load(type, entityId);
        tenantAccess.assertRecordVisible(record);
        return new ParentRef(type, entityId, record.getOrganizationId(), record.getRegionId());
    }

    public String normalize(String entityType) {
        if (entityType == null || entityType.isBlank()) {
            throw new BusinessException("ENTITY_TYPE_REQUIRED", "entityType is required");
        }
        String type = entityType.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED.contains(type)) {
            throw new BusinessException("UNSUPPORTED_ENTITY", "Unsupported entityType: " + entityType);
        }
        return type;
    }

    private SecuredRecord load(String type, UUID entityId) {
        return switch (type) {
            case "LEAD" -> leadRepository
                    .findActiveById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            case "ACCOUNT" -> accountRepository
                    .findActiveById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            case "CONTACT" -> contactRepository
                    .findActiveById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            case "DEAL" -> dealRepository
                    .findActiveById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            case "PROJECT" -> projectRepository
                    .findActiveById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            case "ACTIVITY" -> activityRepository
                    .findActiveById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            default -> throw new BusinessException("UNSUPPORTED_ENTITY", "Unsupported entityType: " + type);
        };
    }

    public record ParentRef(String entityType, UUID entityId, UUID organizationId, UUID regionId) {}
}
