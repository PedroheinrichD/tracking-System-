import "server-only";
import { z } from "zod";
import { CERTIFICATION_KINDS } from "@/lib/domain/resume";

/**
 * Schema da extração do currículo. Sem ids (o código atribui ids estáveis depois)
 * e sem defaults: todo campo é obrigatório no JSON gerado pela IA.
 */
export const ExtractedResumeSchema = z.object({
  language: z.string(),
  personal: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(z.object({ label: z.string(), url: z.string() })),
  }),
  summary: z.string(),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      employmentType: z.string(),
      location: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      current: z.boolean(),
      description: z.string(),
      highlights: z.array(z.string()),
      technologies: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      status: z.string(),
      details: z.string(),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string(),
      date: z.string(),
      workload: z.string(),
      url: z.string(),
      kind: z.enum(CERTIFICATION_KINDS),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      highlights: z.array(z.string()),
      technologies: z.array(z.string()),
      url: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }),
  ),
  skills: z.object({
    programmingLanguages: z.array(z.string()),
    frameworks: z.array(z.string()),
    databases: z.array(z.string()),
    tools: z.array(z.string()),
    otherTechnical: z.array(z.string()),
    softSkills: z.array(z.string()),
  }),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  additionalInfo: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ExtractedResume = z.infer<typeof ExtractedResumeSchema>;

export const TranscriptionSchema = z.object({
  isJobPosting: z.boolean(),
  text: z.string(),
  notes: z.string(),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;
