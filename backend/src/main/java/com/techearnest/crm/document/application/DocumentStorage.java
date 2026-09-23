package com.techearnest.crm.document.application;

import java.io.InputStream;

public interface DocumentStorage {

    String store(String organizationId, String documentId, String originalFileName, InputStream content, long sizeBytes);

    InputStream open(String storageKey);

    void delete(String storageKey);
}
