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

public interface ProjectTaskRepository extends JpaRepository<ProjectTask, UUID> {

    @Query(
            """
            select t from ProjectTask t
            where t.projectId = :projectId
              and t.deletedAt is null
            order by t.createdAt asc
            """)
    List<ProjectTask> findByProjectId(@Param("projectId") UUID projectId);

    @Query(
            """
            select t from ProjectTask t
            join Project p on p.id = t.projectId
            where t.organizationId = :organizationId
              and t.deletedAt is null
              and p.deletedAt is null
              and (:regionIds is null or p.regionId in :regionIds)
              and (:managerIds is null or p.projectManagerId in :managerIds)
              and (:projectId is null or t.projectId = :projectId)
              and (:status is null or t.status = :status)
              and (:assignedResourceId is null or t.assignedResourceId = :assignedResourceId)
              and (:priority is null or t.priority = :priority)
              and (:dueFrom is null or t.dueDate >= :dueFrom)
              and (:dueTo is null or t.dueDate <= :dueTo)
            """)
    Page<ProjectTask> search(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("managerIds") Collection<UUID> managerIds,
            @Param("projectId") UUID projectId,
            @Param("status") String status,
            @Param("assignedResourceId") UUID assignedResourceId,
            @Param("priority") String priority,
            @Param("dueFrom") java.time.LocalDate dueFrom,
            @Param("dueTo") java.time.LocalDate dueTo,
            Pageable pageable);

    @Query(
            """
            select t from ProjectTask t
            where t.parentTaskId = :parentTaskId
              and t.deletedAt is null
            """)
    List<ProjectTask> findByParentTaskId(@Param("parentTaskId") UUID parentTaskId);

    @Query("select t from ProjectTask t where t.id = :id and t.deletedAt is null")
    Optional<ProjectTask> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select t from ProjectTask t
            where t.organizationId = :organizationId
              and t.assignedResourceId = :resourceId
              and t.deletedAt is null
            order by t.createdAt desc
            """)
    List<ProjectTask> findByAssignedResource(
            @Param("organizationId") UUID organizationId, @Param("resourceId") UUID resourceId);
}
