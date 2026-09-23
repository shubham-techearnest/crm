package com.techearnest.crm.project.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskDependencyRepository extends JpaRepository<TaskDependency, UUID> {

    List<TaskDependency> findBySuccessorTaskId(UUID successorTaskId);

    boolean existsByPredecessorTaskIdAndSuccessorTaskId(UUID predecessorTaskId, UUID successorTaskId);

    Optional<TaskDependency> findById(UUID id);
}
