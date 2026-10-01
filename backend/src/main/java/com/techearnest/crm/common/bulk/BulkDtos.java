package com.techearnest.crm.common.bulk;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public final class BulkDtos {

    private BulkDtos() {}

    public record BulkAssignOwnerRequest(@NotNull List<@NotNull UUID> ids, @NotNull UUID ownerId) {}

    public record BulkStatusRequest(@NotNull List<@NotNull UUID> ids, @NotBlank @Size(max = 32) String status) {}

    public record BulkItemFailure(UUID id, String reason) {}

    public record BulkResult(int succeeded, int failed, List<BulkItemFailure> failures) {}
}
