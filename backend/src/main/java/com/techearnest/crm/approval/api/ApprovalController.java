package com.techearnest.crm.approval.api;

import com.techearnest.crm.approval.api.dto.ApprovalDtos.ApprovalActionRequest;
import com.techearnest.crm.approval.api.dto.ApprovalDtos.ApprovalRequestResponse;
import com.techearnest.crm.approval.application.ApprovalService;
import com.techearnest.crm.common.api.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/approval-requests")
public class ApprovalController {

    private final ApprovalService approvalService;

    public ApprovalController(ApprovalService approvalService) {
        this.approvalService = approvalService;
    }

    @GetMapping
    public ApiResponse<List<ApprovalRequestResponse>> listMine(
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(approvalService.listMine(targetType, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<ApprovalRequestResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(approvalService.get(id));
    }

    @PostMapping("/{id}/actions")
    public ApiResponse<ApprovalRequestResponse> act(
            @PathVariable UUID id, @Valid @RequestBody ApprovalActionRequest request) {
        return ApiResponse.ok(approvalService.act(id, request), "Approval action recorded");
    }
}
