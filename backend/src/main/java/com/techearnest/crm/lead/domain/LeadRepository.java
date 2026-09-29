package com.techearnest.crm.lead.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, UUID>, JpaSpecificationExecutor<Lead> {

    @Query(
            """
            select l from Lead l
            where l.organizationId = :organizationId
              and l.deletedAt is null
              and (:search is null
                   or lower(l.firstName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(l.lastName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(l.companyName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(l.email) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or l.regionId in :regionIds)
              and (:ownerIds is null or l.ownerId in :ownerIds)
              and (:status is null or l.status = :status)
            """)
    Page<Lead> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds,
            @Param("status") String status,
            Pageable pageable);

    @Query(
            """
            select l from Lead l
            where l.organizationId = :organizationId
              and l.deletedAt is null
              and (:regionIds is null or l.regionId in :regionIds)
              and (:ownerIds is null or l.ownerId in :ownerIds)
            order by l.createdAt desc
            """)
    List<Lead> findAllForExport(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds);

    @Query("select l from Lead l where l.id = :id and l.deletedAt is null")
    Optional<Lead> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select l from Lead l
            where l.organizationId = :organizationId
              and l.deletedAt is null
              and (
                (cast(:email as string) is not null and lower(l.email) = lower(cast(:email as string)))
                or (cast(:companyName as string) is not null
                    and lower(l.companyName) = lower(cast(:companyName as string)))
              )
            order by l.createdAt desc
            """)
    List<Lead> findPotentialDuplicates(
            @Param("organizationId") UUID organizationId,
            @Param("email") String email,
            @Param("companyName") String companyName,
            Pageable pageable);
}
