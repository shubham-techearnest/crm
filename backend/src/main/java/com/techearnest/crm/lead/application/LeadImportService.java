package com.techearnest.crm.lead.application;

import com.techearnest.crm.common.exception.ApiException;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.importer.application.RowRejected;
import com.techearnest.crm.lead.api.dto.LeadDtos.CreateLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.ImportLeadsRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.LeadImportIssue;
import com.techearnest.crm.lead.api.dto.LeadDtos.LeadImportResult;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.metadata.application.TableAclEvaluator;
import com.techearnest.crm.metadata.application.TableAclEvaluator.CrudOp;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Imports many leads in one request. Each row is saved in its own transaction so valid rows are
 * kept and invalid rows are reported with a reason instead of rolling back the whole file.
 */
@Service
public class LeadImportService {

    public static final int MAX_ROWS = 2000;
    static final String OUTCOME_FAILED = "FAILED";
    static final String OUTCOME_SKIPPED = "SKIPPED";

    private static final Set<String> IMPORTABLE_STATUSES =
            Set.of("NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "LOST");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Logger log = LoggerFactory.getLogger(LeadImportService.class);

    private final LeadService leadService;
    private final LeadRepository leadRepository;
    private final TenantAccess tenantAccess;
    private final TableAclEvaluator tableAclEvaluator;
    private final Validator validator;
    private final TransactionTemplate rowTransaction;

    public LeadImportService(
            LeadService leadService,
            LeadRepository leadRepository,
            TenantAccess tenantAccess,
            TableAclEvaluator tableAclEvaluator,
            Validator validator,
            PlatformTransactionManager transactionManager) {
        this.leadService = leadService;
        this.leadRepository = leadRepository;
        this.tenantAccess = tenantAccess;
        this.tableAclEvaluator = tableAclEvaluator;
        this.validator = validator;
        this.rowTransaction = new TransactionTemplate(transactionManager);
        this.rowTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public LeadImportResult importLeads(ImportLeadsRequest request) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_IMPORT");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.CREATE);
        List<CreateLeadRequest> rows = request == null || request.rows() == null ? List.of() : request.rows();
        if (rows.isEmpty()) {
            throw new BusinessException("IMPORT_EMPTY", "The file has no lead rows to import");
        }
        if (rows.size() > MAX_ROWS) {
            throw new BusinessException(
                    "IMPORT_LIMIT", "A single import is limited to " + MAX_ROWS + " rows; split the file");
        }
        boolean skipDuplicates = request.skipDuplicates() == null || request.skipDuplicates();

        List<LeadImportIssue> issues = new ArrayList<>();
        Set<String> emailsInFile = new HashSet<>();
        int imported = 0;
        for (int index = 0; index < rows.size(); index++) {
            CreateLeadRequest row = rows.get(index);
            try {
                CreateLeadRequest normalized = normalize(row);
                String email = normalized.email() == null ? null : normalized.email().toLowerCase(Locale.ROOT);
                if (skipDuplicates && email != null) {
                    if (!emailsInFile.add(email)) {
                        issues.add(new LeadImportIssue(index, OUTCOME_SKIPPED, "Same email appears earlier in the file"));
                        continue;
                    }
                    if (existingLeadHasEmail(normalized, email)) {
                        issues.add(new LeadImportIssue(index, OUTCOME_SKIPPED, "A lead with this email already exists"));
                        continue;
                    }
                }
                rowTransaction.executeWithoutResult(status -> leadService.createImportedLead(user, normalized));
                imported++;
            } catch (RowRejected e) {
                issues.add(new LeadImportIssue(index, OUTCOME_FAILED, e.getMessage()));
            } catch (ApiException e) {
                issues.add(new LeadImportIssue(index, OUTCOME_FAILED, describe(e)));
            } catch (DataAccessException e) {
                log.warn("Lead import row {} rejected by database: {}", index, e.getMostSpecificCause().getMessage());
                issues.add(new LeadImportIssue(index, OUTCOME_FAILED, "Rejected by the database (invalid or duplicate value)"));
            }
        }
        issues.sort(Comparator.comparingInt(LeadImportIssue::index));
        int skipped = (int) issues.stream().filter(i -> OUTCOME_SKIPPED.equals(i.outcome())).count();
        int failed = issues.size() - skipped;
        return new LeadImportResult(rows.size(), imported, skipped, failed, issues);
    }

    private boolean existingLeadHasEmail(CreateLeadRequest row, String email) {
        UUID orgId = tenantAccess.resolveOrganizationId(row.organizationId());
        return !leadRepository.findPotentialDuplicates(orgId, email, null, PageRequest.of(0, 1)).isEmpty();
    }

    private static String describe(ApiException e) {
        if ("NOT_FOUND".equals(e.getCode()) || e.getMessage() == null || "Resource not found".equals(e.getMessage())) {
            return "Region not found or not accessible";
        }
        return e.getMessage();
    }

    CreateLeadRequest normalize(CreateLeadRequest row) {
        if (row == null) {
            throw new RowRejected("Row is empty");
        }
        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(row);
        if (!violations.isEmpty()) {
            ConstraintViolation<CreateLeadRequest> first = violations.stream()
                    .min(Comparator.comparing(v -> v.getPropertyPath().toString()))
                    .orElseThrow();
            throw new RowRejected(first.getPropertyPath() + ": " + first.getMessage());
        }
        if (isBlank(row.lastName()) && isBlank(row.companyName()) && isBlank(row.email())) {
            throw new RowRejected("Row needs at least a last name, company or email");
        }
        String email = trimToNull(row.email());
        if (email != null && !EMAIL.matcher(email).matches()) {
            throw new RowRejected("Invalid email '" + email + "'");
        }
        if (isNegative(row.estimatedValue())) {
            throw new RowRejected("Estimated value cannot be negative");
        }
        if (row.noOfEmployees() != null && row.noOfEmployees() < 0) {
            throw new RowRejected("Number of employees cannot be negative");
        }
        return withStatusAndPriority(row, email, normalizeStatus(row.status()), normalizePriority(row.priority()));
    }

    private static String normalizeStatus(String raw) {
        String value = code(raw);
        if (value == null) {
            return "NEW";
        }
        if ("CONVERTED".equals(value)) {
            throw new RowRejected("Status CONVERTED cannot be imported; convert the lead after import");
        }
        if (!IMPORTABLE_STATUSES.contains(value)) {
            throw new RowRejected("Unknown status '" + raw.trim() + "' (use New, Contacted, Qualified, Proposal, Negotiation or Lost)");
        }
        return value;
    }

    private static String normalizePriority(String raw) {
        String value = code(raw);
        if (value == null) {
            return null;
        }
        if (!PRIORITIES.contains(value)) {
            throw new RowRejected("Unknown priority '" + raw.trim() + "' (use Low, Medium or High)");
        }
        return value;
    }

    private static String code(String raw) {
        String value = trimToNull(raw);
        return value == null ? null : value.toUpperCase(Locale.ROOT).replaceAll("[\\s-]+", "_");
    }

    private static boolean isNegative(BigDecimal value) {
        return value != null && value.signum() < 0;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private static CreateLeadRequest withStatusAndPriority(
            CreateLeadRequest r, String email, String status, String priority) {
        return new CreateLeadRequest(
                r.organizationId(), r.regionId(), r.ownerId(), r.salutation(), r.firstName(), r.lastName(),
                r.companyName(), email, r.phone(), r.mobile(), r.fax(), r.website(), r.source(),
                r.emailOptOut(), r.noOfEmployees(), r.rating(), r.skypeId(), r.secondaryEmail(), r.twitter(),
                r.addressCountry(), r.addressFlat(), r.addressStreet(), r.addressCity(), r.addressState(),
                r.addressZip(), r.addressLatitude(), r.addressLongitude(), status, priority, r.industry(),
                r.designation(), r.estimatedValue(), r.expectedCloseDate(), r.description());
    }
}
