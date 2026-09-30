package com.techearnest.crm.timesheet.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TimesheetLinkRepository extends JpaRepository<TimesheetLink, UUID> {

    Optional<TimesheetLink> findByTokenHash(String tokenHash);

    @Query(
            """
            select l from TimesheetLink l
            where l.resourceId = :resourceId
              and l.weekStartDate = :weekStart
              and l.revokedAt is null
              and l.expiresAt > :now
            """)
    List<TimesheetLink> findUsable(
            @Param("resourceId") UUID resourceId, @Param("weekStart") LocalDate weekStart, @Param("now") Instant now);
}
