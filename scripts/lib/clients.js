"use strict";

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const CLIENTS_DIR = path.join(ROOT_DIR, "clients");

const CONFIG_FILE = "config.json";
const CURRENT_FILE = "noticias.json";
const TEMP_FILE = "noticias-temp.json";
const ARCHIVE_DIR = "noticias-anteriores";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_VALIDATION = {
  minNoticias: 11,
  maxNoticias: 17,
  maxIdadeDias: 30,
};

const ISO_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateIsoTimestamp(value) {
  const match = ISO_TIMESTAMP_REGEX.exec(value);

  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second, millisecond, timezone] = match;
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);
  const parsedSecond = Number(second);
  const parsedMillisecond = millisecond ? Number(millisecond) : 0;

  if (timezone !== "Z") {
    const timezoneHour = Number(timezone.slice(1, 3));
    const timezoneMinute = Number(timezone.slice(4, 6));

    if (timezoneHour > 23 || timezoneMinute > 59) {
      return false;
    }
  }

  const date = new Date(
    Date.UTC(
      parsedYear,
      parsedMonth - 1,
      parsedDay,
      parsedHour,
      parsedMinute,
      parsedSecond,
      parsedMillisecond
    )
  );

  return (
    date.getUTCFullYear() === parsedYear &&
    date.getUTCMonth() === parsedMonth - 1 &&
    date.getUTCDate() === parsedDay &&
    date.getUTCHours() === parsedHour &&
    date.getUTCMinutes() === parsedMinute &&
    date.getUTCSeconds() === parsedSecond &&
    date.getUTCMilliseconds() === parsedMillisecond
  );
}

function readJsonFile(filePath) {
  let rawContent;

  try {
    rawContent = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Nao foi possivel ler o arquivo ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(rawContent);
  } catch (error) {
    throw new Error(`O arquivo ${filePath} nao contem um JSON valido: ${error.message}`);
  }
}

function listClientSlugs() {
  if (!fs.existsSync(CLIENTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(CLIENTS_DIR, entry.name, CONFIG_FILE)))
    .map((entry) => entry.name)
    .sort();
}

function clientDir(slug) {
  return path.join(CLIENTS_DIR, slug);
}

function clientFilePath(slug, fileName) {
  return path.join(clientDir(slug), fileName);
}

function assertKnownClient(slug) {
  const slugs = listClientSlugs();

  if (!slugs.includes(slug)) {
    const available = slugs.length > 0 ? slugs.join(", ") : "(nenhum)";
    throw new Error(
      `Cliente desconhecido: '${slug}'. Clientes disponiveis em clients/: ${available}.`
    );
  }
}

function loadClientConfig(slug) {
  assertKnownClient(slug);

  const config = readJsonFile(clientFilePath(slug, CONFIG_FILE));

  if (!isPlainObject(config)) {
    throw new Error(`O ${CONFIG_FILE} do cliente '${slug}' deve ser um objeto JSON.`);
  }

  const validation = isPlainObject(config.validacao) ? config.validacao : {};

  return {
    ...config,
    slug,
    idioma: isNonEmptyString(config.idioma) ? config.idioma : "pt-BR",
    timezone: isNonEmptyString(config.timezone) ? config.timezone : DEFAULT_TIMEZONE,
    validacao: {
      minNoticias: Number.isInteger(validation.minNoticias)
        ? validation.minNoticias
        : DEFAULT_VALIDATION.minNoticias,
      maxNoticias: Number.isInteger(validation.maxNoticias)
        ? validation.maxNoticias
        : DEFAULT_VALIDATION.maxNoticias,
      maxIdadeDias: Number.isInteger(validation.maxIdadeDias)
        ? validation.maxIdadeDias
        : DEFAULT_VALIDATION.maxIdadeDias,
    },
  };
}

function getDatePortionInTimezone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

module.exports = {
  ROOT_DIR,
  CLIENTS_DIR,
  CONFIG_FILE,
  CURRENT_FILE,
  TEMP_FILE,
  ARCHIVE_DIR,
  DEFAULT_TIMEZONE,
  DEFAULT_VALIDATION,
  ISO_TIMESTAMP_REGEX,
  isNonEmptyString,
  isPlainObject,
  validateIsoTimestamp,
  readJsonFile,
  listClientSlugs,
  clientDir,
  clientFilePath,
  assertKnownClient,
  loadClientConfig,
  getDatePortionInTimezone,
};
