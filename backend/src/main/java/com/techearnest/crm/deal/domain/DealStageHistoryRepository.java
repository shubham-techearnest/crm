package com.techearnest.crm.deal.domain;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DealStageHistoryRepository extends JpaRepository<DealStageHistory, UUID> {}
