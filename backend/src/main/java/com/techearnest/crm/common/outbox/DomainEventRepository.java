package com.techearnest.crm.common.outbox;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DomainEventRepository extends JpaRepository<DomainEventRecord, UUID> {

    @Query(
            """
            select e from DomainEventRecord e
            where e.processedAt is null
              and e.availableAt <= :now
            order by e.createdAt asc
            """)
    List<DomainEventRecord> findReady(@Param("now") Instant now);
}
