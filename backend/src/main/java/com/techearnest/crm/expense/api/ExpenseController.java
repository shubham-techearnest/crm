package com.techearnest.crm.expense.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.CreateExpenseRequest;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.ExpenseResponse;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.QueryExpenseRequest;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.RejectExpenseRequest;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.UpdateExpenseRequest;
import com.techearnest.crm.expense.application.ExpenseService;
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
@RequestMapping("/api/v1/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    public ApiResponse<List<ExpenseResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) Boolean billable,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = expenseService.list(
                organizationId,
                search,
                status,
                category,
                projectId,
                resourceId,
                billable,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "expenseDate")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<ExpenseResponse>> query(@RequestBody(required = false) QueryExpenseRequest request) {
        var result = expenseService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ExpenseResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(expenseService.get(id));
    }

    @PostMapping
    public ApiResponse<ExpenseResponse> create(@Valid @RequestBody CreateExpenseRequest request) {
        return ApiResponse.ok(expenseService.create(request), "Expense created");
    }

    @PutMapping("/{id}")
    public ApiResponse<ExpenseResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateExpenseRequest request) {
        return ApiResponse.ok(expenseService.update(id, request), "Expense updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        expenseService.softDelete(id);
        return ApiResponse.ok(null, "Expense deleted");
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<ExpenseResponse> submit(@PathVariable UUID id) {
        return ApiResponse.ok(expenseService.submit(id), "Expense submitted");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<ExpenseResponse> approve(@PathVariable UUID id) {
        return ApiResponse.ok(expenseService.approve(id), "Expense approved");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<ExpenseResponse> reject(
            @PathVariable UUID id, @Valid @RequestBody RejectExpenseRequest request) {
        return ApiResponse.ok(expenseService.reject(id, request), "Expense rejected");
    }
}
