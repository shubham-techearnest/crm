package com.techearnest.crm.importer.application;

/** A spreadsheet row that cannot be imported; the message is shown to the user next to the row number. */
public class RowRejected extends RuntimeException {

    public RowRejected(String message) {
        super(message, null, false, false);
    }
}
