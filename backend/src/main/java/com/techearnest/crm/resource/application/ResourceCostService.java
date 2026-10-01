package com.techearnest.crm.resource.application;

import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceMetrics;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.timesheet.domain.TimeEntryFact;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns approved time into cost and revenue. Each entry uses the rates stamped when its timesheet was
 * approved; entries approved before stamping existed fall back to the resource's current hourly rates.
 */
@Service
public class ResourceCostService {

    private final TimeEntryRepository timeEntryRepository;
    private final ResourceRepository resourceRepository;

    public ResourceCostService(TimeEntryRepository timeEntryRepository, ResourceRepository resourceRepository) {
        this.timeEntryRepository = timeEntryRepository;
        this.resourceRepository = resourceRepository;
    }

    /** Hours, billable hours, cost and revenue from approved time. */
    public record Totals(BigDecimal hours, BigDecimal billableHours, BigDecimal cost, BigDecimal revenue) {

        public static final Totals ZERO = new Totals(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        public Totals plus(BigDecimal entryHours, boolean billable, BigDecimal entryCost, BigDecimal entryRevenue) {
            return new Totals(
                    hours.add(entryHours),
                    billable ? billableHours.add(entryHours) : billableHours,
                    cost.add(entryCost),
                    revenue.add(entryRevenue));
        }

        public BigDecimal margin() {
            return ResourceMetrics.margin(revenue, cost);
        }

        public BigDecimal marginPct() {
            return ResourceMetrics.marginPct(revenue, cost);
        }
    }

    @Transactional(readOnly = true)
    public Map<UUID, Totals> approvedTotalsByProject(Collection<UUID> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return Map.of();
        }
        List<TimeEntryFact> facts = timeEntryRepository.findApprovedFactsByProjects(projectIds);
        return totalsBy(facts, TimeEntryFact::projectId, resourcesFor(facts));
    }

    /** Sums approved facts by any key, pricing each entry with its stamped (or fallback) rates. */
    public <K> Map<K, Totals> totalsBy(
            List<TimeEntryFact> facts, Function<TimeEntryFact, K> key, Map<UUID, Resource> resources) {
        Map<K, Totals> totals = new HashMap<>();
        for (TimeEntryFact fact : facts) {
            if (!fact.approved()) {
                continue;
            }
            K k = key.apply(fact);
            if (k == null) {
                continue;
            }
            Resource resource = resources.get(fact.resourceId());
            BigDecimal hours = fact.hours() == null ? BigDecimal.ZERO : fact.hours();
            totals.merge(
                    k,
                    Totals.ZERO.plus(hours, fact.billable(), cost(fact, resource), revenue(fact, resource)),
                    (a, b) -> new Totals(
                            a.hours().add(b.hours()),
                            a.billableHours().add(b.billableHours()),
                            a.cost().add(b.cost()),
                            a.revenue().add(b.revenue())));
        }
        return totals;
    }

    public static BigDecimal cost(TimeEntryFact fact, Resource resource) {
        BigDecimal rate = fact.costRate() != null
                ? fact.costRate()
                : resource == null ? null : ResourceMetrics.hourlyCostRate(resource);
        return ResourceMetrics.amount(fact.hours(), rate);
    }

    /** Only billable hours earn revenue. */
    public static BigDecimal revenue(TimeEntryFact fact, Resource resource) {
        if (!fact.billable()) {
            return BigDecimal.ZERO;
        }
        BigDecimal rate = fact.billingRate() != null
                ? fact.billingRate()
                : resource == null ? null : ResourceMetrics.hourlyBillingRate(resource);
        return ResourceMetrics.amount(fact.hours(), rate);
    }

    private Map<UUID, Resource> resourcesFor(List<TimeEntryFact> facts) {
        Set<UUID> ids = new HashSet<>();
        for (TimeEntryFact fact : facts) {
            if (fact.costRate() == null || fact.billingRate() == null) {
                ids.add(fact.resourceId());
            }
        }
        Map<UUID, Resource> resources = new HashMap<>();
        if (!ids.isEmpty()) {
            resourceRepository.findAllById(ids).forEach(r -> resources.put(r.getId(), r));
        }
        return resources;
    }
}
