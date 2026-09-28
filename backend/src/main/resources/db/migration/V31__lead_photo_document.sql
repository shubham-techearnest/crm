-- Lead profile photo stored as uploaded document reference

ALTER TABLE leads
    ADD COLUMN photo_document_id uuid;
