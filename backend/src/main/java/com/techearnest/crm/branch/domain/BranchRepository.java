package com.techearnest.crm.branch.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BranchRepository extends JpaRepository<Branch, UUID> {

    @Query(
            """
            select b from Branch b
            where b.organizationId = :organizationId
              and b.deletedAt is null
              and (:search is null or lower(b.name) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or b.regionId in :regionIds)
            """)
    Page<Branch> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            Pageable pageable);

    @Query("select b from Branch b where b.id = :id and b.deletedAt is null")
    Optional<Branch> findActiveById(@Param("id") UUID id);
}
