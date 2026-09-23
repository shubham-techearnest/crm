package com.techearnest.crm.note.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    @Query(
            """
            select n from Note n
            where n.organizationId = :organizationId
              and n.entityType = :entityType
              and n.entityId = :entityId
              and n.deletedAt is null
            order by n.createdAt desc
            """)
    List<Note> findByEntity(
            @Param("organizationId") UUID organizationId,
            @Param("entityType") String entityType,
            @Param("entityId") UUID entityId);

    @Query("select n from Note n where n.id = :id and n.deletedAt is null")
    Optional<Note> findActiveById(@Param("id") UUID id);
}
