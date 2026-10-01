package com.techearnest.crm.contact.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.bulk.BulkDtos.BulkAssignOwnerRequest;
import com.techearnest.crm.common.bulk.BulkDtos.BulkResult;
import com.techearnest.crm.common.bulk.BulkExecutor;
import com.techearnest.crm.user.application.OwnerValidator;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contact.api.dto.ContactDtos.ContactResponse;
import com.techearnest.crm.contact.api.dto.ContactDtos.CreateContactRequest;
import com.techearnest.crm.contact.api.dto.ContactDtos.UpdateContactRequest;
import com.techearnest.crm.contact.domain.Contact;
import com.techearnest.crm.contact.domain.ContactRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContactService {

    private final ContactRepository contactRepository;
    private final AccountRepository accountRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final OwnerValidator ownerValidator;

    public ContactService(
            ContactRepository contactRepository,
            AccountRepository accountRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            OwnerValidator ownerValidator) {
        this.ownerValidator = ownerValidator;
        this.contactRepository = contactRepository;
        this.accountRepository = accountRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            UUID accountId,
            String status,
            UUID ownerId,
            String email,
            String designation,
            Pageable pageable) {
        tenantAccess.requirePermission("CONTACT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Contact> page = contactRepository.search(
                orgId,
                blankToNull(search),
                regionIds,
                ownerIds,
                accountId,
                blankToNull(status),
                ownerId,
                blankToNull(email),
                blankToNull(designation),
                pageable);
        return new PageResult(page.map(ContactResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ContactResponse get(UUID id) {
        tenantAccess.requirePermission("CONTACT_VIEW");
        return ContactResponse.from(requireVisibleContact(id));
    }

    @Transactional
    public ContactResponse create(CreateContactRequest request) {
        CurrentUser user = tenantAccess.requirePermission("CONTACT_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Account account = accountRepository
                .findActiveById(request.accountId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!account.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        tenantAccess.assertRecordVisible(account);
        UUID ownerId = request.ownerId() != null ? request.ownerId() : user.userId();

        Contact contact = Contact.create(
                orgId,
                account.getRegionId(),
                account.getId(),
                ownerId,
                request.firstName().trim(),
                request.lastName().trim(),
                blankToNull(request.email()),
                blankToNull(request.phone()),
                blankToNull(request.mobile()),
                blankToNull(request.designation()),
                blankToNull(request.department()),
                blankToNull(request.linkedinUrl()),
                request.status(),
                request.notes());
        contactRepository.save(contact);
        auditService.record(orgId, user.userId(), "CREATE", "CONTACT", contact.getId());
        return ContactResponse.from(contact);
    }

    @Transactional
    public ContactResponse update(UUID id, UpdateContactRequest request) {
        CurrentUser user = tenantAccess.requirePermission("CONTACT_UPDATE");
        Contact contact = requireVisibleContact(id);
        contact.update(
                request.ownerId(),
                request.firstName().trim(),
                request.lastName().trim(),
                blankToNull(request.email()),
                blankToNull(request.phone()),
                blankToNull(request.mobile()),
                blankToNull(request.designation()),
                blankToNull(request.department()),
                blankToNull(request.linkedinUrl()),
                request.status(),
                request.notes());
        auditService.record(contact.getOrganizationId(), user.userId(), "UPDATE", "CONTACT", contact.getId());
        return ContactResponse.from(contact);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("CONTACT_DELETE");
        Contact contact = requireVisibleContact(id);
        contact.markDeleted();
        auditService.record(contact.getOrganizationId(), user.userId(), "DELETE", "CONTACT", contact.getId());
    }

    @Transactional
    public BulkResult bulkAssign(BulkAssignOwnerRequest request) {
        CurrentUser user = tenantAccess.requirePermission("CONTACT_UPDATE");
        UUID ownerOrgId = ownerValidator.requireActiveOwner(request.ownerId());
        return BulkExecutor.run(request.ids(), "contact", id -> {
            Contact contact = requireVisibleContact(id);
            OwnerValidator.requireSameOrganization(ownerOrgId, contact.getOrganizationId());
            contact.reassignOwner(request.ownerId());
            auditService.recordWithSummary(
                    contact.getOrganizationId(),
                    user.userId(),
                    "ASSIGN",
                    "CONTACT",
                    contact.getId(),
                    "{\"bulk\":true,\"ownerId\":\"" + request.ownerId() + "\"}");
        });
    }

    private Contact requireVisibleContact(UUID id) {
        Contact contact = contactRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(contact);
        return contact;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ContactResponse> data, PaginationMeta pagination) {}
}
