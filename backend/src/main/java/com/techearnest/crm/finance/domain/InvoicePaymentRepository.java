package com.techearnest.crm.finance.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoicePaymentRepository extends JpaRepository<InvoicePayment, UUID> {

    @Query(
            "select p from InvoicePayment p where p.invoiceId = :invoiceId and p.deletedAt is null order by p.paidAt desc")
    List<InvoicePayment> findActiveByInvoiceId(@Param("invoiceId") UUID invoiceId);
}
