package com.techearnest.crm.finance.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID>, JpaSpecificationExecutor<Invoice> {

    @Query("select i from Invoice i where i.id = :id and i.deletedAt is null")
    Optional<Invoice> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select i from Invoice i
            where i.organizationId = :organizationId
              and i.deletedAt is null
              and (:search is null
                   or lower(coalesce(i.invoiceNumber, '')) like lower(concat('%', cast(:search as string), '%'))
                   or lower(coalesce(i.notes, '')) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or i.regionId in :regionIds)
              and (:status is null or i.status = :status)
              and (:accountId is null or i.accountId = :accountId)
              and (:projectId is null or i.projectId = :projectId)
              and (:overdueOnly = false
                   or (i.dueDate is not null
                       and i.dueDate < CURRENT_DATE
                       and i.balanceDue > 0
                       and i.status not in ('DRAFT', 'VOID', 'PAID')))
            """)
    Page<Invoice> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("status") String status,
            @Param("accountId") UUID accountId,
            @Param("projectId") UUID projectId,
            @Param("overdueOnly") boolean overdueOnly,
            Pageable pageable);

    default Page<Invoice> searchWithFilter(
            UUID organizationId,
            String search,
            Collection<UUID> regionIds,
            String status,
            UUID accountId,
            UUID projectId,
            boolean overdueOnly,
            Specification<Invoice> extra,
            Pageable pageable) {
        Specification<Invoice> base = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(cb.coalesce(root.get("invoiceNumber"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("notes"), "")), like)));
            }
            if (regionIds != null) {
                predicates.add(root.get("regionId").in(regionIds));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (accountId != null) {
                predicates.add(cb.equal(root.get("accountId"), accountId));
            }
            if (projectId != null) {
                predicates.add(cb.equal(root.get("projectId"), projectId));
            }
            if (overdueOnly) {
                predicates.add(cb.and(
                        cb.isNotNull(root.get("dueDate")),
                        cb.lessThan(root.get("dueDate"), java.time.LocalDate.now()),
                        cb.greaterThan(root.get("balanceDue"), java.math.BigDecimal.ZERO),
                        cb.not(root.get("status").in("DRAFT", "VOID", "PAID"))));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Specification<Invoice> combined = extra == null ? base : base.and(extra);
        return findAll(combined, pageable);
    }
}
