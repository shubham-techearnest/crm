package com.techearnest.crm.resource;

import static org.assertj.core.api.Assertions.assertThat;

import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceMetrics;
import com.techearnest.crm.resource.domain.ResourceMetrics.Classification;
import com.techearnest.crm.resource.domain.ResourceMetrics.Thresholds;
import com.techearnest.crm.resource.domain.ResourceUnavailability;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ResourceMetricsTest {

    private static final UUID ORG = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2030, 6, 12);
    private static final Thresholds DEFAULTS = Thresholds.defaults();

    @Test
    void bandsFollowThresholds() {
        assertThat(ResourceMetrics.band(BigDecimal.ZERO, DEFAULTS)).isEqualTo(ResourceMetrics.BAND_BENCH);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(1), DEFAULTS)).isEqualTo(ResourceMetrics.BAND_PARTIAL);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(99), DEFAULTS)).isEqualTo(ResourceMetrics.BAND_PARTIAL);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(100), DEFAULTS)).isEqualTo(ResourceMetrics.BAND_FULL);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(101), DEFAULTS)).isEqualTo(ResourceMetrics.BAND_OVER);

        Thresholds custom = new Thresholds(7, BigDecimal.valueOf(10), BigDecimal.valueOf(90), BigDecimal.valueOf(110));
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(10), custom)).isEqualTo(ResourceMetrics.BAND_BENCH);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(95), custom)).isEqualTo(ResourceMetrics.BAND_FULL);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(110), custom)).isEqualTo(ResourceMetrics.BAND_FULL);
        assertThat(ResourceMetrics.band(BigDecimal.valueOf(111), custom)).isEqualTo(ResourceMetrics.BAND_OVER);
    }

    @Test
    void benchPartialFullAndOverAreDerivedFromAllocations() {
        Resource r = employee();
        assertThat(classify(r).status()).isEqualTo(ResourceMetrics.STATUS_BENCH);
        assertThat(classify(r).available()).isTrue();

        assertThat(classify(r, alloc(r, 50, -10, 60)).status()).isEqualTo(ResourceMetrics.STATUS_PARTIAL);
        assertThat(classify(r, alloc(r, 60, -10, 60), alloc(r, 40, -10, 60)).status())
                .isEqualTo(ResourceMetrics.STATUS_FULL);
        Classification over = classify(r, alloc(r, 80, -10, 60), alloc(r, 40, -10, 60));
        assertThat(over.status()).isEqualTo(ResourceMetrics.STATUS_OVER);
        assertThat(over.currentAllocationPct()).isEqualByComparingTo("120");
        assertThat(over.activeProjectCount()).isEqualTo(2);
    }

    @Test
    void endingSoonAndFutureAvailability() {
        Resource r = employee();
        Classification c = classify(r, alloc(r, 100, -30, 5));
        assertThat(c.status()).isEqualTo(ResourceMetrics.STATUS_ENDING_SOON);
        assertThat(c.endingSoon()).isTrue();
        assertThat(c.available()).isFalse();
        assertThat(c.availableFrom()).isEqualTo(TODAY.plusDays(6));
        assertThat(c.availableFromCapacityPct()).isEqualByComparingTo("100");

        Classification later = classify(r, alloc(r, 100, -30, 40));
        assertThat(later.status()).isEqualTo(ResourceMetrics.STATUS_FULL);
        assertThat(later.endingSoon()).isFalse();

        Classification chained = classify(r, alloc(r, 100, -30, 5), alloc(r, 100, 6, 90));
        assertThat(chained.availableFrom()).isEqualTo(TODAY.plusDays(91));
        assertThat(chained.nextAllocationStartsOn()).isEqualTo(TODAY.plusDays(6));
    }

    @Test
    void completedAllocationsDoNotCount() {
        Resource r = employee();
        ResourceAllocation done = alloc(r, 100, -30, 30);
        done.end(TODAY.minusDays(1), null);
        assertThat(classify(r, done).status()).isEqualTo(ResourceMetrics.STATUS_BENCH);
    }

    @Test
    void manualAndContractStatesWin() {
        Resource r = employee();
        r.deactivate(Resource.STATUS_TERMINATED, "Left");
        assertThat(classify(r, alloc(r, 50, -10, 60)).status()).isEqualTo(Resource.STATUS_TERMINATED);
        assertThat(classify(r).available()).isFalse();

        Resource contractor = Resource.create(ORG, UUID.randomUUID(), null, "CON-1", null, null, null,
                Resource.TYPE_CONTRACTOR, null, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.valueOf(40), "AVAILABLE");
        contractor.updateContact("Ext", null, null, TODAY.minusDays(1));
        Classification expired = classify(contractor);
        assertThat(expired.status()).isEqualTo(ResourceMetrics.STATUS_CONTRACT_EXPIRED);
        assertThat(expired.available()).isFalse();
    }

    @Test
    void fullDayLeaveMarksOnLeaveAndReducesCapacity() {
        Resource r = employee();
        ResourceUnavailability leave = ResourceUnavailability.create(
                ORG, r.getId(), TODAY.minusDays(1), TODAY.plusDays(5), "LEAVE", null, null);
        Classification c = ResourceMetrics.classify(r, List.of(), List.of(leave), TODAY, DEFAULTS);
        assertThat(c.status()).isEqualTo(ResourceMetrics.STATUS_ON_LEAVE);
        assertThat(c.available()).isFalse();

        LocalDate monday = LocalDate.of(2030, 6, 10);
        LocalDate sunday = monday.plusDays(6);
        assertThat(ResourceMetrics.capacityHours(r, monday, sunday, List.of())).isEqualByComparingTo("40");
        ResourceUnavailability week = ResourceUnavailability.create(ORG, r.getId(), monday, sunday, "LEAVE", null, null);
        assertThat(ResourceMetrics.capacityHours(r, monday, sunday, List.of(week))).isEqualByComparingTo("0");
    }

    @Test
    void ratesConvertToHourlyAndMarginIsDerived() {
        assertThat(ResourceMetrics.hourlyEquivalent(BigDecimal.valueOf(800), Resource.RATE_DAILY,
                BigDecimal.valueOf(8), BigDecimal.valueOf(40))).isEqualByComparingTo("100");
        BigDecimal monthly = ResourceMetrics.hourlyEquivalent(BigDecimal.valueOf(173332), Resource.RATE_MONTHLY,
                BigDecimal.valueOf(8), BigDecimal.valueOf(40));
        assertThat(monthly).isBetween(new BigDecimal("999.9"), new BigDecimal("1000.1"));
        assertThat(ResourceMetrics.hourlyEquivalent(BigDecimal.TEN, Resource.RATE_HOURLY, null, null))
                .isEqualByComparingTo("10");

        Resource r = employee();
        ResourceAllocation withRates = ResourceAllocation.create(ORG, UUID.randomUUID(), r.getId(), TODAY, TODAY,
                null, BigDecimal.TEN, null, BigDecimal.valueOf(3000), BigDecimal.valueOf(1500), "ACTIVE");
        assertThat(ResourceMetrics.costRateFor(withRates, r)).isEqualByComparingTo("1500");
        assertThat(ResourceMetrics.costRateFor(null, r)).isEqualByComparingTo("1200");
        assertThat(ResourceMetrics.billingRateFor(null, r)).isEqualByComparingTo("2500");

        BigDecimal revenue = ResourceMetrics.amount(BigDecimal.valueOf(10), BigDecimal.valueOf(2500));
        BigDecimal cost = ResourceMetrics.amount(BigDecimal.valueOf(10), BigDecimal.valueOf(1200));
        assertThat(ResourceMetrics.margin(revenue, cost)).isEqualByComparingTo("13000");
        assertThat(ResourceMetrics.marginPct(revenue, cost)).isEqualByComparingTo("52");
        assertThat(ResourceMetrics.marginPct(BigDecimal.ZERO, cost)).isNull();
    }

    @Test
    void allocationCoveringPrefersOpenAllocations() {
        Resource r = employee();
        UUID project = UUID.randomUUID();
        ResourceAllocation old = ResourceAllocation.create(ORG, project, r.getId(), TODAY.minusDays(20),
                TODAY.plusDays(20), null, BigDecimal.TEN, null, null, BigDecimal.ONE, "ACTIVE");
        old.end(TODAY.plusDays(20), null);
        ResourceAllocation open = ResourceAllocation.create(ORG, project, r.getId(), TODAY.minusDays(5),
                TODAY.plusDays(5), null, BigDecimal.TEN, null, null, BigDecimal.TWO, "ACTIVE");
        assertThat(ResourceMetrics.allocationCovering(List.of(old, open), TODAY)).isSameAs(open);
        assertThat(ResourceMetrics.allocationCovering(List.of(old, open), TODAY.minusDays(10))).isSameAs(old);
        assertThat(ResourceMetrics.allocationCovering(List.of(old, open), TODAY.plusDays(60))).isNull();
    }

    private static Resource employee() {
        return Resource.create(ORG, UUID.randomUUID(), UUID.randomUUID(), "EMP-1", "Dev", null, null,
                Resource.TYPE_EMPLOYEE, null, BigDecimal.valueOf(1200), BigDecimal.valueOf(2500),
                BigDecimal.valueOf(40), "AVAILABLE");
    }

    private static ResourceAllocation alloc(Resource r, int pct, int startOffset, int endOffset) {
        return ResourceAllocation.create(ORG, UUID.randomUUID(), r.getId(), TODAY.plusDays(startOffset),
                TODAY.plusDays(endOffset), null, BigDecimal.valueOf(pct), null, null, null, "ACTIVE");
    }

    private static Classification classify(Resource r, ResourceAllocation... allocations) {
        return ResourceMetrics.classify(r, List.of(allocations), List.of(), TODAY, DEFAULTS);
    }
}
