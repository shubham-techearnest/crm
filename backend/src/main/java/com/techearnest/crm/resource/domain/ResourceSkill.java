package com.techearnest.crm.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "resource_skills")
public class ResourceSkill {

    @EmbeddedId
    private ResourceSkillId id;

    @Column(nullable = false)
    private String proficiency;

    @Column(name = "years_of_experience")
    private BigDecimal yearsOfExperience;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    private String certification;

    public static ResourceSkill create(
            UUID resourceId, UUID skillId, String proficiency, BigDecimal yearsOfExperience) {
        return create(resourceId, skillId, proficiency, yearsOfExperience, false, null);
    }

    public static ResourceSkill create(
            UUID resourceId,
            UUID skillId,
            String proficiency,
            BigDecimal yearsOfExperience,
            boolean primary,
            String certification) {
        ResourceSkill rs = new ResourceSkill();
        rs.id = new ResourceSkillId(resourceId, skillId);
        rs.proficiency = proficiency;
        rs.yearsOfExperience = yearsOfExperience;
        rs.primary = primary;
        rs.certification = certification == null || certification.isBlank() ? null : certification.trim();
        return rs;
    }

    public boolean isPrimary() {
        return primary;
    }

    public String getCertification() {
        return certification;
    }

    public ResourceSkillId getId() {
        return id;
    }

    public UUID getResourceId() {
        return id != null ? id.getResourceId() : null;
    }

    public UUID getSkillId() {
        return id != null ? id.getSkillId() : null;
    }

    public String getProficiency() {
        return proficiency;
    }

    public BigDecimal getYearsOfExperience() {
        return yearsOfExperience;
    }

    @Embeddable
    public static class ResourceSkillId implements Serializable {

        @Column(name = "resource_id", nullable = false)
        private UUID resourceId;

        @Column(name = "skill_id", nullable = false)
        private UUID skillId;

        protected ResourceSkillId() {}

        public ResourceSkillId(UUID resourceId, UUID skillId) {
            this.resourceId = resourceId;
            this.skillId = skillId;
        }

        public UUID getResourceId() {
            return resourceId;
        }

        public UUID getSkillId() {
            return skillId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof ResourceSkillId that)) {
                return false;
            }
            return Objects.equals(resourceId, that.resourceId) && Objects.equals(skillId, that.skillId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(resourceId, skillId);
        }
    }
}
