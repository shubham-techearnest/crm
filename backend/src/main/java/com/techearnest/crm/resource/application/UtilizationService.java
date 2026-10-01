package com.techearnest.crm.resource.application;

import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UtilizationResponse;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceMetrics;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UtilizationService {

    private final ResourceService resourceService;
    private final ResourceAllocationRepository allocationRepository;
    private final TenantAccess tenantAccess;

    public UtilizationService(
            ResourceService resourceService,
            ResourceAllocationRepository allocationRepository,
            TenantAccess tenantAccess) {
        this.resourceService = resourceService;
        this.allocationRepository = allocationRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional(readOnly = true)
    public UtilizationResponse getUtilization(UUID resourceId, LocalDate periodStart, LocalDate periodEnd) {
        tenantAccess.requirePermission("ALLOCATION_VIEW");
        Resource resource = resourceService.requireVisibleResource(resourceId);
        LocalDate start = periodStart;
        LocalDate end = periodEnd;
        if (start == null || end == null) {
            YearMonth month = YearMonth.now();
            start = month.atDay(1);
            end = month.atEndOfMonth();
        }
        if (end.isBefore(start)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return compute(resource, start, end, null, null);
    }

    /**
     * Computes utilization for a period. When {@code candidate} is provided it is included in the
     * totals (create/update dry-run or validation). When {@code excludeAllocationId} is set, that
     * existing allocation is omitted (so an update candidate can replace it).
     */
    public UtilizationResponse compute(
            Resource resource,
            LocalDate periodStart,
            LocalDate periodEnd,
            ResourceAllocation candidate,
            UUID excludeAllocationId) {
        BigDecimal capacityHours = ResourceMetrics.capacityForDays(
                resource.getCapacityHoursPerWeek(), ResourceMetrics.inclusiveDays(periodStart, periodEnd));

        List<ResourceAllocation> overlapping = allocationRepository.findOverlappingForUtilization(
                resource.getId(), periodStart, periodEnd);

        BigDecimal allocatedHours = BigDecimal.ZERO;
        for (ResourceAllocation allocation : overlapping) {
            if (excludeAllocationId != null && excludeAllocationId.equals(allocation.getId())) {
                continue;
            }
            allocatedHours = allocatedHours.add(ResourceMetrics.allocatedHoursInPeriod(
                    allocation, resource.getCapacityHoursPerWeek(), periodStart, periodEnd));
        }
        if (candidate != null
                && !"CANCELLED".equals(candidate.getStatus())
                && !"COMPLETED".equals(candidate.getStatus())
                && ResourceMetrics.overlaps(candidate.getStartDate(), candidate.getEndDate(), periodStart, periodEnd)) {
            allocatedHours = allocatedHours.add(ResourceMetrics.allocatedHoursInPeriod(
                    candidate, resource.getCapacityHoursPerWeek(), periodStart, periodEnd));
        }

        allocatedHours = allocatedHours.setScale(2, RoundingMode.HALF_UP);
        capacityHours = capacityHours.setScale(2, RoundingMode.HALF_UP);
        BigDecimal availableHours = capacityHours.subtract(allocatedHours);
        BigDecimal utilizationPercent = capacityHours.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : allocatedHours
                        .multiply(BigDecimal.valueOf(100))
                        .divide(capacityHours, 2, RoundingMode.HALF_UP);
        boolean overAllocated = allocatedHours.compareTo(capacityHours) > 0;
        return new UtilizationResponse(
                resource.getId(),
                periodStart,
                periodEnd,
                capacityHours,
                allocatedHours,
                availableHours,
                utilizationPercent,
                overAllocated,
                overAllocated ? "OVER_ALLOCATED" : null);
    }

}
