package com.techearnest.crm.finance.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaxRateRepository extends JpaRepository<TaxRate, UUID> {

    @Query(
            """
            select t from TaxRate t
            where t.organizationId = :organizationId
              and t.deletedAt is null
              and (:search is null
                   or lower(t.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(t.code) like lower(concat('%', cast(:search as string), '%')))
              and (:taxType is null or t.taxType = :taxType)
              and (:activeOnly = false or t.active = true)
            """)
    Page<TaxRate> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("taxType") String taxType,
            @Param("activeOnly") boolean activeOnly,
            Pageable pageable);

    @Query("select t from TaxRate t where t.id = :id and t.deletedAt is null")
    Optional<TaxRate> findActiveById(@Param("id") UUID id);

    boolean existsByOrganizationIdAndCodeAndDeletedAtIsNull(UUID organizationId, String code);
}
