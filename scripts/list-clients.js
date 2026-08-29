#!/usr/bin/env node
"use strict";

// Lista os clientes em clients/ e informa quais precisam de atualizacao hoje.
// Uso: node scripts/list-clients.js [--json]

const fs = require("fs");

const {
  CURRENT_FILE,
  isNonEmptyString,
  validateIsoTimestamp,
  readJsonFile,
  listClientSlugs,
  clientFilePath,
  loadClientConfig,
  getDatePortionInTimezone,
} = require("./lib/clients");

function buildClientStatus(slug, now) {
  const config = loadClientConfig(slug);
  const currentPath = clientFilePath(slug, CURRENT_FILE);
  const today = getDatePortionInTimezone(now, config.timezone);

  const status = {
    slug,
    nome: isNonEmptyString(config.nome) ? config.nome : slug,
    timezone: config.timezone,
    hoje: today,
    dataBusca: null,
    totalNoticias: null,
    atualizadoHoje: false,
    precisaAtualizar: true,
    detalhe: "sem noticias.json",
  };

  if (!fs.existsSync(currentPath)) {
    return status;
  }

  let document;

  try {
    document = readJsonFile(currentPath);
  } catch (error) {
    status.detalhe = `noticias.json ilegivel (${error.message})`;
    return status;
  }

  const dataBusca = document ? document["data-busca"] : null;

  if (!isNonEmptyString(dataBusca) || !validateIsoTimestamp(dataBusca)) {
    status.detalhe = "noticias.json sem 'data-busca' valida";
    return status;
  }

  status.dataBusca = dataBusca;
  status.totalNoticias = Array.isArray(document.noticias) ? document.noticias.length : null;

  const searchDay = getDatePortionInTimezone(new Date(dataBusca), config.timezone);

  if (searchDay === today) {
    status.atualizadoHoje = true;
    status.precisaAtualizar = false;
    status.detalhe = `atualizado hoje (busca em ${dataBusca})`;
  } else {
    status.detalhe = `desatualizado (ultima busca em ${dataBusca})`;
  }

  return status;
}

function main() {
  const asJson = process.argv.includes("--json");
  const now = new Date();
  const slugs = listClientSlugs();

  if (slugs.length === 0) {
    if (asJson) {
      console.log(JSON.stringify({ clientes: [], precisamAtualizar: [] }, null, 2));
      return;
    }

    console.log("Nenhum cliente encontrado em clients/.");
    return;
  }

  const statuses = slugs.map((slug) => buildClientStatus(slug, now));
  const pending = statuses.filter((status) => status.precisaAtualizar).map((s) => s.slug);

  if (asJson) {
    console.log(JSON.stringify({ clientes: statuses, precisamAtualizar: pending }, null, 2));
    return;
  }

  statuses.forEach((status) => {
    console.log(`- ${status.slug}: ${status.detalhe}`);
  });

  if (pending.length > 0) {
    console.log(`\nClientes que precisam de atualizacao: ${pending.join(", ")}`);
  } else {
    console.log("\nTodos os clientes estao atualizados hoje.");
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
