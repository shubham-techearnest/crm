package com.techearnest.crm.platform.application;

import com.techearnest.crm.common.security.AccessGuard;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.platform.api.dto.PlatformDashboardResponse;
import com.techearnest.crm.user.domain.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformDashboardService {

    private final AccessGuard accessGuard;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    public PlatformDashboardService(
            AccessGuard accessGuard,
            OrganizationRepository organizationRepository,
            UserRepository userRepository) {
        this.accessGuard = accessGuard;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PlatformDashboardResponse dashboard() {
        accessGuard.requirePlatform();
        long orgCount = organizationRepository.countNotDeleted();
        long activeOrgCount = organizationRepository.countByStatusNotDeleted("ACTIVE");
        long suspendedOrgCount = organizationRepository.countByStatusNotDeleted("SUSPENDED");
        long activeUserCount = userRepository.countActiveTenantUsers();
        return new PlatformDashboardResponse(orgCount, activeOrgCount, suspendedOrgCount, activeUserCount);
    }
}
