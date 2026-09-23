package com.techearnest.crm.project.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskCommentRepository extends JpaRepository<TaskComment, UUID> {

    @Query(
            """
            select c from TaskComment c
            where c.taskId = :taskId
            order by c.createdAt asc
            """)
    List<TaskComment> findByTaskId(@Param("taskId") UUID taskId);
}
