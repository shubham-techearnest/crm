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

public interface VendorRepository extends JpaRepository<Vendor, UUID>, JpaSpecificationExecutor<Vendor> {

    @Query("select v from Vendor v where v.id = :id and v.deletedAt is null")
    Optional<Vendor> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select v from Vendor v
            where v.organizationId = :organizationId
              and v.deletedAt is null
              and (:search is null
                   or lower(v.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(coalesce(v.email, '')) like lower(concat('%', cast(:search as string), '%'))
                   or lower(coalesce(v.taxNumber, '')) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or v.regionId in :regionIds)
              and (:status is null or v.status = :status)
            """)
    Page<Vendor> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("status") String status,
            Pageable pageable);

    default Page<Vendor> searchWithFilter(
            UUID organizationId,
            String search,
            Collection<UUID> regionIds,
            String status,
            Specification<Vendor> extra,
            Pageable pageable) {
        Specification<Vendor> base = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("email"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("taxNumber"), "")), like)));
            }
            if (regionIds != null) {
                predicates.add(root.get("regionId").in(regionIds));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return findAll(extra == null ? base : base.and(extra), pageable);
    }
}
