package com.techearnest.crm.search.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.search.api.dto.SearchDtos.SearchResponse;
import com.techearnest.crm.search.application.SearchService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public ApiResponse<SearchResponse> search(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam String q,
            @RequestParam(required = false) String types) {
        return ApiResponse.ok(searchService.search(organizationId, q, types));
    }
}
