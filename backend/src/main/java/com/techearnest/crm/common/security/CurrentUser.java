package com.techearnest.crm.common.security;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record CurrentUser(
        UUID userId,
        UUID organizationId,
        String email,
        String displayName,
        DataScope dataScope,
        Set<UUID> regionIds,
        UUID departmentId,
        UUID teamId,
        Set<String> permissions,
        UUID resourceId)
        implements UserDetails {

    public boolean hasPermission(String code) {
        return permissions.contains(code);
    }

    public boolean isPlatform() {
        return dataScope == DataScope.PLATFORM;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return permissions.stream().map(SimpleGrantedAuthority::new).toList();
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    public List<String> permissionList() {
        return permissions.stream().sorted().toList();
    }

    public List<UUID> regionIdList() {
        return regionIds.stream().toList();
    }
}
