package com.techearnest.crm.auth.application;

import com.techearnest.crm.common.config.SecurityProperties;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

@Service
public class JwtService {

    private static final MacAlgorithm ALG = MacAlgorithm.HS256;

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final SecurityProperties properties;

    public JwtService(SecurityProperties properties) {
        this.properties = properties;
        SecretKey key = secretKey(properties.getJwtSecret());
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key.getEncoded()));
        this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(ALG).build();
    }

    public String createAccessToken(CurrentUser user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("techearnest-crm")
                .issuedAt(now)
                .expiresAt(now.plus(properties.getAccessTokenTtl()))
                .subject(user.userId().toString())
                .claim("email", user.email())
                .claim("name", user.displayName())
                .claim("org", user.organizationId() == null ? "" : user.organizationId().toString())
                .claim("scope", user.dataScope().name())
                .claim("regions", user.regionIds().stream().map(UUID::toString).toList())
                .claim("dept", user.departmentId() == null ? "" : user.departmentId().toString())
                .claim("team", user.teamId() == null ? "" : user.teamId().toString())
                .claim("resource", user.resourceId() == null ? "" : user.resourceId().toString())
                .claim("perms", user.permissionList())
                .build();
        JwsHeader header = JwsHeader.with(ALG).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public CurrentUser parseAccessToken(String token) {
        Jwt jwt = decoder.decode(token);
        List<String> perms = stringList(jwt.getClaim("perms"));
        List<String> regionStrings = stringList(jwt.getClaim("regions"));
        return new CurrentUser(
                UUID.fromString(jwt.getSubject()),
                uuidOrNull(jwt.getClaimAsString("org")),
                jwt.getClaimAsString("email"),
                jwt.getClaimAsString("name"),
                DataScope.valueOf(jwt.getClaimAsString("scope")),
                regionStrings.stream().map(UUID::fromString).collect(java.util.stream.Collectors.toSet()),
                uuidOrNull(jwt.getClaimAsString("dept")),
                uuidOrNull(jwt.getClaimAsString("team")),
                new java.util.LinkedHashSet<>(perms),
                uuidOrNull(jwt.getClaimAsString("resource")));
    }

    public long accessTokenTtlSeconds() {
        return properties.getAccessTokenTtl().toSeconds();
    }

    private static SecretKey secretKey(String secret) {
        byte[] bytes = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    private static UUID uuidOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return UUID.fromString(value);
    }

    @SuppressWarnings("unchecked")
    private static List<String> stringList(Object claim) {
        if (claim instanceof Collection<?> collection) {
            return collection.stream().map(String::valueOf).toList();
        }
        return List.of();
    }
}
