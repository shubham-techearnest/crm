package com.techearnest.crm.procurement.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, UUID> {

    @Query(
            """
            select i from PurchaseOrderItem i
            where i.purchaseOrderId = :purchaseOrderId and i.deletedAt is null
            order by i.lineNo asc
            """)
    List<PurchaseOrderItem> findActiveByPurchaseOrderId(@Param("purchaseOrderId") UUID purchaseOrderId);

    @Query("select i from PurchaseOrderItem i where i.id = :id and i.deletedAt is null")
    Optional<PurchaseOrderItem> findActiveById(@Param("id") UUID id);
}
