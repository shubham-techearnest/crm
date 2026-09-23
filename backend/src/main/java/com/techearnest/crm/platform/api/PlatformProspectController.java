package com.techearnest.crm.platform.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.LinkOrganizationRequest;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.ProspectResponse;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.QueryProspectRequest;
import com.techearnest.crm.platform.api.dto.PlatformProspectDtos.UpsertProspectRequest;
import com.techearnest.crm.platform.application.PlatformProspectService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/prospects")
public class PlatformProspectController {

    private final PlatformProspectService platformProspectService;

    public PlatformProspectController(PlatformProspectService platformProspectService) {
        this.platformProspectService = platformProspectService;
    }

    @GetMapping
    public ApiResponse<List<ProspectResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String source,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = platformProspectService.query(new QueryProspectRequest(search, null, stage, source, page, size));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<ProspectResponse>> query(@RequestBody(required = false) QueryProspectRequest request) {
        var result = platformProspectService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProspectResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(platformProspectService.get(id));
    }

    @PostMapping
    public ApiResponse<ProspectResponse> create(@Valid @RequestBody UpsertProspectRequest request) {
        return ApiResponse.ok(platformProspectService.create(request), "Prospect created");
    }

    @PutMapping("/{id}")
    public ApiResponse<ProspectResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpsertProspectRequest request) {
        return ApiResponse.ok(platformProspectService.update(id, request), "Prospect updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        platformProspectService.delete(id);
        return ApiResponse.ok(null, "Prospect deleted");
    }

    @PostMapping("/{id}/link-organization")
    public ApiResponse<ProspectResponse> linkOrganization(
            @PathVariable UUID id, @Valid @RequestBody LinkOrganizationRequest request) {
        return ApiResponse.ok(
                platformProspectService.linkOrganization(id, request.organizationId()), "Prospect linked to organization");
    }
}
