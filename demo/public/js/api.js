// GraphQL documents for the Hugjuulai API (erxes-style names, prefixed with `hugjuulai`).
// TaskMind AI, ProblemHunt and TeacherRate.

const GUIDE = "overview steps { title detail minutes } tips checkUnderstanding source model lang createdAt error";
const TASK = "_id type title description subject dueDate estimatedMinutes weight dependsOn createdBy createdByName classId createdAt";
const ITEM = `task { ${TASK} } status difficulty seen stepsDone chat { q a at source } guide { ${GUIDE} } blockedBy unlocks overdue`;
const BEGIN = `nextTaskId nextTitle reason firstStep queue { taskId title reason } blocked { taskId title waitingFor waitingForTitles }
  ranking { taskId title score reason } summary source provider model error lang createdAt`;
const PROBLEM = `_id number title description location category priority urgency status anonymous photo reporterName mine groupId groupSize
  audience { _id name role title } ai { reason source model error } history { at by byName byRole action status note } createdAt updatedAt`;

const CARD = "_id name subject courses rating reviewCount topTraits";
const REVIEW = "_id teacherId subject rating traits { key value } text likes liked mine authorName flagged createdAt";

export const Q = {
  boot: "query { hugjuulaiUsers { _id name role subject classId className title specialties rooms } hugjuulaiClasses { _id name } }",
  inbox: `query ($userId: String!) { hugjuulaiInbox(userId: $userId) { unread items { ${ITEM} } begin { ${BEGIN} } } }`,
  progress: `query ($teacherId: String!) { hugjuulaiClassProgress(teacherId: $teacherId) {
    task { ${TASK} } className total done inProgress todo avgDifficulty helpRequests
    students { userId name status difficulty helpRequests blocked } } }`,
  problems: `query ($userId: String!) { hugjuulaiProblems(userId: $userId) { ${PROBLEM} } }`,
  ai: "query { hugjuulaiAiStatus { provider model online message priority { provider model online message } } }",
  begin: `mutation ($userId: String!, $lang: String) { hugjuulaiBegin(userId: $userId, lang: $lang) { ${BEGIN} } }`,
  update: `mutation ($userId: String!, $taskId: String!, $status: String, $difficulty: Int, $stepsDone: [Int!], $seen: Boolean) {
    hugjuulaiProgressUpdate(userId: $userId, taskId: $taskId, status: $status, difficulty: $difficulty, stepsDone: $stepsDone, seen: $seen) { ${ITEM} } }`,
  addTask: `mutation ($userId: String!, $doc: HugjuulaiTaskInput!) { hugjuulaiTaskAdd(userId: $userId, doc: $doc) { _id } }`,
  removeTask: "mutation ($userId: String!, $taskId: String!) { hugjuulaiTaskRemove(userId: $userId, taskId: $taskId) }",
  guide: `mutation ($userId: String!, $taskId: String!, $lang: String, $regenerate: Boolean) {
    hugjuulaiTaskGuide(userId: $userId, taskId: $taskId, lang: $lang, regenerate: $regenerate) { ${GUIDE} } }`,
  ask: `mutation ($userId: String!, $taskId: String!, $q: String!, $lang: String) {
    hugjuulaiTaskAsk(userId: $userId, taskId: $taskId, question: $q, lang: $lang) { q a at source error } }`,
  report: `mutation ($userId: String!, $doc: HugjuulaiProblemInput!, $lang: String) {
    hugjuulaiProblemReport(userId: $userId, doc: $doc, lang: $lang) { grouped groupNumber groupSize problem { ${PROBLEM} } } }`,
  status: `mutation ($userId: String!, $problemId: String!, $status: String!, $note: String) {
    hugjuulaiProblemStatus(userId: $userId, problemId: $problemId, status: $status, note: $note) { _id } }`,
  note: `mutation ($userId: String!, $problemId: String!, $note: String!) {
    hugjuulaiProblemNote(userId: $userId, problemId: $problemId, note: $note) { _id } }`,
  teachers: `query ($userId: String!) { hugjuulaiTeachers(userId: $userId) { ${CARD} } }`,
  teacher: `query ($userId: String!, $teacherId: String!) { hugjuulaiTeacher(userId: $userId, teacherId: $teacherId) {
    teacher { ${CARD} } traits { key yes no } ratingCounts reviews { ${REVIEW} } canReview } }`,
  teacherSummary: `mutation ($userId: String!, $teacherId: String!, $lang: String, $regenerate: Boolean) {
    hugjuulaiTeacherSummary(userId: $userId, teacherId: $teacherId, lang: $lang, regenerate: $regenerate) {
      overview pros cons tips source provider model reviewCount lang createdAt error } }`,
  reviewSubmit: `mutation ($userId: String!, $doc: HugjuulaiReviewInput!, $lang: String, $force: Boolean) {
    hugjuulaiReviewSubmit(userId: $userId, doc: $doc, lang: $lang, force: $force) {
      posted review { ${REVIEW} } check { ok issue note suggestion source model error } } }`,
  reviewLike: `mutation ($userId: String!, $reviewId: String!) { hugjuulaiReviewLike(userId: $userId, reviewId: $reviewId) { _id likes liked } }`,
  reviewDelete: "mutation ($userId: String!, $reviewId: String!) { hugjuulaiReviewDelete(userId: $userId, reviewId: $reviewId) }",
  reset: "mutation { hugjuulaiDemoReset }",
};

export async function gql(query, variables = {}) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}
