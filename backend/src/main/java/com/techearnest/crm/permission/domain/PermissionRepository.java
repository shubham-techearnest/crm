package com.techearnest.crm.permission.domain;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    @Query("select p from Permission p order by p.module, p.code")
    List<Permission> findAllOrdered();

    @Query("select p from Permission p where p.code in :codes")
    List<Permission> findByCodeIn(@Param("codes") Collection<String> codes);
}
