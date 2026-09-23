package com.techearnest.crm.search.api.dto;

import java.util.List;
import java.util.UUID;

public final class SearchDtos {

    private SearchDtos() {}

    public record SearchHit(String type, UUID id, String title, String subtitle) {}

    public record SearchResponse(String query, List<SearchHit> results) {}
}
