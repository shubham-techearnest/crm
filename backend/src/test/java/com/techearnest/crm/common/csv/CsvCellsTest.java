package com.techearnest.crm.common.csv;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CsvCellsTest {

    @Test
    void neutralisesFormulaTriggers() {
        assertThat(CsvCells.escape("=HYPERLINK(\"http://x\")")).isEqualTo("\"'=HYPERLINK(\"\"http://x\"\")\"");
        assertThat(CsvCells.escape("+cmd")).isEqualTo("'+cmd");
        assertThat(CsvCells.escape("-2+3")).isEqualTo("'-2+3");
        assertThat(CsvCells.escape("@SUM(A1)")).isEqualTo("'@SUM(A1)");
    }

    @Test
    void leavesPlainNumbersAndTextAlone() {
        assertThat(CsvCells.escape("-12.50")).isEqualTo("-12.50");
        assertThat(CsvCells.escape("42")).isEqualTo("42");
        assertThat(CsvCells.escape("Acme")).isEqualTo("Acme");
        assertThat(CsvCells.escape(null)).isEmpty();
    }

    @Test
    void quotesSeparatorsAndLineBreaks() {
        assertThat(CsvCells.escape("a,b")).isEqualTo("\"a,b\"");
        assertThat(CsvCells.escape("line\r\nbreak")).isEqualTo("\"line\r\nbreak\"");
    }
}
