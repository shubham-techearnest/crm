package com.techearnest.crm.contract.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContractRepository extends JpaRepository<Contract, UUID>, JpaSpecificationExecutor<Contract> {

    @Query("select c from Contract c where c.id = :id and c.deletedAt is null")
    Optional<Contract> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select c from Contract c
            where c.organizationId = :organizationId
              and c.deletedAt is null
              and (:search is null
                   or lower(c.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(coalesce(c.contractNumber, '')) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or c.regionId in :regionIds)
              and (:status is null or c.status = :status)
              and (:accountId is null or c.accountId = :accountId)
              and (:autoRenew is null or c.autoRenew = :autoRenew)
            """)
    Page<Contract> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("status") String status,
            @Param("accountId") UUID accountId,
            @Param("autoRenew") Boolean autoRenew,
            Pageable pageable);

    @Query(
            """
            select c from Contract c
            where c.deletedAt is null
              and c.status = 'ACTIVE'
              and c.endDate is not null
              and c.endDate >= :today
              and c.endDate <= :windowEnd
            """)
    List<Contract> findExpiringBetween(@Param("today") LocalDate today, @Param("windowEnd") LocalDate windowEnd);

    default Page<Contract> searchWithFilter(
            UUID organizationId,
            String search,
            Collection<UUID> regionIds,
            String status,
            UUID accountId,
            Boolean autoRenew,
            Specification<Contract> extra,
            Pageable pageable) {
        Specification<Contract> base = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("contractNumber"), "")), like)));
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
            if (autoRenew != null) {
                predicates.add(cb.equal(root.get("autoRenew"), autoRenew));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return findAll(extra == null ? base : base.and(extra), pageable);
    }
}
