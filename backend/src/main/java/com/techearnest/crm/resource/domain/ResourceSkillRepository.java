package com.techearnest.crm.resource.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResourceSkillRepository extends JpaRepository<ResourceSkill, ResourceSkill.ResourceSkillId> {

    List<ResourceSkill> findByIdResourceId(UUID resourceId);

    @Query("select rs from ResourceSkill rs where rs.id.resourceId in :resourceIds")
    List<ResourceSkill> findByResourceIds(@Param("resourceIds") java.util.Collection<UUID> resourceIds);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ResourceSkill rs where rs.id.resourceId = :resourceId")
    void deleteByResourceId(@Param("resourceId") UUID resourceId);
}
