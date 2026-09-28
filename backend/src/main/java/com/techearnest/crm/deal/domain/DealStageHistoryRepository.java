package com.techearnest.crm.deal.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DealStageHistoryRepository extends JpaRepository<DealStageHistory, UUID> {

    List<DealStageHistory> findByDealIdOrderByChangedAtDesc(UUID dealId);
}
