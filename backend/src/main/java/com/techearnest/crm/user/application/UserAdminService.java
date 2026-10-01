package com.techearnest.crm.user.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.branch.domain.BranchRepository;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.department.domain.DepartmentRepository;
import com.techearnest.crm.team.domain.TeamRepository;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.role.domain.RoleRepository;
import com.techearnest.crm.user.api.dto.UserDtos.AssignRegionsRequest;
import com.techearnest.crm.user.api.dto.UserDtos.AssignRolesRequest;
import com.techearnest.crm.user.api.dto.UserDtos.CreateUserRequest;
import com.techearnest.crm.user.api.dto.UserDtos.UpdateUserRequest;
import com.techearnest.crm.user.api.dto.UserDtos.UserResponse;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdminService {

    static final List<String> USER_STATUSES = List.of("INVITED", "ACTIVE", "LOCKED", "DEACTIVATED");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RegionRepository regionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final BranchRepository branchRepository;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final OwnerValidator ownerValidator;

    public UserAdminService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            PasswordEncoder passwordEncoder,
            BranchRepository branchRepository,
            DepartmentRepository departmentRepository,
            TeamRepository teamRepository,
            OwnerValidator ownerValidator) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.passwordEncoder = passwordEncoder;
        this.branchRepository = branchRepository;
        this.departmentRepository = departmentRepository;
        this.teamRepository = teamRepository;
        this.ownerValidator = ownerValidator;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, Pageable pageable) {
        tenantAccess.requirePermission("USER_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<User> page = userRepository.search(orgId, blankToNull(search), regionIds, pageable);
        List<UUID> ids = page.getContent().stream().map(User::getId).toList();
        Map<UUID, User> details = ids.isEmpty()
                ? Map.of()
                : userRepository.findActiveDetailsByIds(ids).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));
        List<UserResponse> data = page.getContent().stream()
                .map(u -> UserResponse.from(details.getOrDefault(u.getId(), u)))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public UserResponse get(UUID id) {
        tenantAccess.requirePermission("USER_VIEW");
        return UserResponse.from(requireVisibleUser(id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        CurrentUser actor = tenantAccess.requirePermission("USER_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        if (request.regionId() != null) {
            tenantAccess.assertRegionVisible(request.regionId());
        } else if (actor.dataScope() == DataScope.REGION) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }

        String email = request.email().trim().toLowerCase();
        if (userRepository.existsActiveEmailInOrg(orgId, email)) {
            throw new ConflictException("Email already exists in organization");
        }

        validateOrgStructure(orgId, request.branchId(), request.departmentId(), request.teamId(), request.managerId(), null);
        User user = User.create(
                orgId,
                email,
                passwordEncoder.encode(request.password()),
                request.firstName().trim(),
                request.lastName().trim(),
                blankToNull(request.phone()),
                request.regionId(),
                request.branchId(),
                request.departmentId(),
                request.teamId(),
                request.managerId(),
                normalizeStatus(request.status()));
        user.updateWorkProfile(
                blankToNull(request.jobTitle()),
                blankToNull(request.employeeCode()),
                blankToNull(request.mobile()),
                request.dateOfJoining(),
                blankToNull(request.timezone()),
                blankToNull(request.locale()));

        if (request.roleIds() != null && !request.roleIds().isEmpty()) {
            user.replaceRoles(resolveAssignableRoles(actor, orgId, request.roleIds()));
        }
        if (request.regionIds() != null && !request.regionIds().isEmpty()) {
            Set<Region> regions = resolveRegions(orgId, request.regionIds());
            for (Region region : regions) {
                tenantAccess.assertRegionVisible(region.getId());
            }
            user.replaceAssignedRegions(regions);
        }

        userRepository.save(user);
        auditService.record(orgId, actor.userId(), "CREATE", "USER", user.getId());
        return UserResponse.from(requireVisibleUser(user.getId()));
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request) {
        CurrentUser actor = tenantAccess.requirePermission("USER_MANAGE");
        User user = requireVisibleUser(id);
        if (request.regionId() != null) {
            tenantAccess.assertRegionVisible(request.regionId());
        }
        validateOrgStructure(
                user.getOrganizationId(),
                request.branchId(),
                request.departmentId(),
                request.teamId(),
                request.managerId(),
                user);
        user.updateProfile(
                request.firstName().trim(),
                request.lastName().trim(),
                blankToNull(request.phone()),
                request.regionId(),
                request.branchId(),
                request.departmentId(),
                request.teamId(),
                request.managerId(),
                normalizeStatus(request.status()));
        user.updateWorkProfile(
                blankToNull(request.jobTitle()),
                blankToNull(request.employeeCode()),
                blankToNull(request.mobile()),
                request.dateOfJoining(),
                blankToNull(request.timezone()),
                blankToNull(request.locale()));
        auditService.record(user.getOrganizationId(), actor.userId(), "UPDATE", "USER", user.getId());
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse assignRoles(UUID id, AssignRolesRequest request) {
        CurrentUser actor = tenantAccess.requirePermission("USER_MANAGE");
        User user = requireVisibleUser(id);
        user.replaceRoles(resolveAssignableRoles(actor, user.getOrganizationId(), request.roleIds()));
        auditService.record(user.getOrganizationId(), actor.userId(), "ASSIGN", "USER_ROLES", user.getId());
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse assignRegions(UUID id, AssignRegionsRequest request) {
        CurrentUser actor = tenantAccess.requirePermission("USER_MANAGE");
        User user = requireVisibleUser(id);
        Set<Region> regions = resolveRegions(user.getOrganizationId(), request.regionIds());
        for (Region region : regions) {
            tenantAccess.assertRegionVisible(region.getId());
        }
        user.replaceAssignedRegions(regions);
        auditService.record(user.getOrganizationId(), actor.userId(), "ASSIGN", "USER_REGIONS", user.getId());
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse deactivate(UUID id) {
        CurrentUser actor = tenantAccess.requirePermission("USER_MANAGE");
        User user = requireVisibleUser(id);
        user.deactivate();
        auditService.record(user.getOrganizationId(), actor.userId(), "UPDATE", "USER", user.getId());
        return UserResponse.from(user);
    }

    private User requireVisibleUser(UUID id) {
        User user = userRepository
                .findActiveDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(user.getOrganizationId());
        tenantAccess.assertRegionVisible(user.getRegionId());
        return user;
    }

    private Set<Role> resolveAssignableRoles(CurrentUser actor, UUID organizationId, List<UUID> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            return Set.of();
        }
        List<Role> roles = roleRepository.findActiveByIdIn(roleIds);
        if (roles.size() != new HashSet<>(roleIds).size()) {
            throw new ResourceNotFoundException("Resource not found");
        }
        for (Role role : roles) {
            if (role.getOrganizationId() != null && !role.getOrganizationId().equals(organizationId)) {
                throw new ResourceNotFoundException("Resource not found");
            }
            if ("SUPER_ADMIN".equals(role.getCode()) && !actor.isPlatform()) {
                throw new ForbiddenException("You do not have permission to perform this action");
            }
            if (actor.dataScope() == DataScope.REGION
                    && ("SUPER_ADMIN".equals(role.getCode()) || "ORGANIZATION_ADMIN".equals(role.getCode()))) {
                throw new ForbiddenException("You do not have permission to perform this action");
            }
        }
        return new HashSet<>(roles);
    }

    private Set<Region> resolveRegions(UUID organizationId, List<UUID> regionIds) {
        if (regionIds == null || regionIds.isEmpty()) {
            return Set.of();
        }
        Set<Region> regions = new HashSet<>();
        for (UUID regionId : regionIds) {
            Region region = regionRepository
                    .findActiveById(regionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!Objects.equals(region.getOrganizationId(), organizationId)) {
                throw new ResourceNotFoundException("Resource not found");
            }
            regions.add(region);
        }
        return regions;
    }

    /** Validates references on create, and on update only the ones that change. */
    private void validateOrgStructure(
            UUID orgId, UUID branchId, UUID departmentId, UUID teamId, UUID managerId, User existing) {
        UUID selfId = existing == null ? null : existing.getId();
        boolean checkBranch = existing == null || !Objects.equals(existing.getBranchId(), branchId);
        boolean checkDepartment = existing == null || !Objects.equals(existing.getDepartmentId(), departmentId);
        boolean checkTeam = existing == null || checkDepartment || !Objects.equals(existing.getTeamId(), teamId);
        boolean checkManager = existing == null || !Objects.equals(existing.getManagerId(), managerId);
        if (checkBranch && branchId != null) {
            branchRepository
                    .findActiveById(branchId)
                    .filter(branch -> Objects.equals(branch.getOrganizationId(), orgId))
                    .orElseThrow(() -> new BusinessException("INVALID_BRANCH", "Branch not found in this organization"));
        }
        if (checkDepartment && departmentId != null) {
            departmentRepository
                    .findActiveById(departmentId)
                    .filter(department -> Objects.equals(department.getOrganizationId(), orgId))
                    .orElseThrow(() ->
                            new BusinessException("INVALID_DEPARTMENT", "Department not found in this organization"));
        }
        if (checkTeam && teamId != null) {
            var team = teamRepository
                    .findActiveById(teamId)
                    .filter(candidate -> Objects.equals(candidate.getOrganizationId(), orgId))
                    .orElseThrow(() -> new BusinessException("INVALID_TEAM", "Team not found in this organization"));
            if (departmentId != null && !Objects.equals(team.getDepartmentId(), departmentId)) {
                throw new BusinessException("INVALID_TEAM", "Team does not belong to the selected department");
            }
        }
        if (checkManager && managerId != null) {
            if (managerId.equals(selfId)) {
                throw new BusinessException("INVALID_MANAGER", "A user cannot report to themselves");
            }
            OwnerValidator.requireSameOrganization(ownerValidator.requireActiveOwner(managerId), orgId);
        }
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!USER_STATUSES.contains(normalized)) {
            throw new BusinessException("INVALID_STATUS", "Invalid user status: " + status);
        }
        return normalized;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<UserResponse> data, PaginationMeta pagination) {}
}
