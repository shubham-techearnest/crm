package com.techearnest.crm.contract.domain;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContractExpiryReminderRepository extends JpaRepository<ContractExpiryReminder, UUID> {
    boolean existsByContractIdAndRemindOn(UUID contractId, LocalDate remindOn);
}
