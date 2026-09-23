package com.techearnest.crm.procurement.domain;

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

public interface PurchaseOrderRepository
        extends JpaRepository<PurchaseOrder, UUID>, JpaSpecificationExecutor<PurchaseOrder> {

    @Query("select p from PurchaseOrder p where p.id = :id and p.deletedAt is null")
    Optional<PurchaseOrder> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select p from PurchaseOrder p
            where p.organizationId = :organizationId
              and p.deletedAt is null
              and (:search is null
                   or lower(coalesce(p.poNumber, '')) like lower(concat('%', cast(:search as string), '%'))
                   or lower(coalesce(p.notes, '')) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or p.regionId in :regionIds)
              and (:status is null or p.status = :status)
              and (:vendorId is null or p.vendorId = :vendorId)
              and (:projectId is null or p.projectId = :projectId)
            """)
    Page<PurchaseOrder> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("status") String status,
            @Param("vendorId") UUID vendorId,
            @Param("projectId") UUID projectId,
            Pageable pageable);

    default Page<PurchaseOrder> searchWithFilter(
            UUID organizationId,
            String search,
            Collection<UUID> regionIds,
            String status,
            UUID vendorId,
            UUID projectId,
            Specification<PurchaseOrder> extra,
            Pageable pageable) {
        Specification<PurchaseOrder> base = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(cb.coalesce(root.get("poNumber"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("notes"), "")), like)));
            }
            if (regionIds != null) {
                predicates.add(root.get("regionId").in(regionIds));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (vendorId != null) {
                predicates.add(cb.equal(root.get("vendorId"), vendorId));
            }
            if (projectId != null) {
                predicates.add(cb.equal(root.get("projectId"), projectId));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return findAll(extra == null ? base : base.and(extra), pageable);
    }
}
