package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysFieldAclRepository extends JpaRepository<SysFieldAcl, UUID> {

    List<SysFieldAcl> findByOrganizationId(UUID organizationId);

    List<SysFieldAcl> findByOrganizationIdAndRoleIdIn(UUID organizationId, Iterable<UUID> roleIds);

    Optional<SysFieldAcl> findByOrganizationIdAndRoleIdAndFieldId(
            UUID organizationId, UUID roleId, UUID fieldId);
}
