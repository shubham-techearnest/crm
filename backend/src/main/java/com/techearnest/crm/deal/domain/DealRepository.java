package com.techearnest.crm.deal.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DealRepository extends JpaRepository<Deal, UUID> {

    @Query(
            """
            select d from Deal d
            where d.organizationId = :organizationId
              and d.deletedAt is null
              and (:search is null or lower(d.name) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or d.regionId in :regionIds)
              and (:ownerIds is null or d.ownerId in :ownerIds)
              and (:accountId is null or d.accountId = :accountId)
              and (:stage is null or d.stage = :stage)
              and (:ownerId is null or d.ownerId = :ownerId)
              and (:minValue is null or d.value >= :minValue)
              and (:closeFrom is null or d.expectedCloseDate >= :closeFrom)
              and (:closeTo is null or d.expectedCloseDate <= :closeTo)
            """)
    Page<Deal> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds,
            @Param("accountId") UUID accountId,
            @Param("stage") String stage,
            @Param("ownerId") UUID ownerId,
            @Param("minValue") java.math.BigDecimal minValue,
            @Param("closeFrom") java.time.LocalDate closeFrom,
            @Param("closeTo") java.time.LocalDate closeTo,
            Pageable pageable);

    @Query(
            """
            select d from Deal d
            where d.organizationId = :organizationId
              and d.deletedAt is null
              and (:regionIds is null or d.regionId in :regionIds)
              and (:ownerIds is null or d.ownerId in :ownerIds)
            order by d.stage, d.createdAt desc
            """)
    List<Deal> findForPipeline(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds);

    @Query(
            """
            select d from Deal d
            where d.accountId = :accountId
              and d.deletedAt is null
              and (:regionIds is null or d.regionId in :regionIds)
              and (:ownerIds is null or d.ownerId in :ownerIds)
            """)
    Page<Deal> findByAccount(
            @Param("accountId") UUID accountId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds,
            Pageable pageable);

    @Query("select d from Deal d where d.id = :id and d.deletedAt is null")
    Optional<Deal> findActiveById(@Param("id") UUID id);
}
