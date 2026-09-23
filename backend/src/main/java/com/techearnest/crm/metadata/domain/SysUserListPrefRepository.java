package com.techearnest.crm.metadata.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysUserListPrefRepository extends JpaRepository<SysUserListPref, UUID> {
    Optional<SysUserListPref> findByOrganizationIdAndUserIdAndTableCode(
            UUID organizationId, UUID userId, String tableCode);
}
