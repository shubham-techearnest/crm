package com.techearnest.crm.user.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    @Query(
            """
            select distinct u from User u
            left join fetch u.roles r
            left join fetch r.permissions
            where lower(u.email) = lower(:email)
              and u.deletedAt is null
            """)
    Optional<User> findByEmailForLogin(@Param("email") String email);

    @Query(
            """
            select distinct u from User u
            left join fetch u.assignedRegions
            where u.id = :id
            """)
    Optional<User> findWithRegions(@Param("id") UUID id);

    @Query(
            """
            select distinct u from User u
            left join fetch u.roles
            left join fetch u.assignedRegions
            where u.id = :id and u.deletedAt is null
            """)
    Optional<User> findActiveDetailsById(@Param("id") UUID id);

    @Query(
            """
            select u from User u
            where u.organizationId = :organizationId
              and u.deletedAt is null
              and (:search is null
                   or lower(u.email) like lower(concat('%', cast(:search as string), '%'))
                   or lower(u.firstName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(u.lastName) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or u.regionId in :regionIds)
            """)
    Page<User> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            Pageable pageable);

    @Query(
            """
            select count(u) > 0 from User u
            where lower(u.email) = lower(:email)
              and u.deletedAt is null
              and (:organizationId is null and u.organizationId is null
                   or u.organizationId = :organizationId)
            """)
    boolean existsActiveEmailInOrg(@Param("organizationId") UUID organizationId, @Param("email") String email);

    @Query(
            """
            select distinct u from User u
            left join fetch u.roles
            left join fetch u.assignedRegions
            where u.id in :ids and u.deletedAt is null
            """)
    List<User> findActiveDetailsByIds(@Param("ids") Collection<UUID> ids);

    @Query(
            """
            select u.id from User u
            where u.teamId = :teamId
              and u.deletedAt is null
              and u.status = 'ACTIVE'
            """)
    List<UUID> findActiveIdsByTeamId(@Param("teamId") UUID teamId);

    @Query(
            """
            select u.id from User u
            where u.managerId = :managerId
              and u.deletedAt is null
              and u.status = 'ACTIVE'
            """)
    List<UUID> findActiveIdsByManagerId(@Param("managerId") UUID managerId);

    @Query(
            """
            select count(u) from User u
            where u.deletedAt is null
              and u.status = 'ACTIVE'
              and u.organizationId is not null
            """)
    long countActiveTenantUsers();

    long countByOrganizationIdAndDeletedAtIsNull(UUID organizationId);
}
