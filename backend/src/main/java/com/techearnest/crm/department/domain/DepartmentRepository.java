package com.techearnest.crm.department.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {

    @Query(
            """
            select d from Department d
            where d.organizationId = :organizationId
              and d.deletedAt is null
              and (:search is null or lower(d.name) like lower(concat('%', cast(:search as string), '%')))
            """)
    Page<Department> search(
            @Param("organizationId") UUID organizationId, @Param("search") String search, Pageable pageable);

    @Query("select d from Department d where d.id = :id and d.deletedAt is null")
    Optional<Department> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select d from Department d
            where d.organizationId = :organizationId and d.deletedAt is null
            order by d.name
            """)
    List<Department> findAllActiveByOrganization(@Param("organizationId") UUID organizationId);
}
