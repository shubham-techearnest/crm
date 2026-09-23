package com.techearnest.crm.contact.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.contact.api.dto.ContactDtos.ContactResponse;
import com.techearnest.crm.contact.api.dto.ContactDtos.CreateContactRequest;
import com.techearnest.crm.contact.api.dto.ContactDtos.UpdateContactRequest;
import com.techearnest.crm.contact.application.ContactService;
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
@RequestMapping("/api/v1/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping
    public ApiResponse<List<ContactResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String designation,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = contactService.list(
                organizationId,
                search,
                accountId,
                status,
                ownerId,
                email,
                designation,
                PageRequest.of(page, Math.min(size, 100), Sort.by("lastName", "firstName")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ContactResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(contactService.get(id));
    }

    @PostMapping
    public ApiResponse<ContactResponse> create(@Valid @RequestBody CreateContactRequest request) {
        return ApiResponse.ok(contactService.create(request), "Contact created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<ContactResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateContactRequest request) {
        return ApiResponse.ok(contactService.update(id, request), "Contact updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        contactService.delete(id);
        return ApiResponse.ok(null, "Contact deleted successfully");
    }
}
