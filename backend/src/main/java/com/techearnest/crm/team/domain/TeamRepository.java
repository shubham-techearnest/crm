package com.techearnest.crm.team.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamRepository extends JpaRepository<Team, UUID> {

    @Query(
            """
            select t from Team t
            where t.organizationId = :organizationId
              and t.deletedAt is null
              and (:search is null or lower(t.name) like lower(concat('%', cast(:search as string), '%')))
            """)
    Page<Team> search(
            @Param("organizationId") UUID organizationId, @Param("search") String search, Pageable pageable);

    @Query("select t from Team t where t.id = :id and t.deletedAt is null")
    Optional<Team> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select t from Team t
            where t.organizationId = :organizationId and t.deletedAt is null
            order by t.name
            """)
    List<Team> findAllActiveByOrganization(@Param("organizationId") UUID organizationId);
}
