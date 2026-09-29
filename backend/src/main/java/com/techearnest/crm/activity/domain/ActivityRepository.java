package com.techearnest.crm.activity.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    @Query(
            """
            select a from Activity a
            where a.organizationId = :organizationId
              and a.deletedAt is null
              and (:regionIds is null or a.regionId is null or a.regionId in :regionIds)
              and (:assignedToIds is null or a.assignedTo in :assignedToIds)
              and (:relatedEntityType is null or a.relatedEntityType = :relatedEntityType)
              and (:relatedEntityId is null or a.relatedEntityId = :relatedEntityId)
              and (:type is null or a.type = :type)
              and (:status is null or a.status = :status)
              and (:outcome is null or a.outcome = :outcome)
              and (:callDirection is null or a.callDirection = :callDirection)
              and (cast(:dueFrom as timestamp) is null or a.dueDate >= :dueFrom)
              and (cast(:dueTo as timestamp) is null or a.dueDate <= :dueTo)
            """)
    Page<Activity> search(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("assignedToIds") Collection<UUID> assignedToIds,
            @Param("relatedEntityType") String relatedEntityType,
            @Param("relatedEntityId") UUID relatedEntityId,
            @Param("type") String type,
            @Param("status") String status,
            @Param("outcome") String outcome,
            @Param("callDirection") String callDirection,
            @Param("dueFrom") java.time.Instant dueFrom,
            @Param("dueTo") java.time.Instant dueTo,
            Pageable pageable);

    @Query(
            """
            select a from Activity a
            where a.organizationId = :organizationId
              and a.deletedAt is null
              and a.relatedEntityType = :relatedEntityType
              and a.relatedEntityId = :relatedEntityId
              and (:regionIds is null or a.regionId is null or a.regionId in :regionIds)
              and (:assignedToIds is null or a.assignedTo in :assignedToIds)
            """)
    Page<Activity> findRelated(
            @Param("organizationId") UUID organizationId,
            @Param("relatedEntityType") String relatedEntityType,
            @Param("relatedEntityId") UUID relatedEntityId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("assignedToIds") Collection<UUID> assignedToIds,
            Pageable pageable);

    @Query("select a from Activity a where a.id = :id and a.deletedAt is null")
    Optional<Activity> findActiveById(@Param("id") UUID id);
}
