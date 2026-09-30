package com.techearnest.crm.timesheet.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.auth.application.TokenHash;
import com.techearnest.crm.common.config.SelfServiceProperties;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.mail.MailGateway;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.organization.domain.Organization;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.resource.application.ResourceDisplayNames;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.IssueTimesheetLinkRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.LinkEntryView;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.LinkSubmitRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetLinkIssued;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetLinkView;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetLink;
import com.techearnest.crm.timesheet.domain.TimesheetLinkRepository;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Secure timesheet links for resources without a login: a manager (or the weekly job) issues a link for one week,
 * the resource opens it without signing in, sees their allocated projects and submits the week for approval.
 * Only the SHA-256 of the token is stored.
 */
@Service
public class TimesheetLinkService {

    private static final Logger log = LoggerFactory.getLogger(TimesheetLinkService.class);
    private static final DateTimeFormatter WEEK_LABEL = DateTimeFormatter.ofPattern("d MMM yyyy");

    private final TimesheetLinkRepository linkRepository;
    private final TimesheetRepository timesheetRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final ResourceRepository resourceRepository;
    private final OrganizationRepository organizationRepository;
    private final TimesheetService timesheetService;
    private final ResourceDisplayNames resourceNames;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final MailGateway mailGateway;
    private final SelfServiceProperties properties;

    public TimesheetLinkService(
            TimesheetLinkRepository linkRepository,
            TimesheetRepository timesheetRepository,
            TimeEntryRepository timeEntryRepository,
            ResourceRepository resourceRepository,
            OrganizationRepository organizationRepository,
            TimesheetService timesheetService,
            ResourceDisplayNames resourceNames,
            TenantAccess tenantAccess,
            AuditService auditService,
            MailGateway mailGateway,
            SelfServiceProperties properties) {
        this.linkRepository = linkRepository;
        this.timesheetRepository = timesheetRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.resourceRepository = resourceRepository;
        this.organizationRepository = organizationRepository;
        this.timesheetService = timesheetService;
        this.resourceNames = resourceNames;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.mailGateway = mailGateway;
        this.properties = properties;
    }

    @Transactional
    public TimesheetLinkIssued issue(UUID resourceId, IssueTimesheetLinkRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_LINK_SEND");
        Resource resource = resourceRepository
                .findActiveById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(resource);
        if (resource.getUserId() != null) {
            throw new BusinessException(
                    "HAS_LOGIN", "This resource has a login and can fill in timesheets after signing in");
        }
        LocalDate weekStart = request.weekStartDate();
        if (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new BusinessException("INVALID_WEEK_START", "weekStartDate must be a Monday");
        }
        boolean sendEmail = request.sendEmail() == null || request.sendEmail();
        return issueFor(resource, weekStart, user.userId(), sendEmail);
    }

    @Transactional
    public TimesheetLinkView view(String token) {
        TimesheetLink link = requireUsable(token);
        link.markOpened();
        return buildView(link);
    }

    @Transactional
    public TimesheetLinkView submit(String token, LinkSubmitRequest request) {
        TimesheetLink link = requireUsable(token);
        Resource resource = requireResource(link.getResourceId());
        timesheetService.submitFromLink(resource, link.getWeekStartDate(), request.entries(), link.getCreatedBy());
        link.markSubmitted();
        return buildView(link);
    }

    /** Monday morning: last week's link for everyone with an email, no login and an allocation that week. */
    @Scheduled(cron = "${crm.self-service.weekly-link-cron:0 0 9 * * MON}")
    @Transactional
    public void sendWeeklyLinks() {
        if (!properties.isWeeklyTimesheetLinks()) {
            return;
        }
        LocalDate weekStart = TimesheetService.mondayOf(LocalDate.now()).minusWeeks(1);
        int sent = 0;
        for (Resource resource : resourceRepository.findLinkRecipientsForWeek(weekStart, weekStart.plusDays(6))) {
            Timesheet existing = timesheetRepository
                    .findByResourceIdAndWeekStartDateAndDeletedAtIsNull(resource.getId(), weekStart)
                    .orElse(null);
            if (existing != null && !existing.isEditable()) {
                continue;
            }
            if (!linkRepository.findUsable(resource.getId(), weekStart, Instant.now()).isEmpty()) {
                continue;
            }
            issueFor(resource, weekStart, null, true);
            sent++;
        }
        if (sent > 0) {
            log.info("Sent {} weekly timesheet link(s) for the week of {}", sent, weekStart);
        }
    }

    private TimesheetLinkIssued issueFor(Resource resource, LocalDate weekStart, UUID createdBy, boolean sendEmail) {
        Instant now = Instant.now();
        linkRepository.findUsable(resource.getId(), weekStart, now).forEach(TimesheetLink::revoke);
        String raw = TokenHash.newOpaqueToken();
        Instant expiresAt = now.plus(properties.getTimesheetLinkTtl());
        TimesheetLink link = TimesheetLink.issue(
                resource.getOrganizationId(), resource.getId(), weekStart, TokenHash.sha256(raw), expiresAt, createdBy);
        linkRepository.save(link);
        String url = properties.link("/timesheet-link/" + raw);

        boolean emailed = false;
        if (sendEmail && resource.getEmail() != null) {
            String name = resourceNames.of(resource);
            mailGateway.send(
                    resource.getEmail(),
                    "Timesheet for the week of " + weekStart.format(WEEK_LABEL),
                    "Hi " + name + ",\n\nPlease fill in your hours for the week of " + weekStart.format(WEEK_LABEL)
                            + " using this secure link (no password needed):\n\n" + url
                            + "\n\nThe link works until " + expiresAt + " and only for this week.");
            emailed = true;
        }
        auditService.record(resource.getOrganizationId(), createdBy, "ISSUE_LINK", "TIMESHEET_LINK", link.getId());
        return new TimesheetLinkIssued(url, expiresAt, weekStart, emailed, resource.getEmail());
    }

    private TimesheetLinkView buildView(TimesheetLink link) {
        Resource resource = requireResource(link.getResourceId());
        Timesheet timesheet = timesheetRepository
                .findByResourceIdAndWeekStartDateAndDeletedAtIsNull(resource.getId(), link.getWeekStartDate())
                .orElse(null);
        List<LinkEntryView> entries = timesheet == null
                ? List.of()
                : timeEntryRepository.findActiveByTimesheetId(timesheet.getId()).stream()
                        .map(e -> new LinkEntryView(
                                e.getProjectId(), e.getTaskId(), e.getWorkDate(), e.getHours(), e.getDescription(),
                                e.isBillable()))
                        .toList();
        String organizationName = organizationRepository
                .findActiveById(resource.getOrganizationId())
                .map(Organization::getName)
                .orElse(null);
        return new TimesheetLinkView(
                resourceNames.of(resource),
                organizationName,
                link.getWeekStartDate(),
                link.getWeekStartDate().plusDays(6),
                timesheet == null ? Timesheet.STATUS_DRAFT : timesheet.getStatus(),
                timesheet == null ? null : timesheet.getRejectionReason(),
                timesheet == null || timesheet.isEditable(),
                link.getExpiresAt(),
                resource.getCapacityHoursPerWeek(),
                timesheetService.allocatedProjectOptions(resource.getOrganizationId(), resource.getId()),
                entries);
    }

    private TimesheetLink requireUsable(String token) {
        if (token == null || token.isBlank() || token.length() > 128) {
            throw new ResourceNotFoundException("This timesheet link is invalid or has expired");
        }
        TimesheetLink link = linkRepository
                .findByTokenHash(TokenHash.sha256(token.trim()))
                .orElseThrow(() -> new ResourceNotFoundException("This timesheet link is invalid or has expired"));
        if (!link.isUsable(Instant.now())) {
            throw new ResourceNotFoundException("This timesheet link is invalid or has expired");
        }
        return link;
    }

    private Resource requireResource(UUID resourceId) {
        return resourceRepository
                .findActiveById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("This timesheet link is invalid or has expired"));
    }
}
