/*
 * Conflict-of-interest vocabulary.
 *
 * Follows ordinary Australian meeting practice as set out in Joske's Law and
 * Procedure at Meetings in Australia: a member DECLARES an interest, the
 * declaration is minuted, and the MEETING then resolves what follows. The
 * member does not decide the consequence, and neither does this software —
 * it records what was declared and what was resolved.
 *
 * These are meeting-procedure options, not legal advice. What a particular
 * board may resolve is governed by its own constitution or rules and, for
 * companies, by statute — so the wording here stays descriptive.
 */

/** Nature of the interest being declared. */
const COI_TYPES = [
  {
    id: 'MATERIAL_PERSONAL',
    label: 'Material personal interest',
    help: 'A real interest in the matter — usually the most restrictive category.',
  },
  {
    id: 'PECUNIARY',
    label: 'Pecuniary interest',
    help: 'A financial interest, direct or through an associate.',
  },
  {
    id: 'PERCEIVED',
    label: 'Perceived conflict',
    help: 'No actual interest, but a reasonable observer might think otherwise.',
  },
  {
    id: 'DUTY_TO_DUTY',
    label: 'Conflict of duty',
    help: 'Competing duties — a role on another body affected by the matter.',
  },
  {
    id: 'INDIRECT',
    label: 'Indirect interest',
    help: 'Through a family member, employer or associated entity.',
  },
];

/**
 * What the meeting resolved.
 *
 * PENDING is deliberately the default: a declaration that has been made but
 * not yet ruled on is a normal state, and pretending otherwise would put words
 * in the meeting's mouth.
 */
const COI_EFFECTS = [
  {
    id: 'PENDING',
    label: 'Declared — not yet resolved',
    help: 'Interest declared and minuted. The meeting has not yet ruled.',
    tone: 'warning',
    restrictsVote: false,
  },
  {
    id: 'NOT_A_CONFLICT',
    label: 'Resolved: not a conflict',
    help: 'The meeting resolved that no material conflict arises. The member takes part as normal.',
    tone: 'success',
    restrictsVote: false,
  },
  {
    id: 'REMAIN_AND_VOTE',
    label: 'May remain and vote',
    help: 'Interest noted; the meeting consented to the member remaining present and voting.',
    tone: 'success',
    restrictsVote: false,
  },
  {
    id: 'REMAIN_NO_VOTE',
    label: 'Remains, does not vote',
    help: 'The member stays for the discussion but abstains on the question.',
    tone: 'info',
    restrictsVote: true,
  },
  {
    id: 'WITHDRAW',
    label: 'Withdraws for the item',
    help: 'The member leaves while the item is considered and does not vote. Check quorum still holds.',
    tone: 'danger',
    restrictsVote: true,
  },
];

const BOARD_KINDS = [
  { id: 'BOARD', label: 'Board' },
  { id: 'COMMITTEE', label: 'Committee' },
  { id: 'SUBCOMMITTEE', label: 'Sub-committee' },
];

const ids = (list) => list.map((i) => i.id);

/** Effects that stop the member voting — used to flag quorum risk. */
const restrictsVote = (effect) =>
  Boolean(COI_EFFECTS.find((e) => e.id === effect)?.restrictsVote);

module.exports = {
  COI_TYPES,
  COI_EFFECTS,
  BOARD_KINDS,
  COI_TYPE_IDS: ids(COI_TYPES),
  COI_EFFECT_IDS: ids(COI_EFFECTS),
  BOARD_KIND_IDS: ids(BOARD_KINDS),
  restrictsVote,
};
