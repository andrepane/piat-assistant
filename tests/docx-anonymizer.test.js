import test from "node:test";
import assert from "node:assert/strict";

import {
  anonymizeClinicalText,
  extractTextFromWordXml,
  validateAnonymizedText
} from "../src/docx-anonymizer.js";

test("extrae párrafos, saltos y entidades del XML de Word", () => {
  const xml = '<w:document><w:p><w:r><w:t>Niño &amp; familia</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Segundo</w:t></w:r><w:tab/><w:r><w:t>dato</w:t></w:r></w:p></w:document>';
  assert.equal(extractTextFromWordXml(xml), "Niño & familia\nSegundo\tdato");
});

test("excluye texto eliminado, campos internos y contenido oculto", () => {
  const xml = '<w:document><w:p><w:r><w:t>Visible</w:t></w:r>' +
    '<w:del><w:r><w:delText>Nombre borrado</w:delText></w:r></w:del>' +
    '<w:r><w:rPr><w:vanish/></w:rPr><w:t>Oculto</w:t></w:r>' +
    '<w:r><w:instrText>AUTHOR Andrea</w:instrText></w:r></w:p></w:document>';
  assert.equal(extractTextFromWordXml(xml), "Visible");
});

test("sustituye identificadores conocidos y patrones personales", () => {
  const result = anonymizeClinicalText(
    "Nombre: Álvaro Pérez\nÁlvaro acude con su familia.\nNH: 23-53\nContacto: familia@example.com / 612 345 678",
    { name: "Álvaro Pérez", nh: "2353" }
  );
  assert.equal(result.text.includes("Álvaro Pérez"), false);
  assert.equal(result.text.includes("Álvaro acude"), false);
  assert.equal(result.text.includes("23-53"), false);
  assert.equal(result.text.includes("familia@example.com"), false);
  assert.equal(result.text.includes("612 345 678"), false);
  assert.equal(validateAnonymizedText(result.text, { name: "Álvaro Pérez", nh: "2353" }).length, 0);
});

test("la validación impide confirmar si queda el nombre conocido", () => {
  const findings = validateAnonymizedText("Informe de Álvaro Pérez", { name: "Álvaro Pérez" });
  assert.equal(findings[0].type, "known-name");
});

test("un nombre corto se detecta como palabra y no dentro de otra palabra", () => {
  assert.equal(validateAnonymizedText("Ana juega", { name: "Ana Pérez" }).length > 0, true);
  assert.equal(validateAnonymizedText("Analizamos el caso", { name: "Ana Pérez" }).length, 0);
});
