package com.techearnest.crm.finance.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceLineRepository extends JpaRepository<InvoiceLine, UUID> {

    @Query("select l from InvoiceLine l where l.invoiceId = :invoiceId and l.deletedAt is null order by l.lineNo")
    List<InvoiceLine> findActiveByInvoiceId(@Param("invoiceId") UUID invoiceId);

    boolean existsByTimeEntryIdAndDeletedAtIsNull(UUID timeEntryId);
}
