# Board Portal — why things are the way they are

A running decision log for Mez: every button, link and workflow that isn't
self-explanatory, why it came about, and what was rejected along the way.
Newest decisions are added to the relevant section as they happen. Maintained
alongside the code — if a feature changes, its entry here changes with it.

The product in one line: **the board secretary's paper process, automated —
SharePoint stays the single source of truth for documents; the portal reads
from it and records governance (agendas, quorum, motions, minutes, conflicts,
proxies) around it.**

---

## Guiding principles

These recur in almost every decision below:

1. **SharePoint is the master for documents.** The portal never becomes a
   second document store people have to keep in sync. Files are edited in
   SharePoint, previewed in the portal.
2. **Board-centric setup.** You set a board up once (members, quorum rules,
   SharePoint link, constitution); every meeting scheduled for that board
   inherits those settings as defaults, overridable per meeting.
3. **The record must be trustworthy.** Timestamps lock, edits are shown as
   edits, non-voting members never sneak into a quorum count. If it's going
   to be relied on in a dispute, the portal must not quietly rewrite it.
4. **Roles come from the host (Mason-View).** The portal doesn't run its own
   login; MV authenticates and forwards who you are. Member = read, Admin =
   secretary duties, top-level MV roles = destructive actions.

---

## Meetings & scheduling

### Schedule dialog field order: title → date → pack → venue
The dialog originally asked for things in a developer-convenient order. Boyd
reordered it to match how a secretary actually thinks: what the meeting is,
when it is, where its papers live, where it happens.

### Board dropdown drives the defaults
"Go set up the board… then when you schedule a meeting for that board those
settings are default." Picking the board pre-fills quorum rules, venue,
SharePoint library, and invites the sitting members. The alternative — typing
rules per meeting — was rejected because rules live in the constitution, not
in an individual meeting.

### Recurring meetings (REPEATS / series dates)
Boards meet on a rhythm (e.g. third Tuesday monthly). One scheduling action
creates the series rather than requiring N manual entries.

### Quorum rules chosen at schedule, from board settings
Quorum (minimum count, required offices, ex-officio exclusions, named
mandatory members) is defined per board in Board Settings and pulled in at
scheduling with the ability to override for one meeting — because a special
meeting can legitimately have different requirements, but the default must be
the constitutional one. Modeled on AFAM Incorporated's standing rule.

### Non-voting members never count toward quorum
Hard rule: `votingRights === false` is excluded from the count, **unless**
the person is named as mandatory in board settings (some constitutions
require e.g. the Secretary to be present without giving them a vote). Boyd:
"non voting doesn't make a quorum unless it's in the settings turned on as
must be, or in constitution they must be present."

### Delete meetings = top-level MV roles only
Deleting erases the whole governance record (agenda, votes, minutes), so it's
above day-to-day admin. A secretary or chair administers meetings; only
ADMIN / SUPER_ADMIN / BOARD_ADMIN in MV can erase one. The Delete button
simply doesn't render for anyone else.

### Invitations: board members auto-invited; search to add; external ad-hoc
Scheduling a meeting invites the board's sitting members automatically
(officers first). Others are added by typed search. People outside the system
entirely (a presenting consultant, an auditor) are added as ad-hoc external
invitees — created as GUEST with no vote, because a one-off visitor shouldn't
require a full user account.

---

## Board settings

### One page per board, accordion workflow (steps 1–4)
Settings began as a flat admin page covering all boards; Boyd found it
unintuitive. Reworked to: open **a board**, and everything on screen belongs
to that board — members, quorum rule, SharePoint link, constitution — in an
accordion ordered like the setup actually proceeds. "It's like: go set up the
board or committee, then when you open that, all the settings for that is
just that one board."

### Member register shows only sitting members
The register originally listed everyone in the system. Changed to show only
people currently holding a seat on **this** board (BoardMember with tenure
status), because a register full of non-members is noise and looks wrong to
a secretary.

### One profile per person; disclosures selected per board
A person (e.g. Boyd) sits on several boards but has one profile
(phone, title, organisation, bio). What they disclose (interests) is chosen
per board, because an interest can conflict on one board and be irrelevant on
another.

### Officer ordering in the roll
Roll and register list officers first in office order (Chair, then directors,
then Secretary…), matching how a meeting is actually called, not alphabetical.

### Constitution upload → suggested rules
The constitution PDF can be uploaded against the board; the portal extracts
quorum-looking clauses and suggests minimums. Suggestion, not automation —
the secretary confirms, because parsing legal text is fallible and quorum is
exactly where you can't afford a silent misread.

---

## Board pack (SharePoint)

### Agenda item click dives straight to that item's pack folder
Pack folders are numbered to match agenda items ("05 Financial Reports" →
item 5). Clicking the agenda item opens the browser **in that folder**, not
at the pack root — the earlier root-landing behavior made every navigation a
two-step chore and was reported twice before it stuck.

### Sub-folders shown as a tree on the agenda
An item like "TIP communication" holds a folder of emails; the agenda shows
the folder and the files within (deep listing, path-prefixed names like
`TIP communication/Letter.docx`) so nothing in the pack is invisible from the
agenda view.

### Received stamps, locked at first arrival
Automates the "Received 29/7/26 @ 15:15" annotations secretaries keep by
hand. Crucial refinement after a real scare: a **file's received time locks
at first sighting** (`PackFileReceipt`), and a later edit shows as a separate
"updated" stamp — because pressing Sync once re-dated the whole pack to
"late" when files were merely touched. On-time/late is classified against
the board's papers-due window (default 4 days before the meeting).

### Preview in a window; editing stays in SharePoint
Clicking a paper opens the SharePoint embedded viewer in a modal with
Download and "Edit in SharePoint" links. The portal deliberately has no
editor — one source of truth (principle 1).

### Uploads land in Late papers unless you're an admin
A member with something to table can upload, but it goes to the meeting's
**Late papers** area only, tagged `late-paper` — that's the only
write path they get. An admin can choose the destination (any agenda item /
folder). Reasoning: business arising on the day belongs where the meeting
will actually address it, and members shouldn't be able to rewrite the pack.
SharePoint still enforces the real write permission regardless of what the
portal offers.

### Agenda order lock ("new items append below")
The secretary orders the agenda manually (move up/down), then locks it.
After locking, a sync never reorders — newly discovered pack folders append
at the bottom. Prevents SharePoint folder-name sorting from fighting the
secretary's intended running order. The lock control is a small text link,
deliberately unobtrusive (Boyd: "too big, make it less prominent").

### Chair is the default presenter
An agenda item with no presenter shows the board's Chair — because in
practice the Chair carries anything unassigned, and a blank presenter column
reads as an error.

---

## Ask me anything (AI)

### Why it exists
Boyd wanted directors to interrogate the pack ("What's the Pelligra loan
status?", "Which papers were late?") without reading 200 pages. The answer
engine is grounded: the model receives **this meeting's record + the full
text of its pack** and is instructed to answer only from that, citing files
by name, and to say plainly when the pack doesn't contain the answer.

### Branded BizGPT / answered by BizGPT2.0
The product face is BizGPT (Boyd's brand), regardless of which model answers.
Footer always reads "answered by BizGPT2.0"; the real provider is in the
hover tooltip for debugging. Decision: brand consistency for users, truth
available for admins.

### Multiple AI providers with failover
Started with a single BizGPT endpoint (gpu.ai instance) which was down more
than up while credit was being sorted. Rather than a dead feature, the
Integrations page holds up to four providers (BizGPT-compatible, Anthropic,
OpenAI, Gemini) with keys managed in-app; one is active, the others are
fallbacks. If the active provider fails, the next configured one answers.
One dead endpoint never takes the feature down.

### Friendly failure messages
Raw HTTP errors were replaced with words a secretary can act on: "the
gateway is up but the model behind it is not answering — the instance is
starting or stopped", "the API key was rejected", "network appears down,
check the connection". Transient network errors retry automatically (3
attempts) before surfacing at all.

### Pack manifest — the AI knows what it can't read
The context includes a manifest of every file: read in full, truncated,
no extractable text (scanned), or "appears to be a cover sheet only". Came
from a real incident where the AI was blamed for not reading attachments
that genuinely weren't in the pack — now it can say exactly what it holds.

### Whole-folder reading, generous limits
Initial 12k-character truncation made the AI look blind. Limits raised to
200k chars/file, 600k/pack, and `.msg` Outlook emails parse (subject, from,
sent, body) because real packs are full of them.

### Text cache keyed by SharePoint's modified stamp
Re-downloading and re-parsing every paper per question was the slow part —
not the model. Extracted text is stored (`PackFileText`) against item id +
lastModified + size; unchanged files are never fetched twice, and the cache
warms in the background when the agenda loads. Embeddings/RAG were
considered and rejected: the whole pack fits the model's context, so
retrieval would add complexity without speed.

### Chat window: only ✕ closes it
Click-outside-to-close was throwing away conversations mid-thought. Now only
the explicit close button closes; a stray click can't destroy a chat.

### Per-person saved chats
Each person's conversation is saved server-side per meeting (and per paper
when asked from a file preview): reopen the window, your chat is there.
"My chats" lists every thread for the meeting; "New chat" clears one.
Chats are private to the person — the board doesn't see each other's
questions.

### Ask button on file preview
Asking from an open paper scopes the chat to that paper ("Summarise this")
while keeping the rest of the pack available for context.

### Working dots
Long operations (motion scan ~8s, first ask ~30s) showed nothing and looked
broken. Orange animated dots with a status word ("Reading the pack…") were
added everywhere the AI runs.

### Motion scan
Papers put their asks in recognisable shapes ("RECOMMENDATION: That the
Board…"). "Read the pack for motions" extracts these as **suggestions** the
secretary approves — nothing enters the motion list automatically. Reads run
5 files in parallel (was 67s serial, now well under 10 with the text cache).

---

## Embedding in Mason-View

### The portal lives in an iframe under MV's sidebar
MV authenticates, owns navigation, and forwards identity headers
(`x-user-id`, `x-user-role`, `x-org-key`); the portal renders chromeless
when embedded. This keeps one login and one menu for the user while the
portal stays an independently deployable product.

### Sidebar active-state is query-aware
MV's menu matched on pathname only, so every Board Portal item under
`/portal?path=…` showed as active (the "grey lines" bug). Matching includes
the query string now.

### `BOARD_PORTAL_EMBED_URL` must never be public
The embed URL points at a portal instance that trusts MV's identity headers;
exposing it publicly would let anyone claim any identity. Local/private
addresses only.

---

## Reliability & data hygiene

### Transient network retries everywhere
A reboot-time ENETUNREACH from the container turned into user-visible "fetch
failed" errors. All outbound calls (Microsoft sign-in, Graph, file
downloads, AI providers) go through `resilientFetch`: 3 attempts with
backoff, then a plain-words 503.

### File names are UTF-8, with mojibake repair
The upload path decoded names as Latin-1, so "Minutes — MS MC Clime.pdf"
reached SharePoint as "Minutes Ã¢Â€Â” …". Names now decode as UTF-8 and a
`fixMojibake()` net repairs any already-mangled name; the affected live file
was renamed in SharePoint.

### `getDownloadUrl` fetches the full item
Graph drops the `@microsoft.graph.downloadUrl` annotation when `$select` is
used — a subtle trap that produced null download URLs. The full item is
fetched instead.

---

*Maintained by Claude Code at Boyd's direction. When a feature is added or a
behavior deliberately changed, the matching entry here is updated in the same
commit.*
