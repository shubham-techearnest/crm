package com.techearnest.crm.finance.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CreditNoteRepository extends JpaRepository<CreditNote, UUID> {

    @Query("select c from CreditNote c where c.id = :id and c.deletedAt is null")
    Optional<CreditNote> findActiveById(@Param("id") UUID id);

    @Query(
            "select c from CreditNote c where c.invoiceId = :invoiceId and c.deletedAt is null order by c.createdAt desc")
    List<CreditNote> findActiveByInvoiceId(@Param("invoiceId") UUID invoiceId);
}
