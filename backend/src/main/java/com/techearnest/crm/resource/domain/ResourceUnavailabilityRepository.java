package com.techearnest.crm.resource.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResourceUnavailabilityRepository extends JpaRepository<ResourceUnavailability, UUID> {

    @Query("select u from ResourceUnavailability u where u.id = :id and u.deletedAt is null")
    Optional<ResourceUnavailability> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select u from ResourceUnavailability u
            where u.resourceId = :resourceId and u.deletedAt is null
            order by u.startDate desc
            """)
    List<ResourceUnavailability> findActiveByResource(@Param("resourceId") UUID resourceId);

    @Query(
            """
            select u from ResourceUnavailability u
            where u.resourceId in :resourceIds
              and u.deletedAt is null
              and u.startDate <= :periodEnd
              and u.endDate >= :periodStart
            """)
    List<ResourceUnavailability> findOverlapping(
            @Param("resourceIds") Collection<UUID> resourceIds,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);
}
