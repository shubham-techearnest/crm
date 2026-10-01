package com.techearnest.crm.resource.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.TreeSet;

/**
 * The single place for resource formulas: allocation bands, availability, capacity, utilization, rate conversion,
 * cost, revenue and margin. Pure functions over domain values so every screen, report and API agrees.
 */
public final class ResourceMetrics {

    public static final String BAND_BENCH = "BENCH";
    public static final String BAND_PARTIAL = "PARTIALLY_ALLOCATED";
    public static final String BAND_FULL = "FULLY_ALLOCATED";
    public static final String BAND_OVER = "OVERALLOCATED";

    public static final String STATUS_BENCH = "BENCH";
    public static final String STATUS_PARTIAL = "PARTIALLY_ALLOCATED";
    public static final String STATUS_FULL = "FULLY_ALLOCATED";
    public static final String STATUS_OVER = "OVERALLOCATED";
    public static final String STATUS_ENDING_SOON = "ENDING_SOON";
    public static final String STATUS_ON_LEAVE = "ON_LEAVE";
    public static final String STATUS_UNAVAILABLE = "UNAVAILABLE";
    public static final String STATUS_INACTIVE = "INACTIVE";
    public static final String STATUS_CONTRACT_EXPIRED = "CONTRACT_EXPIRED";
    public static final String STATUS_TERMINATED = "TERMINATED";
    public static final String STATUS_NOT_STARTED = "NOT_STARTED";

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal SEVEN = BigDecimal.valueOf(7);
    private static final BigDecimal WEEKS_PER_MONTH = new BigDecimal("4.3333");
    private static final int SCALE = 4;

    private ResourceMetrics() {}

    public record Thresholds(int endingSoonDays, BigDecimal benchMaxPct, BigDecimal fullPct, BigDecimal overPct) {

        public static Thresholds of(ResourceBoardSettings settings) {
            return new Thresholds(
                    settings.getEndingSoonDays(),
                    settings.getBenchMaxAllocationPct(),
                    settings.getFullAllocationPct(),
                    settings.getOverallocationPct());
        }

        public static Thresholds defaults() {
            return new Thresholds(
                    ResourceBoardSettings.DEFAULT_ENDING_SOON_DAYS,
                    ResourceBoardSettings.DEFAULT_BENCH_MAX_PCT,
                    ResourceBoardSettings.DEFAULT_FULL_PCT,
                    ResourceBoardSettings.DEFAULT_OVER_PCT);
        }
    }

    /** Everything the board needs to know about one resource at one point in time. */
    public record Classification(
            String status,
            String band,
            BigDecimal currentAllocationPct,
            BigDecimal futureAllocationPct,
            boolean available,
            boolean endingSoon,
            boolean onLeave,
            boolean engagementEndingSoon,
            LocalDate currentAllocationEndsOn,
            LocalDate availableFrom,
            BigDecimal availableFromCapacityPct,
            LocalDate nextAllocationStartsOn,
            int activeProjectCount) {}

    // ---------------------------------------------------------------- allocation bands

    public static String band(BigDecimal totalPct, Thresholds thresholds) {
        BigDecimal pct = nz(totalPct);
        if (pct.compareTo(thresholds.overPct()) > 0) {
            return BAND_OVER;
        }
        if (pct.compareTo(thresholds.fullPct()) >= 0) {
            return BAND_FULL;
        }
        if (pct.compareTo(thresholds.benchMaxPct()) <= 0) {
            return BAND_BENCH;
        }
        return BAND_PARTIAL;
    }

    /** Allocation share of weekly capacity; derived from allocated hours when no percentage was entered. */
    public static BigDecimal effectivePercentage(ResourceAllocation allocation, BigDecimal capacityHoursPerWeek) {
        if (allocation.getAllocationPercentage() != null) {
            return allocation.getAllocationPercentage();
        }
        if (allocation.getAllocatedHours() == null || nz(capacityHoursPerWeek).signum() == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal weeks = BigDecimal.valueOf(inclusiveDays(allocation.getStartDate(), allocation.getEndDate()))
                .divide(SEVEN, SCALE, RoundingMode.HALF_UP);
        if (weeks.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return allocation.getAllocatedHours()
                .multiply(HUNDRED)
                .divide(weeks.multiply(capacityHoursPerWeek), 2, RoundingMode.HALF_UP);
    }

    public static BigDecimal hoursPerWeek(ResourceAllocation allocation, BigDecimal capacityHoursPerWeek) {
        return effectivePercentage(allocation, capacityHoursPerWeek)
                .multiply(nz(capacityHoursPerWeek))
                .divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }

    /** Sum of open allocation percentages covering {@code date}. */
    public static BigDecimal allocationPctOn(
            Collection<ResourceAllocation> allocations, BigDecimal capacityHoursPerWeek, LocalDate date) {
        BigDecimal total = BigDecimal.ZERO;
        for (ResourceAllocation allocation : allocations) {
            if (allocation.isOpen() && allocation.covers(date)) {
                total = total.add(effectivePercentage(allocation, capacityHoursPerWeek));
            }
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    /** Hours of an allocation that fall inside a period, prorated by calendar days. */
    public static BigDecimal allocatedHoursInPeriod(
            ResourceAllocation allocation, BigDecimal capacityHoursPerWeek, LocalDate periodStart, LocalDate periodEnd) {
        LocalDate overlapStart = max(allocation.getStartDate(), periodStart);
        LocalDate overlapEnd = min(allocation.getEndDate(), periodEnd);
        long overlapDays = inclusiveDays(overlapStart, overlapEnd);
        if (overlapDays <= 0) {
            return BigDecimal.ZERO;
        }
        if (allocation.getAllocatedHours() != null) {
            long allocationDays = inclusiveDays(allocation.getStartDate(), allocation.getEndDate());
            return allocation.getAllocatedHours()
                    .multiply(BigDecimal.valueOf(overlapDays))
                    .divide(BigDecimal.valueOf(allocationDays), SCALE, RoundingMode.HALF_UP);
        }
        if (allocation.getAllocationPercentage() != null) {
            return allocation.getAllocationPercentage()
                    .multiply(capacityForDays(capacityHoursPerWeek, overlapDays))
                    .divide(HUNDRED, SCALE, RoundingMode.HALF_UP);
        }
        return BigDecimal.ZERO;
    }

    // ---------------------------------------------------------------- capacity

    public static BigDecimal capacityForDays(BigDecimal capacityHoursPerWeek, long days) {
        if (days <= 0) {
            return BigDecimal.ZERO;
        }
        return nz(capacityHoursPerWeek).multiply(BigDecimal.valueOf(days)).divide(SEVEN, SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Working capacity in a period after leave: weekly capacity prorated by calendar days, minus leave hours
     * (whole working days unless the leave states hours per day), limited to the engagement window.
     */
    public static BigDecimal capacityHours(
            Resource resource,
            LocalDate periodStart,
            LocalDate periodEnd,
            Collection<ResourceUnavailability> leave) {
        LocalDate start = periodStart;
        LocalDate end = periodEnd;
        if (resource.getEngagementStartDate() != null) {
            start = max(start, resource.getEngagementStartDate());
        }
        if (resource.getEngagementEndDate() != null) {
            end = min(end, resource.getEngagementEndDate());
        }
        long days = inclusiveDays(start, end);
        if (days <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal capacity = capacityForDays(resource.getCapacityHoursPerWeek(), days);
        BigDecimal leaveHours = BigDecimal.ZERO;
        BigDecimal workdayShare = nz(resource.getWorkingDaysPerWeek()).divide(SEVEN, SCALE, RoundingMode.HALF_UP);
        for (ResourceUnavailability off : leave) {
            long offDays = inclusiveDays(max(off.getStartDate(), start), min(off.getEndDate(), end));
            if (offDays <= 0) {
                continue;
            }
            BigDecimal perDay = off.getHoursPerDay() != null ? off.getHoursPerDay() : nz(resource.getWorkingHoursPerDay());
            leaveHours = leaveHours.add(perDay.multiply(BigDecimal.valueOf(offDays)).multiply(workdayShare));
        }
        return capacity.subtract(leaveHours).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    // ---------------------------------------------------------------- rates and money

    /** Converts an hourly, daily or monthly rate to its hourly equivalent using the resource's working pattern. */
    public static BigDecimal hourlyEquivalent(
            BigDecimal rate, String rateUnit, BigDecimal hoursPerDay, BigDecimal capacityHoursPerWeek) {
        if (rate == null) {
            return null;
        }
        String unit = rateUnit == null ? Resource.RATE_HOURLY : rateUnit;
        return switch (unit) {
            case Resource.RATE_DAILY -> nz(hoursPerDay).signum() == 0
                    ? rate
                    : rate.divide(hoursPerDay, SCALE, RoundingMode.HALF_UP);
            case Resource.RATE_MONTHLY -> {
                BigDecimal monthlyHours = nz(capacityHoursPerWeek).multiply(WEEKS_PER_MONTH);
                yield monthlyHours.signum() == 0 ? rate : rate.divide(monthlyHours, SCALE, RoundingMode.HALF_UP);
            }
            default -> rate;
        };
    }

    public static BigDecimal hourlyCostRate(Resource resource) {
        return hourlyEquivalent(
                resource.getCostRate(), resource.getRateUnit(),
                resource.getWorkingHoursPerDay(), resource.getCapacityHoursPerWeek());
    }

    public static BigDecimal hourlyBillingRate(Resource resource) {
        return hourlyEquivalent(
                resource.getBillingRate(), resource.getRateUnit(),
                resource.getWorkingHoursPerDay(), resource.getCapacityHoursPerWeek());
    }

    /** Allocation rates are always hourly; the resource's own rate (converted to hourly) is the fallback. */
    public static BigDecimal costRateFor(ResourceAllocation allocation, Resource resource) {
        if (allocation != null && allocation.getCostRate() != null) {
            return allocation.getCostRate();
        }
        return hourlyCostRate(resource);
    }

    public static BigDecimal billingRateFor(ResourceAllocation allocation, Resource resource) {
        if (allocation != null && allocation.getBillingRate() != null) {
            return allocation.getBillingRate();
        }
        return hourlyBillingRate(resource);
    }

    /** The allocation that governs work on a date: an open one covering it first, otherwise any covering one. */
    public static ResourceAllocation allocationCovering(List<ResourceAllocation> allocations, LocalDate date) {
        ResourceAllocation fallback = null;
        for (ResourceAllocation allocation : allocations) {
            if (ResourceAllocation.STATUS_CANCELLED.equals(allocation.getStatus()) || !allocation.covers(date)) {
                continue;
            }
            if (allocation.isOpen()) {
                return allocation;
            }
            if (fallback == null) {
                fallback = allocation;
            }
        }
        return fallback;
    }

    public static BigDecimal amount(BigDecimal hours, BigDecimal rate) {
        if (hours == null || rate == null) {
            return BigDecimal.ZERO;
        }
        return hours.multiply(rate).setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal margin(BigDecimal revenue, BigDecimal cost) {
        return nz(revenue).subtract(nz(cost)).setScale(2, RoundingMode.HALF_UP);
    }

    /** Margin as a percentage of revenue; null when there is no revenue. */
    public static BigDecimal marginPct(BigDecimal revenue, BigDecimal cost) {
        if (nz(revenue).signum() == 0) {
            return null;
        }
        return margin(revenue, cost).multiply(HUNDRED).divide(revenue, 2, RoundingMode.HALF_UP);
    }

    public static BigDecimal percent(BigDecimal part, BigDecimal whole) {
        if (nz(whole).signum() == 0) {
            return BigDecimal.ZERO;
        }
        return nz(part).multiply(HUNDRED).divide(whole, 2, RoundingMode.HALF_UP);
    }

    // ---------------------------------------------------------------- availability

    /**
     * Classifies a resource on {@code today} from its allocations, leave and engagement window. Manual lifecycle
     * states win; everything else (bench, partial, full, over, ending soon, available-from) is derived.
     */
    public static Classification classify(
            Resource resource,
            List<ResourceAllocation> allocations,
            Collection<ResourceUnavailability> leave,
            LocalDate today,
            Thresholds thresholds) {
        BigDecimal capacity = resource.getCapacityHoursPerWeek();
        List<ResourceAllocation> open = allocations.stream().filter(ResourceAllocation::isOpen).toList();

        BigDecimal currentPct = allocationPctOn(open, capacity, today);
        String band = band(currentPct, thresholds);

        List<ResourceAllocation> current = open.stream().filter(a -> a.covers(today)).toList();
        LocalDate currentEnds = current.stream()
                .map(ResourceAllocation::getEndDate)
                .min(Comparator.naturalOrder())
                .orElse(null);
        LocalDate horizon = today.plusDays(thresholds.endingSoonDays());
        boolean endingSoon = currentEnds != null && !currentEnds.isAfter(horizon);

        LocalDate nextStart = open.stream()
                .map(ResourceAllocation::getStartDate)
                .filter(d -> d.isAfter(today))
                .min(Comparator.naturalOrder())
                .orElse(null);
        BigDecimal futurePct = nextStart == null ? BigDecimal.ZERO : allocationPctOn(open, capacity, nextStart);

        boolean onLeave = leave.stream().anyMatch(off -> !today.isBefore(off.getStartDate()) && !today.isAfter(off.getEndDate())
                && off.getHoursPerDay() == null);

        LocalDate engagementEnd = resource.getEngagementEndDate();
        boolean engagementExpired = resource.isExternal() && engagementEnd != null && engagementEnd.isBefore(today);
        boolean engagementEndingSoon = resource.isExternal() && engagementEnd != null
                && !engagementEnd.isBefore(today) && !engagementEnd.isAfter(horizon);
        boolean notStarted = resource.getEngagementStartDate() != null && resource.getEngagementStartDate().isAfter(today);

        String status;
        String stored = resource.getStatus();
        if (Resource.ENDED_STATUSES.contains(stored)) {
            status = stored;
        } else if (engagementExpired) {
            status = STATUS_CONTRACT_EXPIRED;
        } else if (Resource.STATUS_ON_LEAVE.equals(stored) || onLeave) {
            status = STATUS_ON_LEAVE;
        } else if (Resource.STATUS_UNAVAILABLE.equals(stored)) {
            status = STATUS_UNAVAILABLE;
        } else if (notStarted && current.isEmpty()) {
            status = STATUS_NOT_STARTED;
        } else if (BAND_OVER.equals(band)) {
            status = STATUS_OVER;
        } else if (endingSoon) {
            status = STATUS_ENDING_SOON;
        } else if (BAND_FULL.equals(band)) {
            status = STATUS_FULL;
        } else if (BAND_PARTIAL.equals(band)) {
            status = STATUS_PARTIAL;
        } else {
            status = STATUS_BENCH;
        }

        boolean workforceActive = !Resource.ENDED_STATUSES.contains(stored) && !engagementExpired;
        LocalDate availableFrom = null;
        BigDecimal availableFromPct = null;
        if (workforceActive) {
            LocalDate earliest = today;
            if (resource.getAvailableFrom() != null && resource.getAvailableFrom().isAfter(earliest)) {
                earliest = resource.getAvailableFrom();
            }
            if (resource.getEngagementStartDate() != null && resource.getEngagementStartDate().isAfter(earliest)) {
                earliest = resource.getEngagementStartDate();
            }
            LocalDate free = firstDateBelow(open, capacity, earliest, thresholds.fullPct());
            if (free != null && (engagementEnd == null || !free.isAfter(engagementEnd) || !resource.isExternal())) {
                availableFrom = free;
                availableFromPct = HUNDRED.subtract(allocationPctOn(open, capacity, free)).max(BigDecimal.ZERO);
            }
        }
        boolean available = workforceActive
                && !STATUS_ON_LEAVE.equals(status)
                && !STATUS_UNAVAILABLE.equals(status)
                && availableFrom != null
                && !availableFrom.isAfter(today);

        int projectCount = (int) current.stream().map(ResourceAllocation::getProjectId).distinct().count();
        return new Classification(
                status,
                band,
                currentPct,
                futurePct,
                available,
                endingSoon,
                onLeave,
                engagementEndingSoon,
                currentEnds,
                availableFrom,
                availableFromPct,
                nextStart,
                projectCount);
    }

    /** First date on/after {@code from} where total allocation drops below {@code limitPct}. */
    static LocalDate firstDateBelow(
            List<ResourceAllocation> open, BigDecimal capacity, LocalDate from, BigDecimal limitPct) {
        TreeSet<LocalDate> candidates = new TreeSet<>();
        candidates.add(from);
        for (ResourceAllocation allocation : open) {
            LocalDate afterEnd = allocation.getEndDate().plusDays(1);
            if (afterEnd.isAfter(from)) {
                candidates.add(afterEnd);
            }
        }
        for (LocalDate candidate : candidates) {
            if (allocationPctOn(open, capacity, candidate).compareTo(limitPct) < 0) {
                return candidate;
            }
        }
        return null;
    }

    /** Weekly allocation percentages from {@code start} for {@code weeks} weeks (sampled on each week's Monday). */
    public static List<BigDecimal> weeklyLoad(
            List<ResourceAllocation> allocations, BigDecimal capacity, LocalDate start, int weeks) {
        List<BigDecimal> load = new ArrayList<>(weeks);
        for (int i = 0; i < weeks; i++) {
            LocalDate weekStart = start.plusWeeks(i);
            BigDecimal peak = BigDecimal.ZERO;
            for (int d = 0; d < 5; d++) {
                peak = peak.max(allocationPctOn(allocations, capacity, weekStart.plusDays(d)));
            }
            load.add(peak);
        }
        return load;
    }

    // ---------------------------------------------------------------- helpers

    public static long inclusiveDays(LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) {
            return 0;
        }
        return ChronoUnit.DAYS.between(start, end) + 1;
    }

    public static boolean overlaps(LocalDate aStart, LocalDate aEnd, LocalDate bStart, LocalDate bEnd) {
        return !aStart.isAfter(bEnd) && !aEnd.isBefore(bStart);
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
