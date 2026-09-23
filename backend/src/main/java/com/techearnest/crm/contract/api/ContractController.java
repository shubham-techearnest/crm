package com.techearnest.crm.contract.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.contract.api.dto.ContractDtos.ContractResponse;
import com.techearnest.crm.contract.api.dto.ContractDtos.CreateContractRequest;
import com.techearnest.crm.contract.api.dto.ContractDtos.QueryContractRequest;
import com.techearnest.crm.contract.api.dto.ContractDtos.UpdateContractRequest;
import com.techearnest.crm.contract.application.ContractService;
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
@RequestMapping("/api/v1/contracts")
public class ContractController {

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    @GetMapping
    public ApiResponse<List<ContractResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) Boolean autoRenew,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = contractService.list(
                organizationId,
                search,
                status,
                accountId,
                autoRenew,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<ContractResponse>> query(@RequestBody(required = false) QueryContractRequest request) {
        var result = contractService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ContractResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(contractService.get(id));
    }

    @PostMapping
    public ApiResponse<ContractResponse> create(@Valid @RequestBody CreateContractRequest request) {
        return ApiResponse.ok(contractService.create(request), "Contract created");
    }

    @PutMapping("/{id}")
    public ApiResponse<ContractResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateContractRequest request) {
        return ApiResponse.ok(contractService.update(id, request), "Contract updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        contractService.softDelete(id);
        return ApiResponse.ok(null, "Contract deleted");
    }
}
