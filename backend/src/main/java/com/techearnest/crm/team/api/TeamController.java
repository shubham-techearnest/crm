package com.techearnest.crm.team.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.team.api.dto.TeamDtos.CreateTeamRequest;
import com.techearnest.crm.team.api.dto.TeamDtos.TeamResponse;
import com.techearnest.crm.team.api.dto.TeamDtos.UpdateTeamRequest;
import com.techearnest.crm.team.application.TeamService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/teams")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @GetMapping
    public ApiResponse<List<TeamResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result =
                teamService.list(organizationId, search, PageRequest.of(page, Math.min(size, 100), Sort.by("name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<TeamResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(teamService.get(id));
    }

    @PostMapping
    public ApiResponse<TeamResponse> create(@Valid @RequestBody CreateTeamRequest request) {
        return ApiResponse.ok(teamService.create(request), "Team created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<TeamResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateTeamRequest request) {
        return ApiResponse.ok(teamService.update(id, request), "Team updated successfully");
    }
}
