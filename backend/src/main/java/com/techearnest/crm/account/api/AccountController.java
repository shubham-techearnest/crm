package com.techearnest.crm.account.api;

import com.techearnest.crm.account.api.dto.AccountDtos.AccountResponse;
import com.techearnest.crm.account.api.dto.AccountDtos.CreateAccountRequest;
import com.techearnest.crm.account.api.dto.AccountDtos.UpdateAccountRequest;
import com.techearnest.crm.account.application.AccountService;
import com.techearnest.crm.activity.api.dto.ActivityDtos.ActivityResponse;
import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.contact.api.dto.ContactDtos.ContactResponse;
import com.techearnest.crm.deal.api.dto.DealDtos.DealResponse;
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
@RequestMapping("/api/v1/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public ApiResponse<List<AccountResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String accountType,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = accountService.list(
                organizationId,
                search,
                status,
                accountType,
                industry,
                regionId,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<AccountResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(accountService.get(id));
    }

    @PostMapping
    public ApiResponse<AccountResponse> create(@Valid @RequestBody CreateAccountRequest request) {
        return ApiResponse.ok(accountService.create(request), "Account created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<AccountResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateAccountRequest request) {
        return ApiResponse.ok(accountService.update(id, request), "Account updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        accountService.delete(id);
        return ApiResponse.ok(null, "Account deleted successfully");
    }

    @PostMapping("/bulk-assign")
    public ApiResponse<com.techearnest.crm.common.bulk.BulkDtos.BulkResult> bulkAssign(
            @Valid @RequestBody com.techearnest.crm.common.bulk.BulkDtos.BulkAssignOwnerRequest request) {
        return ApiResponse.ok(accountService.bulkAssign(request), "Bulk assign completed");
    }

    @GetMapping("/{id}/contacts")
    public ApiResponse<List<ContactResponse>> contacts(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = accountService.listContacts(
                id, PageRequest.of(page, Math.min(size, 100), Sort.by("lastName")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}/deals")
    public ApiResponse<List<DealResponse>> deals(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = accountService.listDeals(
                id, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}/activities")
    public ApiResponse<List<ActivityResponse>> activities(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = accountService.listActivities(
                id, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}/projects")
    public ApiResponse<List<?>> projects(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = accountService.listProjects(id, PageRequest.of(page, Math.min(size, 100)));
        return ApiResponse.page(result.data(), result.message(), result.pagination());
    }
}
