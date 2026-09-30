package com.techearnest.crm.auth.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserInviteTokenRepository extends JpaRepository<UserInviteToken, UUID> {

    Optional<UserInviteToken> findByTokenHash(String tokenHash);

    @Query(
            """
            select t from UserInviteToken t
            where t.userId = :userId and t.acceptedAt is null and t.revokedAt is null
            """)
    List<UserInviteToken> findOpenByUserId(@Param("userId") UUID userId);
}
