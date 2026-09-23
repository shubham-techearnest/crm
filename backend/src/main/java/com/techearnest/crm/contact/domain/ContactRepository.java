package com.techearnest.crm.contact.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContactRepository extends JpaRepository<Contact, UUID> {

    @Query(
            """
            select c from Contact c
            where c.organizationId = :organizationId
              and c.deletedAt is null
              and (:search is null
                   or lower(c.firstName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(c.lastName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(c.email) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or c.regionId in :regionIds)
              and (:ownerIds is null or c.ownerId in :ownerIds)
              and (:accountId is null or c.accountId = :accountId)
              and (:status is null or c.status = :status)
              and (:ownerId is null or c.ownerId = :ownerId)
              and (:email is null or lower(c.email) like lower(concat('%', cast(:email as string), '%')))
              and (:designation is null
                   or lower(c.designation) like lower(concat('%', cast(:designation as string), '%')))
            """)
    Page<Contact> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds,
            @Param("accountId") UUID accountId,
            @Param("status") String status,
            @Param("ownerId") UUID ownerId,
            @Param("email") String email,
            @Param("designation") String designation,
            Pageable pageable);

    @Query(
            """
            select c from Contact c
            where c.accountId = :accountId
              and c.deletedAt is null
              and (:regionIds is null or c.regionId in :regionIds)
              and (:ownerIds is null or c.ownerId in :ownerIds)
            """)
    Page<Contact> findByAccount(
            @Param("accountId") UUID accountId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerIds") Collection<UUID> ownerIds,
            Pageable pageable);

    @Query("select c from Contact c where c.id = :id and c.deletedAt is null")
    Optional<Contact> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select c from Contact c
            where c.organizationId = :organizationId
              and c.accountId = :accountId
              and c.deletedAt is null
              and c.email is not null
              and lower(trim(c.email)) = lower(trim(:email))
            """)
    Optional<Contact> findActiveByAccountAndEmailIgnoreCase(
            @Param("organizationId") UUID organizationId,
            @Param("accountId") UUID accountId,
            @Param("email") String email);
}
