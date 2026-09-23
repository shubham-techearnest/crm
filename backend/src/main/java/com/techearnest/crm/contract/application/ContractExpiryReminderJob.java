package com.techearnest.crm.contract.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.contract.domain.Contract;
import com.techearnest.crm.contract.domain.ContractExpiryReminder;
import com.techearnest.crm.contract.domain.ContractExpiryReminderRepository;
import com.techearnest.crm.contract.domain.ContractRepository;
import com.techearnest.crm.notification.application.NotificationService;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ContractExpiryReminderJob {

    private static final Logger log = LoggerFactory.getLogger(ContractExpiryReminderJob.class);

    private final ContractRepository contractRepository;
    private final ContractExpiryReminderRepository reminderRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public ContractExpiryReminderJob(
            ContractRepository contractRepository,
            ContractExpiryReminderRepository reminderRepository,
            NotificationService notificationService,
            AuditService auditService) {
        this.contractRepository = contractRepository;
        this.reminderRepository = reminderRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    @Scheduled(cron = "${crm.contracts.expiry-cron:0 15 6 * * *}")
    @Transactional
    public void run() {
        LocalDate today = LocalDate.now();
        LocalDate windowEnd = today.plusDays(90);
        List<Contract> candidates = contractRepository.findExpiringBetween(today, windowEnd);
        int sent = 0;
        for (Contract contract : candidates) {
            if (contract.getEndDate() == null) {
                continue;
            }
            long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(today, contract.getEndDate());
            if (daysLeft > contract.getRenewalNoticeDays()) {
                continue;
            }
            if (reminderRepository.existsByContractIdAndRemindOn(contract.getId(), today)) {
                continue;
            }
            sendReminder(contract, today);
            sent += 1;
        }
        if (sent > 0) {
            log.info("Contract expiry reminders sent: {}", sent);
        }
    }

    private void sendReminder(Contract contract, LocalDate today) {
        try {
            reminderRepository.save(ContractExpiryReminder.create(
                    contract.getOrganizationId(), contract.getId(), today, contract.getOwnerId()));
        } catch (DataIntegrityViolationException ex) {
            return;
        }
        notificationService.notify(
                contract.getOrganizationId(),
                contract.getOwnerId(),
                "CONTRACT_EXPIRY",
                "Contract expiring soon",
                "Contract \"" + contract.getName() + "\" ends on " + contract.getEndDate() + ".",
                "CONTRACT",
                contract.getId());
        auditService.recordWithSummary(
                contract.getOrganizationId(),
                null,
                "EXECUTE",
                "CONTRACT_REMINDER",
                contract.getId(),
                "Expiry reminder for " + today);
        if (contract.getEndDate() != null && !contract.getEndDate().isAfter(today)) {
            contract.markExpired();
        }
    }
}
