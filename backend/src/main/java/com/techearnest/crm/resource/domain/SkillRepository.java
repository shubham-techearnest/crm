package com.techearnest.crm.resource.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SkillRepository extends JpaRepository<Skill, UUID> {

    @Query("select s from Skill s where s.id = :id and s.deletedAt is null")
    Optional<Skill> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select s from Skill s
            where s.organizationId = :organizationId
              and s.deletedAt is null
              and (:search is null
                   or lower(s.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(s.category) like lower(concat('%', cast(:search as string), '%')))
              and (:name is null or lower(s.name) like lower(concat('%', cast(:name as string), '%')))
              and (:category is null
                   or lower(s.category) like lower(concat('%', cast(:category as string), '%')))
            """)
    Page<Skill> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("name") String name,
            @Param("category") String category,
            Pageable pageable);

    @Query(
            """
            select count(s) > 0 from Skill s
            where s.organizationId = :organizationId
              and lower(s.name) = lower(:name)
              and s.deletedAt is null
            """)
    boolean existsActiveByOrganizationIdAndName(
            @Param("organizationId") UUID organizationId, @Param("name") String name);
}
