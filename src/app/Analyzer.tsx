"use client";

import { useMemo, useRef, useState } from "react";
import { parseBillId, toCanonical, toLabel } from "@/lib/billId";
import { normalizeWhitespace } from "@/lib/billText";
import { newId, parseAnswer, reviewDrivers, verifyQuote, type ReviewedDriver } from "@/lib/drivers";
import { buildExport, compareExports, parseExport, toMarkdown, type BillMeta, type Comparison } from "@/lib/exportFile";
import { parseRubric, type Rubric } from "@/lib/rubric";
import { score } from "@/lib/score";
import { CONFIDENCES, DRIVERS, FREQUENCIES, TEAM_LABELS, driverLabel } from "@/lib/taxonomy";
import { buildExtractionPrompt, buildRepairPrompt, LONG_PROMPT_CHARS, PROMPT_VERSION } from "@/prompts/extract";

/**
 * Everything on this page lives in React state only (S-5): nothing is written to
 * localStorage, IndexedDB, cookies or the server. Closing the tab erases it.
 * Untrusted text (bill text, AI answers) is only ever rendered as text (S-6).
 */

interface Bill {
  id: string;
  label: string;
  title: string | null;
  versionLabel: string | null;
  text: string;
  structured: boolean;
  url: string | null;
  source: "fetched" | "pasted";
}

const DIGEST_END = /THE PEOPLE OF THE STATE OF CALIFORNIA DO ENACT AS FOLLOWS/i;

function download(name: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readFile(file: File, max: number): Promise<string> {
  if (file.size > max) throw new Error("That file is too large.");
  return file.text();
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    } catch {
      setCopied(null);
      alertFallback();
    }
  };
  return { copied, copy };
}
function alertFallback() {
  // Clipboard can be blocked by browser policy; the prompt box stays selectable as a fallback.
  const el = document.getElementById("prompt-box") as HTMLTextAreaElement | null;
  el?.select();
}

export default function Analyzer() {
  const [billInput, setBillInput] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteLabel, setPasteLabel] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [skipDigest, setSkipDigest] = useState(false);

  const [answerText, setAnswerText] = useState("");
  const [answerErrors, setAnswerErrors] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<ReviewedDriver[]>([]);
  const [notFound, setNotFound] = useState<string[]>([]);

  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [rubricName, setRubricName] = useState<string | null>(null);
  const [rubricErrors, setRubricErrors] = useState<string[]>([]);

  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const rubricInput = useRef<HTMLInputElement>(null);
  const compareInput = useRef<HTMLInputElement>(null);
  const { copied, copy } = useCopy();

  // ---------- Step 1: bill ----------
  async function loadBill(e: React.FormEvent) {
    e.preventDefault();
    setBillError(null);
    const id = parseBillId(billInput);
    if (!id) {
      setBillError("That doesn't look like a California bill ID. Try “AB 123”, “SB 45 2025”, or a leginfo link.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bill?id=${encodeURIComponent(toCanonical(id))}`);
      const data = await res.json();
      if (!res.ok) {
        setBillError(typeof data?.message === "string" ? data.message : "Couldn't load the bill.");
        setPasteOpen(true);
        setPasteLabel(toLabel(id));
        return;
      }
      resetAfterBill();
      setBill({
        id: data.id,
        label: data.label,
        title: data.title,
        versionLabel: data.versionLabel,
        text: data.text,
        structured: data.structured,
        url: data.links?.text ?? null,
        source: "fetched",
      });
    } catch {
      setBillError("Couldn't reach this site's bill service. Paste the bill text instead.");
      setPasteOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function submitPasted(e: React.FormEvent) {
    e.preventDefault();
    const text = normalizeWhitespace(pasteText);
    if (text.length < 100) {
      setBillError("That's too short to be a bill. Paste the full bill text.");
      return;
    }
    const id = parseBillId(pasteLabel);
    resetAfterBill();
    setBillError(null);
    setBill({
      id: id ? toCanonical(id) : pasteLabel.trim().slice(0, 40) || "pasted-bill",
      label: id ? toLabel(id) : pasteLabel.trim().slice(0, 80) || "Pasted bill",
      title: null,
      versionLabel: null,
      text,
      structured: DIGEST_END.test(text),
      url: null,
      source: "pasted",
    });
  }

  function resetAfterBill() {
    setAnswerText("");
    setAnswerErrors([]);
    setDrivers([]);
    setNotFound([]);
    setComparison(null);
  }

  // ---------- Step 2: prompt ----------
  const promptText = useMemo(() => {
    if (!bill) return "";
    let text = bill.text;
    if (skipDigest) {
      const i = text.search(DIGEST_END);
      if (i > 0) text = text.slice(i);
    }
    return buildExtractionPrompt({ billLabel: bill.label, versionLabel: bill.versionLabel, billText: text });
  }, [bill, skipDigest]);

  // ---------- Step 3: answer ----------
  function checkAnswer(e: React.FormEvent) {
    e.preventDefault();
    const r = parseAnswer(answerText);
    if (!r.ok) {
      setAnswerErrors(r.errors);
      setDrivers([]);
      return;
    }
    setAnswerErrors([]);
    setDrivers(reviewDrivers(r.answer, bill?.text ?? null));
    setNotFound(r.answer.not_found);
    setComparison(null);
  }

  // ---------- Step 4: review ----------
  function updateDriver(id: string, patch: Partial<ReviewedDriver>) {
    setDrivers((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...patch, editedByAnalyst: true };
        if (patch.quote !== undefined) next.quoteStatus = verifyQuote(next.quote, bill?.text ?? null);
        return next;
      }),
    );
  }
  function removeDriver(id: string) {
    setDrivers((ds) => ds.filter((d) => d.id !== id));
  }
  function addDriver() {
    setDrivers((ds) => [
      ...ds,
      {
        id: newId(),
        code: "NEW_REPORT",
        summary: "Added by analyst",
        section: "",
        quote: "",
        frequency: "unknown",
        effective_date: null,
        confidence: "medium",
        quoteStatus: "missing",
        editedByAnalyst: true,
      },
    ]);
  }

  // ---------- Step 5: rubric ----------
  async function onRubricFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      applyRubric(await readFile(file, 1_000_000), file.name);
    } catch (err) {
      setRubricErrors([(err as Error).message]);
    }
  }
  function applyRubric(text: string, name: string) {
    const r = parseRubric(text);
    if (!r.ok) {
      setRubric(null);
      setRubricName(null);
      setRubricErrors(r.errors);
      return;
    }
    setRubric(r.rubric);
    setRubricName(name);
    setRubricErrors([]);
  }
  async function loadExampleRubric() {
    const res = await fetch("/rubric.example.json");
    applyRubric(await res.text(), "rubric.example.json (made-up numbers)");
  }

  // ---------- Step 6: results ----------
  const result = useMemo(() => (rubric && drivers.length ? score(drivers, rubric) : null), [rubric, drivers]);
  const meta: BillMeta | null = bill
    ? { id: bill.id, label: bill.label, version: bill.versionLabel, url: bill.url }
    : null;

  function exportAs(kind: "full" | "drivers_only", format: "md" | "json") {
    if (!meta) return;
    const file = buildExport(meta, drivers, result, kind);
    const base = `${meta.id}-${kind === "full" ? "worksheet-INTERNAL" : "drivers"}-${file.generated_at.slice(0, 10)}`;
    if (format === "json") download(`${base}.json`, JSON.stringify(file, null, 2), "application/json");
    else download(`${base}.md`, toMarkdown(file), "text/markdown");
  }

  async function onCompareFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !meta) return;
    try {
      const parsed = parseExport(await readFile(file, 2_000_000));
      if (!parsed.ok) {
        setCompareError(parsed.error);
        setComparison(null);
        return;
      }
      setCompareError(null);
      setComparison(compareExports(parsed.file, buildExport(meta, drivers, result, result ? "full" : "drivers_only")));
    } catch (err) {
      setCompareError((err as Error).message);
    }
  }

  const unverified = drivers.filter((d) => d.quoteStatus !== "verified").length;

  return (
    <main id="main" className="page">
      <header className="intro">
        <h1>Bill Impact Analyzer</h1>
        <p className="lead">
          Turn a California bill into a draft IT workload worksheet for Development, Project Management, Operations and
          Security.
        </p>
        <p className="note">
          <strong>What this tool stores: nothing.</strong> The bill text is public. Your rubric is read from your computer
          into this tab only and is never uploaded. Close the tab and it&apos;s gone. Results are drafts for analyst
          review, not a fiscal analysis.
        </p>
      </header>

      {/* STEP 1 */}
      <section aria-labelledby="s1">
        <h2 id="s1">1. Load the bill</h2>
        <form onSubmit={loadBill} className="row">
          <label htmlFor="bill-input">Bill ID or leginfo link</label>
          <input
            id="bill-input"
            value={billInput}
            onChange={(e) => setBillInput(e.target.value)}
            placeholder="AB 123  ·  SB 45 2025  ·  https://leginfo.legislature.ca.gov/…"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
          />
          <button type="submit" disabled={loading || billInput.trim() === ""}>
            {loading ? "Loading…" : "Load bill"}
          </button>
        </form>
        <div aria-live="polite">
          {loading && <p className="status">Fetching from the Legislature&apos;s site…</p>}
          {billError && <p className="error">{billError}</p>}
        </div>
        <details open={pasteOpen} onToggle={(e) => setPasteOpen((e.target as HTMLDetailsElement).open)}>
          <summary>Or paste the bill text yourself</summary>
          <form onSubmit={submitPasted} className="stack">
            <label htmlFor="paste-label">Bill ID or name</label>
            <input id="paste-label" value={pasteLabel} onChange={(e) => setPasteLabel(e.target.value)} maxLength={120} />
            <label htmlFor="paste-text">Bill text</label>
            <textarea id="paste-text" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} maxLength={2_000_000} />
            <button type="submit">Use this text</button>
          </form>
        </details>
        {bill && (
          <div className="card" aria-live="polite">
            <p>
              <strong>{bill.label}</strong>
              {bill.title ? ` — ${bill.title}` : ""}
            </p>
            <p>
              Version: {bill.versionLabel ?? "not detected"} · {bill.text.length.toLocaleString()} characters ·{" "}
              {bill.source === "fetched" ? "loaded from leginfo" : "pasted"}
              {bill.url && (
                <>
                  {" · "}
                  <a href={bill.url} target="_blank" rel="noopener noreferrer">
                    Open on leginfo
                  </a>
                </>
              )}
            </p>
            {!bill.structured && (
              <p className="warn">
                Couldn&apos;t find the Legislative Counsel&apos;s Digest or the enacting clause. Check that the text below is the
                bill and not the page around it, or paste the text instead.
              </p>
            )}
            <details>
              <summary>Show the bill text</summary>
              <pre className="billtext">{bill.text}</pre>
            </details>
          </div>
        )}
      </section>

      {/* STEP 2 */}
      <section aria-labelledby="s2" className={bill ? "" : "disabled"}>
        <h2 id="s2">2. Copy the prompt into your AI</h2>
        {!bill ? (
          <p className="muted">Load a bill first.</p>
        ) : (
          <>
            <p>
              Paste this into Copilot (for work) or another AI chat. It contains only the public bill text and the driver
              list, never your rubric.
            </p>
            <div className="row">
              <button type="button" onClick={() => copy("prompt", promptText)}>
                {copied === "prompt" ? "Copied" : "Copy prompt"}
              </button>
              <span className="muted">
                {promptText.length.toLocaleString()} characters · {PROMPT_VERSION}
              </span>
            </div>
            {promptText.length > LONG_PROMPT_CHARS && (
              <p className="warn">
                This prompt is long; some chat tools cut long messages.{" "}
                {bill.structured && (
                  <label className="inline">
                    <input type="checkbox" checked={skipDigest} onChange={(e) => setSkipDigest(e.target.checked)} /> Leave out
                    the Legislative Counsel&apos;s Digest
                  </label>
                )}
              </p>
            )}
            <details>
              <summary>Show the prompt</summary>
              <label htmlFor="prompt-box" className="sr-only">
                Prompt text
              </label>
              <textarea id="prompt-box" readOnly rows={10} value={promptText} />
            </details>
          </>
        )}
      </section>

      {/* STEP 3 */}
      <section aria-labelledby="s3" className={bill ? "" : "disabled"}>
        <h2 id="s3">3. Paste the AI&apos;s answer</h2>
        <form onSubmit={checkAnswer} className="stack">
          <label htmlFor="answer">The JSON your AI returned</label>
          <textarea
            id="answer"
            rows={8}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder='{ "drivers": [ … ] }'
            spellCheck={false}
            maxLength={200_000}
          />
          <button type="submit" disabled={answerText.trim() === ""}>
            Check answer
          </button>
        </form>
        <div aria-live="polite">
          {answerErrors.length > 0 && (
            <div className="error">
              <p>The answer didn&apos;t match the expected format:</p>
              <ul>
                {answerErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <button type="button" onClick={() => copy("repair", buildRepairPrompt(answerErrors))}>
                {copied === "repair" ? "Copied" : "Copy a fix-it prompt for the AI"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* STEP 4 */}
      <section aria-labelledby="s4" className={drivers.length ? "" : "disabled"}>
        <h2 id="s4">4. Review the drivers</h2>
        {drivers.length === 0 ? (
          <p className="muted">Check an answer first.</p>
        ) : (
          <>
            <p aria-live="polite">
              {drivers.length} driver{drivers.length === 1 ? "" : "s"}.{" "}
              {unverified > 0
                ? `${unverified} quote${unverified === 1 ? "" : "s"} could not be found in the bill text — check those rows.`
                : "Every quote was found in the bill text."}{" "}
              Your edits are marked in the export.
            </p>
            <div className="tablewrap">
              <table>
                <caption className="sr-only">Workload drivers found in the bill</caption>
                <thead>
                  <tr>
                    <th scope="col">Driver</th>
                    <th scope="col">Section</th>
                    <th scope="col">What the bill requires</th>
                    <th scope="col">Frequency</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Quote</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.id} className={d.quoteStatus === "verified" ? "" : "flag"}>
                      <td>
                        <label className="sr-only" htmlFor={`code-${d.id}`}>
                          Driver {i + 1}
                        </label>
                        <select id={`code-${d.id}`} value={d.code} onChange={(e) => updateDriver(d.id, { code: e.target.value as ReviewedDriver["code"] })}>
                          {DRIVERS.map((x) => (
                            <option key={x.code} value={x.code}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                        {d.editedByAnalyst && <span className="tag">edited</span>}
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`sec-${d.id}`}>
                          Section for driver {i + 1}
                        </label>
                        <input id={`sec-${d.id}`} value={d.section} maxLength={200} onChange={(e) => updateDriver(d.id, { section: e.target.value })} />
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`sum-${d.id}`}>
                          Summary for driver {i + 1}
                        </label>
                        <textarea id={`sum-${d.id}`} rows={2} value={d.summary} maxLength={400} onChange={(e) => updateDriver(d.id, { summary: e.target.value })} />
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`freq-${d.id}`}>
                          Frequency for driver {i + 1}
                        </label>
                        <select id={`freq-${d.id}`} value={d.frequency} onChange={(e) => updateDriver(d.id, { frequency: e.target.value as ReviewedDriver["frequency"] })}>
                          {FREQUENCIES.map((f) => (
                            <option key={f} value={f}>
                              {f.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`conf-${d.id}`}>
                          Confidence for driver {i + 1}
                        </label>
                        <select id={`conf-${d.id}`} value={d.confidence} onChange={(e) => updateDriver(d.id, { confidence: e.target.value as ReviewedDriver["confidence"] })}>
                          {CONFIDENCES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`quote-${d.id}`}>
                          Quote for driver {i + 1}
                        </label>
                        <textarea id={`quote-${d.id}`} rows={2} value={d.quote} maxLength={600} onChange={(e) => updateDriver(d.id, { quote: e.target.value })} />
                        <span className={`qs qs-${d.quoteStatus}`}>
                          {d.quoteStatus === "verified"
                            ? "Found in bill"
                            : d.quoteStatus === "unverified"
                              ? "Not found in bill"
                              : d.quoteStatus === "missing"
                                ? "No quote"
                                : "No bill text to check"}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="link" onClick={() => removeDriver(d.id)}>
                          Remove<span className="sr-only"> driver {i + 1}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addDriver}>
              Add a driver
            </button>
            {notFound.length > 0 && (
              <p className="muted">AI checked for and did not find: {notFound.map(driverLabel).join(", ")}.</p>
            )}
          </>
        )}
      </section>

      {/* STEP 5 */}
      <section aria-labelledby="s5">
        <h2 id="s5">5. Load your rubric</h2>
        <p>
          Your rubric maps each driver to hours by classification. It is read from your computer into this tab only.
        </p>
        <div className="row">
          <input ref={rubricInput} id="rubric-file" aria-label="Rubric file" tabIndex={-1} type="file" accept=".json,application/json" onChange={onRubricFile} className="sr-only" />
          <button type="button" onClick={() => rubricInput.current?.click()}>
            Load rubric.json
          </button>
          <button type="button" className="secondary" onClick={loadExampleRubric}>
            Try the example (made-up numbers)
          </button>
          {rubric && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setRubric(null);
                setRubricName(null);
              }}
            >
              Clear rubric
            </button>
          )}
        </div>
        <div aria-live="polite">
          {rubric && (
            <p className="status">
              Loaded <strong>{rubricName}</strong>: version {rubric.rubric_version}, {rubric.rules.length} rules,{" "}
              {rubric.hours_per_position.toLocaleString()} hours per position.
            </p>
          )}
          {rubricErrors.length > 0 && (
            <div className="error">
              <p>That rubric couldn&apos;t be used:</p>
              <ul>
                {rubricErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* STEP 6 */}
      <section aria-labelledby="s6" className={result ? "" : "disabled"}>
        <h2 id="s6">6. Impact by team</h2>
        {!result ? (
          <p className="muted">Review drivers and load a rubric to see the worksheet.</p>
        ) : (
          <>
            {result.noImpactOnly && <p className="status">The AI found no IT impact. Confirm by reading the bill&apos;s operative sections.</p>}
            <div className="tablewrap">
              <table>
                <caption>Draft staffing by team (rubric {result.rubricVersion}, {result.hoursPerPosition.toLocaleString()} hours per position)</caption>
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Impact</th>
                    <th scope="col">One-time hours</th>
                    <th scope="col">Ongoing hours / yr</th>
                    <th scope="col">One-time positions</th>
                    <th scope="col">Ongoing positions</th>
                    <th scope="col">By classification</th>
                  </tr>
                </thead>
                <tbody>
                  {result.teams.map((t) => (
                    <tr key={t.team}>
                      <th scope="row">{TEAM_LABELS[t.team]}</th>
                      <td>
                        <span className={`impact impact-${t.impact}`}>{t.impact}</span>
                        {t.unscored.length > 0 && <span className="muted"> · {t.unscored.length} needs your estimate</span>}
                      </td>
                      <td className="num">{t.oneTimeHours.toLocaleString()}</td>
                      <td className="num">{t.ongoingHours.toLocaleString()}</td>
                      <td className="num">{t.oneTimePositions}</td>
                      <td className="num">{t.ongoingPositions}</td>
                      <td>
                        {t.byClass.length === 0
                          ? "—"
                          : t.byClass.map((c) => (
                              <div key={c.classification}>
                                {c.classification}: {c.oneTimeHours ? `${c.oneTimeHours} one-time` : ""}
                                {c.oneTimeHours && c.ongoingHours ? ", " : ""}
                                {c.ongoingHours ? `${c.ongoingHours}/yr` : ""}
                              </div>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.unscored.length > 0 && (
              <p className="warn">
                No rubric rule for: {result.unscored.map((d) => `${driverLabel(d.code)}${d.section ? ` (${d.section})` : ""}`).join("; ")}. Estimate these yourself or add rules to your rubric.
              </p>
            )}
            {result.deadlines.length > 0 && (
              <p>
                Deadlines: {result.deadlines.map((d) => `${d.date ?? "date not given"}${d.section ? ` (${d.section})` : ""}`).join("; ")}.
              </p>
            )}
          </>
        )}

        {drivers.length > 0 && (
          <div className="exports">
            <h3>Export</h3>
            <div className="row">
              <button type="button" onClick={() => exportAs("full", "md")} disabled={!result}>
                Worksheet (Markdown, internal)
              </button>
              <button type="button" onClick={() => exportAs("full", "json")} disabled={!result}>
                Worksheet (JSON, internal)
              </button>
              <button type="button" className="secondary" onClick={() => exportAs("drivers_only", "md")}>
                Drivers only (safe to share)
              </button>
            </div>
            <h3>Compare with an earlier version</h3>
            <p className="muted">Load a JSON export you saved for an earlier version of this bill to see what the amendment changed.</p>
            <input ref={compareInput} id="compare-file" aria-label="Earlier export file" tabIndex={-1} type="file" accept=".json,application/json" onChange={onCompareFile} className="sr-only" />
            <button type="button" className="secondary" onClick={() => compareInput.current?.click()}>
              Load earlier export
            </button>
            <div aria-live="polite">
              {compareError && <p className="error">{compareError}</p>}
              {comparison && (
                <div className="card">
                  <p>
                    {comparison.added.length} driver(s) added, {comparison.removed.length} removed, {comparison.unchanged} unchanged.
                  </p>
                  {comparison.added.length > 0 && (
                    <p>Added: {comparison.added.map((d) => `${driverLabel(d.code)} (${d.section || "no section"})`).join("; ")}</p>
                  )}
                  {comparison.removed.length > 0 && (
                    <p>Removed: {comparison.removed.map((d) => `${driverLabel(d.code)} (${d.section || "no section"})`).join("; ")}</p>
                  )}
                  {comparison.teamDeltas && (
                    <ul>
                      {comparison.teamDeltas.map((t) => (
                        <li key={t.team}>
                          {TEAM_LABELS[t.team as keyof typeof TEAM_LABELS]}: {t.oneTime >= 0 ? "+" : ""}
                          {t.oneTime} one-time hours, {t.ongoing >= 0 ? "+" : ""}
                          {t.ongoing} ongoing hours/yr
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="foot">
        <p className="muted">
          Personal tool. Bill text from leginfo.legislature.ca.gov. Output is a draft for analyst review.
        </p>
      </footer>
    </main>
  );
}
