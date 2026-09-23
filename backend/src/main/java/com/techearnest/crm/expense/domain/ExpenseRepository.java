package com.techearnest.crm.expense.domain;

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

public interface ExpenseRepository extends JpaRepository<Expense, UUID>, JpaSpecificationExecutor<Expense> {

    @Query("select e from Expense e where e.id = :id and e.deletedAt is null")
    Optional<Expense> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select e from Expense e
            where e.organizationId = :organizationId
              and e.deletedAt is null
              and (:search is null
                   or lower(e.category) like lower(concat('%', cast(:search as string), '%'))
                   or lower(coalesce(e.description, '')) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or e.regionId in :regionIds)
              and (:status is null or e.status = :status)
              and (:category is null or e.category = :category)
              and (:projectId is null or e.projectId = :projectId)
              and (:resourceId is null or e.resourceId = :resourceId)
              and (:billable is null or e.billable = :billable)
            """)
    Page<Expense> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("status") String status,
            @Param("category") String category,
            @Param("projectId") UUID projectId,
            @Param("resourceId") UUID resourceId,
            @Param("billable") Boolean billable,
            Pageable pageable);

    default Page<Expense> searchWithFilter(
            UUID organizationId,
            String search,
            Collection<UUID> regionIds,
            String status,
            String category,
            UUID projectId,
            UUID resourceId,
            Boolean billable,
            Specification<Expense> extra,
            Pageable pageable) {
        Specification<Expense> base = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("category")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), like)));
            }
            if (regionIds != null) {
                predicates.add(root.get("regionId").in(regionIds));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (projectId != null) {
                predicates.add(cb.equal(root.get("projectId"), projectId));
            }
            if (resourceId != null) {
                predicates.add(cb.equal(root.get("resourceId"), resourceId));
            }
            if (billable != null) {
                predicates.add(cb.equal(root.get("billable"), billable));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return findAll(extra == null ? base : base.and(extra), pageable);
    }
}
