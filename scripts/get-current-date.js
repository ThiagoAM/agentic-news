#!/usr/bin/env node
"use strict";

// Imprime a data/hora atual em ISO 8601 com offset de fuso.
// Uso: node scripts/get-current-date.js [--tz America/Sao_Paulo]

const { DEFAULT_TIMEZONE } = require("./lib/clients");

function parseTimezoneArg() {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--tz");

  if (flagIndex !== -1) {
    const value = args[flagIndex + 1];

    if (!value) {
      throw new Error("A opcao --tz exige um valor, por exemplo --tz America/Sao_Paulo.");
    }

    return value;
  }

  return DEFAULT_TIMEZONE;
}

function formatTimestampWithOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(date);

  const get = (type) => {
    const part = parts.find((item) => item.type === type);

    if (!part) {
      throw new Error(`Nao foi possivel formatar o componente '${type}' da data.`);
    }

    return part.value;
  };

  const rawOffset = get("timeZoneName");
  const offset = rawOffset === "GMT" ? "+00:00" : rawOffset.replace("GMT", "");

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset}`;
}

try {
  const timeZone = parseTimezoneArg();
  console.log(formatTimestampWithOffset(new Date(), timeZone));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
