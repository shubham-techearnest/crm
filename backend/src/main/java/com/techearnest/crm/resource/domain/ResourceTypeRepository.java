package com.techearnest.crm.resource.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ResourceTypeRepository extends JpaRepository<ResourceType, String> {

    @Query("select t from ResourceType t order by t.sortOrder asc, t.name asc")
    List<ResourceType> findAllOrdered();
}
