"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  PrequalQuestion,
  PrequalTemplateDetail,
} from "@/domain/loaders/prequal";

type Tab = "settings" | "questions" | "scoring";

export function TemplateEditor({
  template,
}: {
  template: PrequalTemplateDetail;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("settings");
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [tradeCategory, setTradeCategory] = useState(
    template.tradeCategory ?? "",
  );
  const [validityMonths, setValidityMonths] = useState<number | null>(
    template.validityMonths,
  );
  const [questions, setQuestions] = useState<PrequalQuestion[]>(
    template.questions,
  );
  const [passThreshold, setPassThreshold] = useState(
    template.scoringRules.passThreshold,
  );
  const [gatingFailValues, setGatingFailValues] = useState(
    template.scoringRules.gatingFailValues,
  );

  const isArchived = !!template.archivedAt;

  const persist = (patch: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      startTx(async () => {
        const res = await fetch(
          `/api/prequal/templates/${template.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Save failed (${res.status})`);
          reject(new Error(text));
          return;
        }
        setError(null);
        router.refresh();
        resolve();
      });
    });

  const saveSettings = () => {
    void persist({
      name,
      description: description || null,
      tradeCategory: tradeCategory || null,
      validityMonths: validityMonths ?? null,
    });
  };

  const saveQuestions = () => {
    void persist({ questions });
  };

  const saveScoring = () => {
    void persist({
      scoringRules: {
        passThreshold,
        gatingFailValues,
      },
    });
  };

  const archive = () => {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    startTx(async () => {
      const res = await fetch(
        `/api/prequal/templates/${template.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        setError(text || `Archive failed (${res.status})`);
        return;
      }
      router.push("/contractor/settings/prequalification/templates");
      router.refresh();
    });
  };

  const setDefault = () => {
    startTx(async () => {
      const res = await fetch(
        `/api/prequal/templates/${template.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_default" }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        setError(text || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  const addQuestion = () => {
    const idx = questions.length + 1;
    setQuestions([
      ...questions,
      {
        key: `question_${idx}`,
        label: "New question",
        type: "short_text",
        required: false,
      },
    ]);
  };

  const updateQuestion = (i: number, patch: Partial<PrequalQuestion>) => {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (i: number) => {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  };

  return (
    <>
      <div className="pq-ws">
        <div className="pq-ws-tabs">
          {(
            [
              ["settings", "Settings"],
              ["questions", `Questions (${questions.length})`],
              ["scoring", "Scoring"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`pq-tab${tab === key ? " on" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ padding: "16px 20px 20px" }}>
          {error ? (
            <div className="pq-warn-banner" style={{ marginBottom: 12 }}>
              {error}
            </div>
          ) : null}
          {tab === "settings" && (
            <div>
              <label className="pq-field">
                <span className="pq-field-label required">Template name</span>
                <input
                  className="pq-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isArchived}
                />
              </label>
              <label className="pq-field">
                <span className="pq-field-label">Description</span>
                <textarea
                  className="pq-textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isArchived}
                />
              </label>
              <label className="pq-field">
                <span className="pq-field-label">Trade category</span>
                <input
                  className="pq-input"
                  placeholder="e.g. Electrical, Concrete, Glazing — leave blank for general"
                  value={tradeCategory}
                  onChange={(e) => setTradeCategory(e.target.value)}
                  disabled={isArchived}
                />
                <span className="pq-field-help">
                  Optional. When set, this template auto-suggests for subs whose
                  primary trade matches.
                </span>
              </label>
              <label className="pq-field">
                <span className="pq-field-label">Validity (months)</span>
                <input
                  type="number"
                  className="pq-input"
                  value={validityMonths ?? ""}
                  placeholder="12 (leave blank for never expires)"
                  onChange={(e) =>
                    setValidityMonths(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  disabled={isArchived}
                />
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button
                  className="pq-btn primary"
                  onClick={saveSettings}
                  disabled={pending || isArchived}
                >
                  {pending ? "Saving…" : "Save settings"}
                </button>
                {!template.isDefault && !isArchived ? (
                  <button
                    className="pq-btn"
                    onClick={setDefault}
                    disabled={pending}
                  >
                    Mark as default
                  </button>
                ) : null}
                {!isArchived ? (
                  <button
                    className={`pq-btn ${confirmArchive ? "danger" : "danger-outline"}`}
                    onClick={archive}
                    disabled={pending}
                  >
                    {confirmArchive ? "Confirm archive" : "Archive template"}
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {tab === "questions" && (
            <div>
              {questions.length === 0 ? (
                <div className="pq-empty">
                  <div className="pq-empty-title">No questions yet</div>
                  <div className="pq-empty-sub">
                    Add at least one question before sending an invite.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {questions.map((q, i) => (
                    <QuestionRow
                      key={`${q.key}-${i}`}
                      q={q}
                      onChange={(patch) => updateQuestion(i, patch)}
                      onRemove={() => removeQuestion(i)}
                      disabled={isArchived}
                    />
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="pq-btn"
                  onClick={addQuestion}
                  disabled={isArchived}
                >
                  + Add question
                </button>
                <button
                  className="pq-btn primary"
                  onClick={saveQuestions}
                  disabled={pending || isArchived}
                >
                  {pending ? "Saving…" : "Save questions"}
                </button>
              </div>
            </div>
          )}

          {tab === "scoring" && (
            <div>
              <label className="pq-field">
                <span className="pq-field-label">Pass threshold</span>
                <input
                  type="number"
                  className="pq-input"
                  value={passThreshold}
                  onChange={(e) => setPassThreshold(Number(e.target.value))}
                  disabled={isArchived}
                />
                <span className="pq-field-help">
                  Submissions at or above this score AND with no gating
                  failures are eligible for approval.
                </span>
              </label>

              <div className="pq-form-section">
                <h4>Gating questions</h4>
                <div className="pq-form-section-sub">
                  Questions marked <strong>gating</strong> in the Questions
                  tab. Set the answer that triggers an automatic gating fail.
                </div>
                {questions.filter((q) => q.gating).length === 0 ? (
                  <div className="pq-empty-sub">
                    No gating questions yet. Mark a question as gating in the
                    Questions tab.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {questions
                      .filter((q) => q.gating)
                      .map((q) => (
                        <GatingValueRow
                          key={q.key}
                          q={q}
                          value={gatingFailValues[q.key]}
                          onChange={(v) =>
                            setGatingFailValues({
                              ...gatingFailValues,
                              [q.key]: v,
                            })
                          }
                          disabled={isArchived}
                        />
                      ))}
                  </div>
                )}
              </div>

              <button
                className="pq-btn primary"
                onClick={saveScoring}
                disabled={pending || isArchived}
                style={{ marginTop: 8 }}
              >
                {pending ? "Saving…" : "Save scoring"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function QuestionRow({
  q,
  onChange,
  onRemove,
  disabled,
}: {
  q: PrequalQuestion;
  onChange: (patch: Partial<PrequalQuestion>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 14px",
        background: "var(--surface-1)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 10 }}>
        <input
          className="pq-input"
          value={q.label}
          placeholder="Question label"
          onChange={(e) => onChange({ label: e.target.value })}
          disabled={disabled}
        />
        <select
          className="pq-select"
          value={q.type}
          onChange={(e) =>
            onChange({ type: e.target.value as PrequalQuestion["type"] })
          }
          disabled={disabled}
        >
          <option value="short_text">Short text</option>
          <option value="long_text">Long text</option>
          <option value="yes_no">Yes / No</option>
          <option value="number">Number</option>
          <option value="select_one">Select one</option>
          <option value="multi_select">Multi-select</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11.5,
            color: "var(--text-tertiary)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          key:
          <input
            className="pq-input"
            value={q.key}
            onChange={(e) =>
              onChange({
                key: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, "_"),
              })
            }
            disabled={disabled}
            style={{ width: 200, padding: "6px 8px", fontSize: 12 }}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            disabled={disabled}
          />
          Required
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
          <input
            type="checkbox"
            checked={!!q.gating}
            onChange={(e) => onChange({ gating: e.target.checked })}
            disabled={disabled}
          />
          Gating
        </label>
        {q.type === "yes_no" || q.type === "number" ? (
          <label
            style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}
          >
            weight:
            <input
              type="number"
              className="pq-input"
              value={q.weight ?? 0}
              onChange={(e) => onChange({ weight: Number(e.target.value) })}
              disabled={disabled}
              style={{ width: 80, padding: "6px 8px", fontSize: 12 }}
            />
          </label>
        ) : null}
        <button
          className="pq-btn xs danger-outline"
          onClick={onRemove}
          disabled={disabled}
          style={{ marginLeft: "auto" }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function GatingValueRow({
  q,
  value,
  onChange,
  disabled,
}: {
  q: PrequalQuestion;
  value: string | boolean | string[] | undefined;
  onChange: (v: string | boolean | string[]) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 200px",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface-2)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 580 }}>{q.label}</div>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            color: "var(--text-tertiary)",
          }}
        >
          {q.key}
        </div>
      </div>
      {q.type === "yes_no" ? (
        <select
          className="pq-select"
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) =>
            onChange(e.target.value === "true" ? true : false)
          }
          disabled={disabled}
        >
          <option value="">— pick fail value —</option>
          <option value="true">Fails on Yes</option>
          <option value="false">Fails on No</option>
        </select>
      ) : (
        <input
          className="pq-input"
          placeholder="Fail value"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
