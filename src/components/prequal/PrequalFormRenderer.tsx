"use client";

import type { PrequalQuestion } from "@/domain/loaders/prequal";

// Renders a question array. Three modes:
//   - "fill":  editable inputs (sub side, draft)
//   - "view":  read-only answers, no score
//   - "review": read-only answers (contractor side; score breakdown is the
//               separate <PrequalReviewPanel> component, not embedded here)

export type FormMode = "fill" | "view" | "review";

export type AnswersMap = Record<string, unknown>;

export function PrequalFormRenderer({
  questions,
  answers,
  mode,
  onChange,
}: {
  questions: PrequalQuestion[];
  answers: AnswersMap;
  mode: FormMode;
  onChange?: (key: string, value: unknown) => void;
}) {
  const readOnly = mode !== "fill";

  return (
    <div>
      {questions.map((q) => (
        <Field
          key={q.key}
          q={q}
          value={answers[q.key]}
          readOnly={readOnly}
          onChange={(v) => onChange?.(q.key, v)}
        />
      ))}
    </div>
  );
}

function Field({
  q,
  value,
  readOnly,
  onChange,
}: {
  q: PrequalQuestion;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  return (
    <label className="pq-field">
      <span className={`pq-field-label${q.required ? " required" : ""}`}>
        {q.label}
      </span>
      {q.helpText ? <span className="pq-field-help">{q.helpText}</span> : null}
      <Input q={q} value={value} readOnly={readOnly} onChange={onChange} />
    </label>
  );
}

function Input({
  q,
  value,
  readOnly,
  onChange,
}: {
  q: PrequalQuestion;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  if (readOnly) {
    return <ReadOnlyValue q={q} value={value} />;
  }
  switch (q.type) {
    case "short_text":
      return (
        <input
          type="text"
          className="pq-input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={q.required}
        />
      );
    case "long_text":
      return (
        <textarea
          className="pq-textarea"
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={q.required}
        />
      );
    case "number":
      return (
        <input
          type="number"
          className="pq-input"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange(n);
          }}
          required={q.required}
          step="any"
        />
      );
    case "yes_no":
      return (
        <div className="pq-radio-group">
          <label
            className={`pq-radio${value === true ? " on" : ""}`}
          >
            <input
              type="radio"
              name={q.key}
              checked={value === true}
              onChange={() => onChange(true)}
            />
            Yes
          </label>
          <label
            className={`pq-radio${value === false ? " on" : ""}`}
          >
            <input
              type="radio"
              name={q.key}
              checked={value === false}
              onChange={() => onChange(false)}
            />
            No
          </label>
        </div>
      );
    case "select_one":
      return (
        <div className="pq-radio-group">
          {(q.options ?? []).map((opt) => (
            <label
              key={opt.key}
              className={`pq-radio${value === opt.key ? " on" : ""}`}
            >
              <input
                type="radio"
                name={q.key}
                checked={value === opt.key}
                onChange={() => onChange(opt.key)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="pq-checkbox-group">
          {(q.options ?? []).map((opt) => {
            const checked = arr.includes(opt.key);
            return (
              <label
                key={opt.key}
                className={`pq-checkbox${checked ? " on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? arr.filter((k) => k !== opt.key)
                      : [...arr, opt.key];
                    onChange(next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      );
    }
  }
}

function ReadOnlyValue({ q, value }: { q: PrequalQuestion; value: unknown }) {
  let display = "";
  if (q.type === "yes_no") {
    display = value === true ? "Yes" : value === false ? "No" : "—";
  } else if (q.type === "select_one") {
    const opt = q.options?.find((o) => o.key === value);
    display = opt?.label ?? "—";
  } else if (q.type === "multi_select") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    display = arr
      .map((k) => q.options?.find((o) => o.key === k)?.label ?? k)
      .join(", ") || "—";
  } else if (q.type === "number") {
    display = typeof value === "number" ? String(value) : "—";
  } else {
    display = typeof value === "string" && value.length > 0 ? value : "—";
  }
  return (
    <div
      className="pq-input"
      style={{
        background: "var(--surface-2)",
        cursor: "default",
        whiteSpace: "pre-wrap",
      }}
    >
      {display}
      {q.unit && display !== "—" ? <span> {q.unit}</span> : null}
    </div>
  );
}
