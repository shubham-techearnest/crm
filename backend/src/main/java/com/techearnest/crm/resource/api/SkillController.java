package com.techearnest.crm.resource.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateSkillRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.SkillResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateSkillRequest;
import com.techearnest.crm.resource.application.SkillService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
@RequestMapping("/api/v1/skills")
public class SkillController {

    private final SkillService skillService;

    public SkillController(SkillService skillService) {
        this.skillService = skillService;
    }

    @GetMapping
    public ApiResponse<List<SkillResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = skillService.list(
                organizationId,
                search,
                name,
                category,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.ASC, "name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<SkillResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(skillService.get(id));
    }

    @PostMapping
    public ApiResponse<SkillResponse> create(@Valid @RequestBody CreateSkillRequest request) {
        return ApiResponse.ok(skillService.create(request), "Skill created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<SkillResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateSkillRequest request) {
        return ApiResponse.ok(skillService.update(id, request), "Skill updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        skillService.softDelete(id);
        return ApiResponse.ok(null, "Skill deleted successfully");
    }
}
