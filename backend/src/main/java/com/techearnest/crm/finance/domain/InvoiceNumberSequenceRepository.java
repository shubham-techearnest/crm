package com.techearnest.crm.finance.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface InvoiceNumberSequenceRepository extends JpaRepository<InvoiceNumberSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from InvoiceNumberSequence s where s.organizationId = :orgId and s.prefix = :prefix")
    Optional<InvoiceNumberSequence> findForUpdate(
            @Param("orgId") UUID organizationId, @Param("prefix") String prefix);
}
