package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysTableAclRepository extends JpaRepository<SysTableAcl, UUID> {

    List<SysTableAcl> findByOrganizationId(UUID organizationId);

    List<SysTableAcl> findByOrganizationIdAndRoleId(UUID organizationId, UUID roleId);

    Optional<SysTableAcl> findByOrganizationIdAndRoleIdAndTableId(
            UUID organizationId, UUID roleId, UUID tableId);

    long countByOrganizationIdAndRoleIdAndCanUpdateTrue(UUID organizationId, UUID roleId);
}
