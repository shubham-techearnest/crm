package com.techearnest.crm.metadata.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CustomFieldSchemaResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CustomFieldValuesQuery;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CustomFieldValuesResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveCustomFieldValuesRequest;
import com.techearnest.crm.metadata.application.CustomFieldService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/custom-fields/{tableCode}")
public class CustomFieldController {

    private final CustomFieldService customFieldService;

    public CustomFieldController(CustomFieldService customFieldService) {
        this.customFieldService = customFieldService;
    }

    @GetMapping("/schema")
    public ApiResponse<CustomFieldSchemaResponse> schema(
            @PathVariable String tableCode, @RequestParam(defaultValue = "CREATE") String layoutKey) {
        return ApiResponse.ok(customFieldService.schema(tableCode, layoutKey));
    }

    @GetMapping("/records/{recordId}")
    public ApiResponse<CustomFieldValuesResponse> values(@PathVariable String tableCode, @PathVariable UUID recordId) {
        return ApiResponse.ok(new CustomFieldValuesResponse(recordId, customFieldService.values(tableCode, recordId)));
    }

    @PutMapping("/records/{recordId}")
    public ApiResponse<CustomFieldValuesResponse> save(
            @PathVariable String tableCode,
            @PathVariable UUID recordId,
            @Valid @RequestBody SaveCustomFieldValuesRequest request) {
        Map<String, Object> saved = customFieldService.save(tableCode, recordId, request.values());
        return ApiResponse.ok(new CustomFieldValuesResponse(recordId, saved), "Custom fields saved");
    }

    @PostMapping("/records/query")
    public ApiResponse<List<CustomFieldValuesResponse>> query(
            @PathVariable String tableCode, @Valid @RequestBody CustomFieldValuesQuery request) {
        return ApiResponse.ok(customFieldService.valuesFor(tableCode, request.recordIds()).entrySet().stream()
                .map(entry -> new CustomFieldValuesResponse(entry.getKey(), entry.getValue()))
                .toList());
    }
}
