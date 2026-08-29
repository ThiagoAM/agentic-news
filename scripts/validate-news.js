#!/usr/bin/env node
"use strict";

// Valida o arquivo de noticias de um cliente contra o contrato e as regras
// definidas em clients/<slug>/config.json.
//
// Uso:
//   node scripts/validate-news.js <slug>          valida clients/<slug>/noticias.json
//   node scripts/validate-news.js <slug> --temp   valida clients/<slug>/noticias-temp.json
//   node scripts/validate-news.js --all           valida o noticias.json de todos os clientes

const fs = require("fs");
const path = require("path");

const {
  ROOT_DIR,
  CURRENT_FILE,
  TEMP_FILE,
  isNonEmptyString,
  isPlainObject,
  validateIsoTimestamp,
  readJsonFile,
  listClientSlugs,
  clientFilePath,
  loadClientConfig,
} = require("./lib/clients");

function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function getIsoDatePortion(value) {
  return value.slice(0, 10);
}

function validateNewsDocument(document, validation) {
  const { minNoticias, maxNoticias, maxIdadeDias } = validation;
  const maxAgeInMs = maxIdadeDias * 24 * 60 * 60 * 1000;
  const errors = [];
  const warnings = [];
  let searchTimestamp = null;
  let searchDatePortion = null;

  if (!isPlainObject(document)) {
    return {
      errors: ["O JSON raiz deve ser um objeto com as propriedades 'data-busca' e 'noticias'."],
      warnings,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(document, "data-busca")) {
    errors.push("A propriedade raiz 'data-busca' e obrigatoria.");
  } else if (!isNonEmptyString(document["data-busca"])) {
    errors.push("A propriedade raiz 'data-busca' deve ser uma string nao vazia.");
  } else if (!validateIsoTimestamp(document["data-busca"])) {
    errors.push(
      "A propriedade raiz 'data-busca' deve estar no formato ISO 8601 com fuso, por exemplo 2026-03-19T14:30:00-03:00."
    );
  } else {
    searchTimestamp = new Date(document["data-busca"]);
    searchDatePortion = getIsoDatePortion(document["data-busca"]);
  }

  if (!Object.prototype.hasOwnProperty.call(document, "noticias")) {
    errors.push("A propriedade raiz 'noticias' e obrigatoria.");
    return { errors, warnings };
  }

  if (!Array.isArray(document.noticias)) {
    errors.push("A propriedade raiz 'noticias' deve ser um array.");
    return { errors, warnings };
  }

  if (document.noticias.length < minNoticias) {
    errors.push(`O array 'noticias' deve ter no minimo ${minNoticias} itens.`);
  }

  if (document.noticias.length > maxNoticias) {
    errors.push(`O array 'noticias' deve ter no maximo ${maxNoticias} itens.`);
  }

  document.noticias.forEach((item, index) => {
    const prefix = `Noticias[${index}]`;

    if (!isPlainObject(item)) {
      errors.push(`${prefix}: cada item do array deve ser um objeto.`);
      return;
    }

    const requiredFields = ["titulo", "descricao", "data_publicacao", "url", "fonte"];

    requiredFields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(item, field)) {
        errors.push(`${prefix}: a propriedade '${field}' e obrigatoria.`);
        return;
      }

      if (!isNonEmptyString(item[field])) {
        errors.push(`${prefix}: a propriedade '${field}' deve ser uma string nao vazia.`);
      }
    });

    if (
      Object.prototype.hasOwnProperty.call(item, "data_publicacao") &&
      isNonEmptyString(item.data_publicacao) &&
      !validateIsoTimestamp(item.data_publicacao)
    ) {
      errors.push(
        `${prefix}: a propriedade 'data_publicacao' deve estar no formato ISO 8601 com fuso, por exemplo 2026-03-19T09:00:00-03:00.`
      );
    } else if (
      searchTimestamp &&
      Object.prototype.hasOwnProperty.call(item, "data_publicacao") &&
      isNonEmptyString(item.data_publicacao)
    ) {
      const publicationTimestamp = new Date(item.data_publicacao);
      const ageInMs = searchTimestamp.getTime() - publicationTimestamp.getTime();
      const publicationDatePortion = getIsoDatePortion(item.data_publicacao);

      if (ageInMs > maxAgeInMs) {
        errors.push(
          `${prefix}: a noticia foi publicada ha mais de ${maxIdadeDias} dias em relacao a 'data-busca' (${document["data-busca"]}).`
        );
      } else if (publicationDatePortion !== searchDatePortion) {
        warnings.push(
          `${prefix}: a noticia tem data ${publicationDatePortion}; a prioridade sao noticias com a data ${searchDatePortion}.`
        );
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(item, "url") &&
      isNonEmptyString(item.url) &&
      !validateUrl(item.url)
    ) {
      errors.push(`${prefix}: a propriedade 'url' deve ser uma URL absoluta com http ou https.`);
    }
  });

  return { errors, warnings };
}

function validateClientFile(slug, fileName) {
  const config = loadClientConfig(slug);
  const filePath = clientFilePath(slug, fileName);
  const relativePath = path.relative(ROOT_DIR, filePath);

  if (!fs.existsSync(filePath)) {
    console.error(`Validacao falhou para ${relativePath}: arquivo nao encontrado.`);
    return false;
  }

  let document;

  try {
    document = readJsonFile(filePath);
  } catch (error) {
    console.error(`Validacao falhou para ${relativePath}: ${error.message}`);
    return false;
  }

  const { errors, warnings } = validateNewsDocument(document, config.validacao);

  if (errors.length > 0) {
    console.error(`Validacao falhou para ${relativePath}:`);
    errors.forEach((error) => console.error(`- ${error}`));
    warnings.forEach((warning) => console.error(`- Aviso: ${warning}`));
    return false;
  }

  warnings.forEach((warning) => console.warn(`Aviso (${slug}): ${warning}`));
  console.log(
    `Validacao concluida com sucesso para ${relativePath}. O arquivo contem ${document.noticias.length} noticia(s) valida(s).`
  );
  return true;
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    const slugs = listClientSlugs();

    if (slugs.length === 0) {
      throw new Error("Nenhum cliente encontrado em clients/.");
    }

    const failures = slugs.filter((slug) => !validateClientFile(slug, CURRENT_FILE));

    if (failures.length > 0) {
      console.error(`\nClientes com validacao reprovada: ${failures.join(", ")}`);
      process.exit(1);
    }

    console.log(`\nTodos os ${slugs.length} cliente(s) passaram na validacao.`);
    return;
  }

  const slug = args.find((arg) => !arg.startsWith("--"));

  if (!slug) {
    throw new Error(
      "Informe o cliente: node scripts/validate-news.js <slug> [--temp], ou use --all para validar todos."
    );
  }

  const fileName = args.includes("--temp") ? TEMP_FILE : CURRENT_FILE;

  if (!validateClientFile(slug, fileName)) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
