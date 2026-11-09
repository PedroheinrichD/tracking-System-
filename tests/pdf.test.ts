import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { renderResumePdf } from "@/server/pdf/render";
import { buildResumeFileName, titleSlug } from "@/lib/pdf/filename";
import type { TailoredResume } from "@/lib/domain/resume";
import { baseResume } from "./fixtures";

function tailored(): TailoredResume {
  const resume = baseResume();
  resume.experiences[0].highlights.push(
    "Responsável pela internacionalização e acessibilidade das interfaces administrativas do sistema",
  );
  return { ...resume, sectionOrder: ["summary", "skills", "experience", "projects", "education", "certifications", "languages"] };
}

describe("geração de PDF legível por ATS", () => {
  it("gera PDF com texto extraível, acentos preservados e sem hifenização", async () => {
    const buffer = await renderResumePdf(tailored(), "Desenvolvedor Front-end");
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const flat = text.replace(/\s+/g, " ");

    expect(totalPages).toBeLessThanOrEqual(2);
    expect(flat).toContain("Pedro Henrique Souza");
    expect(flat).toContain("RESUMO PROFISSIONAL");
    expect(flat).toContain("EXPERIÊNCIA PROFISSIONAL");
    expect(flat).toContain("Ciência da Computação");
    // Palavras longas inteiras (sem "internaciona-lização")
    expect(flat).toContain("internacionalização");
    expect(flat).toContain("acessibilidade");
    // Ordem de leitura linear: cargo antes dos tópicos, experiência antes da formação
    expect(flat.indexOf("Desenvolvedor Front-end — Loja Online LTDA")).toBeLessThan(
      flat.indexOf("Desenvolvi telas do e-commerce"),
    );
    expect(flat.indexOf("EXPERIÊNCIA PROFISSIONAL")).toBeLessThan(flat.indexOf("FORMAÇÃO ACADÊMICA"));
    expect(flat).toContain("Linguagens de programação: JS, TypeScript, PHP");
  });

  it("não usa ligaduras: fi/fl continuam extraíveis como letras separadas", async () => {
    const resume = tailored();
    resume.summary = "Perfil profissional com eficiência, gráficos financeiros, certificação e código flexível.";
    const buffer = await renderResumePdf(resume, "Teste");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const flat = text.replace(/\s+/g, " ");
    for (const word of ["profissional", "eficiência", "gráficos", "financeiros", "certificação", "flexível"]) {
      expect(flat).toContain(word);
    }
  });

  it("um currículo curto cabe em uma página; um longo quebra entre seções", async () => {
    const short = tailored();
    short.projects = short.projects.slice(0, 1);
    short.certifications = short.certifications.slice(0, 1);
    const shortPdf = await getDocumentProxy(new Uint8Array(await renderResumePdf(short, "Teste")));
    expect((await extractText(shortPdf, { mergePages: true })).totalPages).toBe(1);

    const long = tailored();
    long.experiences[0].highlights.push(...Array.from({ length: 12 }, (_, i) => `Entrega relevante número ${i + 1} do projeto`));
    const longPdf = await getDocumentProxy(new Uint8Array(await renderResumePdf(long, "Teste")));
    const { totalPages, text } = await extractText(longPdf, { mergePages: false });
    expect(totalPages).toBe(2);
    // Nenhuma página termina com um título de seção sozinho.
    for (const page of text.slice(0, -1)) {
      const lastLine = page.trim().split("\n").pop() ?? "";
      expect(lastLine).not.toMatch(/^(RESUMO PROFISSIONAL|COMPETÊNCIAS|EXPERIÊNCIA PROFISSIONAL|PROJETOS|FORMAÇÃO ACADÊMICA|CURSOS E CERTIFICAÇÕES|IDIOMAS)$/);
    }
  });

  it("respeita a ordem de seções e o idioma de saída", async () => {
    const resume = { ...tailored(), language: "en", sectionOrder: ["skills", "experience"] as TailoredResume["sectionOrder"] };
    const buffer = await renderResumePdf(resume, "Frontend Developer");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toContain("SKILLS");
    expect(flat).toContain("PROFESSIONAL EXPERIENCE");
    expect(flat).not.toContain("PROFESSIONAL SUMMARY");
    expect(flat.indexOf("SKILLS")).toBeLessThan(flat.indexOf("PROFESSIONAL EXPERIENCE"));
  });
});

describe("nome do arquivo", () => {
  it("segue o padrão Nome_Curriculo_Cargo.pdf", () => {
    expect(buildResumeFileName("Pedro Henrique", "Desenvolvedor Frontend", "pt-BR")).toBe(
      "Pedro_Curriculo_Desenvolvedor_Frontend.pdf",
    );
    expect(buildResumeFileName("Pedro", "Desenvolvedor(a) Front-end Pleno", "pt-BR")).toBe(
      "Pedro_Curriculo_Desenvolvedor_Frontend_Pleno.pdf",
    );
    expect(buildResumeFileName("Ágatha Lima", "Engenheira de Software C#", "en")).toBe(
      "Agatha_Resume_Engenheira_De_Software_Csharp.pdf",
    );
    expect(titleSlug("Pessoa Desenvolvedora Back-End / Node.js")).toBe("Pessoa_Desenvolvedora_BackEnd_Node_Js");
  });
});
