package com.techearnest.crm.resource.application;

import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.AllocationResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.OnboardResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.OnboardResourceResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalAccessResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalInviteRequest;
import com.techearnest.crm.resource.domain.Resource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** One-step onboarding: create the resource, put it on a project and give it the access it needs to log time. */
@Service
public class ResourceOnboardingService {

    private static final BigDecimal FULL_TIME = new BigDecimal("100");

    private final ResourceService resourceService;
    private final AllocationService allocationService;
    private final ResourcePortalService portalService;
    private final ProjectRepository projectRepository;

    public ResourceOnboardingService(
            ResourceService resourceService,
            AllocationService allocationService,
            ResourcePortalService portalService,
            ProjectRepository projectRepository) {
        this.resourceService = resourceService;
        this.allocationService = allocationService;
        this.portalService = portalService;
        this.projectRepository = projectRepository;
    }

    @Transactional
    public OnboardResourceResponse onboard(OnboardResourceRequest request) {
        ResourceResponse resource = resourceService.create(request.resource());
        List<String> warnings = new ArrayList<>();

        AllocationResponse allocation = null;
        if (request.projectId() != null) {
            Project project = projectRepository
                    .findActiveById(request.projectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            LocalDate start = request.allocationStartDate() != null ? request.allocationStartDate() : LocalDate.now();
            LocalDate end = firstNonNull(
                    request.allocationEndDate(), project.getEndDate(), resource.engagementEndDate());
            if (end == null || end.isBefore(start)) {
                end = start.plusMonths(3);
                warnings.add("The project has no end date, so the allocation runs for 3 months until " + end + ".");
            }
            var result = allocationService.create(new CreateAllocationRequest(
                    resource.organizationId(),
                    project.getId(),
                    resource.id(),
                    start,
                    end,
                    null,
                    request.allocationPercentage() != null ? request.allocationPercentage() : FULL_TIME,
                    blankToNull(request.allocationRole()),
                    null,
                    null,
                    start.isAfter(LocalDate.now()) ? "PLANNED" : "ACTIVE",
                    false));
            allocation = result.data();
            if (result.message() != null && !result.message().isBlank()) {
                warnings.add(result.message());
            }
        }

        PortalAccessResponse portalAccess = null;
        boolean external = !Resource.TYPE_EMPLOYEE.equals(resource.resourceType());
        if (external && !Boolean.FALSE.equals(request.grantPortalAccess()) && resource.userId() == null) {
            if (resource.email() == null || resource.email().isBlank()) {
                warnings.add("No email on the resource, so no portal login was sent. Add an email and invite them"
                        + " from the Portal & timesheets tab.");
            } else {
                portalAccess = portalService.invite(resource.id(), new PortalInviteRequest(null, null));
            }
        }
        return new OnboardResourceResponse(resource, allocation, portalAccess, warnings);
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
