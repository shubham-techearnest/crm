package com.techearnest.crm.platform.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlatformProspectOrgRepository
        extends JpaRepository<PlatformProspectOrg, UUID>, JpaSpecificationExecutor<PlatformProspectOrg> {

    @Query("select p from PlatformProspectOrg p where p.id = :id and p.deletedAt is null")
    Optional<PlatformProspectOrg> findActiveById(@Param("id") UUID id);
}
