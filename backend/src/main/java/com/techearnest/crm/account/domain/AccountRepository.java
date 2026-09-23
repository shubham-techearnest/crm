package com.techearnest.crm.account.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    @Query(
            """
            select a from Account a
            where a.organizationId = :organizationId
              and a.deletedAt is null
              and (:search is null
                   or lower(a.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(a.email) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or a.regionId in :regionIds)
              and (:ownerIds is null or a.ownerId in :ownerIds)
              and (:status is null or a.status = :status)
              and (:accountType is null or a.accountType = :accountType)
              and (:industry is null
                   or lower(a.industry) like lower(concat('%', cast(:industry as string), '%')))
              and (:regionId is null or a.regionId = :regionId)
            """)
    Page<Account> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds,
            @Param("status") String status,
            @Param("accountType") String accountType,
            @Param("industry") String industry,
            @Param("regionId") UUID regionId,
            Pageable pageable);

    @Query("select a from Account a where a.id = :id and a.deletedAt is null")
    Optional<Account> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select a from Account a
            where a.organizationId = :organizationId
              and a.deletedAt is null
              and lower(trim(a.name)) = lower(trim(:name))
            order by a.createdAt asc
            """)
    List<Account> findActiveByOrganizationIdAndNameIgnoreCase(
            @Param("organizationId") UUID organizationId, @Param("name") String name);

    @Query(
            """
            select a from Account a
            where a.organizationId = :organizationId
              and a.deletedAt is null
              and a.email is not null
              and lower(trim(a.email)) = lower(trim(:email))
            order by a.createdAt asc
            """)
    List<Account> findActiveByOrganizationIdAndEmailIgnoreCase(
            @Param("organizationId") UUID organizationId, @Param("email") String email);
}
