package com.techearnest.crm.common.bulk;

import com.techearnest.crm.common.bulk.BulkDtos.BulkItemFailure;
import com.techearnest.crm.common.bulk.BulkDtos.BulkResult;
import com.techearnest.crm.common.exception.BusinessException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Applies an action to each id and reports per-record failures instead of failing the batch.
 * The action must not call other {@code @Transactional} beans that can throw, or a single failure
 * would mark the surrounding transaction rollback-only.
 */
public final class BulkExecutor {

    public static final int MAX_IDS = 100;

    private BulkExecutor() {}

    public static BulkResult run(List<UUID> ids, String noun, Consumer<UUID> action) {
        List<UUID> unique = cap(ids, noun);
        List<BulkItemFailure> failures = new ArrayList<>();
        int succeeded = 0;
        for (UUID id : unique) {
            try {
                action.accept(id);
                succeeded++;
            } catch (RuntimeException ex) {
                failures.add(new BulkItemFailure(id, ex.getMessage() == null ? "FAILED" : ex.getMessage()));
            }
        }
        return new BulkResult(succeeded, failures.size(), failures);
    }

    private static List<UUID> cap(List<UUID> ids, String noun) {
        if (ids == null || ids.isEmpty()) {
            throw new BusinessException("BULK_EMPTY", "Select at least one " + noun);
        }
        List<UUID> unique = new ArrayList<>(new LinkedHashSet<>(ids));
        if (unique.size() > MAX_IDS) {
            throw new BusinessException("BULK_LIMIT", "Bulk actions are capped at " + MAX_IDS + " records");
        }
        return unique;
    }
}
