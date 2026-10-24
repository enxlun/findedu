// Demo data: one 10th-grade class in Ulaanbaatar. Due dates are relative to the
// moment the data is seeded, so the demo always looks fresh.

import type { BeginPlan, ClassRoom, Problem, Progress, Review, Task, TeacherSummary, TraitKey, User } from "./types.ts";

export const SEED_VERSION = 4;

export interface Db {
  version: number;
  users: User[];
  classes: ClassRoom[];
  tasks: Task[];
  progress: Progress[];
  plans: BeginPlan[];
  problems: Problem[];
  reviews: Review[];
  summaries: TeacherSummary[];
}

const HOUR = 3600 * 1000;

export const buildSeed = (now: Date = new Date()): Db => {
  const at = (hours: number): string => {
    const d = new Date(now.getTime() + hours * HOUR);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  };
  const created = at(-72);

  const users: User[] = [
    { _id: "t-oyuna", name: "Б. Оюунчимэг", role: "teacher", subject: "Математик", classId: "c-10a", rooms: ["201"], courses: ["Математик (10-р анги)", "Геометр (11-р анги)", "Олимпиадын бэлтгэл"] },
    { _id: "t-anar", name: "Д. Анар", role: "teacher", subject: "Англи хэл", classId: "c-10a", rooms: ["208"], courses: ["Англи хэл (10-р анги)", "IELTS бэлтгэл"] },
    { _id: "t-bata", name: "Г. Батбаяр", role: "teacher", subject: "Физик", classId: "c-10a", rooms: ["305"], courses: ["Физик (10-р анги)", "Физикийн лаборатори"] },
    { _id: "t-tsetseg", name: "Ж. Цэцэгмаа", role: "teacher", subject: "Монгол хэл", classId: "c-10a", rooms: ["210"], courses: ["Монгол хэл (10-р анги)", "Уран зохиол"] },
    { _id: "t-ganbold", name: "С. Ганболд", role: "teacher", subject: "Хими", classId: "c-10a", rooms: ["310"], courses: ["Хими (10-р анги)", "Химийн лаборатори"] },
    { _id: "t-erdene", name: "Б. Эрдэнэ", role: "teacher", subject: "Түүх", classId: "c-10a", rooms: ["212"], courses: ["Монголын түүх", "Нийгмийн ухаан"] },
    { _id: "s-bold", name: "Болд", role: "student", classId: "c-10a" },
    { _id: "s-saraa", name: "Сараа", role: "student", classId: "c-10a" },
    { _id: "s-temuulen", name: "Тэмүүлэн", role: "student", classId: "c-10a" },
    { _id: "a-naraa", name: "Ц. Нарантуяа", role: "admin", title: "Сургалтын менежер" },
    { _id: "st-gana", name: "Б. Ганбаатар", role: "staff", title: "Цахилгаанчин", specialties: ["electric"] },
    { _id: "st-enkh", name: "Д. Энхтөр", role: "staff", title: "Сантехникч", specialties: ["plumbing", "heating"] },
    { _id: "st-munkh", name: "Г. Мөнхзул", role: "staff", title: "IT инженер", specialties: ["it"] },
    { _id: "st-dorj", name: "О. Дорж", role: "staff", title: "Засварчин", specialties: ["furniture", "cleaning", "safety", "other"] },
  ];
  const classes: ClassRoom[] = [{ _id: "c-10a", name: "10А" }];

  const task = (
    _id: string,
    type: Task["type"],
    createdBy: string,
    subject: string,
    title: string,
    description: string,
    dueInHours: number,
    estimatedMinutes: number,
    weight: number,
    dependsOn: string[] = [],
  ): Task => ({ _id, type, title, description, subject, dueDate: at(dueInHours), estimatedMinutes, weight, dependsOn, createdBy, classId: "c-10a", createdAt: created });

  const tasks: Task[] = [
    task("m-hw1", "homework", "t-oyuna", "Математик", "Квадрат тэгшитгэл: 1–12 бодлого", "Сурах бичгийн 54-р хуудас. Дискриминант ашиглан бодож, бодолтоо бүрэн бичнэ.", 22, 45, 3),
    task("m-hw2", "homework", "t-oyuna", "Математик", "Функцийн график: 10 бодлого", "Квадрат функцийн орой, тэнхлэгтэй огтлолцох цэгийг олж график зурна.", 60, 30, 3),
    task("m-exam", "exam", "t-oyuna", "Математик", "Явцын шалгалт: Квадрат функц", "45 минутын бичгийн шалгалт. Тэгшитгэл, график, бодлогын хэрэглээ.", 140, 60, 5, ["m-hw1", "m-hw2"]),
    task("p-hw1", "homework", "t-bata", "Физик", "Лабораторийн хэмжилтийн хүснэгт", "Хүч ба хурдатгалын 5 хэмжилтийг хүснэгтэд оруулж, нэгжийг шалгана.", 20, 25, 3),
    task("p-hw2", "homework", "t-bata", "Физик", "Ньютоны 2-р хууль: лабораторийн тайлан", "Хэмжилтээсээ F = ma хамаарлыг шалгаж, график зурж, алдааны шалтгааныг дүгнэлтдээ бичнэ.", 46, 60, 4, ["p-hw1"]),
    task("p-exam", "exam", "t-bata", "Физик", "Сорил: Хүч ба хөдөлгөөн", "30 минутын тест. Ньютоны хуулиуд, хурдатгал, хүчний диаграм.", 100, 45, 5, ["p-hw2"]),
    task("e-hw1", "homework", "t-anar", "Англи хэл", "Unit 3 vocabulary: 20 words", "Learn the 20 words on page 31. Write one example sentence for each.", -18, 20, 2),
    task("e-hw2", "homework", "t-anar", "Англи хэл", "Essay: My dream job (150 words)", "Use at least 5 new words from Unit 3. Introduction, two body paragraphs, conclusion.", 70, 40, 3, ["e-hw1"]),
    task("e-exam", "exam", "t-anar", "Англи хэл", "Unit 3 quiz", "Vocabulary and reading quiz, 20 minutes.", 94, 30, 4, ["e-hw1"]),
  ];

  const prog = (
    taskId: string,
    userId: string,
    status: Progress["status"],
    difficulty = 3,
    extra: Partial<Progress> = {},
  ): Progress => ({
    _id: `pr-${taskId}-${userId}`,
    taskId,
    userId,
    status,
    difficulty,
    seenAt: at(-40),
    stepsDone: [],
    chat: [],
    updatedAt: at(-6),
    ...(status === "done" ? { completedAt: at(-8) } : {}),
    ...extra,
  });

  const progress: Progress[] = [
    prog("m-hw1", "s-saraa", "done", 2),
    prog("e-hw1", "s-saraa", "done", 1),
    prog("p-hw1", "s-saraa", "done", 2),
    prog("p-hw1", "s-temuulen", "done", 3),
    prog("m-hw1", "s-temuulen", "in_progress", 4),
    prog("p-hw2", "s-temuulen", "in_progress", 5, {
      chat: [
        { q: "Хурдатгалыг яаж олох вэ?", a: "Хурдатгал бол хурд хэр хурдан өөрчлөгдөж байгааг хэлдэг. Хэмжилтээсээ хурдны өөрчлөлтийг олоод, тэр өөрчлөлтөд зарцуулсан хугацаанд хуваа. Аль багануудаа ашиглах вэ?", at: at(-3), source: "ai" },
        { q: "Графикийн тэнхлэгийг юу гэж нэрлэх вэ?", a: "Аль хэмжигдэхүүнийг өөрөө өөрчилсөн бэ? Тэр нь ихэвчлэн x тэнхлэгт байрладаг. Нэгжээ хаалтанд бичихээ мартуузай.", at: at(-2), source: "ai" },
      ],
    }),
    // Bold has opened three of his nine tasks; the rest are unread in his inbox.
    prog("m-hw1", "s-bold", "todo", 3),
    prog("e-hw1", "s-bold", "todo", 2),
    prog("p-hw1", "s-bold", "todo", 3),
    { ...prog("p-hw2", "s-bold", "todo", 4), seenAt: undefined },
  ];

  let n = 1039;
  const ev = (by: string, action: Problem["history"][number]["action"], hoursAgo: number, extra: Partial<Problem["history"][number]> = {}) => ({ at: at(-hoursAgo), by, action, ...extra });
  const problem = (
    _id: string,
    f: Pick<Problem, "title" | "description" | "location" | "category" | "priority" | "status" | "reportedBy" | "audience"> &
      Partial<Pick<Problem, "anonymous" | "groupId" | "urgency">>,
    hoursAgo: number,
    reason: string,
    history: Problem["history"] = [],
  ): Problem => ({
    _id,
    number: ++n,
    anonymous: false,
    urgency: f.priority,
    groupId: _id,
    ...f,
    ai: { reason, source: "ai", model: "gemma-4-26b-a4b-it" },
    history: [ev(f.reportedBy, "reported", hoursAgo), ...(f.groupId && f.groupId !== _id ? [ev(f.reportedBy, "grouped", hoursAgo)] : []), ...history],
    createdAt: at(-hoursAgo),
    updatedAt: history.length ? history[history.length - 1].at : at(-hoursAgo),
  });

  const problems: Problem[] = [
    problem("ph-wifi", { title: "Номын сангийн Wi-Fi тасраад байна", description: "Бие даалтаа хийж чадахгүй байна.", location: "Номын сан", category: "it", priority: "medium", status: "resolved", reportedBy: "s-bold", audience: ["st-munkh", "a-naraa"] }, 70,
      "Техник, IT ангилалд оруулж, IT инженер Г. Мөнхзул болон захиргаанд илгээв.",
      [ev("st-munkh", "status", 66, { status: "seen" }), ev("st-munkh", "status", 50, { status: "resolved", note: "Router-ийг сольж, сүлжээг дахин тохирууллаа." })]),
    problem("ph-radiator", { title: "1-р давхрын коридорын радиатор халахгүй байна", description: "Өглөөнөөс хойш маш хүйтэн. Бага ангийнхан хүрмээ тайлж чадахгүй байна.", location: "1-р байр · 1 давхар · коридор", category: "heating", priority: "urgent", status: "new", reportedBy: "s-saraa", audience: ["st-enkh", "a-naraa"] }, 5,
      "Халаалтын асуудал, олон хүнд нөлөөлж байгаа тул яаралтай. Сантехникч Д. Энхтөр болон захиргаанд илгээв."),
    problem("ph-projector", { title: "305 тоотын проектор асахгүй байна", description: "Физикийн хичээл дээр проектор асаалаа ч дэлгэц дээр дүрс гарахгүй байна. Кабель шалгасан.", location: "2-р байр · 3 давхар · 305 тоот", category: "it", priority: "medium", status: "new", reportedBy: "s-bold", audience: ["st-munkh", "t-bata", "a-naraa"] }, 6,
      "Техник, IT. 305 тоотыг хариуцдаг Г. Батбаяр багш, IT инженер Г. Мөнхзул болон захиргаа харна."),
    problem("ph-desks", { title: "201 тоотын 3 ширээний хөл суларсан", description: "Ширээ ганхаад бичиж болохгүй байна.", location: "1-р байр · 2 давхар · 201 тоот", category: "furniture", priority: "low", status: "seen", reportedBy: "s-temuulen", audience: ["st-dorj", "t-oyuna", "a-naraa"] }, 26,
      "Тавилга. 201 тоотын анги удирдсан багш, засварчин О. Дорж болон захиргаанд илгээв.",
      [ev("st-dorj", "status", 20, { status: "seen", note: "Баасан гарагт хичээлийн дараа засна." })]),
    problem("ph-tap", { title: "2 давхрын ариун цэврийн өрөөний цорго гоожиж байна", description: "Шал нойтон, хальтирч унах аюултай.", location: "1-р байр · 2 давхар · ариун цэврийн өрөө", category: "plumbing", priority: "high", status: "seen", reportedBy: "s-saraa", anonymous: true, audience: ["st-enkh", "a-naraa"] }, 22,
      "Ус, сантехник. Хальтирч унах эрсдэлтэй тул өндөр ач холбогдолтой.",
      [ev("st-enkh", "status", 18, { status: "seen", note: "Сэлбэг захиалсан, маргааш солино." })]),
    problem("ph-gym", { title: "Спорт заалны гэрэл анивчаад байна", description: "Баруун талын 2 гэрэл байнга анивчдаг.", location: "Спорт заал", category: "electric", priority: "medium", status: "new", reportedBy: "s-saraa", audience: ["st-gana", "a-naraa"] }, 9,
      "Цахилгаан. Цахилгаанчин Б. Ганбаатар болон захиргаанд илгээв."),
    problem("ph-cold-2", { title: "1 давхарт маш хүйтэн байна", description: "Коридороор явахад даарч байна.", location: "1-р байр · 1 давхар", category: "heating", priority: "high", status: "new", reportedBy: "s-bold", audience: ["st-enkh", "a-naraa"], groupId: "ph-radiator" }, 3,
      "Өмнөх #1041 мэдээлэлтэй ижил тул бүлэглэв."),
    problem("ph-cold-3", { title: "Коридорын халаалт ажиллахгүй", description: "", location: "1-р байр · коридор", category: "heating", priority: "high", status: "new", reportedBy: "s-temuulen", anonymous: true, audience: ["st-enkh", "a-naraa"], groupId: "ph-radiator" }, 2,
      "#1041-тэй ижил асуудал тул бүлэглэв."),
  ];

  // TeacherRate: anonymous reviews. Authors are kept for the administration only.
  // Trait code: a attendance, n notes, f fair grades, g grades on time, c clear,
  // h lots of homework, x extra credit, t group work, u fun; "+" yes, "-" no.
  const CODES: Record<string, TraitKey> = { a: "attendance", n: "notes", f: "fairGrades", g: "gradesOnTime", c: "clear", h: "homework", x: "extraCredit", t: "teamwork", u: "fun" };
  const traits = (code: string): Review["traits"] =>
    Object.fromEntries(code.split(" ").filter(Boolean).map((p) => [CODES[p[0]], p[1] === "+"]));
  const likers = (n: number) => [...Array(n)].map((_, i) => `x-like-${i + 1}`);
  const review = (
    _id: string,
    teacherId: string,
    [authorId, authorName]: [string, string],
    subject: string,
    rating: number,
    code: string,
    text: string,
    likes: number,
    daysAgo: number,
  ): Review => ({ _id, teacherId, authorId, authorName, subject, rating, traits: traits(code), text, likes: likers(likes), flagged: false, createdAt: at(-daysAgo * 24 - 3) });

  const reviews: Review[] = [
    review("rv-o1", "t-oyuna", ["x-nomin", "Номин · 11Б"], "Математик (10-р анги)", 5, "a+ n+ f+ g+ c+ h+ x- t- u-", "Бодлогыг алхам алхмаар маш ойлгомжтой тайлбарладаг. Гэрийн даалгавар их өгдөг ч шалгалтад яг тэр төрлийн бодлого ирдэг. Тэмдэглэлээ сайн хөтөлбөл асуудалгүй.", 9, 12),
    review("rv-o2", "t-oyuna", ["x-tuguldur", "Төгөлдөр · 12А"], "Геометр (11-р анги)", 4, "a+ n+ f+ g+ c+ h+ t-", "Ирцийг маш чанга авдаг, 5 минут хоцорвол тэмдэглэнэ. Дүнгээ шударга, цагт нь гаргадаг. Заримдаа хурдан явдаг тул ойлгоогүй бол шууд асуух хэрэгтэй.", 6, 20),
    review("rv-o3", "t-oyuna", ["x-anu", "Ану · 11А"], "Математик (10-р анги)", 3, "a+ n+ f+ c- h+ u-", "Хичээл нь хэцүү, даалгавар их. Самбар дээр хурдан бичдэг болохоор тэмдэглэл хөтлөхөд амаргүй. Гэхдээ хичээлийн дараа асуухад тайван тайлбарлаж өгдөг.", 3, 33),
    review("rv-o4", "t-oyuna", ["x-bilguun", "Билгүүн · 12Б"], "Олимпиадын бэлтгэл", 5, "a- f+ c+ x+ t+ u+", "Олимпиадын бэлтгэл дээр сонирхолтой бодлого их үзүүлдэг, оролцвол нэмэлт оноо өгдөг. Багаар бодлого бодуулдаг нь гоё.", 5, 45),
    review("rv-o5", "t-oyuna", ["s-saraa", "Сараа · 10А"], "Математик (10-р анги)", 5, "a+ n+ f+ g+ c+ h+ x+", "Дасгалаа тогтмол хийвэл дүн сайн гарна. Тэмдэглэлийн дэвтрийг сард нэг шалгадаг, цэвэр хөтөлбөл нэмэлт оноо өгдөг.", 2, 4),

    review("rv-a1", "t-anar", ["x-khulan", "Хулан · 11Б"], "Англи хэл (10-р анги)", 5, "a- n- f+ g- c+ h- t+ u+", "Хичээл нь маш хөгжилтэй, тоглоом, дуугаар үг цээжлүүлдэг. Ирц тэр бүр авдаггүй. Дүнгээ заримдаа хоцроож оруулдаг.", 11, 9),
    review("rv-a2", "t-anar", ["x-temuujin", "Тэмүүжин · 12А"], "IELTS бэлтгэл", 4, "a+ f+ g+ c+ h+ x- t+", "IELTS бэлтгэлд speaking-ийг хосоор дасгалжуулдаг нь их тус болсон. Essay их бичүүлдэг, засвар нь нарийн.", 7, 17),
    review("rv-a3", "t-anar", ["x-maral", "Марал · 11А"], "Англи хэл (10-р анги)", 3, "a- n- f+ g- c- h- u+", "Хөгжилтэй ч дүрмийг бага тайлбарладаг, өөрөө давтах хэрэгтэй болдог. Шалгалтын дүнгээ улирлын сүүлд гаргасан.", 2, 27),
    review("rv-a4", "t-anar", ["x-od", "Од · 12Б"], "Англи хэл (10-р анги)", 4, "a- f+ c+ t+ u+", "Багаар presentation хийлгэдэг, айхгүйгээр ярьж сурсан. Шударга дүгнэдэг.", 4, 52),

    review("rv-b1", "t-bata", ["x-erkhes", "Эрхэс · 11Б"], "Физикийн лаборатори", 5, "a+ n+ f+ g+ c+ t+ u+", "Туршилт их хийлгэдэг, лабораторийн дэвтрийг заавал хөтлүүлж шалгадаг. Томьёог амьдралын жишээгээр тайлбарладаг.", 8, 6),
    review("rv-b2", "t-bata", ["x-saruul", "Саруул · 12А"], "Физик (10-р анги)", 4, "a+ n+ f+ g- c+ h- t+", "Сайн заадаг, гэхдээ лабораторийн тайлангийн дүнг жаахан удаан гаргадаг. Хүчний диаграмыг ойлгомжтой болгосон.", 4, 19),
    review("rv-b3", "t-bata", ["s-temuulen", "Тэмүүлэн · 10А"], "Физик (10-р анги)", 3, "a+ n+ f+ c- h+ t+", "Тайлан бичихэд хэцүү байна. Хурдатгалын сэдвийг дахиад нэг тайлбарлаад өгвөл сайн байна. Багаар ажиллахад таатай.", 1, 2),
    review("rv-b4", "t-bata", ["x-gerel", "Гэрэл · 11А"], "Физик (10-р анги)", 5, "a+ f+ g+ c+ x+ u+", "Асуулт асуухыг дэмждэг, буруу хариулсан ч загнадаггүй. Сорилын дараа алдаагаа засвал оноо нэмдэг.", 6, 38),

    review("rv-c1", "t-tsetseg", ["x-ankhaa", "Анхаа · 11Б"], "Монгол хэл (10-р анги)", 4, "a+ n+ f+ g+ c+ h+ t- u-", "Тэмдэглэлийн дэвтрийг өдөр бүр шалгадаг тул байнга хөтлөх хэрэгтэй. Зөв бичгийн дүрмийг маш сайн ойлгуулдаг.", 10, 8),
    review("rv-c2", "t-tsetseg", ["x-solongo", "Солонго · 12А"], "Уран зохиол", 5, "a+ n+ f+ g+ c+ h+ u+", "Шүлэг, зохиолыг сонирхолтой задалдаг. Эссэ их бичүүлдэг ч засвар хийж буцааж өгдөг нь сайн.", 7, 21),
    review("rv-c3", "t-tsetseg", ["x-batzorig", "Батзориг · 11А"], "Монгол хэл (10-р анги)", 3, "a+ n+ f+ g+ c+ h+ x- u-", "Даалгавар их, хоцроовол оноо хасдаг. Дүрэм нь чанга, гэхдээ шударга.", 3, 30),
    review("rv-c4", "t-tsetseg", ["x-misheel", "Мишээл · 12Б"], "Уран зохиол", 5, "a+ n+ f+ c+ t+ u+", "Багаар жүжиглэлт хийлгэсэн нь хамгийн гоё хичээл байсан. Ирц заавал авдаг.", 5, 60),

    review("rv-g1", "t-ganbold", ["x-dulguun", "Дөлгөөн · 11Б"], "Хими (10-р анги)", 2, "a+ n- f+ g- c- h- x+ t+", "Сэдвээ хурдан өнгөрөөдөг, тайлбар нь ойлгомжгүй. Дүнгээ улирлын сүүлд л гаргадаг. Гэхдээ лабораторийн нэмэлт ажил хийвэл оноо өгдөг.", 9, 5),
    review("rv-g2", "t-ganbold", ["s-saraa", "Сараа · 10А"], "Химийн лаборатори", 3, "a+ f+ g- c- x+ t+", "Лабораторийн туршилт сонирхолтой, багаар хийдэг. Харин онолын хичээл дээр асуулт асуухад богинохон хариулдаг.", 4, 3),
    review("rv-g3", "t-ganbold", ["x-uyanga", "Уянга · 12А"], "Хими (10-р анги)", 4, "a+ f+ g+ c+ x+ u-", "Шалгалтын өмнө давтлага хийж өгдөг. Номоо уншаад очвол ойлгоход амар болно.", 3, 24),
    review("rv-g4", "t-ganbold", ["x-temuulen-11a", "Тэмүүлэн · 11А"], "Хими (10-р анги)", 2, "a+ n- f- g- c- h+", "Даалгавар их, хариуг нь тайлбарладаггүй. Дүн яаж гарсныг асуухад тодорхой хариулдаггүй.", 5, 41),

    review("rv-e1", "t-erdene", ["x-naraa", "Нараа · 11Б"], "Монголын түүх", 5, "a- n- f+ g+ c+ h- t+ u+", "Түүхийг үлгэр шиг ярьдаг, хичээл нь маш сонирхолтой. Ирц бараг авдаггүй, гэхдээ хичээлээ таслах хүсэл төрдөггүй.", 12, 7),
    review("rv-e2", "t-erdene", ["x-amaraa", "Амараа · 12А"], "Нийгмийн ухаан", 4, "a- f+ g+ c+ h- t+ u+", "Хэлэлцүүлэг их хийдэг, өөрийн бодлыг хэлэхийг дэмждэг. Шалгалт нь бага зэрэг хэцүү.", 6, 22),
    review("rv-e3", "t-erdene", ["x-zolboo", "Золбоо · 11А"], "Монголын түүх", 5, "a- n- f+ g+ c+ h- x+ u+", "Төсөл хийвэл нэмэлт оноо өгдөг. Он тоо цээжлүүлэхээс илүү учир шалтгааныг ойлгуулдаг.", 8, 35),
  ];

  return { version: SEED_VERSION, users, classes, tasks, progress, plans: [], problems, reviews, summaries: [] };
};
