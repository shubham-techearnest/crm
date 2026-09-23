package com.techearnest.crm.view.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SavedViewRepository extends JpaRepository<SavedView, UUID> {

    @Query(
            """
            select v from SavedView v
            where v.organizationId = :organizationId
              and v.module = :module
              and v.deletedAt is null
              and (v.ownerId = :ownerId
                   or v.visibility = 'PUBLIC'
                   or (v.visibility = 'SHARED' and :ownerId is not null))
            order by v.isDefault desc, v.name asc
            """)
    List<SavedView> findVisible(
            @Param("organizationId") UUID organizationId,
            @Param("module") String module,
            @Param("ownerId") UUID ownerId);

    @Query("select v from SavedView v where v.id = :id and v.deletedAt is null")
    Optional<SavedView> findActiveById(@Param("id") UUID id);
}
