#!/usr/bin/env node
"use strict";

// Lista os clientes em clients/ e informa quais precisam de atualizacao hoje.
// Antes de listar, confere se o clone local nao esta atras de origin/main —
// um clone desatualizado faria clientes pendentes parecerem atualizados.
// Uso: node scripts/list-clients.js [--json] [--no-fetch]

const fs = require("fs");
const { execFileSync } = require("child_process");

const {
  ROOT_DIR,
  CURRENT_FILE,
  isNonEmptyString,
  validateIsoTimestamp,
  readJsonFile,
  listClientSlugs,
  clientFilePath,
  loadClientConfig,
  getDatePortionInTimezone,
} = require("./lib/clients");

function runGit(args, timeoutMs) {
  return execFileSync("git", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
  }).trim();
}

// Retorna { status: "ok" | "behind" | "unknown", detalhe }.
function checkGitFreshness() {
  try {
    runGit(["rev-parse", "--is-inside-work-tree"], 5000);
  } catch (_error) {
    return { status: "unknown", detalhe: "diretorio fora de um repositorio git" };
  }

  try {
    runGit(["fetch", "--quiet", "origin", "main"], 60000);
  } catch (_error) {
    return {
      status: "unknown",
      detalhe: "nao foi possivel consultar origin/main (sem rede ou sem acesso ao remoto)",
    };
  }

  try {
    const local = runGit(["rev-parse", "HEAD"], 5000);
    const remote = runGit(["rev-parse", "origin/main"], 5000);

    if (local === remote) {
      return { status: "ok", detalhe: "clone em dia com origin/main" };
    }

    const mergeBase = runGit(["merge-base", "HEAD", "origin/main"], 5000);

    if (mergeBase === local) {
      return { status: "behind", detalhe: "o clone local esta atras de origin/main" };
    }

    return { status: "ok", detalhe: "clone com commits locais ainda nao enviados" };
  } catch (_error) {
    return { status: "unknown", detalhe: "nao foi possivel comparar HEAD com origin/main" };
  }
}

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
  const skipFetch = process.argv.includes("--no-fetch");
  const freshness = skipFetch
    ? { status: "unknown", detalhe: "verificacao de origin/main pulada (--no-fetch)" }
    : checkGitFreshness();

  if (freshness.status === "behind") {
    const aviso =
      "ATENCAO: o clone local esta atras de origin/main. Execute 'git pull origin main' e rode este script novamente — o status abaixo NAO e confiavel.";

    if (asJson) {
      console.log(JSON.stringify({ erro: aviso, git: freshness }, null, 2));
    } else {
      console.error(aviso);
    }

    process.exit(1);
  }

  if (freshness.status === "unknown" && !asJson) {
    console.warn(`Aviso: ${freshness.detalhe}; o status abaixo assume que o clone esta em dia.`);
  }

  const now = new Date();
  const slugs = listClientSlugs();

  if (slugs.length === 0) {
    if (asJson) {
      console.log(JSON.stringify({ clientes: [], precisamAtualizar: [], git: freshness }, null, 2));
      return;
    }

    console.log("Nenhum cliente encontrado em clients/.");
    return;
  }

  const statuses = slugs.map((slug) => buildClientStatus(slug, now));
  const pending = statuses.filter((status) => status.precisaAtualizar).map((s) => s.slug);

  if (asJson) {
    console.log(
      JSON.stringify({ clientes: statuses, precisamAtualizar: pending, git: freshness }, null, 2)
    );
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
