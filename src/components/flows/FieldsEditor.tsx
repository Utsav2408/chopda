"use client";

import { FIELD_TYPES, type FieldType, type StepField } from "@/lib/flow-fields";
import { FormField } from "@/components/forms/FormField";

export type FieldsEditorProps = {
  fields: StepField[];
  disabled?: boolean;
  onChange: (fields: StepField[]) => void;
};

function slugifyKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!base) return "field";
  if (/^[a-z]/.test(base)) return base.slice(0, 64);
  return `f_${base}`.slice(0, 64);
}

function uniqueKey(preferred: string, existing: StepField[], skipIndex?: number): string {
  let key = preferred || "field";
  const taken = new Set(existing.filter((_, i) => i !== skipIndex).map((f) => f.key));
  if (!taken.has(key)) return key;
  let n = 2;
  while (taken.has(`${key}_${n}`)) n += 1;
  return `${key}_${n}`.slice(0, 64);
}

export function FieldsEditor({ fields, disabled = false, onChange }: FieldsEditorProps) {
  function updateAt(index: number, patch: Partial<StepField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function addField() {
    const label = `Field ${fields.length + 1}`;
    const key = uniqueKey(slugifyKey(label), fields);
    onChange([
      ...fields,
      {
        key,
        label,
        type: "text",
        required: false,
      },
    ]);
  }

  return (
    <div className="flow-fields">
      {fields.length === 0 ? (
        <p className="ui-hint">No fields yet. Add file, text, confirm, date, or number fields.</p>
      ) : null}

      {fields.map((field, index) => (
        <div key={`field-${index}`} className="flow-field-row">
          <FormField name={`field-${index}-label`} label="Label" htmlFor={`field-${index}-label`}>
            <input
              id={`field-${index}-label`}
              className="ui-input"
              value={field.label}
              disabled={disabled}
              onChange={(e) => {
                const label = e.target.value;
                const key = uniqueKey(slugifyKey(label), fields, index);
                updateAt(index, { label, key });
              }}
            />
          </FormField>

          <FormField name={`field-${index}-type`} label="Type" htmlFor={`field-${index}-type`}>
            <select
              id={`field-${index}-type`}
              className="ui-input"
              value={field.type}
              disabled={disabled}
              onChange={(e) => updateAt(index, { type: e.target.value as FieldType })}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flow-field-row__checks flow-field-row__wide">
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={field.required}
                disabled={disabled}
                onChange={(e) => updateAt(index, { required: e.target.checked })}
              />
              Required
            </label>
            <span className="ui-hint">Key: {field.key}</span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              disabled={disabled}
              onClick={() => removeAt(index)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="ui-btn ui-btn--ghost" disabled={disabled} onClick={addField}>
        Add field
      </button>
    </div>
  );
}
