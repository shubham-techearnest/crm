package com.techearnest.crm.platform.api.dto;

public record PlatformDashboardResponse(
        long orgCount, long activeOrgCount, long suspendedOrgCount, long activeUserCount) {}
