package com.techearnest.crm.search.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.contact.domain.Contact;
import com.techearnest.crm.contact.domain.ContactRepository;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.lead.domain.Lead;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.search.api.dto.SearchDtos.SearchHit;
import com.techearnest.crm.search.api.dto.SearchDtos.SearchResponse;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SearchService {

    private static final int LIMIT_PER_TYPE = 20;
    private static final Set<String> ALL_TYPES =
            Set.of("LEAD", "CONTACT", "ACCOUNT", "DEAL", "PROJECT");

    private final LeadRepository leadRepository;
    private final ContactRepository contactRepository;
    private final AccountRepository accountRepository;
    private final DealRepository dealRepository;
    private final ProjectRepository projectRepository;
    private final TenantAccess tenantAccess;

    public SearchService(
            LeadRepository leadRepository,
            ContactRepository contactRepository,
            AccountRepository accountRepository,
            DealRepository dealRepository,
            ProjectRepository projectRepository,
            TenantAccess tenantAccess) {
        this.leadRepository = leadRepository;
        this.contactRepository = contactRepository;
        this.accountRepository = accountRepository;
        this.dealRepository = dealRepository;
        this.projectRepository = projectRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional(readOnly = true)
    public SearchResponse search(UUID organizationId, String q, String types) {
        CurrentUser user = tenantAccess.currentUser();
        String query = q == null ? "" : q.trim();
        if (query.length() < 2) {
            throw new BusinessException("QUERY_TOO_SHORT", "Search query must be at least 2 characters");
        }

        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Set<String> requested = parseTypes(types);
        PageRequest page = PageRequest.of(0, LIMIT_PER_TYPE);

        List<SearchHit> results = new ArrayList<>();

        if (requested.contains("LEAD") && user.hasPermission("LEAD_VIEW")) {
            for (Lead lead : leadRepository.search(orgId, query, regionIds, ownerIds, null, page).getContent()) {
                String title = ((lead.getFirstName() != null ? lead.getFirstName() : "") + " "
                                + (lead.getLastName() != null ? lead.getLastName() : ""))
                        .trim();
                if (title.isBlank()) {
                    title = lead.getEmail() != null ? lead.getEmail() : "Lead";
                }
                String subtitle = lead.getCompanyName() != null ? lead.getCompanyName() : lead.getStatus();
                results.add(new SearchHit("LEAD", lead.getId(), title, subtitle));
            }
        }

        if (requested.contains("CONTACT") && user.hasPermission("CONTACT_VIEW")) {
            for (Contact contact :
                    contactRepository
                            .search(orgId, query, regionIds, ownerIds, null, null, null, null, null, page)
                            .getContent()) {
                String title = ((contact.getFirstName() != null ? contact.getFirstName() : "") + " "
                                + (contact.getLastName() != null ? contact.getLastName() : ""))
                        .trim();
                results.add(new SearchHit(
                        "CONTACT",
                        contact.getId(),
                        title.isBlank() ? "Contact" : title,
                        contact.getEmail()));
            }
        }

        if (requested.contains("ACCOUNT") && user.hasPermission("ACCOUNT_VIEW")) {
            for (Account account :
                    accountRepository
                            .search(orgId, query, regionIds, ownerIds, null, null, null, null, page)
                            .getContent()) {
                results.add(new SearchHit("ACCOUNT", account.getId(), account.getName(), account.getStatus()));
            }
        }

        if (requested.contains("DEAL") && user.hasPermission("DEAL_VIEW")) {
            for (Deal deal :
                    dealRepository
                            .search(orgId, query, regionIds, ownerIds, null, null, null, null, null, null, page)
                            .getContent()) {
                results.add(new SearchHit("DEAL", deal.getId(), deal.getName(), deal.getStage()));
            }
        }

        if (requested.contains("PROJECT") && user.hasPermission("PROJECT_VIEW")) {
            for (Project project :
                    projectRepository
                            .search(orgId, query, regionIds, ownerIds, null, null, null, null, null, false, page)
                            .getContent()) {
                results.add(new SearchHit(
                        "PROJECT", project.getId(), project.getName(), project.getProjectCode()));
            }
        }

        return new SearchResponse(query, results);
    }

    private static Set<String> parseTypes(String types) {
        if (types == null || types.isBlank()) {
            return ALL_TYPES;
        }
        Set<String> parsed = new LinkedHashSet<>();
        for (String part : types.split(",")) {
            String type = part.trim().toUpperCase(Locale.ROOT);
            if (ALL_TYPES.contains(type)) {
                parsed.add(type);
            }
        }
        if (parsed.isEmpty()) {
            throw new BusinessException("INVALID_TYPES", "No valid search types provided");
        }
        return parsed;
    }
}
