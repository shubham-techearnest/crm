package com.techearnest.crm.dashboard.api.dto;

import java.math.BigDecimal;
import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {}

    public record NamedValue(String name, BigDecimal value) {}

    public record NamedCount(String name, long count) {}

    public record DashboardResponse(
            List<NamedValue> cards,
            List<NamedCount> seriesPrimary,
            List<NamedCount> seriesSecondary,
            String title) {}
}
