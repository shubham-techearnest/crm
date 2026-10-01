import { useQuery } from "@tanstack/react-query";
import { TechEarnestRecordFieldGrid } from "@/components/TechEarnestRecord/TechEarnestRecordFieldGrid";
import { TechEarnestRecordSection } from "@/components/TechEarnestRecord/TechEarnestRecordSection";
import {
  customFieldKeys,
  formatCustomFieldValue,
  getCustomFieldSchema,
  getCustomFieldValues,
  type CustomFieldDefinition,
} from "./customFieldsApi";

/** Read-only display of a record's Metadata Studio custom fields, grouped like the edit layout. */
export function CustomFieldsRecordPanel({ tableCode, recordId }: { tableCode: string; recordId: string }) {
  const schemaQuery = useQuery({
    queryKey: customFieldKeys.schema(tableCode, "EDIT"),
    queryFn: () => getCustomFieldSchema(tableCode, "EDIT"),
    retry: false,
    staleTime: 60_000,
  });
  const hasFields = (schemaQuery.data?.fields.length ?? 0) > 0;
  const valuesQuery = useQuery({
    queryKey: customFieldKeys.values(tableCode, recordId),
    queryFn: () => getCustomFieldValues(tableCode, recordId),
    enabled: hasFields,
    retry: false,
  });

  if (!hasFields || !schemaQuery.data) return null;
  const byCode = new Map(schemaQuery.data.fields.map((field) => [field.code, field]));
  const values = valuesQuery.data ?? {};

  return (
    <>
      {schemaQuery.data.sections.map((section) => {
        const fields = section.fields
          .map((code) => byCode.get(code))
          .filter((field): field is CustomFieldDefinition => !!field);
        if (!fields.length) return null;
        return (
          <TechEarnestRecordSection key={section.id} id={`techearnest-record-section-custom-${section.id}`} title={section.title}>
            <TechEarnestRecordFieldGrid
              fields={fields.map((field) => ({
                label: field.label,
                value: valuesQuery.isLoading ? "…" : formatCustomFieldValue(field, values[field.code]) || "—",
              }))}
            />
          </TechEarnestRecordSection>
        );
      })}
    </>
  );
}
