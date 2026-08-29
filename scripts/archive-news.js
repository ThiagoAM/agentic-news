#!/usr/bin/env node
"use strict";

// Arquiva o noticias.json atual de um cliente em noticias-anteriores/ e
// promove o noticias-temp.json a arquivo atual.
//
// Uso: node scripts/archive-news.js <slug>

const fs = require("fs");
const path = require("path");

const {
  ROOT_DIR,
  CURRENT_FILE,
  TEMP_FILE,
  ARCHIVE_DIR,
  ISO_TIMESTAMP_REGEX,
  isNonEmptyString,
  isPlainObject,
  validateIsoTimestamp,
  readJsonFile,
  clientFilePath,
  loadClientConfig,
} = require("./lib/clients");

function buildArchiveFileName(dataBusca) {
  const match = ISO_TIMESTAMP_REGEX.exec(dataBusca);

  if (!match || !validateIsoTimestamp(dataBusca)) {
    throw new Error(
      "O noticias.json atual possui 'data-busca' ausente ou invalida. Corrija o arquivo antes de arquivar."
    );
  }

  const [, year, month, day, hour, minute] = match;
  return `noticias-${day}-${month}-${year}-${hour}-${minute}.json`;
}

function replaceFile(sourcePath, destinationPath) {
  try {
    fs.renameSync(sourcePath, destinationPath);
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }

    fs.rmSync(destinationPath, { force: true });
    fs.renameSync(sourcePath, destinationPath);
  }
}

function main() {
  const slug = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

  if (!slug) {
    throw new Error("Informe o cliente: node scripts/archive-news.js <slug>.");
  }

  loadClientConfig(slug);

  const tempPath = clientFilePath(slug, TEMP_FILE);
  const currentPath = clientFilePath(slug, CURRENT_FILE);
  const archiveDirPath = clientFilePath(slug, ARCHIVE_DIR);
  const relativeTemp = path.relative(ROOT_DIR, tempPath);
  const relativeCurrent = path.relative(ROOT_DIR, currentPath);

  if (!fs.existsSync(tempPath)) {
    throw new Error(
      `O arquivo temporario ${relativeTemp} nao foi encontrado. Gere-o antes de executar o arquivamento.`
    );
  }

  fs.mkdirSync(archiveDirPath, { recursive: true });

  if (!fs.existsSync(currentPath)) {
    replaceFile(tempPath, currentPath);
    console.log(
      `Arquivo ${relativeTemp} promovido para ${relativeCurrent}. Nenhum historico anterior foi encontrado.`
    );
    return;
  }

  const currentDocument = readJsonFile(currentPath);

  if (!isPlainObject(currentDocument)) {
    throw new Error("O noticias.json atual deve ser um objeto JSON valido antes do arquivamento.");
  }

  if (!isNonEmptyString(currentDocument["data-busca"])) {
    throw new Error(
      "O noticias.json atual nao possui uma propriedade 'data-busca' valida para gerar o nome do historico."
    );
  }

  const archiveFileName = buildArchiveFileName(currentDocument["data-busca"]);
  const archivePath = path.join(archiveDirPath, archiveFileName);

  fs.rmSync(archivePath, { force: true });
  fs.renameSync(currentPath, archivePath);
  replaceFile(tempPath, currentPath);

  console.log(`Arquivo anterior movido para ${path.relative(ROOT_DIR, archivePath)}.`);
  console.log(`Arquivo ${relativeTemp} promovido para ${relativeCurrent}.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
