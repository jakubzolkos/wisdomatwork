'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Download, Upload, Users } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { COHORTS } from '@/lib/cohorts'
import { bulkInviteAction, type BulkInviteSummary } from './actions'
import {
  CSV_TEMPLATE_CONTENT,
  parseCsv,
  parsePastedList,
  type ParsedInviteRow,
} from '@/lib/invitations/parse'

type Props = {
  cohorts: { id: string; name: string }[]
}

const NONE_TEAM = '__none__'
const NONE_COHORT = '__none_cohort__'

type Mode = 'paste' | 'csv'
type Step = 'input' | 'preview' | 'summary'

/**
 * Bulk-invite dialog. The flow is intentionally three-stepped so the
 * admin sees exactly what they're about to send before any email
 * goes out:
 *
 *   1. input    - paste rows or upload a CSV
 *   2. preview  - parsed table with per-row validation feedback
 *   3. summary  - real send results from the server action
 */
export function BulkInviteDialog({ cohorts }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('input')
  const [mode, setMode] = useState<Mode>('paste')
  const [pastedText, setPastedText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvHeaderError, setCsvHeaderError] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<ParsedInviteRow[]>([])
  const [role, setRole] = useState<Role>('fellow')
  const [schoolTeamId, setSchoolTeamId] = useState<string>(NONE_TEAM)
  const [cohortLetter, setCohortLetter] = useState<string>(NONE_COHORT)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<BulkInviteSummary | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFellow = role === 'fellow'

  const validCount = useMemo(
    () => previewRows.filter((r) => r.ok).length,
    [previewRows],
  )
  const invalidCount = previewRows.length - validCount

  function reset() {
    setStep('input')
    setMode('paste')
    setPastedText('')
    setCsvText('')
    setCsvFileName(null)
    setCsvHeaderError(null)
    setPreviewRows([])
    setRole('fellow')
    setSchoolTeamId(NONE_TEAM)
    setCohortLetter(NONE_COHORT)
    setError(null)
    setSummary(null)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setCsvFileName(file.name)
    setCsvHeaderError(null)
    setError(null)
  }

  function handleDownloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'invite-fellows-template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handlePreview() {
    setError(null)
    setCsvHeaderError(null)
    const text = mode === 'csv' ? csvText : pastedText
    if (!text.trim()) {
      setError(
        mode === 'csv'
          ? 'Choose a CSV file first'
          : 'Paste at least one row to continue',
      )
      return
    }
    if (mode === 'csv') {
      const parsed = parseCsv(text)
      if (parsed.headerError) {
        setCsvHeaderError(parsed.headerError)
        return
      }
      if (parsed.rows.length === 0) {
        setError('CSV is empty - add at least one row of fellows.')
        return
      }
      setPreviewRows(parsed.rows)
    } else {
      const rows = parsePastedList(text)
      if (rows.length === 0) {
        setError('No rows found in input')
        return
      }
      setPreviewRows(rows)
    }
    setStep('preview')
  }

  function handleSubmit() {
    if (validCount === 0) {
      setError('Fix the rows above before sending invitations.')
      return
    }
    setError(null)
    setSummary(null)

    const text = mode === 'csv' ? csvText : pastedText
    const fd = new FormData()
    fd.set('source', mode)
    fd.set('text', text)
    fd.set('role', role)
    fd.set('cohortId', schoolTeamId === NONE_TEAM ? '' : schoolTeamId)
    fd.set(
      'cohortLetter',
      isFellow && cohortLetter !== NONE_COHORT ? cohortLetter : '',
    )
    startTransition(async () => {
      const result = await bulkInviteAction(fd)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSummary(result)
      setStep('summary')
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="h-4 w-4" />
          Bulk invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk invite fellows</DialogTitle>
          <DialogDescription>
            Add many fellows at once. Each recipient gets a personalized
            activation email.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <InputStep
            mode={mode}
            onModeChange={(m) => {
              setMode(m)
              setError(null)
              setCsvHeaderError(null)
            }}
            pastedText={pastedText}
            onPastedTextChange={setPastedText}
            csvText={csvText}
            csvFileName={csvFileName}
            onPickFile={() => fileInputRef.current?.click()}
            onDownloadTemplate={handleDownloadTemplate}
            csvHeaderError={csvHeaderError}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            role={role}
            onRoleChange={setRole}
            schoolTeamId={schoolTeamId}
            onSchoolTeamIdChange={setSchoolTeamId}
            cohortLetter={cohortLetter}
            onCohortLetterChange={setCohortLetter}
            cohorts={cohorts}
            isFellow={isFellow}
            error={error}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            rows={previewRows}
            validCount={validCount}
            invalidCount={invalidCount}
            error={error}
          />
        )}

        {step === 'summary' && summary && (
          <BulkSummary summary={summary} />
        )}

        <DialogFooter className="mt-2">
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handlePreview}>
                Preview rows
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
                disabled={pending}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={pending || validCount === 0}
              >
                {pending && <Spinner className="h-4 w-4" />}
                Send {validCount} invitation{validCount === 1 ? '' : 's'}
              </Button>
            </>
          )}

          {step === 'summary' && (
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InputStep(props: {
  mode: Mode
  onModeChange: (m: Mode) => void
  pastedText: string
  onPastedTextChange: (v: string) => void
  csvText: string
  csvFileName: string | null
  onPickFile: () => void
  onDownloadTemplate: () => void
  csvHeaderError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  role: Role
  onRoleChange: (v: Role) => void
  schoolTeamId: string
  onSchoolTeamIdChange: (v: string) => void
  cohortLetter: string
  onCohortLetterChange: (v: string) => void
  cohorts: { id: string; name: string }[]
  isFellow: boolean
  error: string | null
}) {
  return (
    <div className="space-y-5">
      <Tabs value={props.mode} onValueChange={(v) => props.onModeChange(v as Mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="paste">Paste entries</TabsTrigger>
          <TabsTrigger value="csv">Upload CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-2 pt-3">
          <FieldLabel htmlFor="bulk-paste">Fellow list</FieldLabel>
          <Textarea
            id="bulk-paste"
            value={props.pastedText}
            onChange={(e) => props.onPastedTextChange(e.target.value)}
            placeholder={
              'Lagoon School, Manee, Nnamani, Director of Formation, manee@example.com\n, Jane, Doe, , jane@example.com'
            }
            rows={8}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <FieldDescription>
            Enter one fellow per line in this order:{' '}
            <span className="font-mono">
              School Name, First Name, Last Name, Title, Email Address
            </span>
            . School Name and Title are optional - leave them blank between
            commas. First Name, Last Name, and Email Address are required.
          </FieldDescription>
        </TabsContent>

        <TabsContent value="csv" className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={props.fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={props.onFileChange}
              className="hidden"
            />
            <Button type="button" variant="outline" onClick={props.onPickFile}>
              <Upload className="h-4 w-4" />
              Choose CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={props.onDownloadTemplate}
            >
              <Download className="h-4 w-4" />
              Download CSV Template
            </Button>
            {props.csvFileName ? (
              <span className="text-sm text-muted-foreground">
                {props.csvFileName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No file chosen</span>
            )}
          </div>
          <FieldDescription>
            CSV must include a header row with these exact columns (in any
            order): <span className="font-mono">School Name</span>,{' '}
            <span className="font-mono">First Name</span>,{' '}
            <span className="font-mono">Last Name</span>,{' '}
            <span className="font-mono">Title</span>,{' '}
            <span className="font-mono">Email Address</span>. School Name and
            Title are optional; First Name, Last Name, and Email Address are
            required for every row.
          </FieldDescription>
          {props.csvHeaderError && (
            <p role="alert" className="text-sm text-destructive">
              {props.csvHeaderError}
            </p>
          )}
        </TabsContent>
      </Tabs>

      <FieldGroup>
        <Field>
          <FieldLabel>Default role</FieldLabel>
          <Select
            value={props.role}
            onValueChange={(v) => props.onRoleChange(v as Role)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Default School Name (optional)</FieldLabel>
          <Select
            value={props.schoolTeamId}
            onValueChange={props.onSchoolTeamIdChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_TEAM}>No school</SelectItem>
              {props.cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Used when a row leaves School Name blank. A row that lists an
            existing School Name will override this default.
          </FieldDescription>
        </Field>

        {props.isFellow ? (
          <Field>
            <FieldLabel>Default cohort (optional)</FieldLabel>
            <Select
              value={props.cohortLetter}
              onValueChange={props.onCohortLetterChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_COHORT}>No cohort</SelectItem>
                {COHORTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    Cohort {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </FieldGroup>

      {props.error && (
        <p role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      )}
    </div>
  )
}

function PreviewStep(props: {
  rows: ParsedInviteRow[]
  validCount: number
  invalidCount: number
  error: string | null
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">Total: {props.rows.length}</Badge>
        <Badge className="border-transparent bg-success-soft text-success hover:bg-success-soft">
          Ready: {props.validCount}
        </Badge>
        {props.invalidCount > 0 && (
          <Badge variant="destructive">Errors: {props.invalidCount}</Badge>
        )}
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">School Name</th>
              <th className="px-3 py-2 font-medium">First Name</th>
              <th className="px-3 py-2 font-medium">Last Name</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Email Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {props.rows.map((r, i) => (
              <tr key={`row-${i}`}>
                <td className="px-3 py-2">
                  {r.ok ? (
                    <Badge className="border-transparent bg-success-soft text-success hover:bg-success-soft">
                      Ready
                    </Badge>
                  ) : (
                    <span title={r.error}>
                      <Badge variant="destructive">Error</Badge>
                    </span>
                  )}
                </td>
                {r.ok && r.data ? (
                  <>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.data.school_name ?? '—'}
                    </td>
                    <td className="px-3 py-2">{r.data.first_name}</td>
                    <td className="px-3 py-2">{r.data.last_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.data.title ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.data.email}
                    </td>
                  </>
                ) : (
                  <td
                    className="px-3 py-2 text-xs text-destructive"
                    colSpan={5}
                  >
                    Line {r.line}: {r.error ?? 'invalid row'} —{' '}
                    <span className="font-mono text-muted-foreground">
                      {r.raw.slice(0, 80)}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {props.invalidCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Rows with errors will be skipped. Go back to fix them or send the
          ready rows now.
        </p>
      )}

      {props.error && (
        <p role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      )}
    </div>
  )
}

function BulkSummary({ summary }: { summary: BulkInviteSummary }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">Total: {summary.total}</Badge>
        <Badge className="border-transparent bg-success-soft text-success hover:bg-success-soft">
          Invited: {summary.invited}
        </Badge>
        {summary.failed > 0 && (
          <Badge variant="destructive">Failed: {summary.failed}</Badge>
        )}
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {summary.results.map((r, i) => (
              <tr key={`${r.email}-${i}`}>
                <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                <td className="px-3 py-2">
                  {r.status === 'invited' ? (
                    <span className="text-success">invited</span>
                  ) : (
                    <span className="text-destructive">failed</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.message ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
