package com.techearnest.crm.project.application;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Builds project codes in the house format {@code <ACCOUNT>-<PROJECT>-<NNN>}, e.g. {@code DPE-SFD-001} for
 * "Deccan shop-floor dashboard" at Deccan Precision Engineering Pvt Ltd. In-house projects use {@code INT} for the
 * account part. The sequence is per prefix and counts soft-deleted projects too, because codes stay unique in the table.
 */
@Component
public class ProjectCodeGenerator {

    static final String IN_HOUSE_PREFIX = "INT";

    private static final Set<String> LEGAL_SUFFIXES = Set.of(
            "PVT", "PRIVATE", "LTD", "LIMITED", "LLP", "LLC", "INC", "CO", "CORP", "CORPORATION", "COMPANY",
            "PLC", "GMBH", "PTY", "THE", "AND", "OF", "&");
    private static final Set<String> FILLER_WORDS = Set.of(
            "A", "AN", "THE", "AND", "OF", "FOR", "TO", "IN", "ON", "WITH", "APP", "APPLICATION", "PROJECT", "SYSTEM");

    private final JdbcTemplate jdbcTemplate;

    public ProjectCodeGenerator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String next(UUID organizationId, String accountName, String projectName) {
        String prefix = accountPart(accountName) + "-" + projectPart(projectName, accountName);
        Pattern numbered = Pattern.compile("^" + Pattern.quote(prefix) + "-(\\d{1,9})$", Pattern.CASE_INSENSITIVE);
        long max = 0;
        for (String code : jdbcTemplate.queryForList(
                "select project_code from projects where organization_id = ? and upper(project_code) like ?",
                String.class, organizationId, prefix + "-%")) {
            Matcher matcher = numbered.matcher(code);
            if (matcher.matches()) {
                max = Math.max(max, Long.parseLong(matcher.group(1)));
            }
        }
        return String.format(Locale.ROOT, "%s-%03d", prefix, max + 1);
    }

    static String accountPart(String accountName) {
        List<String> words = words(accountName);
        words.removeIf(LEGAL_SUFFIXES::contains);
        return abbreviate(words, IN_HOUSE_PREFIX);
    }

    static String projectPart(String projectName, String accountName) {
        Set<String> accountWords = Set.copyOf(words(accountName));
        List<String> words = words(projectName);
        List<String> distinctive = new ArrayList<>(words);
        distinctive.removeIf(word -> accountWords.contains(word) || FILLER_WORDS.contains(word));
        if (distinctive.isEmpty()) {
            distinctive = words;
            distinctive.removeIf(FILLER_WORDS::contains);
        }
        return abbreviate(distinctive, "PRJ");
    }

    private static String abbreviate(List<String> words, String fallback) {
        if (words.isEmpty()) {
            return fallback;
        }
        if (words.size() == 1) {
            String word = words.get(0);
            return word.length() <= 3 ? word : word.substring(0, 3);
        }
        StringBuilder initials = new StringBuilder();
        for (String word : words) {
            if (initials.length() == 3) {
                break;
            }
            initials.append(word.charAt(0));
        }
        return initials.toString();
    }

    private static List<String> words(String value) {
        if (value == null || value.isBlank()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(Arrays.stream(value.toUpperCase(Locale.ROOT).split("[^A-Z0-9&]+"))
                .filter(word -> !word.isBlank())
                .toList());
    }
}
