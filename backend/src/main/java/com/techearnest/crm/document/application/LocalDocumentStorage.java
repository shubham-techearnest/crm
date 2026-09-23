package com.techearnest.crm.document.application;

import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LocalDocumentStorage implements DocumentStorage {

    private final Path root;

    public LocalDocumentStorage(@Value("${crm.storage.root:./data/uploads}") String rootPath) {
        this.root = Path.of(rootPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create document storage root: " + this.root, e);
        }
    }

    @Override
    public String store(
            String organizationId, String documentId, String originalFileName, InputStream content, long sizeBytes) {
        String safeName = sanitizeFileName(originalFileName);
        Path relative = Path.of(organizationId, documentId + "_" + safeName);
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root)) {
            throw new BusinessException("INVALID_PATH", "Invalid storage path");
        }
        try {
            Files.createDirectories(target.getParent());
            Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new BusinessException("STORAGE_ERROR", "Failed to store document");
        }
        return relative.toString().replace('\\', '/');
    }

    @Override
    public InputStream open(String storageKey) {
        Path target = resolve(storageKey);
        if (!Files.isRegularFile(target)) {
            throw new ResourceNotFoundException("Document file not found");
        }
        try {
            return Files.newInputStream(target);
        } catch (IOException e) {
            throw new BusinessException("STORAGE_ERROR", "Failed to read document");
        }
    }

    @Override
    public void delete(String storageKey) {
        Path target = resolve(storageKey);
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            throw new BusinessException("STORAGE_ERROR", "Failed to delete document file");
        }
    }

    private Path resolve(String storageKey) {
        Path target = root.resolve(storageKey).normalize();
        if (!target.startsWith(root)) {
            throw new BusinessException("INVALID_PATH", "Invalid storage path");
        }
        return target;
    }

    private static String sanitizeFileName(String name) {
        if (name == null || name.isBlank()) {
            return "file";
        }
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return cleaned.isEmpty() ? "file" : cleaned.substring(0, Math.min(cleaned.length(), 180));
    }
}
