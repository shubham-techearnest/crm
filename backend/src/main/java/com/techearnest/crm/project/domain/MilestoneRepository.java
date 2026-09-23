package com.techearnest.crm.project.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID> {

    @Query(
            """
            select m from Milestone m
            where m.projectId = :projectId
              and m.deletedAt is null
            order by m.sortOrder asc, m.createdAt asc
            """)
    List<Milestone> findByProjectId(@Param("projectId") UUID projectId);

    @Query(
            """
            select m from Milestone m
            join Project p on p.id = m.projectId
            where m.organizationId = :organizationId
              and m.deletedAt is null
              and p.deletedAt is null
              and (:regionIds is null or p.regionId in :regionIds)
              and (:managerIds is null or p.projectManagerId in :managerIds)
              and (:projectId is null or m.projectId = :projectId)
              and (:status is null or m.status = :status)
              and (:dueFrom is null or m.dueDate >= :dueFrom)
              and (:dueTo is null or m.dueDate <= :dueTo)
            """)
    Page<Milestone> search(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("managerIds") Collection<UUID> managerIds,
            @Param("projectId") UUID projectId,
            @Param("status") String status,
            @Param("dueFrom") java.time.LocalDate dueFrom,
            @Param("dueTo") java.time.LocalDate dueTo,
            Pageable pageable);

    @Query("select m from Milestone m where m.id = :id and m.deletedAt is null")
    Optional<Milestone> findActiveById(@Param("id") UUID id);
}
