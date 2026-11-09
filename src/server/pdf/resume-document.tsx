import path from "node:path";
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { MISC_LABELS, resolveLocale, SECTION_LABELS, SKILL_LABELS, type ResumeLocale } from "@/lib/domain/labels";
import {
  SKILL_CATEGORIES,
  sectionHasContent,
  type SectionKey,
  type TailoredResume,
} from "@/lib/domain/resume";

/**
 * Modelo de PDF pensado para leitura por ATS: uma coluna, ordem de leitura
 * linear, títulos de seção em texto, sem tabelas, ícones ou imagens.
 * A fonte (IBM Plex Sans, SIL OFL) é embutida com mapeamento Unicode, então o
 * texto continua selecionável e extraível.
 */
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsRegistered = false;

export function registerPdfFonts(): void {
  if (fontsRegistered) return;
  Font.register({
    family: "Plex",
    fonts: [
      { src: path.join(FONT_DIR, "IBMPlexSans-Regular.woff"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "IBMPlexSans-Italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: path.join(FONT_DIR, "IBMPlexSans-Medium.woff"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "IBMPlexSans-SemiBold.woff"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "IBMPlexSans-Bold.woff"), fontWeight: 700 },
    ],
  });
  // Sem hifenização: palavras partidas ("desenvolvi-mento") deixam de casar com palavras-chave no ATS.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const INK = "#16181D";
const MUTED = "#4B5058";
const ACCENT = "#0F5E66";
const RULE = "#C9CDD2";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Plex",
    fontSize: 10,
    lineHeight: 1.34,
    color: INK,
    // Sem ligaduras: o glifo combinado "fi"/"fl" é extraído como "f" por vários leitores de PDF,
    // e um ATS leria "prossional" em vez de "profissional".
    fontFeatureSettings: { liga: false, clig: false, dlig: false },
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 46,
  },
  name: { fontSize: 20, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.2 },
  headline: { fontSize: 11.5, fontWeight: 500, color: ACCENT, marginTop: 3 },
  contact: { fontSize: 9, color: MUTED, marginTop: 6 },
  link: { color: MUTED, textDecoration: "none" },
  section: { marginTop: 11 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: ACCENT,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingBottom: 2,
    marginBottom: 5,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
  },
  paragraph: { marginBottom: 2 },
  item: { marginBottom: 7 },
  itemTitle: { fontSize: 10.5, fontWeight: 600 },
  itemMeta: { fontSize: 9, color: MUTED, marginBottom: 2 },
  bulletRow: { flexDirection: "row", marginBottom: 1.5 },
  bullet: { width: 10, color: MUTED },
  bulletText: { flex: 1 },
  techLine: { fontSize: 9.2, color: MUTED, marginTop: 2 },
  label: { fontWeight: 600, color: INK },
  skillLine: { marginBottom: 2 },
});

function joinParts(parts: (string | null | undefined)[], separator = " · "): string {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join(separator);
}

function period(start: string, end: string, current: boolean, locale: ResumeLocale): string {
  const finish = current ? MISC_LABELS[locale].present : end;
  if (start && finish) return `${start} – ${finish}`;
  return start || finish || "";
}

/** Remove caracteres de controle e emojis, que a fonte não tem e o ATS não lê. */
function clean(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .trim();
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

function hrefFor(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^mailto:/i.test(url)) return url;
  return `https://${url}`;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{clean(item)}</Text>
        </View>
      ))}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {/* minPresenceAhead mantém o título junto da primeira linha da seção (sem título órfão no fim da página) */}
      <Text style={styles.sectionTitle} minPresenceAhead={16}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function renderSection(resume: TailoredResume, section: SectionKey, locale: ResumeLocale) {
  const titles = SECTION_LABELS[locale];
  const misc = MISC_LABELS[locale];

  switch (section) {
    case "summary":
      return (
        <Section key={section} title={titles.summary}>
          <Text style={styles.paragraph}>{clean(resume.summary)}</Text>
        </Section>
      );
    case "skills":
      return (
        <Section key={section} title={titles.skills}>
          {SKILL_CATEGORIES.filter((category) => resume.skills[category].length).map((category) => (
            <Text key={category} style={styles.skillLine}>
              <Text style={styles.label}>{SKILL_LABELS[locale][category]}: </Text>
              {resume.skills[category].map(clean).join(", ")}
            </Text>
          ))}
        </Section>
      );
    case "experience":
      return (
        <Section key={section} title={titles.experience}>
          {resume.experiences.map((experience) => (
            <View key={experience.id} style={styles.item}>
              <Text style={styles.itemTitle} minPresenceAhead={24}>
                {clean(joinParts([experience.role, experience.company], " — "))}
              </Text>
              <Text style={styles.itemMeta}>
                {clean(
                  joinParts([
                    period(experience.startDate, experience.endDate, experience.current, locale),
                    experience.location,
                    experience.employmentType,
                  ]),
                )}
              </Text>
              {experience.description ? <Text style={styles.paragraph}>{clean(experience.description)}</Text> : null}
              <Bullets items={experience.highlights} />
              {experience.technologies.length ? (
                <Text style={styles.techLine}>
                  <Text style={styles.label}>{misc.technologies}: </Text>
                  {experience.technologies.map(clean).join(", ")}
                </Text>
              ) : null}
            </View>
          ))}
        </Section>
      );
    case "projects":
      return (
        <Section key={section} title={titles.projects}>
          {resume.projects.map((project) => (
            <View key={project.id} style={styles.item}>
              <Text style={styles.itemTitle} minPresenceAhead={24}>
                {clean(project.name)}
              </Text>
              {project.url || project.startDate || project.endDate ? (
                <Text style={styles.itemMeta}>
                  {clean(joinParts([period(project.startDate, project.endDate, false, locale), displayUrl(project.url)]))}
                </Text>
              ) : null}
              {project.description ? <Text style={styles.paragraph}>{clean(project.description)}</Text> : null}
              <Bullets items={project.highlights} />
              {project.technologies.length ? (
                <Text style={styles.techLine}>
                  <Text style={styles.label}>{misc.technologies}: </Text>
                  {project.technologies.map(clean).join(", ")}
                </Text>
              ) : null}
            </View>
          ))}
        </Section>
      );
    case "education":
      return (
        <Section key={section} title={titles.education}>
          {resume.education.map((education) => (
            <View key={education.id} style={styles.item}>
              <Text style={styles.itemTitle} minPresenceAhead={20}>
                {clean(joinParts([joinParts([education.degree, education.field], " — "), education.institution], " | "))}
              </Text>
              <Text style={styles.itemMeta}>
                {clean(joinParts([period(education.startDate, education.endDate, false, locale), education.status]))}
              </Text>
              {education.details ? <Text style={styles.paragraph}>{clean(education.details)}</Text> : null}
            </View>
          ))}
        </Section>
      );
    case "certifications":
      return (
        <Section key={section} title={titles.certifications}>
          {resume.certifications.map((certification) => (
            <View key={certification.id} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.label}>{clean(certification.name)}</Text>
                {(() => {
                  const details = joinParts([
                    certification.issuer,
                    certification.date,
                    certification.workload ? `${misc.workload}: ${certification.workload}` : "",
                  ]);
                  return details ? ` — ${clean(details)}` : "";
                })()}
              </Text>
            </View>
          ))}
        </Section>
      );
    case "languages":
      return (
        <Section key={section} title={titles.languages}>
          <Text>
            {resume.languages
              .map((language) => clean(joinParts([language.name, language.level], " — ")))
              .join("   |   ")}
          </Text>
        </Section>
      );
    case "additional":
      return (
        <Section key={section} title={titles.additional}>
          <Bullets items={resume.additionalInfo} />
        </Section>
      );
  }
}

export function ResumeDocument({ resume, subject }: { resume: TailoredResume; subject: string }) {
  const locale = resolveLocale(resume.language);
  const { personal } = resume;
  const contactItems = [personal.email, personal.phone, personal.location].map(clean).filter(Boolean);
  const order = resume.sectionOrder.filter((section) => sectionHasContent(resume, section));

  return (
    <Document
      title={`${clean(personal.fullName) || "Currículo"} — ${subject}`}
      author={clean(personal.fullName)}
      subject={subject}
      creator="Sob Medida (ATS pessoal)"
      producer="Sob Medida"
      language={locale}
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{clean(personal.fullName)}</Text>
          {personal.headline ? <Text style={styles.headline}>{clean(personal.headline)}</Text> : null}
          <Text style={styles.contact}>
            {contactItems.join("  |  ")}
            {personal.links.map((link, index) => (
              <Text key={index}>
                {contactItems.length || index > 0 ? "  |  " : ""}
                <Link src={hrefFor(link.url)} style={styles.link}>
                  {displayUrl(clean(link.url))}
                </Link>
              </Text>
            ))}
          </Text>
        </View>
        {order.map((section) => renderSection(resume, section, locale))}
      </Page>
    </Document>
  );
}
