package com.techearnest.crm.importer.application;

import jakarta.persistence.EntityManager;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Resolves the human-readable references used in spreadsheets (account name, vendor name, region name/code,
 * project code, user email…) to record IDs within one organization. Results are cached for one import.
 * Visibility of the resolved record is still enforced by the module's create service.
 */
public class ImportLookups {

    private final EntityManager entityManager;
    private final UUID organizationId;
    private final Map<String, UUID> cache = new HashMap<>();

    public ImportLookups(EntityManager entityManager, UUID organizationId) {
        this.entityManager = entityManager;
        this.organizationId = organizationId;
    }

    public UUID region(String nameOrCode) {
        return resolve("Region", nameOrCode,
                "select r.id from Region r where r.organizationId = :org and r.deletedAt is null"
                        + " and (lower(r.name) = :v or lower(r.code) = :v)");
    }

    public UUID account(String name) {
        return resolve("Account", name,
                "select a.id from Account a where a.organizationId = :org and a.deletedAt is null and lower(a.name) = :v");
    }

    public UUID vendor(String name) {
        return resolve("Vendor", name,
                "select v.id from Vendor v where v.organizationId = :org and v.deletedAt is null and lower(v.name) = :v");
    }

    public UUID project(String codeOrName) {
        UUID byCode = find("select p.id from Project p where p.organizationId = :org and p.deletedAt is null"
                + " and lower(p.projectCode) = :v", codeOrName);
        if (byCode != null) {
            return byCode;
        }
        return resolve("Project", codeOrName,
                "select p.id from Project p where p.organizationId = :org and p.deletedAt is null and lower(p.name) = :v");
    }

    public UUID contactByEmail(String email) {
        return resolve("Contact", email,
                "select c.id from Contact c where c.organizationId = :org and c.deletedAt is null and lower(c.email) = :v");
    }

    public UUID userByEmail(String email) {
        return resolve("User", email,
                "select u.id from User u where u.organizationId = :org and u.deletedAt is null and lower(u.email) = :v");
    }

    /** Matches a resource by employee code, its own email, or the email of its linked login. */
    public UUID resource(String codeOrEmail) {
        return resolve("Resource", codeOrEmail,
                "select r.id from Resource r where r.organizationId = :org and r.deletedAt is null"
                        + " and (lower(r.employeeCode) = :v or lower(r.email) = :v or r.userId in"
                        + " (select u.id from User u where u.organizationId = :org and lower(u.email) = :v))");
    }

    public UUID task(UUID projectId, String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String key = "Task|" + projectId + "|" + name.trim().toLowerCase(Locale.ROOT);
        if (cache.containsKey(key)) {
            return cache.get(key);
        }
        List<UUID> ids = entityManager.createQuery(
                        "select t.id from ProjectTask t where t.organizationId = :org and t.projectId = :project"
                                + " and t.deletedAt is null and lower(t.name) = :v", UUID.class)
                .setParameter("org", organizationId)
                .setParameter("project", projectId)
                .setParameter("v", name.trim().toLowerCase(Locale.ROOT))
                .setMaxResults(2)
                .getResultList();
        if (ids.size() != 1) {
            throw new RowRejected(ids.isEmpty()
                    ? "Task '" + name.trim() + "' was not found in this project"
                    : "More than one task in this project is named '" + name.trim() + "'");
        }
        cache.put(key, ids.get(0));
        return ids.get(0);
    }

    public UUID taxRate(String codeOrName) {
        return resolve("Tax rate", codeOrName,
                "select t.id from TaxRate t where t.organizationId = :org and t.deletedAt is null"
                        + " and (lower(t.code) = :v or lower(t.name) = :v)");
    }

    public boolean exists(String jpql, Object... namedParams) {
        var query = entityManager.createQuery(jpql, Long.class).setParameter("org", organizationId);
        for (int i = 0; i + 1 < namedParams.length; i += 2) {
            query.setParameter((String) namedParams[i], namedParams[i + 1]);
        }
        return query.getSingleResult() > 0;
    }

    public UUID organizationId() {
        return organizationId;
    }

    /** Returns null when value is blank; rejects the row when nothing or more than one record matches. */
    private UUID resolve(String label, String value, String jpql) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String key = label + "|" + value.trim().toLowerCase(Locale.ROOT);
        if (cache.containsKey(key)) {
            return cache.get(key);
        }
        List<UUID> ids = query(jpql, value);
        if (ids.isEmpty()) {
            throw new RowRejected(label + " '" + value.trim() + "' was not found");
        }
        if (ids.size() > 1) {
            throw new RowRejected("More than one " + label.toLowerCase(Locale.ROOT) + " is named '" + value.trim()
                    + "'; rename one of them or use a unique code");
        }
        cache.put(key, ids.get(0));
        return ids.get(0);
    }

    private UUID find(String jpql, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        List<UUID> ids = query(jpql, value);
        return ids.size() == 1 ? ids.get(0) : null;
    }

    private List<UUID> query(String jpql, String value) {
        return entityManager.createQuery(jpql, UUID.class)
                .setParameter("org", organizationId)
                .setParameter("v", value.trim().toLowerCase(Locale.ROOT))
                .setMaxResults(2)
                .getResultList();
    }
}
