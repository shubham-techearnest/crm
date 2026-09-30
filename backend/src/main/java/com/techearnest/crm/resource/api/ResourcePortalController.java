package com.techearnest.crm.resource.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.AcceptInviteRequest;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.AcceptInviteResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.InvitePreview;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalAccessRequest;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalAccessResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalInviteRequest;
import com.techearnest.crm.resource.application.ResourcePortalService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ResourcePortalController {

    private final ResourcePortalService portalService;

    public ResourcePortalController(ResourcePortalService portalService) {
        this.portalService = portalService;
    }

    @GetMapping("/resources/{id}/portal-access")
    public ApiResponse<PortalAccessResponse> status(@PathVariable UUID id) {
        return ApiResponse.ok(portalService.status(id));
    }

    @PostMapping("/resources/{id}/portal-access")
    public ApiResponse<PortalAccessResponse> invite(
            @PathVariable UUID id, @Valid @RequestBody(required = false) PortalInviteRequest request) {
        return ApiResponse.ok(
                portalService.invite(id, request != null ? request : new PortalInviteRequest(null, null)),
                "Invitation sent");
    }

    @PutMapping("/resources/{id}/portal-access")
    public ApiResponse<PortalAccessResponse> updateAccess(
            @PathVariable UUID id, @Valid @RequestBody PortalAccessRequest request) {
        return ApiResponse.ok(portalService.updateAccess(id, request.accessExpiresOn()), "Access updated");
    }

    @DeleteMapping("/resources/{id}/portal-access")
    public ApiResponse<PortalAccessResponse> revoke(@PathVariable UUID id) {
        return ApiResponse.ok(portalService.revoke(id), "Access revoked");
    }

    /** Public: authenticated by the invitation token itself. */
    @GetMapping("/public/invites/{token}")
    public ApiResponse<InvitePreview> preview(@PathVariable String token) {
        return ApiResponse.ok(portalService.preview(token));
    }

    /** Public: authenticated by the invitation token itself. */
    @PostMapping("/public/invites/{token}/accept")
    public ApiResponse<AcceptInviteResponse> accept(
            @PathVariable String token, @Valid @RequestBody AcceptInviteRequest request) {
        return ApiResponse.ok(portalService.accept(token, request), "Password set. You can sign in now.");
    }
}
