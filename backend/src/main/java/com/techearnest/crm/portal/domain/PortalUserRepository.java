package com.techearnest.crm.portal.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PortalUserRepository extends JpaRepository<PortalUser, UUID> {

    @Query(
            """
            select p from PortalUser p
            where lower(p.email) = lower(:email)
              and p.deletedAt is null
            """)
    Optional<PortalUser> findByEmailForLogin(@Param("email") String email);

    @Query("select p from PortalUser p where p.id = :id and p.deletedAt is null")
    Optional<PortalUser> findActiveById(@Param("id") UUID id);
}
